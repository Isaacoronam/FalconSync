import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminLocationPayload } from '../../../core/models/admin.model';
import {
  ConservationStatus,
  LocationCategory,
  LocationCircuit,
  LocationStatus,
  LocationTag,
  LocationVerificationLevel,
} from '../../../core/models/location.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import {
  CONSERVATION_LABELS,
  LOCATION_CATEGORY_LABELS,
  LOCATION_CIRCUIT_CHOICES,
  LOCATION_STATUS_LABELS,
  LOCATION_TAG_CHOICES,
  LOCATION_VERIFICATION_CHOICES,
} from '../../../core/utils/location-labels';
import { LocationPickerComponent, PickerCoordinates } from './location-picker.component';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-admin-poi-form',
  imports: [ReactiveFormsModule, RouterLink, LocationPickerComponent],
  templateUrl: './admin-poi-form.component.html',
  styleUrl: './admin-poi-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPoiFormComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly categories = Object.entries(LOCATION_CATEGORY_LABELS) as Array<
    [LocationCategory, string]
  >;
  protected readonly conservationStatuses = Object.entries(CONSERVATION_LABELS) as Array<
    [ConservationStatus, string]
  >;
  protected readonly statuses = (['draft', 'published'] as LocationStatus[]).map((value) => ({
    value,
    label: LOCATION_STATUS_LABELS[value],
  }));
  protected readonly circuits = LOCATION_CIRCUIT_CHOICES;
  protected readonly tags = LOCATION_TAG_CHOICES;
  protected readonly verificationLevels = LOCATION_VERIFICATION_CHOICES;

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    slug: [
      '',
      [
        Validators.maxLength(100),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    category: ['architecture', [Validators.required]],
    description: [
      '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(5000)],
    ],
    address: ['', [Validators.maxLength(240)]],
    historicalPeriod: ['', [Validators.maxLength(120)]],
    historicalStory: ['', [Validators.maxLength(10000)]],
    interestingFactsText: ['', [Validators.maxLength(2300)]],
    visitorInfo: ['', [Validators.maxLength(2000)]],
    contentSourcesText: ['', [Validators.maxLength(5000)]],
    conservationStatus: ['unknown', [Validators.required]],
    status: ['draft', [Validators.required]],
    sourceUrl: ['', [Validators.pattern(/^https?:\/\/[^\s]+$/i)]],
    coordinateSource: ['', [Validators.maxLength(500)]],
    coordinateVerifiedAt: [''],
    verificationLevel: ['unverified' as LocationVerificationLevel],
    audioGuideUrl: ['', [Validators.pattern(/^https?:\/\/[^\s]+$/i)]],
    isProvisional: [false],
    isCatalogVisible: [true],
    latitude: [11.4078, [Validators.required, Validators.min(10.3), Validators.max(12.19)]],
    longitude: [-69.6785, [Validators.required, Validators.min(-71.35), Validators.max(-68.18)]],
  });

  protected readonly editingId = signal<string | null>(null);
  protected readonly locationTitle = signal('');
  protected readonly images = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploadingImage = signal(false);
  protected readonly removingImageUrl = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly imageError = signal<string | null>(null);
  protected readonly selectedCircuits = signal<LocationCircuit[]>([]);
  protected readonly selectedTags = signal<LocationTag[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const justCreated = this.route.snapshot.queryParamMap.get('creado') === '1';

    if (justCreated) {
      this.success.set('POI creado. Ya puedes añadir imágenes y publicarlo cuando esté listo.');
    }

    if (!id) {
      return;
    }

    this.editingId.set(id);
    this.loadLocation(id);
  }

  protected isEditing(): boolean {
    return this.editingId() !== null;
  }

  protected loadLocation(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminApi
      .getLocation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          const [longitude, latitude] = data.location.coordinates;

          this.form.patchValue({
            title: data.title,
            slug: data.slug,
            category: data.category,
            description: data.description,
            address: data.address ?? '',
            historicalPeriod: data.historicalPeriod ?? '',
            historicalStory: data.historicalStory ?? '',
            interestingFactsText: (data.interestingFacts ?? []).join('\n'),
            visitorInfo: data.visitorInfo ?? '',
            contentSourcesText: (data.contentSources ?? []).join('\n'),
            conservationStatus: data.conservationStatus,
            status: data.status === 'archived' ? 'draft' : data.status,
            sourceUrl: data.sourceUrl ?? '',
            coordinateSource: data.coordinateSource ?? '',
            coordinateVerifiedAt: data.coordinateVerifiedAt
              ? data.coordinateVerifiedAt.slice(0, 10)
              : '',
            verificationLevel: data.verificationLevel ?? 'unverified',
            audioGuideUrl: data.audioGuideUrl ?? '',
            isProvisional: data.isProvisional,
            isCatalogVisible: data.isCatalogVisible !== false,
            latitude,
            longitude,
          });

          this.selectedCircuits.set([...(data.circuits ?? [])]);
          this.selectedTags.set([...(data.tags ?? [])]);
          this.locationTitle.set(data.title);
          this.images.set(data.images);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo cargar el punto de interés.'));
          this.loading.set(false);
        },
      });
  }

  protected updateCoordinates(coordinates: PickerCoordinates): void {
    this.form.patchValue({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    this.form.controls.latitude.markAsTouched();
    this.form.controls.longitude.markAsTouched();
  }

  protected toggleCircuit(circuit: LocationCircuit, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.selectedCircuits.update((values) =>
      checked ? [...values, circuit] : values.filter((value) => value !== circuit),
    );
  }

  protected toggleTag(tag: LocationTag, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.selectedTags.update((values) =>
      checked ? [...values, tag] : values.filter((value) => value !== tag),
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de guardar.');
      return;
    }

    const values = this.form.getRawValue();
    const coordinateVerifiedAt = values.coordinateVerifiedAt.trim();

    if (values.status === 'published' && values.isProvisional) {
      this.error.set(
        'No puedes publicar un POI provisional. Verifica la ubicación y desmarca la casilla.',
      );
      return;
    }

    if (values.status === 'published' && !coordinateVerifiedAt) {
      this.error.set(
        'No puedes publicar sin fecha de verificación de coordenadas.',
      );
      return;
    }

    const payload: AdminLocationPayload = {
      title: values.title.trim(),
      category: values.category as LocationCategory,
      description: values.description.trim(),
      address: values.address.trim() || undefined,
      circuits: this.selectedCircuits(),
      tags: this.selectedTags(),
      historicalPeriod: values.historicalPeriod.trim() || undefined,
      historicalStory: values.historicalStory.trim() || undefined,
      interestingFacts: values.interestingFactsText
        .split(/\r?\n/)
        .map((fact) => fact.trim())
        .filter(Boolean),
      visitorInfo: values.visitorInfo.trim() || undefined,
      contentSources: values.contentSourcesText
        .split(/\r?\n/)
        .map((source) => source.trim())
        .filter(Boolean),
      conservationStatus: values.conservationStatus as ConservationStatus,
      status: values.status as Exclude<LocationStatus, 'archived'>,
      sourceUrl: values.sourceUrl.trim() || undefined,
      coordinateSource: values.coordinateSource.trim() || undefined,
      coordinateVerifiedAt: coordinateVerifiedAt || null,
      verificationLevel: values.verificationLevel as LocationVerificationLevel,
      audioGuideUrl: values.audioGuideUrl.trim() || undefined,
      isProvisional: values.isProvisional,
      isCatalogVisible: values.isCatalogVisible,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };
    const slug = values.slug.trim().toLowerCase();

    if (slug) {
      payload.slug = slug;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const id = this.editingId();

    if (id) {
      this.adminApi
        .updateLocation(id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ data }) => {
            this.saving.set(false);
            this.success.set('Cambios guardados.');
            this.locationTitle.set(data.title);
            this.images.set(data.images);
            this.form.patchValue({ slug: data.slug });
          },
          error: (error: unknown) => {
            this.saving.set(false);
            this.error.set(apiErrorMessage(error, 'No se pudieron guardar los cambios.'));
          },
        });

      return;
    }

    this.adminApi
      .createLocation(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.saving.set(false);
          void this.router.navigate(['/admin/poi', data.id, 'editar'], {
            queryParams: { creado: '1' },
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo crear el punto de interés.'));
        },
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const id = this.editingId();

    if (!id) {
      this.imageError.set('Guarda el POI antes de añadir imágenes.');
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      this.imageError.set('Solo se admiten imágenes JPEG, PNG o WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('La imagen no puede superar 5 MB.');
      return;
    }

    this.uploadingImage.set(true);
    this.imageError.set(null);

    this.adminApi
      .uploadLocationImage(id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.images.set(data.images);
          this.uploadingImage.set(false);
        },
        error: (error: unknown) => {
          this.imageError.set(apiErrorMessage(error, 'No se pudo subir la imagen.'));
          this.uploadingImage.set(false);
        },
      });
  }

  protected removeImage(url: string): void {
    const id = this.editingId();

    if (!id) {
      return;
    }

    this.removingImageUrl.set(url);
    this.imageError.set(null);

    this.adminApi
      .removeLocationImage(id, url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.images.set(data.images);
          this.removingImageUrl.set(null);
        },
        error: (error: unknown) => {
          this.imageError.set(apiErrorMessage(error, 'No se pudo quitar la imagen.'));
          this.removingImageUrl.set(null);
        },
      });
  }

  protected hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  protected titleError(): string | null {
    return this.controlError('title');
  }

  protected slugError(): string | null {
    return this.controlError('slug', 'El slug solo admite minúsculas, números y guiones.');
  }

  protected descriptionError(): string | null {
    return this.controlError('description');
  }

  protected urlError(controlName: 'sourceUrl' | 'audioGuideUrl'): string | null {
    return this.controlError(controlName, 'Debe ser una URL que empiece por http:// o https://.');
  }

  protected coordinateError(controlName: 'latitude' | 'longitude'): string | null {
    return this.controlError(
      controlName,
      controlName === 'latitude'
        ? 'La latitud debe estar entre 10.3 y 12.19 (Falcón).'
        : 'La longitud debe estar entre -71.35 y -68.18 (Falcón).',
    );
  }

  private controlError(controlName: string, patternMessage?: string): string | null {
    const control = this.form.get(controlName);

    if (!control || !control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('minlength')) {
      return `Debe tener al menos ${control.getError('minlength').requiredLength} caracteres.`;
    }

    if (control.hasError('maxlength')) {
      return `No puede superar ${control.getError('maxlength').requiredLength} caracteres.`;
    }

    if (control.hasError('pattern')) {
      return patternMessage ?? 'El formato no es válido.';
    }

    if (control.hasError('min') || control.hasError('max')) {
      return patternMessage ?? 'El valor está fuera del rango permitido.';
    }

    return 'El valor no es válido.';
  }
}
