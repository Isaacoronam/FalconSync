import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdventureApiService } from '../../../../core/services/adventure-api.service';
import {
  Adventure,
  AdminAdventurePayload,
  ADVENTURE_DIFFICULTIES,
  AdventureDifficulty,
  AdventureStatus,
  difficultyLabel,
  statusLabel,
} from '../../../../core/models/adventure.model';
import { apiErrorMessage } from '../../../../core/utils/api-error';

const DIFFICULTY_OPTIONS = ADVENTURE_DIFFICULTIES.map((value) => ({
  value,
  label: difficultyLabel(value),
}));

@Component({
  selector: 'app-admin-aventura-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-aventura-form.component.html',
  styleUrl: './admin-aventura-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAventuraFormComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly difficulties = DIFFICULTY_OPTIONS;
  protected readonly difficultyLabel = difficultyLabel;
  protected readonly statusLabel = statusLabel;

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(140)]],
    slug: [
      '',
      [Validators.maxLength(100), Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)],
    ],
    summary: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(280)]],
    description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(10000)]],
    difficulty: ['easy', [Validators.required]],
    estimatedMinutes: [60, [Validators.required, Validators.min(1), Validators.max(1440)]],
    coverImage: ['', [Validators.pattern(/^(https?:\/\/[^\s]+|\/[^\s]+)$/i)]],
    badgeName: ['', [Validators.maxLength(80)]],
    badgeDescription: ['', [Validators.maxLength(280)]],
    badgeImage: ['', [Validators.pattern(/^(https?:\/\/[^\s]+|\/[^\s]+)$/i)]],
  });

  protected readonly editingId = signal<string | null>(null);
  protected readonly adventureTitle = signal('');
  protected readonly adventureStatus = signal<AdventureStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      return;
    }

    this.editingId.set(id);
    this.loadAdventure(id);
  }

  protected isEditing(): boolean {
    return this.editingId() !== null;
  }

  protected loadAdventure(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.adventuresApi
      .getAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.form.patchValue({
            title: data.title,
            slug: data.slug ?? '',
            summary: data.summary,
            description: data.description,
            difficulty: data.difficulty,
            estimatedMinutes: data.estimatedMinutes,
            coverImage: data.coverImage ?? '',
            badgeName: data.badge?.name ?? '',
            badgeDescription: data.badge?.description ?? '',
            badgeImage: data.badge?.image ?? '',
          });

          this.adventureTitle.set(data.title);
          this.adventureStatus.set(data.status);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo cargar la aventura.'));
          this.loading.set(false);
        },
      });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de guardar.');
      return;
    }

    const values = this.form.getRawValue();
    const payload: AdminAdventurePayload = {
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase() || undefined,
      summary: values.summary.trim(),
      description: values.description.trim(),
      difficulty: values.difficulty as AdventureDifficulty,
      estimatedMinutes: Number(values.estimatedMinutes),
      coverImage: values.coverImage.trim() || undefined,
      badge: this.buildBadge(values),
    };

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const id = this.editingId();

    const request = id
      ? this.adventuresApi.updateAdmin(id, payload)
      : this.adventuresApi.createAdmin(payload);

    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.saving.set(false);
          this.success.set(id ? 'Cambios guardados.' : 'Aventura creada.');
          this.adventureTitle.set(data.title);

          if (!id) {
            void this.router.navigate(['/admin/aventuras', data.id, 'editar'], {
              queryParams: { creado: '1' },
            });
          }
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            apiErrorMessage(error, 'No se pudieron guardar los cambios de la aventura.'),
          );
        },
      });
  }

  protected publish(): void {
    const id = this.editingId();

    if (!id) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .publishAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set('Aventura publicada.');
          this.form.controls.difficulty.updateValueAndValidity();
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            apiErrorMessage(error, 'No se pudo publicar la aventura.'),
          );
        },
      });
  }

  protected archive(): void {
    const id = this.editingId();

    if (!id) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .archiveAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set('Aventura archivada.');
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo archivar la aventura.'));
        },
      });
  }

  protected restore(): void {
    const id = this.editingId();

    if (!id) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .restoreAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set('Aventura restaurada como borrador.');
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo restaurar la aventura.'));
        },
      });
  }

  protected titleError(): string | null {
    return this.controlError('title');
  }

  protected slugError(): string | null {
    return this.controlError('slug', 'El slug solo admite minúsculas, números y guiones.');
  }

  protected summaryError(): string | null {
    return this.controlError('summary');
  }

  protected descriptionError(): string | null {
    return this.controlError('description');
  }

  protected minutesError(): string | null {
    return this.controlError('estimatedMinutes', 'La duración debe ser entre 1 y 1440 minutos.');
  }

  protected urlError(controlName: 'coverImage' | 'badgeImage'): string | null {
    return this.controlError(controlName, 'Debe ser una URL http(s) o una ruta local.');
  }

  protected createdNotice(): boolean {
    return this.route.snapshot.queryParamMap.get('creado') === '1';
  }

  private buildBadge(values: {
    badgeName: string;
    badgeDescription: string;
    badgeImage: string;
  }): Adventure['badge'] | undefined {
    const name = values.badgeName.trim();

    if (!name && !values.badgeDescription.trim() && !values.badgeImage.trim()) {
      return undefined;
    }

    if (!name) {
      return undefined;
    }

    const badge: Adventure['badge'] = { name };

    if (values.badgeDescription.trim()) {
      badge.description = values.badgeDescription.trim();
    }

    if (values.badgeImage.trim()) {
      badge.image = values.badgeImage.trim();
    }

    return badge;
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
