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
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { PageSkeletonComponent } from '../../../components/ui/page-skeleton/page-skeleton.component';
import {
  DAMAGE_CATEGORIES,
  DamageCategory,
  HeritageAsset,
  INSPECTION_RESULTS,
  INSPECTION_TYPES,
  INTERVENTION_TYPES,
  Inspection,
  InspectionFinding,
  InspectionResult,
  InspectionType,
  InspectorOption,
  Intervention,
  InterventionType,
  SEVERITIES,
  Severity,
} from '../../../models/conservation.model';
import { AuthService } from '../../../services/auth.service';
import { ConservationApiService } from '../../../services/conservation-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  DAMAGE_CATEGORY_LABELS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_STATE_LABELS,
  INSPECTION_TYPE_LABELS,
  INTERVENTION_STATE_LABELS,
  INTERVENTION_TYPE_LABELS,
  SEVERITY_LABELS,
  eventLabel,
  shortId,
} from '../../../services/utils/conservation-labels';
import { EvidencePanelComponent } from '../../../components/conservation/evidence-panel/evidence-panel.component';

@Component({
  selector: 'app-inspection-detail',
  imports: [
    DatePipe,
    EvidencePanelComponent,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    PageSkeletonComponent,
  ],
  templateUrl: './inspection-detail.component.html',
  styleUrl: './inspection-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly conservationApi = inject(ConservationApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly auth = inject(AuthService);
  protected readonly categories = DAMAGE_CATEGORIES;
  protected readonly categoryLabels = DAMAGE_CATEGORY_LABELS;
  protected readonly inspectionTypes = INSPECTION_TYPES;
  protected readonly inspectionTypeLabels = INSPECTION_TYPE_LABELS;
  protected readonly inspectionStateLabels = INSPECTION_STATE_LABELS;
  protected readonly inspectionResults = INSPECTION_RESULTS;
  protected readonly inspectionResultLabels = INSPECTION_RESULT_LABELS;
  protected readonly severities = SEVERITIES;
  protected readonly severityLabels = SEVERITY_LABELS;
  protected readonly interventionTypes = INTERVENTION_TYPES;
  protected readonly interventionTypeLabels = INTERVENTION_TYPE_LABELS;
  protected readonly interventionStateLabels = INTERVENTION_STATE_LABELS;
  protected readonly eventLabel = eventLabel;
  protected readonly shortId = shortId;

  protected readonly inspection = signal<Inspection | null>(null);
  protected readonly assets = signal<HeritageAsset[]>([]);
  protected readonly inspectors = signal<InspectorOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly refreshing = signal(false);
  protected readonly noFindingsDeclared = signal(false);
  protected readonly severitySelections = signal<Record<string, Severity>>({});
  protected readonly selectedFindingIds = signal<string[]>([]);
  protected readonly rejectionReasons = signal<Record<string, string>>({});

  protected readonly findingForm = this.formBuilder.group({
    category: ['cracks' as DamageCategory],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    severityProposed: ['medium' as Severity],
    requiresIntervention: [false],
  });

  protected readonly reviewForm = this.formBuilder.group({
    decision: ['approve' as 'approve' | 'return'],
    result: ['fair' as InspectionResult],
    notes: ['', [Validators.maxLength(2000)]],
  });

  protected readonly interventionForm = this.formBuilder.group({
    type: ['repair' as InterventionType],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
  });

  protected readonly closeForm = this.formBuilder.group({
    justification: ['', [Validators.maxLength(2000)]],
  });

  protected readonly isInspector = computed(
    () => this.inspection()?.inspectorId === this.auth.currentUser()?.id,
  );
  protected readonly isReviewer = computed(
    () => this.inspection()?.reviewerId === this.auth.currentUser()?.id,
  );
  protected readonly actionLocked = computed(() => this.refreshing() || this.busy() !== null);
  protected readonly canStart = computed(
    () => this.isInspector() && this.inspection()?.state === 'planned',
  );
  protected readonly canResume = computed(
    () => this.isInspector() && this.inspection()?.state === 'returned',
  );
  protected readonly canAddFinding = computed(
    () => this.isInspector() && this.inspection()?.state === 'in_progress',
  );
  protected readonly canSubmit = computed(
    () => this.isInspector() && this.inspection()?.state === 'in_progress',
  );
  protected readonly canReview = computed(
    () => this.isReviewer() && this.inspection()?.state === 'submitted',
  );
  protected readonly canProposeIntervention = computed(
    () =>
      (this.isInspector() || this.isReviewer()) &&
      ['reviewed', 'closed'].includes(this.inspection()?.state ?? ''),
  );
  protected readonly canUploadInspectionEvidence = computed(() => {
    const item = this.inspection();
    const userId = this.auth.currentUser()?.id;

    if (!item || !userId || !this.auth.canUploadEvidence()) {
      return false;
    }

    if (['closed', 'cancelled'].includes(item.state)) {
      return false;
    }

    if (item.inspectorId === userId) {
      return ['planned', 'in_progress', 'returned'].includes(item.state);
    }

    return item.reviewerId === userId;
  });

  protected readonly interventions = computed(() => this.inspection()?.interventions ?? []);
  protected readonly proposedFindings = computed(
    () => this.inspection()?.findings.filter((finding) => finding.state === 'proposed') ?? [],
  );
  protected readonly availableFindings = computed(
    () =>
      this.inspection()?.findings.filter(
        (finding) => !['discarded', 'resolved'].includes(finding.state),
      ) ?? [],
  );
  protected readonly coveredFindingIds = computed(() => {
    const ids = new Set<string>();
    for (const intervention of this.interventions()) {
      if (intervention.state === 'verified') {
        intervention.findingIds.forEach((id) => ids.add(id));
      }
    }
    return ids;
  });
  protected readonly closureBlocked = computed(() => {
    const verified = this.coveredFindingIds();
    return (
      this.inspection()?.findings.filter(
        (finding) =>
          finding.requiresIntervention &&
          !['discarded', 'resolved'].includes(finding.state) &&
          !verified.has(finding.findingId),
      ) ?? []
    );
  });
  protected readonly needsClosureJustification = computed(
    () =>
      this.inspection()?.findings.some(
        (finding) =>
          !finding.requiresIntervention && !['discarded', 'resolved'].includes(finding.state),
      ) ?? false,
  );
  protected readonly canClose = computed(
    () =>
      this.isReviewer() &&
      this.inspection()?.state === 'reviewed' &&
      this.closureBlocked().length === 0,
  );
  protected readonly history = computed(() =>
    [...(this.inspection()?.history ?? [])].sort(
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
      this.error.set('No se indicó la inspección.');
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
      .getInspection(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyInspection(response.data);
          this.loading.set(false);
          this.refreshing.set(false);
        },
        error: (error: unknown) => {
          const message = apiErrorMessage(error, 'No se pudo cargar la inspección.');
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

  protected start(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    this.run('start', this.conservationApi.startInspection(item.id, item.version), {
      success: 'Inspección iniciada.',
      fallback: 'No se pudo iniciar la inspección.',
    });
  }

  protected resume(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    this.run('resume', this.conservationApi.resumeInspection(item.id, item.version), {
      success: 'Inspección reanudada para corrección.',
      fallback: 'No se pudo reanudar la inspección.',
    });
  }

  protected addFinding(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    if (this.findingForm.invalid) {
      this.findingForm.markAllAsTouched();
      this.actionError.set('Describe el hallazgo con al menos 10 caracteres.');
      return;
    }

    const values = this.findingForm.getRawValue();
    this.run(
      'finding',
      this.conservationApi.addFinding(item.id, item.version, {
        category: values.category,
        description: values.description.trim(),
        severityProposed: values.severityProposed,
        requiresIntervention: values.requiresIntervention,
      }),
      {
        success: 'Hallazgo registrado.',
        fallback: 'No se pudo registrar el hallazgo.',
        reset: () =>
          this.findingForm.reset({
            category: 'cracks',
            description: '',
            severityProposed: 'medium',
            requiresIntervention: false,
          }),
      },
    );
  }

  protected submitInspection(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    if (item.findings.length === 0 && !this.noFindingsDeclared()) {
      this.actionError.set('Registra al menos un hallazgo o declara que no se encontraron daños.');
      return;
    }

    this.run(
      'submit',
      this.conservationApi.submitInspection(item.id, item.version, this.noFindingsDeclared()),
      {
        success: 'Inspección enviada a revisión.',
        fallback: 'No se pudo enviar la inspección.',
      },
    );
  }

  protected submitReview(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    const values = this.reviewForm.getRawValue();

    if (values.decision === 'return' && !values.notes.trim()) {
      this.actionError.set('Indica los cambios solicitados al inspector.');
      return;
    }

    const findings: Record<string, Severity> = {};
    if (values.decision === 'approve') {
      for (const finding of this.proposedFindings()) {
        const severity = this.severityFor(finding);
        if (!severity) {
          this.actionError.set('Confirma la severidad de todos los hallazgos propuestos.');
          return;
        }
        findings[finding.findingId] = severity;
      }
    }

    this.run(
      'review',
      this.conservationApi.reviewInspection(item.id, item.version, {
        decision: values.decision,
        result: values.decision === 'approve' ? values.result : undefined,
        findings,
        notes: values.notes.trim() || undefined,
      }),
      {
        success:
          values.decision === 'approve'
            ? 'Inspección revisada. Ya se pueden proponer intervenciones.'
            : 'Inspección devuelta al inspector.',
        fallback: 'No se pudo registrar la revisión.',
        reset: () => this.reviewForm.reset({ decision: 'approve', result: 'fair', notes: '' }),
      },
    );
  }

  protected closeInspection(): void {
    const item = this.inspection();
    if (!item) {
      return;
    }

    const justification = this.closeForm.controls.justification.value.trim();
    if (this.needsClosureJustification() && !justification) {
      this.actionError.set('Justifica el cierre porque hay hallazgos sin intervención asociada.');
      return;
    }

    if (!window.confirm('Cerrar la inspección es una acción final. ¿Continuar?')) {
      return;
    }

    this.run(
      'close',
      this.conservationApi.closeInspection(item.id, item.version, justification || undefined),
      {
        success: 'Inspección cerrada y estado del POI actualizado.',
        fallback: 'No se pudo cerrar la inspección.',
        reset: () => this.closeForm.reset({ justification: '' }),
      },
    );
  }

  protected proposeIntervention(): void {
    if (this.actionLocked()) {
      return;
    }

    const item = this.inspection();
    if (!item) {
      return;
    }

    const findingIds = this.selectedFindingIds();

    if (findingIds.length === 0) {
      this.actionError.set('Selecciona al menos un hallazgo para la intervención.');
      return;
    }

    if (this.interventionForm.invalid) {
      this.interventionForm.markAllAsTouched();
      this.actionError.set('Describe la intervención con al menos 10 caracteres.');
      return;
    }

    const values = this.interventionForm.getRawValue();
    this.busy.set('intervention');
    this.actionError.set(null);
    this.notice.set(null);

    this.conservationApi
      .proposeIntervention(item.id, {
        findingIds,
        type: values.type,
        description: values.description.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          this.notice.set('Intervención propuesta. Otra persona debe aprobarla.');
          this.selectedFindingIds.set([]);
          this.interventionForm.reset({ type: 'repair', description: '' });
          this.inspection.update((current) =>
            current
              ? { ...current, interventions: [...(current.interventions ?? []), response.data] }
              : current,
          );
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.actionError.set(apiErrorMessage(error, 'No se pudo proponer la intervención.'));
        },
      });
  }

  protected transitionIntervention(
    intervention: Intervention,
    action: 'approve' | 'reject' | 'start' | 'complete' | 'verify',
  ): void {
    if (this.actionLocked()) {
      return;
    }

    const reason = this.rejectionReasons()[intervention.id]?.trim();

    if (action === 'reject' && !reason) {
      this.actionError.set('Indica el motivo del rechazo de la intervención.');
      return;
    }

    if (
      action === 'verify' &&
      !window.confirm('Verificar cierra la intervención como válida. ¿Continuar?')
    ) {
      return;
    }

    this.busy.set(`intervention-${intervention.id}`);
    this.actionError.set(null);
    this.notice.set(null);

    this.conservationApi
      .transitionIntervention(intervention.id, intervention.version, action, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          this.notice.set('Intervención actualizada.');
          this.inspection.update((current) =>
            current
              ? {
                  ...current,
                  interventions: (current.interventions ?? []).map((item) =>
                    item.id === response.data.id ? response.data : item,
                  ),
                }
              : current,
          );
          this.rejectionReasons.update((current) => {
            const next = { ...current };
            delete next[intervention.id];
            return next;
          });
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.actionError.set(apiErrorMessage(error, 'No se pudo actualizar la intervención.'));
        },
      });
  }

  protected setNoFindings(event: Event): void {
    this.noFindingsDeclared.set((event.target as HTMLInputElement).checked);
  }

  protected toggleFinding(findingId: string): void {
    this.selectedFindingIds.update((current) =>
      current.includes(findingId)
        ? current.filter((id) => id !== findingId)
        : [...current, findingId],
    );
  }

  protected isFindingSelected(findingId: string): boolean {
    return this.selectedFindingIds().includes(findingId);
  }

  protected setSeverity(findingId: string, severity: string): void {
    this.severitySelections.update((current) => ({
      ...current,
      [findingId]: severity as Severity,
    }));
  }

  protected severityFor(finding: InspectionFinding): Severity {
    return (
      this.severitySelections()[finding.findingId] ??
      finding.severityConfirmed ??
      finding.severityProposed
    );
  }

  protected setRejectionReason(interventionId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rejectionReasons.update((current) => ({
      ...current,
      [interventionId]: value,
    }));
  }

  protected rejectionReason(interventionId: string): string {
    return this.rejectionReasons()[interventionId] ?? '';
  }

  protected canApproveIntervention(intervention: Intervention): boolean {
    return (
      intervention.state === 'proposed' && intervention.proposedBy !== this.auth.currentUser()?.id
    );
  }

  protected canStartIntervention(intervention: Intervention): boolean {
    return intervention.state === 'approved' && this.isInspector();
  }

  protected canCompleteIntervention(intervention: Intervention): boolean {
    return (
      intervention.state === 'in_progress' &&
      intervention.executorId === this.auth.currentUser()?.id
    );
  }

  protected canVerifyIntervention(intervention: Intervention): boolean {
    return (
      intervention.state === 'completed' && intervention.executorId !== this.auth.currentUser()?.id
    );
  }

  protected canUploadInterventionEvidence(intervention: Intervention): boolean {
    return this.auth.canUploadEvidence() && !['verified', 'rejected'].includes(intervention.state);
  }

  protected stateClass(state: string): string {
    return `conservation-badge conservation-badge--${state}`;
  }

  protected severityClass(severity: Severity): string {
    return `conservation-badge conservation-badge--${severity}`;
  }

  protected assetName(id: string): string {
    return this.assets().find((asset) => asset.id === id)?.name ?? `Activo ${shortId(id)}`;
  }

  protected inspectorName(id: string | null | undefined): string {
    return this.inspectors().find((inspector) => inspector.id === id)?.name ?? shortId(id);
  }

  protected findingName(findingId: string): string {
    const finding = this.inspection()?.findings.find((item) => item.findingId === findingId);
    return finding
      ? `${DAMAGE_CATEGORY_LABELS[finding.category]} (${shortId(findingId)})`
      : shortId(findingId);
  }

  private run(
    key: string,
    request: Observable<{ data: Inspection }>,
    options: {
      success: string;
      fallback: string;
      reset?: () => void;
    },
  ): void {
    if (this.actionLocked()) {
      return;
    }

    this.busy.set(key);
    this.actionError.set(null);
    this.notice.set(null);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.busy.set(null);
        this.notice.set(options.success);
        options.reset?.();
        this.applyInspection(response.data);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.actionError.set(apiErrorMessage(error, options.fallback));
      },
    });
  }

  private applyInspection(next: Inspection): void {
    this.inspection.update((current) => ({
      ...next,
      interventions: next.interventions ?? current?.interventions ?? [],
      history: next.history?.length ? next.history : (current?.history ?? []),
    }));

    this.severitySelections.set(
      Object.fromEntries(
        next.findings.map((finding) => [
          finding.findingId,
          finding.severityConfirmed ?? finding.severityProposed,
        ]),
      ),
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

    this.conservationApi
      .listInspectors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.inspectors.set(response.data),
        error: () => this.inspectors.set([]),
      });
  }
}
