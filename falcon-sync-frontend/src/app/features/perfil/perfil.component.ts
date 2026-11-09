import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  GalleryMeta,
  Profile,
  ProfileCheckIn,
  ProfileStats,
} from '../../core/models/profile.model';
import {
  UserAchievement,
  achievementCategoryLabel,
  achievementIcon,
} from '../../core/models/achievement.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { apiErrorMessage } from '../../core/utils/api-error';

type MessageType = 'success' | 'error' | null;
type GalleryFilter = 'all' | 'withPhoto' | 'withoutPhoto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const GALLERY_PAGE_SIZE = 9;

const GALLERY_FILTERS: Array<{ value: GalleryFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'withPhoto', label: 'Con foto' },
  { value: 'withoutPhoto', label: 'Sin foto' },
];

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
  private readonly viewerCloseButton =
    viewChild<ElementRef<HTMLButtonElement>>('viewerClose');

  protected readonly profile = signal<Profile | null>(null);
  protected readonly stats = signal<ProfileStats | null>(null);
  protected readonly achievements = signal<UserAchievement[]>([]);
  protected readonly avatarUrl = signal<SafeUrl | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly messageType = signal<MessageType>(null);
  protected readonly failedAchievementImages = signal<ReadonlySet<string>>(
    new Set(),
  );

  protected readonly gallery = signal<ProfileCheckIn[]>([]);
  protected readonly galleryMeta = signal<GalleryMeta>({
    page: 1,
    limit: GALLERY_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  protected readonly galleryLoading = signal(false);
  protected readonly galleryError = signal<string | null>(null);
  protected readonly galleryFilter = signal<GalleryFilter>('all');
  protected readonly photoActionId = signal<string | null>(null);
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly photoActionError = signal<string | null>(null);
  protected readonly viewerId = signal<string | null>(null);

  protected readonly galleryFilters = GALLERY_FILTERS;
  protected readonly photoUrls = signal<Record<string, SafeUrl>>({});

  protected readonly galleryEmptyMessage = computed(() => {
    switch (this.galleryFilter()) {
      case 'withPhoto':
        return 'Todavía no has guardado fotos. Añade una a cualquiera de tus visitas.';
      case 'withoutPhoto':
        return 'Todas las visitas de esta página tienen foto.';
      default:
        return 'Aún no has registrado visitas. Cuando estés en un lugar, escanea su QR para guardar la visita y ganar su insignia.';
    }
  });

  protected readonly viewerCheckIn = computed(() => {
    const id = this.viewerId();

    if (!id) {
      return null;
    }

    return this.gallery().find((checkIn) => checkIn.id === id) ?? null;
  });

  protected readonly galleryPhotos = computed(() =>
    this.gallery().filter((checkIn) => checkIn.photoAvailable),
  );

  protected readonly viewerIndex = computed(() => {
    const id = this.viewerId();

    if (!id) {
      return -1;
    }

    return this.galleryPhotos().findIndex((checkIn) => checkIn.id === id);
  });

  protected readonly viewerPositionLabel = computed(() => {
    const index = this.viewerIndex();
    const total = this.galleryPhotos().length;

    if (index < 0 || total === 0) {
      return '';
    }

    return `Foto ${index + 1} de ${total}`;
  });

  protected form = { name: '', username: '', bio: '' };

  private avatarRawUrl: string | null = null;
  private readonly photoRawUrls = new Map<string, string>();
  private readonly photoRequestVersions = new Map<string, number>();
  private galleryRequest = 0;

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
      return `Chivito te da la bienvenida, ${firstName}. Cuando visites un lugar, escanea su QR y guarda una insignia en tu perfil.`;
    }

    const lugares = stats.uniqueLocations;
    const insignias = stats.locationAchievements;
    return `Chivito celebra contigo, ${firstName}: ya descubriste ${lugares} ${
      lugares === 1 ? 'lugar' : 'lugares'
    } y reúnes ${insignias} ${insignias === 1 ? 'insignia' : 'insignias'}. ¡Sigue explorando a tu ritmo!`;
  });

  protected achievementIcon = achievementIcon;
  protected achievementCategoryLabel = achievementCategoryLabel;

  ngOnInit(): void {
    this.loadProfile();
    this.loadGallery(1);
  }

  ngOnDestroy(): void {
    this.releaseAvatarUrl();

    for (const rawUrl of this.photoRawUrls.values()) {
      URL.revokeObjectURL(rawUrl);
    }

    this.photoRawUrls.clear();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.viewerId()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeViewer();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.moveViewer(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.moveViewer(1);
    }
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
          this.achievements.set(
            (data.achievements ?? []).filter(
              (achievement) => achievement.type === 'location',
            ),
          );
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

  protected loadGallery(page = 1): void {
    const requestId = ++this.galleryRequest;
    const filter = this.galleryFilter();
    const hasPhoto =
      filter === 'all' ? undefined : filter === 'withPhoto';

    this.galleryLoading.set(true);
    this.galleryError.set(null);

    this.profileApi
      .getGallery(page, GALLERY_PAGE_SIZE, hasPhoto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, meta }) => {
          if (requestId !== this.galleryRequest) {
            return;
          }

          this.gallery.set(data);
          this.galleryMeta.set(meta);
          this.galleryLoading.set(false);

          for (const checkIn of data) {
            this.loadCheckInPhoto(checkIn);
          }
        },
        error: (error: unknown) => {
          if (requestId !== this.galleryRequest) {
            return;
          }

          this.galleryLoading.set(false);
          this.galleryError.set(
            apiErrorMessage(error, 'No se pudo cargar la galería de visitas.'),
          );
        },
      });
  }

  protected setGalleryFilter(filter: GalleryFilter): void {
    if (this.galleryFilter() === filter) {
      return;
    }

    this.galleryFilter.set(filter);
    this.closeViewer();
    this.loadGallery(1);
  }

  protected goToGalleryPage(page: number): void {
    const meta = this.galleryMeta();

    if (page < 1 || page > meta.totalPages || this.galleryLoading()) {
      return;
    }

    this.closeViewer();
    this.loadGallery(page);
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

    if (file.size > MAX_IMAGE_BYTES) {
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

  protected onCheckInPhotoSelected(
    checkIn: ProfileCheckIn,
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.photoActionError.set(
        'La foto debe ser una imagen JPEG, PNG o WebP.',
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.photoActionError.set('La foto no puede superar 5 MB.');
      return;
    }

    this.photoActionId.set(checkIn.id);
    this.pendingDeleteId.set(null);
    this.photoActionError.set(null);

    this.profileApi
      .uploadCheckInPhoto(checkIn.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.photoActionId.set(null);
          this.applyCheckInUpdate(data.checkIn);
          this.message.set(
            data.checkIn.photoAvailable
              ? `Foto guardada para ${data.checkIn.location.title}.`
              : 'Foto actualizada.',
          );
          this.messageType.set('success');
        },
        error: (error: unknown) => {
          this.photoActionId.set(null);
          this.photoActionError.set(
            apiErrorMessage(error, 'No se pudo guardar la foto de la visita.'),
          );
        },
      });
  }

  protected requestPhotoDelete(checkIn: ProfileCheckIn): void {
    this.pendingDeleteId.set(checkIn.id);
    this.photoActionError.set(null);
  }

  protected cancelPhotoDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmPhotoDelete(checkIn: ProfileCheckIn): void {
    this.photoActionId.set(checkIn.id);
    this.pendingDeleteId.set(null);
    this.photoActionError.set(null);

    this.profileApi
      .deleteCheckInPhoto(checkIn.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.photoActionId.set(null);

          if (this.viewerId() === checkIn.id) {
            this.closeViewer();
          }

          this.applyCheckInUpdate(data.checkIn);
          this.message.set(
            `Foto eliminada de tu visita a ${data.checkIn.location.title}.`,
          );
          this.messageType.set('success');
        },
        error: (error: unknown) => {
          this.photoActionId.set(null);
          this.photoActionError.set(
            apiErrorMessage(error, 'No se pudo eliminar la foto de la visita.'),
          );
        },
      });
  }

  protected openViewer(checkIn: ProfileCheckIn): void {
    if (!checkIn.photoAvailable) {
      return;
    }

    this.loadCheckInPhoto(checkIn);
    this.viewerId.set(checkIn.id);
    setTimeout(() => this.viewerCloseButton()?.nativeElement.focus());
  }

  protected closeViewer(): void {
    this.viewerId.set(null);
  }

  protected moveViewer(delta: number): void {
    const photos = this.galleryPhotos();

    if (photos.length === 0) {
      return;
    }

    const current = this.viewerIndex();
    const nextIndex =
      current < 0
        ? 0
        : (current + delta + photos.length) % photos.length;
    const next = photos[nextIndex];

    this.loadCheckInPhoto(next);
    this.viewerId.set(next.id);
  }

  protected photoUrl(checkInId: string): SafeUrl | null {
    return this.photoUrls()[checkInId] ?? null;
  }

  protected achievementImage(achievement: UserAchievement): string | null {
    if (
      !achievement.image ||
      this.failedAchievementImages().has(achievement.id)
    ) {
      return null;
    }

    return achievement.image;
  }

  protected onAchievementImageError(achievementId: string): void {
    this.failedAchievementImages.update((failed) => {
      const next = new Set(failed);
      next.add(achievementId);
      return next;
    });
  }

  protected achievementLink(achievement: UserAchievement): string[] | null {
    if (achievement.type === 'location' && achievement.sourceActive) {
      return ['/lugares', achievement.sourceSlug];
    }

    return null;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private applyCheckInUpdate(updated: ProfileCheckIn): void {
    this.gallery.update((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)),
    );

    if (updated.photoAvailable) {
      this.loadCheckInPhoto(updated, true);
    } else {
      this.revokePhotoUrl(updated.id);
    }

    const filter = this.galleryFilter();

    if (
      (filter === 'withPhoto' && !updated.photoAvailable) ||
      (filter === 'withoutPhoto' && updated.photoAvailable)
    ) {
      this.loadGallery(this.galleryPageForReload());
    }
  }

  private galleryPageForReload(): number {
    const meta = this.galleryMeta();
    const page = Math.min(
      Math.max(meta.page, 1),
      Math.max(meta.totalPages, 1),
    );

    if (this.gallery().length <= 1 && page > 1) {
      return page - 1;
    }

    return page;
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

  private loadCheckInPhoto(checkIn: ProfileCheckIn, force = false): void {
    if (!checkIn.photoUrl) {
      return;
    }

    if (!force && this.photoRawUrls.has(checkIn.id)) {
      return;
    }

    const version = (this.photoRequestVersions.get(checkIn.id) ?? 0) + 1;
    this.photoRequestVersions.set(checkIn.id, version);

    this.profileApi
      .getPrivateImage(checkIn.photoUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (this.photoRequestVersions.get(checkIn.id) !== version) {
            return;
          }

          this.revokePhotoUrl(checkIn.id);
          const rawUrl = URL.createObjectURL(blob);
          this.photoRawUrls.set(checkIn.id, rawUrl);
          this.photoUrls.update((urls) => ({
            ...urls,
            [checkIn.id]: this.sanitizer.bypassSecurityTrustUrl(rawUrl),
          }));
        },
        error: () => {
          // Si la foto falla, la visita conserva la imagen pública del POI.
        },
      });
  }

  private revokePhotoUrl(checkInId: string): void {
    const rawUrl = this.photoRawUrls.get(checkInId);

    if (rawUrl) {
      URL.revokeObjectURL(rawUrl);
      this.photoRawUrls.delete(checkInId);
    }

    this.photoUrls.update((urls) => {
      if (!(checkInId in urls)) {
        return urls;
      }

      const next = { ...urls };
      delete next[checkInId];
      return next;
    });
  }

  private releaseAvatarUrl(): void {
    if (this.avatarRawUrl) {
      URL.revokeObjectURL(this.avatarRawUrl);
      this.avatarRawUrl = null;
    }
  }
}
