import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PanoramaViewerComponent } from '../../../components/panoramas/panorama-viewer/panorama-viewer.component';
import { AdminPanoramaDetail } from '../../../models/panorama.model';
import { AuthService } from '../../../services/auth.service';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import {
  HOTSPOT_TYPE_LABELS,
  PANORAMA_STATUS_LABELS,
  PANORAMA_VISIBILITY_LABELS,
  formatPanoramaBytes,
  formatPanoramaDate,
  panoramaStatusBadgeClass,
  panoramaVisibilityBadgeClass,
} from '../../../services/utils/panorama-labels';

type TransitionAction = 'approve' | 'publish' | 'archive';

@Component({
  selector: 'app-admin-panorama-detail',
  imports: [RouterLink, PanoramaViewerComponent],
  templateUrl: './admin-panorama-detail.component.html',
  styleUrl: './admin-panorama-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanoramaDetailComponent implements OnInit {
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly mode: 'manage' | 'curate' =
    this.route.snapshot.data['mode'] === 'curate' ? 'curate' : 'manage';
  protected readonly statusLabels = PANORAMA_STATUS_LABELS;
  protected readonly visibilityLabels = PANORAMA_VISIBILITY_LABELS;
  protected readonly hotspotLabels = HOTSPOT_TYPE_LABELS;
  protected readonly formatDate = formatPanoramaDate;
  protected readonly formatBytes = formatPanoramaBytes;
  protected readonly statusBadgeClass = panoramaStatusBadgeClass;
  protected readonly visibilityBadgeClass = panoramaVisibilityBadgeClass;

  protected readonly panorama = signal<AdminPanoramaDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyAction = signal<TransitionAction | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se indicó el panorama que quieres consultar.');
      this.loading.set(false);
      return;
    }

    this.load(id);
  }

  protected isCurate(): boolean {
    return this.mode === 'curate';
  }

  protected listLink(): string {
    return this.isCurate() ? '/curaduria/panoramas' : '/admin/panoramas';
  }

  protected canEdit(): boolean {
    const panorama = this.panorama();

    return (
      panorama !== null &&
      this.auth.canManagePanoramas() &&
      panorama.status !== 'archived'
    );
  }

  protected canApprove(): boolean {
    const panorama = this.panorama();

    return (
      panorama !== null &&
      panorama.status === 'draft' &&
      this.hasEditorialRights(panorama)
    );
  }

  protected canPublishNow(): boolean {
    const panorama = this.panorama();

    return (
      panorama !== null &&
      panorama.status === 'approved' &&
      this.hasEditorialRights(panorama)
    );
  }

  protected canArchive(): boolean {
    const panorama = this.panorama();

    return (
      panorama !== null &&
      panorama.status !== 'archived' &&
      this.hasEditorialRights(panorama)
    );
  }

  protected approve(): void {
    this.runTransition('approve');
  }

  protected publish(): void {
    this.runTransition('publish');
  }

  protected archive(): void {
    this.runTransition('archive');
  }

  private hasEditorialRights(panorama: AdminPanoramaDetail): boolean {
    return (
      this.auth.canPublishPanoramas() ||
      (this.auth.canManagePanoramas() && panorama.visibility === 'inspection')
    );
  }

  private runTransition(action: TransitionAction): void {
    const panorama = this.panorama();

    if (!panorama || this.busyAction()) {
      return;
    }

    this.busyAction.set(action);
    this.actionError.set(null);
    this.notice.set(null);

    const request =
      action === 'approve'
        ? this.panoramaApi.approve(panorama.id, panorama.version)
        : action === 'publish'
          ? this.panoramaApi.publish(panorama.id, panorama.version)
          : this.panoramaApi.archive(panorama.id, panorama.version);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => {
        this.panorama.set(data);
        this.busyAction.set(null);
        this.notice.set(
          action === 'approve'
            ? 'Panorama aprobado. Ya puede publicarse cuando el equipo editorial lo decida.'
            : action === 'publish'
              ? 'Panorama publicado. Ya aparece en la visita 360° pública.'
              : 'Panorama archivado. Deja de estar disponible en la API pública.',
        );
      },
      error: (error: unknown) => {
        this.busyAction.set(null);
        this.actionError.set(
          apiErrorMessage(
            error,
            action === 'approve'
              ? 'No se pudo aprobar el panorama. Revisa los derechos pendientes.'
              : action === 'publish'
                ? 'No se pudo publicar el panorama. Revisa los requisitos pendientes.'
                : 'No se pudo archivar el panorama.',
          ),
        );
      },
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.panoramaApi
      .getAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.panorama.set(data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(error, 'No se pudo cargar el panorama o no tienes acceso.'),
          );
          this.loading.set(false);
        },
      });
  }
}
