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
import { LocationApiService } from '../../../../core/services/location-api.service';
import { apiErrorMessage } from '../../../../core/utils/api-error';
import { FalconLocation } from '../../../../core/models/location.model';
import {
  AdminAdventureStop,
  AdminAdventureStopPayload,
} from '../../../../core/models/adventure.model';

interface EditDraft {
  didacticText: string;
  instructions: string;
}

@Component({
  selector: 'app-admin-aventura-stops',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-aventura-stops.component.html',
  styleUrl: './admin-aventura-stops.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAventuraStopsComponent implements OnInit {
  private readonly adventuresApi = inject(AdventureApiService);
  private readonly locationsApi = inject(LocationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly adventureId = signal<string | null>(null);
  protected readonly adventureTitle = signal('');
  protected readonly stops = signal<AdminAdventureStop[]>([]);
  protected readonly locations = signal<FalconLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly editingStopId = signal<string | null>(null);
  protected readonly editDraft = signal<EditDraft>({ didacticText: '', instructions: '' });

  protected readonly stopForm = this.formBuilder.group({
    locationId: ['', [Validators.required]],
    order: [1, [Validators.required, Validators.min(1)]],
    didacticText: ['', [Validators.maxLength(2000)]],
    instructions: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading.set(false);
      return;
    }

    this.adventureId.set(id);
    this.loadAdventure(id);
    this.loadLocations();
  }

  private loadAdventure(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.adventuresApi
      .getAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.adventureTitle.set(data.title);
          this.stops.set([...(data.stops ?? [])]);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error, 'No se pudo cargar la aventura.'));
          this.loading.set(false);
        },
      });
  }

  private loadLocations(): void {
    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.locations.set(response.data);
        },
        error: () => {
          this.locations.set([]);
        },
      });
  }

  protected stopTitle(stop: AdminAdventureStop): string {
    return stop.location.title;
  }

  protected trackByStop(_index: number, stop: AdminAdventureStop): string {
    return stop.id;
  }

  protected startAdd(): void {
    this.adding.set(true);
    this.error.set(null);
    this.stopForm.reset({
      locationId: '',
      order: this.nextOrder(),
      didacticText: '',
      instructions: '',
    });
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.error.set(null);
  }

  protected nextOrder(): number {
    return Math.max(0, ...this.stops().map((stop) => stop.order)) + 1;
  }

  protected addStop(): void {
    if (this.stopForm.invalid) {
      this.stopForm.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de añadir la parada.');
      return;
    }

    const values = this.stopForm.getRawValue();
    const payload: AdminAdventureStopPayload = {
      locationId: values.locationId,
      order: Number(values.order),
      didacticText: values.didacticText.trim() || undefined,
      instructions: values.instructions.trim() || undefined,
    };

    const id = this.adventureId();

    if (!id) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .addStop(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.adding.set(false);
          this.success.set('Parada añadida.');
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo añadir la parada.'));
        },
      });
  }

  protected editStop(stop: AdminAdventureStop): void {
    this.editingStopId.set(stop.id);
    this.editDraft.set({
      didacticText: stop.didacticText ?? '',
      instructions: stop.instructions ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingStopId.set(null);
    this.editDraft.set({ didacticText: '', instructions: '' });
  }

  protected saveEdit(stop: AdminAdventureStop): void {
    const id = this.adventureId();
    const draft = this.editDraft();

    if (!id) {
      return;
    }

    const payload: Partial<AdminAdventureStopPayload> = {
      didacticText: draft.didacticText.trim() || undefined,
      instructions: draft.instructions.trim() || undefined,
    };

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .updateStop(id, stop.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingStopId.set(null);
          this.success.set('Parada actualizada.');
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo actualizar la parada.'));
        },
      });
  }

  protected deleteStop(stop: AdminAdventureStop): void {
    if (!confirm(`¿Eliminar la parada «${stop.location.title}» de esta aventura?`)) {
      return;
    }

    const id = this.adventureId();

    if (!id) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .deleteStop(id, stop.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set('Parada eliminada.');
          this.loadAdventure(id);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo eliminar la parada.'));
        },
      });
  }

  protected moveStop(stop: AdminAdventureStop, direction: 'up' | 'down'): void {
    const id = this.adventureId();

    if (!id) {
      return;
    }

    const items = this.stops();
    const index = items.findIndex((item) => item.id === stop.id);
    const target = direction === 'up' ? index - 1 : index + 1;

    if (target < 0 || target >= items.length) {
      return;
    }

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];

    this.saving.set(true);
    this.error.set(null);

    this.adventuresApi
      .reorderStops(id, next.map((item) => item.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.saving.set(false);
          this.stops.set([...data]);
          this.success.set('Paradas reordenadas.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo reordenar las paradas.'));
        },
      });
  }

  protected updateDraftField(field: keyof EditDraft, value: string): void {
    this.editDraft.set({ ...this.editDraft(), [field]: value });
  }
}
