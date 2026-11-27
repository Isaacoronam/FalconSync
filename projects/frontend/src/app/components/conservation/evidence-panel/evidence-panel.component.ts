import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageSkeletonComponent } from '../../ui/page-skeleton/page-skeleton.component';
import { Evidence, EvidenceOwnerType } from '../../../models/conservation.model';
import { EvidenceApiService } from '../../../services/evidence-api.service';
import { apiErrorMessage } from '../../../services/utils/api-error';
import { formatBytes } from '../../../services/utils/conservation-labels';

@Component({
  selector: 'app-evidence-panel',
  imports: [DatePipe, FormsModule, PageSkeletonComponent],
  templateUrl: './evidence-panel.component.html',
  styleUrl: './evidence-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidencePanelComponent {
  private static instanceCounter = 0;
  private readonly evidenceApi = inject(EvidenceApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly instanceId = `evidence-${EvidencePanelComponent.instanceCounter++}`;

  readonly ownerType = input.required<EvidenceOwnerType>();
  readonly ownerId = input.required<string>();
  readonly findingId = input<string | undefined>(undefined);
  readonly canUpload = input(false);
  readonly title = input('Evidencia');
  readonly emptyMessage = input('Todavía no hay evidencia adjunta para este registro.');

  readonly uploaded = output<Evidence>();

  protected readonly evidence = signal<Evidence[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly formatBytes = formatBytes;
  protected purpose = '';

  constructor() {
    effect(() => {
      const ownerId = this.ownerId();
      const findingId = this.findingId();
      const ownerType = this.ownerType();

      if (ownerId) {
        this.load(ownerType, ownerId, findingId);
      }
    });
  }

  protected load(
    ownerType = this.ownerType(),
    ownerId = this.ownerId(),
    findingId = this.findingId(),
  ): void {
    this.loading.set(true);
    this.error.set(null);

    this.evidenceApi
      .list(ownerType, ownerId, findingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.evidence.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.evidence.set([]);
          this.error.set(apiErrorMessage(error, 'No se pudo cargar la evidencia.'));
          this.loading.set(false);
        },
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  protected upload(): void {
    const file = this.selectedFile();

    if (!file) {
      this.error.set('Selecciona un archivo antes de subirlo.');
      return;
    }

    const purpose = this.purpose.trim();

    if (purpose.length < 3) {
      this.error.set('Describe para qué se adjunta la evidencia.');
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.evidenceApi
      .upload({
        ownerType: this.ownerType(),
        ownerId: this.ownerId(),
        findingId: this.findingId(),
        purpose,
        file,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.purpose = '';
          this.notice.set('Evidencia cargada y verificada.');
          this.uploaded.emit(response.data);
          this.load();
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo cargar la evidencia.'));
        },
      });
  }

  protected download(item: Evidence): void {
    this.downloadingId.set(item.id);
    this.error.set(null);

    this.evidenceApi
      .download(item.id, 'Descarga desde la consola de conservación')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `evidencia-${item.id}`;
          link.click();
          URL.revokeObjectURL(url);
          this.downloadingId.set(null);
        },
        error: (error: unknown) => {
          this.downloadingId.set(null);
          this.error.set(apiErrorMessage(error, 'No se pudo descargar la evidencia.'));
        },
      });
  }
}
