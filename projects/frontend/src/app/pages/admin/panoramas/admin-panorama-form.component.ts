import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import { AdminLocation } from '../../../models/admin.model';
import {
  AdminPanoramaDetail,
  AdminPanoramaSummary,
  HOTSPOT_TYPES,
  HotspotType,
  PanoramaHotspotPayload,
  PanoramaUpdatePayload,
  PanoramaVisibility,
} from '../../../models/panorama.model';
import { AdminApiService } from '../../../services/admin-api.service';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { HOTSPOT_TYPE_LABELS } from '../../../services/utils/panorama-labels';

const MAX_PANORAMA_BYTES = 40 * 1024 * 1024;
const ALLOWED_PANORAMA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface HotspotDraft {
  hotspotId: string | null;
  label: string;
  type: HotspotType;
  yaw: number;
  pitch: number;
  ariaLabel: string;
  targetPanoramaId: string | null;
  targetLocationId: string | null;
  targetUrl: string | null;
}

@Component({
  selector: 'app-admin-panorama-form',
  imports: [ReactiveFormsModule, RouterLink, PageSkeletonComponent],
  templateUrl: './admin-panorama-form.component.html',
  styleUrl: './admin-panorama-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanoramaFormComponent implements OnInit {
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hotspotTypes = HOTSPOT_TYPES.map((value) => ({
    value,
    label: HOTSPOT_TYPE_LABELS[value],
  }));
  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(2000)]],
    locationId: ['', [Validators.required]],
    visibility: ['public' as PanoramaVisibility, [Validators.required]],
    capturedAt: [''],
    author: ['', [Validators.required, Validators.maxLength(160)]],
    license: ['', [Validators.required, Validators.maxLength(200)]],
    licenseUrl: ['', [Validators.pattern(/^https?:\/\/[^\s]+$/i)]],
    credit: ['', [Validators.required, Validators.maxLength(300)]],
    rightsDocumented: [false],
    permitDocumented: [false],
    rightsNotes: ['', [Validators.maxLength(500)]],
    peopleBlurred: [false],
    consentDocumented: [false],
    consentNotes: ['', [Validators.maxLength(500)]],
    fallbackAlt: ['', [Validators.maxLength(200)]],
    fallbackDescription: ['', [Validators.maxLength(2000)]],
    transcript: ['', [Validators.maxLength(10000)]],
  });

  protected readonly panoramaId = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly hotspotDrafts = signal<HotspotDraft[]>([]);
  protected readonly sceneTargets = signal<AdminPanoramaSummary[]>([]);
  protected readonly locationTargets = signal<AdminLocation[]>([]);
  protected readonly targetsError = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTargets();

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.panoramaId.set(id);
      this.loadPanorama(id);
      return;
    }

    this.form.patchValue({ visibility: 'public' });
  }

  protected isEditing(): boolean {
    return this.panoramaId() !== null;
  }

  protected addHotspot(): void {
    this.hotspotDrafts.update((drafts) => [
      ...drafts,
      {
        hotspotId: null,
        label: '',
        type: 'info',
        yaw: 0,
        pitch: 0,
        ariaLabel: '',
        targetPanoramaId: null,
        targetLocationId: null,
        targetUrl: '',
      },
    ]);
  }

  protected removeHotspot(index: number): void {
    this.hotspotDrafts.update((drafts) => drafts.filter((_draft, position) => position !== index));
  }

  protected updateHotspotText(
    index: number,
    field: 'label' | 'ariaLabel' | 'targetUrl',
    value: string,
  ): void {
    this.patchHotspot(index, { [field]: value });
  }

  protected updateHotspotNumber(
    index: number,
    field: 'yaw' | 'pitch',
    value: string,
  ): void {
    const number = Number(value);

    if (Number.isFinite(number)) {
      this.patchHotspot(index, { [field]: number });
    }
  }

  protected updateHotspotType(index: number, value: string): void {
    if (!HOTSPOT_TYPES.includes(value as HotspotType)) {
      return;
    }

    this.patchHotspot(index, {
      type: value as HotspotType,
      targetPanoramaId: null,
      targetLocationId: null,
      targetUrl: value === 'info' ? '' : null,
    });
  }

  protected updateHotspotTarget(
    index: number,
    field: 'targetPanoramaId' | 'targetLocationId',
    value: string,
  ): void {
    this.patchHotspot(index, { [field]: value || null });
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.fileError.set(null);

    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    if (!ALLOWED_PANORAMA_TYPES.has(file.type)) {
      this.fileError.set('La imagen debe ser JPEG, PNG o WebP.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    if (file.size > MAX_PANORAMA_BYTES) {
      this.fileError.set('La imagen supera el límite de 40 MB.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios y los enlaces antes de guardar.');
      return;
    }

    const file = this.selectedFile();

    if (!this.isEditing() && !file) {
      this.fileError.set('Adjunta la imagen equirectangular de la panorámica.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.isEditing()) {
      const id = this.panoramaId();
      const version = this.version();

      if (!id || version === null) {
        this.saving.set(false);
        this.error.set('No se pudo determinar la versión del panorama.');
        return;
      }

      this.panoramaApi
        .update(id, version, this.buildUpdatePayload())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ data }) => {
            this.applyDetail(data);
            this.saving.set(false);
            this.success.set('Cambios guardados. La versión del panorama se actualizó.');
          },
          error: (error: unknown) => {
            this.saving.set(false);
            this.error.set(
              apiErrorMessage(error, 'No se pudieron guardar los cambios del panorama.'),
            );
          },
        });
      return;
    }

    this.panoramaApi
      .create(this.buildCreatePayload(), file as File)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.saving.set(false);
          void this.router.navigate(['/admin/panoramas', data.id], {
            queryParams: {
              aviso:
                'Panorama creado como borrador. Revisa derechos, accesibilidad y hotspots antes de solicitar la aprobación.',
            },
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            apiErrorMessage(
              error,
              'No se pudo crear el panorama. Verifica que la imagen sea equirectangular 2:1 y que la ficha esté completa.',
            ),
          );
        },
      });
  }

  private loadPanorama(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.panoramaApi
      .getAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.applyDetail(data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo cargar el panorama.'));
          this.loading.set(false);
        },
      });
  }

  private applyDetail(data: AdminPanoramaDetail): void {
    this.panoramaId.set(data.id);
    this.version.set(data.version);
    this.form.patchValue({
      title: data.title,
      description: data.description,
      locationId: data.locationId ?? '',
      visibility: data.visibility,
      capturedAt: data.capturedAt ? data.capturedAt.slice(0, 10) : '',
      author: data.author,
      license: data.license,
      licenseUrl: data.licenseUrl ?? '',
      credit: data.credit,
      rightsDocumented: data.rightsDocumented,
      permitDocumented: data.permitDocumented,
      rightsNotes: data.rightsNotes ?? '',
      peopleBlurred: data.peopleBlurred,
      consentDocumented: data.consentDocumented,
      consentNotes: data.consentNotes ?? '',
      fallbackAlt: data.fallbackAlt,
      fallbackDescription: data.fallbackDescription,
      transcript: data.transcript ?? '',
    });
    this.hotspotDrafts.set(
      data.hotspots.map((hotspot) => ({
        hotspotId: hotspot.hotspotId,
        label: hotspot.label,
        type: hotspot.type,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        ariaLabel: hotspot.ariaLabel,
        targetPanoramaId: hotspot.targetPanoramaId,
        targetLocationId: hotspot.targetLocationId,
        targetUrl: hotspot.targetUrl,
      })),
    );
  }

  private loadTargets(): void {
    this.panoramaApi
      .listAdmin({ status: 'published', visibility: 'public', limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => this.sceneTargets.set(data),
        error: () =>
          this.targetsError.set(
            'No se pudieron cargar las escenas publicadas para los hotspots de escena.',
          ),
      });

    this.adminApi
      .listLocations({ status: 'published', limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => this.locationTargets.set(data),
        error: () =>
          this.targetsError.set(
            'No se pudieron cargar los POI publicados para los hotspots de lugar.',
          ),
      });
  }

  private patchHotspot(index: number, patch: Partial<HotspotDraft>): void {
    this.hotspotDrafts.update((drafts) =>
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  private buildHotspots(): PanoramaHotspotPayload[] {
    return this.hotspotDrafts().map((hotspot) => ({
      ...(hotspot.hotspotId ? { hotspotId: hotspot.hotspotId } : {}),
      label: hotspot.label.trim(),
      type: hotspot.type,
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
      ariaLabel: hotspot.ariaLabel.trim() || hotspot.label.trim(),
      targetPanoramaId:
        hotspot.type === 'scene' ? hotspot.targetPanoramaId : null,
      targetLocationId:
        hotspot.type === 'location' ? hotspot.targetLocationId : null,
      targetUrl: hotspot.type === 'info' ? hotspot.targetUrl : null,
    }));
  }

  private buildCommonFields() {
    const raw = this.form.getRawValue();
    const title = raw.title.trim();

    return {
      title,
      description: raw.description.trim(),
      locationId: raw.locationId,
      visibility: raw.visibility,
      capturedAt: raw.capturedAt || null,
      author: raw.author.trim(),
      license: raw.license.trim(),
      licenseUrl: raw.licenseUrl.trim() || null,
      credit: raw.credit.trim(),
      rightsDocumented: raw.rightsDocumented,
      permitDocumented: raw.permitDocumented,
      rightsNotes: raw.rightsNotes.trim() || null,
      peopleBlurred: raw.peopleBlurred,
      consentDocumented: raw.consentDocumented,
      consentNotes: raw.consentNotes.trim() || null,
      fallbackAlt: raw.fallbackAlt.trim() || `Vista panorámica de ${title}`,
      fallbackDescription:
        raw.fallbackDescription.trim() || raw.description.trim(),
      transcript: raw.transcript.trim() || null,
      hotspots: this.buildHotspots(),
    };
  }

  private buildCreatePayload() {
    return this.buildCommonFields();
  }

  private buildUpdatePayload(): PanoramaUpdatePayload {
    return this.buildCommonFields();
  }
}
