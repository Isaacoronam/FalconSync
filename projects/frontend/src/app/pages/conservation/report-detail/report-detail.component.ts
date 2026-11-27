import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ConservationHistoryEvent,
  HeritageAsset,
  INSPECTION_TYPES,
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
  DAMAGE_CATEGORY_LABELS,
  INSPECTION_TYPE_LABELS,
  REPORT_STATE_LABELS,
  eventLabel,
  shortId,
} from '../../../services/utils/conservation-labels';
import { EvidencePanelComponent } from '../../../components/conservation/evidence-panel/evidence-panel.component';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';

@Component({
  selector: 'app-report-detail',
  imports: [
    DatePipe,
    EvidencePanelComponent,
    ReactiveFormsModule,
    RouterLink,
    PageSkeletonComponent,
  ],
  templateUrl: './report-detail.component.html',
  styleUrl: './report-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly conservationApi = inject(ConservationApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly auth = inject(AuthService);
  protected readonly categoryLabels = DAMAGE_CATEGORY_LABELS;
  protected readonly stateLabels = REPORT_STATE_LABELS;
  protected readonly inspectionTypeLabels = INSPECTION_TYPE_LABELS;
  protected readonly inspectionTypes = INSPECTION_TYPES;
  protected readonly eventLabel = eventLabel;
  protected readonly shortId = shortId;

  protected readonly report = signal<Report | null>(null);
  protected readonly assets = signal<HeritageAsset[]>([]);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly inspectors = signal<InspectorOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly refreshing = signal(false);

  protected readonly triageForm = this.formBuilder.group({
    decision: [''],
    reason: [''],
    notes: [''],
  });

  protected readonly convertForm = this.formBuilder.group({
    assetId: [''],
    inspectorId: [''],
    reviewerId: [''],
    type: ['follow_up' as InspectionType],
    scope: ['', [Validators.required, Validators.maxLength(4000)]],
    scheduledAt: [''],
  });

  protected readonly targetName = computed(() => {
    const report = this.report();
    if (!report) {
      return '';
    }

    if (report.heritageAssetId) {
      return (
        this.assets().find((asset) => asset.id === report.heritageAssetId)?.name ??
        `Activo ${shortId(report.heritageAssetId)}`
      );
    }

    return (
      this.locations().find((location) => location.id === report.locationId)?.title ??
      `POI ${shortId(report.locationId)}`
    );
  });

  protected readonly matchingAssets = computed(() => {
    const report = this.report();
    if (!report?.locationId) {
      return this.assets();
    }

    return this.assets().filter(
      (asset) => !asset.locationId || asset.locationId === report.locationId,
    );
  });

  protected readonly canTriage = computed(() => {
    const report = this.report();
    return Boolean(
      report &&
      this.auth.canTriageReports() &&
      report.reporterId !== this.auth.currentUser()?.id &&
      ['received', 'triaged', 'accepted'].includes(report.state),
    );
  });

  protected readonly canConvert = computed(() => this.report()?.state === 'accepted');

  protected readonly actionLocked = computed(() => this.refreshing() || this.busy() !== null);

  protected readonly canUploadEvidence = computed(() => {
    const report = this.report();
    return Boolean(
      report &&
      this.auth.canUploadEvidence() &&
      report.reporterId === this.auth.currentUser()?.id &&
      !['rejected', 'closed'].includes(report.state),
    );
  });

  protected readonly history = computed<ConservationHistoryEvent[]>(() =>
    [...(this.report()?.history ?? [])].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    ),
  );

  ngOnInit(): void {
    this.load();
    this.loadOptions();
  }

  protected load(silent = false): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se indicó el reporte.');
      this.loading.set(false);
      return;
    }

    if (!silent) {
      this.loading.set(true);
      this.refreshing.set(false);
    } else {
      this.refreshing.set(true);
    }
    this.error.set(null);

    this.conservationApi
      .getReport(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.report.set(response.data);
          if (!silent) {
            this.convertForm.patchValue({
              assetId: response.data.heritageAssetId ?? '',
              inspectorId: this.auth.currentUser()?.id ?? '',
            });
          }
          this.loading.set(false);
          this.refreshing.set(false);
        },
        error: (error: unknown) => {
          const message = apiErrorMessage(error, 'No se pudo cargar el reporte.');
          if (silent) {
            this.actionError.set(message);
          } else {
            this.error.set(message);
            this.loading.set(false);
          }
          this.refreshing.set(false);
        },
      });
  }

  protected markTriaged(): void {
    const report = this.report();
    if (!report) {
      return;
    }

    this.submitTriage(report, { notes: this.triageForm.controls.notes.value.trim() });
  }

  protected submitTriageDecision(): void {
    const report = this.report();
    if (!report) {
      return;
    }

    const values = this.triageForm.getRawValue();
    const decision = values.decision as '' | 'accept' | 'reject' | 'close';

    if (!decision) {
      this.markTriaged();
      return;
    }

    if (decision !== 'accept' && !values.reason.trim()) {
      this.actionError.set('Indica el motivo del rechazo o cierre.');
      return;
    }

    this.submitTriage(report, {
      decision,
      reason: values.reason.trim() || undefined,
      notes: values.notes.trim() || undefined,
    });
  }

  protected convert(): void {
    if (this.actionLocked()) {
      return;
    }

    const report = this.report();
    if (!report) {
      return;
    }

    const values = this.convertForm.getRawValue();

    if (!report.heritageAssetId && !values.assetId) {
      this.actionError.set('Selecciona el activo patrimonial que se inspeccionará.');
      return;
    }

    if (!values.reviewerId) {
      this.actionError.set('Selecciona un revisor distinto del inspector.');
      return;
    }

    if (values.reviewerId === values.inspectorId) {
      this.actionError.set('El revisor debe ser una persona distinta del inspector.');
      return;
    }

    if (!values.scope.trim()) {
      this.actionError.set('Describe el alcance de la inspección.');
      return;
    }

    this.busy.set('convert');
    this.actionError.set(null);
    this.notice.set(null);

    this.conservationApi
      .convertReport(report.id, report.version, {
        assetId: report.heritageAssetId ? undefined : values.assetId,
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
          void this.router.navigate(['/inspecciones', response.data.inspection.id]);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.actionError.set(apiErrorMessage(error, 'No se pudo convertir el reporte.'));
        },
      });
  }

  protected stateClass(state: string): string {
    return `conservation-badge conservation-badge--${state}`;
  }

  protected inspectorName(id: string | null | undefined): string {
    return this.inspectors().find((inspector) => inspector.id === id)?.name ?? shortId(id);
  }

  protected otherInspectors(): InspectorOption[] {
    return this.inspectors().filter(
      (inspector) => inspector.id !== this.convertForm.controls.inspectorId.value,
    );
  }

  private submitTriage(
    report: Report,
    payload: {
      decision?: 'accept' | 'reject' | 'close';
      reason?: string;
      notes?: string;
    },
  ): void {
    if (this.actionLocked()) {
      return;
    }

    this.busy.set('triage');
    this.actionError.set(null);
    this.notice.set(null);

    this.conservationApi
      .triageReport(report.id, report.version, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          this.notice.set('Triaje actualizado.');
          this.report.set(response.data);
          this.triageForm.reset({ decision: '', reason: '', notes: '' });
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.actionError.set(apiErrorMessage(error, 'No se pudo actualizar el triaje.'));
        },
      });
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

    if (this.auth.canTriageReports()) {
      this.conservationApi
        .listInspectors()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => this.inspectors.set(response.data),
          error: () => this.inspectors.set([]),
        });
    }
  }
}
