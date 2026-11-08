import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  Profile,
  ProfileAdventure,
  ProfileCheckIn,
  ProfileStats,
} from '../../core/models/profile.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { apiErrorMessage } from '../../core/utils/api-error';

type MessageType = 'success' | 'error' | null;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilComponent implements OnInit, OnDestroy {
  private readonly profileApi = inject(ProfileApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly stats = signal<ProfileStats | null>(null);
  protected readonly adventures = signal<ProfileAdventure[]>([]);
  protected readonly recentCheckIns = signal<ProfileCheckIn[]>([]);
  protected readonly avatarUrl = signal<SafeUrl | null>(null);
  protected readonly photoUrls = signal<Record<string, SafeUrl>>({});
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly messageType = signal<MessageType>(null);

  protected form = { name: '', username: '', bio: '' };

  private avatarRawUrl: string | null = null;
  private readonly photoRawUrls = new Map<string, string>();

  protected readonly initials = computed(() => {
    const name = this.profile()?.name?.trim();

    if (!name) {
      return 'FS';
    }

    const parts = name.split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || 'FS';
  });

  protected readonly chivitoMessage = computed(() => {
    const profile = this.profile();
    const stats = this.stats();

    if (!profile || !stats) {
      return '';
    }

    const firstName = profile.name.split(/\s+/).filter(Boolean)[0] ?? 'explorador';

    if (stats.totalCheckIns === 0) {
      return `Chivito te da la bienvenida, ${firstName}. Aún no registras visitas: elige una aventura y empieza por su primera parada.`;
    }

    if (stats.completedAdventures > 0) {
      return `Chivito celebra contigo, ${firstName}: completaste ${stats.completedAdventures} ${
        stats.completedAdventures === 1 ? 'aventura' : 'aventuras'
      } y acumulas ${stats.totalCheckIns} ${
        stats.totalCheckIns === 1 ? 'check-in' : 'check-ins'
      }.`;
    }

    if (stats.startedAdventures > 0 && stats.totalStops > 0) {
      return `Chivito te acompaña, ${firstName}: llevas ${stats.visitedStops} de ${stats.totalStops} paradas visitadas y ${stats.totalCheckIns} ${
        stats.totalCheckIns === 1 ? 'check-in' : 'check-ins'
      }.`;
    }

    return `Chivito dice: tu perfil está listo, ${firstName}. Cada check-in suma una parada a tu recorrido.`;
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.releaseAvatarUrl();

    for (const rawUrl of this.photoRawUrls.values()) {
      URL.revokeObjectURL(rawUrl);
    }

    this.photoRawUrls.clear();
  }

  protected loadProfile(): void {
    this.loading.set(true);
    this.error.set(null);

    this.profileApi
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.profile.set(data.profile);
          this.stats.set(data.stats);
          this.adventures.set(data.adventures);
          this.recentCheckIns.set(data.recentCheckIns);
          this.auth.updateCurrentUser({
            name: data.profile.name,
            username: data.profile.username,
          });
          this.form = {
            name: data.profile.name,
            username: data.profile.username ?? '',
            bio: data.profile.bio,
          };

          if (data.profile.avatarUrl) {
            this.loadAvatar(data.profile.avatarUrl);
          }

          for (const checkIn of data.recentCheckIns) {
            this.loadCheckInPhoto(checkIn);
          }

          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(
              error,
              'No se pudo cargar tu perfil. Verifica que la API esté disponible.',
            ),
          );
          this.loading.set(false);
        },
      });
  }

  protected saveProfile(): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.message.set(null);
    this.messageType.set(null);

    this.profileApi
      .updateProfile({
        name: this.form.name,
        username: this.form.username,
        bio: this.form.bio,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.profile.set(data.profile);
          this.auth.updateCurrentUser({
            name: data.profile.name,
            username: data.profile.username,
          });
          this.form = {
            name: data.profile.name,
            username: data.profile.username ?? '',
            bio: data.profile.bio,
          };
          this.saving.set(false);
          this.message.set('Perfil actualizado.');
          this.messageType.set('success');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.message.set(
            apiErrorMessage(error, 'No se pudo guardar el perfil.'),
          );
          this.messageType.set('error');
        },
      });
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.message.set('El avatar debe ser una imagen JPEG, PNG o WebP.');
      this.messageType.set('error');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      this.message.set('El avatar no puede superar 5 MB.');
      this.messageType.set('error');
      return;
    }

    this.uploading.set(true);
    this.message.set(null);

    this.profileApi
      .uploadAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.profile.set(data.profile);
          this.uploading.set(false);
          this.message.set('Avatar actualizado.');
          this.messageType.set('success');

          if (data.profile.avatarUrl) {
            this.loadAvatar(data.profile.avatarUrl);
          }
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.message.set(
            apiErrorMessage(error, 'No se pudo subir el avatar.'),
          );
          this.messageType.set('error');
        },
      });
  }

  protected removeAvatar(): void {
    if (!this.profile()?.hasAvatar || this.uploading()) {
      return;
    }

    this.uploading.set(true);
    this.message.set(null);

    this.profileApi
      .deleteAvatar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.profile.set(data.profile);
          this.uploading.set(false);
          this.releaseAvatarUrl();
          this.avatarUrl.set(null);
          this.message.set('Avatar eliminado.');
          this.messageType.set('success');
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.message.set(
            apiErrorMessage(error, 'No se pudo eliminar el avatar.'),
          );
          this.messageType.set('error');
        },
      });
  }

  protected photoUrl(checkInId: string): SafeUrl | null {
    return this.photoUrls()[checkInId] ?? null;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private loadAvatar(url: string): void {
    this.profileApi
      .getPrivateImage(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.releaseAvatarUrl();
          this.avatarRawUrl = URL.createObjectURL(blob);
          this.avatarUrl.set(
            this.sanitizer.bypassSecurityTrustUrl(this.avatarRawUrl),
          );
        },
        error: () => {
          // El avatar es decorativo: el perfil sigue siendo utilizable.
        },
      });
  }

  private loadCheckInPhoto(checkIn: ProfileCheckIn): void {
    if (!checkIn.photoUrl || this.photoRawUrls.has(checkIn.id)) {
      return;
    }

    this.profileApi
      .getPrivateImage(checkIn.photoUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const rawUrl = URL.createObjectURL(blob);
          this.photoRawUrls.set(checkIn.id, rawUrl);
          this.photoUrls.update((urls) => ({
            ...urls,
            [checkIn.id]: this.sanitizer.bypassSecurityTrustUrl(rawUrl),
          }));
        },
        error: () => {
          // Si la foto falla, el check-in conserva su imagen pública de POI.
        },
      });
  }

  private releaseAvatarUrl(): void {
    if (this.avatarRawUrl) {
      URL.revokeObjectURL(this.avatarRawUrl);
      this.avatarRawUrl = null;
    }
  }
}
