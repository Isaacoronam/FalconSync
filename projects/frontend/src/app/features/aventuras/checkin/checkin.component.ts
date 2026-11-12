import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocationApiService } from '../../../core/services/location-api.service';
import { CheckInApiService } from '../../../core/services/check-in-api.service';
import { CheckInSessionService } from '../../../core/services/check-in-session.service';
import { ProfileApiService } from '../../../core/services/profile-api.service';
import {
  UserAchievement,
  achievementCategoryLabel,
  achievementIcon,
} from '../../../core/models/achievement.model';
import { apiErrorMessage } from '../../../core/utils/api-error';

type CheckInStage = 'idle' | 'locating' | 'submitting' | 'success' | 'error';
type PhotoStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60000,
};

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-checkin',
  imports: [FormsModule, RouterLink],
  templateUrl: './checkin.component.html',
  styleUrl: './checkin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckinComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locationsApi = inject(LocationApiService);
  private readonly checkInApi = inject(CheckInApiService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly session = inject(CheckInSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly locationId = signal<string | null>(null);
  protected readonly token = signal<string | null>(null);
  protected readonly locationTitle = signal<string | null>(null);
  protected readonly locationSlug = signal<string | null>(null);
  protected readonly stage = signal<CheckInStage>('idle');
  protected readonly checking = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageType = signal<'success' | 'error' | null>(null);
  protected readonly distanceMeters = signal<number | null>(null);
  protected readonly radiusMeters = signal<number | null>(null);
  protected readonly photoFile = signal<File | null>(null);
  protected readonly photoPreview = signal<SafeUrl | null>(null);
  protected readonly photoName = signal<string | null>(null);
  protected readonly photoStatus = signal<PhotoStatus>('idle');
  protected readonly photoError = signal<string | null>(null);
  protected readonly achievements = signal<UserAchievement[]>([]);

  protected readonly hasToken = computed(() => Boolean(this.token()));
  private photoRawUrl: string | null = null;

  ngOnInit(): void {
    const locationId = this.route.snapshot.paramMap.get('locationId');
    this.locationId.set(locationId);

    if (!locationId) {
      return;
    }

    this.token.set(this.session.get(locationId));
    this.loadLocationTitle(locationId);
  }

  ngOnDestroy(): void {
    this.clearPhotoSelection();
  }

  protected achievementIcon = achievementIcon;
  protected achievementCategoryLabel = achievementCategoryLabel;

  private loadLocationTitle(locationId: string): void {
    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const location = response.data.find((item) => item.id === locationId);

          if (location) {
            this.locationTitle.set(location.title);
            this.locationSlug.set(location.slug);
          }
        },
        error: () => {
          // El título es decorativo: no bloquea el check-in si falla.
        },
      });
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    this.clearPhotoSelection();

    if (!file) {
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      this.photoError.set('La foto debe ser una imagen JPEG, PNG o WebP.');
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('La foto no puede superar 5 MB.');
      return;
    }

    this.photoFile.set(file);
    this.photoName.set(file.name);
    this.photoRawUrl = URL.createObjectURL(file);
    this.photoPreview.set(
      this.sanitizer.bypassSecurityTrustUrl(this.photoRawUrl),
    );
    this.photoError.set(null);
  }

  protected removePhoto(): void {
    this.clearPhotoSelection();
  }

  protected async realizarCheckIn(): Promise<void> {
    const locationId = this.locationId();
    const token = this.token();

    if (!locationId || !token) {
      this.finalizarError(
        'No hay un QR cargado para este lugar. Escanea el código del punto de interés.',
      );
      return;
    }

    this.stage.set('locating');
    this.checking.set(true);
    this.message.set(null);
    this.messageType.set(null);

    if (!('geolocation' in navigator)) {
      this.stage.set('idle');
      this.checking.set(false);
      this.finalizarError(
        'Tu navegador no puede obtener la ubicación. Verifica los permisos e inténtalo de nuevo.',
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => this.procesarPosicion(position.coords),
      (error) => this.manejarErrorGeolocalizacion(error),
      GEOLOCATION_OPTIONS,
    );
  }

  protected reintentarFoto(): void {
    const checkInId = this.checkInId();
    const file = this.photoFile();

    if (!checkInId || !file) {
      return;
    }

    this.subirFoto(checkInId, file);
  }

  protected descartarFoto(): void {
    this.clearPhotoSelection();
    this.photoStatus.set('idle');
    this.photoError.set(null);
  }

  protected escanearOtro(): void {
    const locationId = this.locationId();

    if (locationId) {
      this.session.clear(locationId);
    }

    void this.router.navigate(['/checkin']);
  }

  private checkInId = signal<string | null>(null);

  private procesarPosicion(coords: { latitude: number; longitude: number }): void {
    this.stage.set('submitting');

    this.checkInApi
      .createCheckIn({
        locationId: this.locationId()!,
        token: this.token()!,
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.checking.set(false);
          this.stage.set('success');
          this.checkInId.set(response.data.id);
          this.achievements.set(
            (response.achievementsAwarded ?? []).filter(
              (achievement) => achievement.type === 'location',
            ),
          );
          this.session.consume(this.locationId()!);
          this.token.set(null);
          this.message.set(
            '¡Visita confirmada! Chivito celebra este lugar descubierto contigo.',
          );
          this.messageType.set('success');

          const file = this.photoFile();

          if (file) {
            this.subirFoto(response.data.id, file);
          }
        },
        error: (error: unknown) => {
          this.checking.set(false);
          this.stage.set('error');
          this.procesarErrorCheckIn(error);
        },
      });
  }

  private subirFoto(checkInId: string, file: File): void {
    this.photoStatus.set('uploading');
    this.photoError.set(null);

    this.profileApi
      .uploadCheckInPhoto(checkInId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.photoStatus.set('uploaded');
          this.photoError.set(null);
        },
        error: (error: unknown) => {
          this.photoStatus.set('error');
          this.photoError.set(
            apiErrorMessage(
              error,
              'No se pudo guardar la foto. Tu check-in y tus insignias ya quedaron registrados.',
            ),
          );
        },
      });
  }

  private manejarErrorGeolocalizacion(error: GeolocationPositionError): void {
    this.stage.set('idle');
    this.checking.set(false);

    switch (error.code) {
      case error.PERMISSION_DENIED:
        this.finalizarError(
          'No se pudo obtener tu ubicación. Concede permiso de ubicación.',
        );
        break;
      case error.POSITION_UNAVAILABLE:
      case error.TIMEOUT:
        this.finalizarError('No se pudo determinar tu ubicación.');
        break;
      default:
        this.finalizarError('No se pudo determinar tu ubicación.');
    }
  }

  private procesarErrorCheckIn(error: unknown): void {
    const status = (error as { status?: number }).status;
    const body = (
      error as {
        error?: {
          error?: { code?: string; details?: unknown };
        };
      }
    ).error;
    const code = body?.error?.code;
    const details = body?.error?.details as
      | { distanceMeters?: number; radiusMeters?: number }
      | undefined;

    if (code === 'CHECK_IN_ALREADY_EXISTS' || status === 409) {
      this.finalizarError(
        'Ya registraste un check-in en este punto de interés. Puedes verlo en tu perfil.',
      );
      return;
    }

    if (code === 'CHECK_IN_OUTSIDE_GEOFENCE') {
      const distancia = details?.distanceMeters;
      const radio = details?.radiusMeters;

      this.distanceMeters.set(distancia ?? null);
      this.radiusMeters.set(radio ?? null);

      if (typeof distancia === 'number' && typeof radio === 'number') {
        this.finalizarError(
          `Estás demasiado lejos del punto de interés (${Math.round(distancia)} m). Acércate a menos de ${Math.round(radio)} m.`,
        );
      } else {
        this.finalizarError(
          'Estás demasiado lejos del punto de interés. Acércate y vuelve a intentarlo.',
        );
      }
      return;
    }

    if (code === 'INVALID_CHECK_IN_TOKEN') {
      this.finalizarError(
        'El token del QR no es válido o ya fue reemplazado. Escanea el QR actual del lugar.',
      );
      return;
    }

    if (code === 'LOCATION_NOT_AVAILABLE') {
      this.finalizarError(
        'Este lugar no está disponible para check-in en este momento.',
      );
      return;
    }

    if (code === 'LOCATION_NOT_FOUND') {
      this.finalizarError('El punto de interés ya no existe en el catálogo.');
      return;
    }

    this.finalizarError(
      apiErrorMessage(error, 'No se pudo registrar el check-in. Inténtalo de nuevo.'),
    );
  }

  private finalizarError(texto: string): void {
    this.message.set(texto);
    this.messageType.set('error');
  }

  private clearPhotoSelection(): void {
    this.photoFile.set(null);
    this.photoName.set(null);
    this.photoPreview.set(null);

    if (this.photoRawUrl) {
      URL.revokeObjectURL(this.photoRawUrl);
      this.photoRawUrl = null;
    }
  }
}
