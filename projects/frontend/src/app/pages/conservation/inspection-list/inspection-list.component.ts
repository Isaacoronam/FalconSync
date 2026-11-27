import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import {
  HERITAGE_ASSET_TYPES,
  HeritageAsset,
  HeritageAssetType,
  INSPECTION_STATES,
  INSPECTION_TYPES,
  Inspection,
  InspectionState,
  InspectionType,
  InspectorOption,
  Report,
} from '../../../models/conservation.model';
import { FalconLocation } from '../../../models/location.model';
import { AuthService } from '../../../services/auth.service';
import { ConservationApiService } from '../../../services/conservation-api.service';
import { LocationApiService } from '../../../services/location-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  ASSET_TYPE_LABELS,
  INSPECTION_STATE_LABELS,
  INSPECTION_TYPE_LABELS,
  REPORT_STATE_LABELS,
  shortId,
} from '../../../services/utils/conservation-labels';

@Component({
  selector: 'app-inspection-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, PageSkeletonComponent],
  templateUrl: './inspection-list.component.html',
  styleUrl: './inspection-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionListComponent implements OnInit {
  private readonly conservationApi = inject(ConservationApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthService);
  protected readonly assetTypes = HERITAGE_ASSET_TYPES;
  protected readonly assetTypeLabels = ASSET_TYPE_LABELS;
  protected readonly inspectionTypes = INSPECTION_TYPES;
  protected readonly inspectionTypeLabels = INSPECTION_TYPE_LABELS;
  protected readonly inspectionStates = INSPECTION_STATES;
  protected readonly inspectionStateLabels = INSPECTION_STATE_LABELS;
  protected readonly reportStateLabels = REPORT_STATE_LABELS;
  protected readonly shortId = shortId;

  protected readonly inspections = signal<Inspection[]>([]);
  protected readonly queueReports = signal<Report[]>([]);
  protected readonly queueTotal = signal(0);
  protected readonly assets = signal<HeritageAsset[]>([]);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly inspectors = signal<InspectorOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly queueLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly queueError = signal<string | null>(null);
  protected readonly assetError = signal<string | null>(null);
  protected readonly assetNotice = signal<string | null>(null);
  protected readonly inspectionError = signal<string | null>(null);
  protected readonly busy = signal<'asset' | 'inspection' | null>(null);
  protected readonly filterState = signal<'' | InspectionState>('');

  protected readonly assetForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['building' as HeritageAssetType],
    locationId: [''],
    latitude: [''],
    longitude: [''],
    address: ['', [Validators.maxLength(240)]],
    description: ['', [Validators.maxLength(5000)]],
  });

  protected readonly inspectionForm = this.formBuilder.group({
    assetId: [''],
    inspectorId: [''],
    reviewerId: [''],
    type: ['routine' as InspectionType],
    scope: ['', [Validators.required, Validators.maxLength(4000)]],
    scheduledAt: [''],
  });

  protected reviewers(): InspectorOption[] {
    return this.inspectors().filter(
      (inspector) => inspector.id !== this.inspectionForm.controls.inspectorId.value,
    );
  }

  ngOnInit(): void {
    this.loadOptions();
    this.loadInspections();

    if (this.auth.canTriageReports()) {
      this.loadQueue();
    }
  }

  protected loadInspections(): void {
    this.loading.set(true);
    this.error.set(null);

    this.conservationApi
      .listInspections(this.filterState() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.inspections.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.inspections.set([]);
          this.error.set(apiErrorMessage(error, 'No se pudieron cargar las inspecciones.'));
          this.loading.set(false);
        },
      });
  }

  protected changeFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as '' | InspectionState;
    this.filterState.set(value);
    this.loadInspections();
  }

  protected loadQueue(): void {
    this.queueLoading.set(true);
    this.queueError.set(null);

    this.conservationApi
      .listReportQueue()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.queueReports.set(response.data);
          this.queueTotal.set(response.meta.total);
          this.queueLoading.set(false);
        },
        error: (error: unknown) => {
          this.queueReports.set([]);
          this.queueError.set(apiErrorMessage(error, 'No se pudo cargar la cola de triaje.'));
          this.queueLoading.set(false);
        },
      });
  }

  protected createAsset(): void {
    const values = this.assetForm.getRawValue();
    const latitude = values.latitude ? Number(values.latitude) : NaN;
    const longitude = values.longitude ? Number(values.longitude) : NaN;

    this.assetError.set(null);
    this.assetNotice.set(null);

    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      this.assetError.set(
        'Completa código, nombre y un código de 3 a 40 caracteres alfanuméricos o guiones.',
      );
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.assetError.set(
        'Indica latitud y longitud, o selecciona un punto de interés con coordenadas.',
      );
      return;
    }

    this.busy.set('asset');

    this.conservationApi
      .createAsset({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        type: values.type,
        status: 'active',
        locationId: values.locationId || undefined,
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        address: values.address.trim() || undefined,
        description: values.description.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          this.assetNotice.set(`Activo ${response.data.name} (${response.data.code}) registrado.`);
          this.assetForm.reset({
            code: '',
            name: '',
            type: 'building',
            locationId: '',
            latitude: '',
            longitude: '',
            address: '',
            description: '',
          });
          this.assets.update((current) => [...current, response.data]);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.assetError.set(apiErrorMessage(error, 'No se pudo registrar el activo.'));
        },
      });
  }

  protected useLocationCoordinates(): void {
    const locationId = this.assetForm.controls.locationId.value;
    const location = this.locations().find((item) => item.id === locationId);

    if (!location) {
      return;
    }

    this.assetForm.patchValue({
      latitude: String(location.location.coordinates[1]),
      longitude: String(location.location.coordinates[0]),
      address: location.address ?? this.assetForm.controls.address.value,
    });
  }

  protected createInspection(): void {
    const values = this.inspectionForm.getRawValue();
    this.inspectionError.set(null);

    if (!values.assetId) {
      this.inspectionError.set('Selecciona el activo que se inspeccionará.');
      return;
    }

    if (!values.reviewerId) {
      this.inspectionError.set('Selecciona un revisor distinto del inspector.');
      return;
    }

    if (values.reviewerId === values.inspectorId) {
      this.inspectionError.set('El revisor debe ser una persona distinta del inspector.');
      return;
    }

    if (!values.scope.trim()) {
      this.inspectionError.set('Describe el alcance de la inspección.');
      return;
    }

    this.busy.set('inspection');

    this.conservationApi
      .createInspection({
        assetId: values.assetId,
        inspectorId: values.inspectorId || undefined,
        reviewerId: values.reviewerId,
        type: values.type,
        scope: values.scope.trim(),
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          void this.router.navigate(['/inspecciones', response.data.id]);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.inspectionError.set(apiErrorMessage(error, 'No se pudo crear la inspección.'));
        },
      });
  }

  protected stateClass(state: string): string {
    return `conservation-badge conservation-badge--${state}`;
  }

  protected assetName(id: string): string {
    return this.assets().find((asset) => asset.id === id)?.name ?? `Activo ${shortId(id)}`;
  }

  protected inspectorName(id: string | null | undefined): string {
    return this.inspectors().find((inspector) => inspector.id === id)?.name ?? shortId(id);
  }

  protected reportTarget(report: Report): string {
    if (report.heritageAssetId) {
      return this.assetName(report.heritageAssetId);
    }

    return (
      this.locations().find((location) => location.id === report.locationId)?.title ??
      `POI ${shortId(report.locationId)}`
    );
  }

  private loadOptions(): void {
    this.conservationApi
      .listAssets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.assets.set(response.data),
        error: () => this.assets.set([]),
      });

    this.locationApi
      .list({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.locations.set(response.data),
        error: () => this.locations.set([]),
      });

    this.conservationApi
      .listInspectors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.inspectors.set(response.data);
          this.inspectionForm.patchValue({
            inspectorId: this.auth.currentUser()?.id ?? '',
          });
        },
        error: () => this.inspectors.set([]),
      });
  }
}
