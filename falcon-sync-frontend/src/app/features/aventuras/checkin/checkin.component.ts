import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocationApiService } from '../../../core/services/location-api.service';
import { CheckInApiService } from '../../../core/services/check-in-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

type CheckInStage = 'idle' | 'locating' | 'success' | 'error';

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly locationId = signal<string | null>(null);
  protected readonly token = signal<string | null>(null);
  protected readonly tokenPrecargado = signal(false);
  protected readonly locationTitle = signal<string | null>(null);
  protected readonly stage = signal<CheckInStage>('idle');
  protected readonly checking = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageType = signal<'success' | 'error' | null>(null);
  protected readonly distanceMeters = signal<number | null>(null);
  protected readonly radiusMeters = signal<number | null>(null);
  protected readonly photoPreview = signal<SafeUrl | null>(null);
  protected readonly photoName = signal<string | null>(null);

  private photoFile: File | null = null;
  private photoRawUrl: string | null = null;
  private watchId: number | null = null;

  ngOnInit(): void {
    this.locationId.set(this.route.snapshot.paramMap.get('locationId'));
    const queryToken = this.route.snapshot.queryParamMap.get('token');

    if (queryToken) {
      this.token.set(queryToken);
      this.tokenPrecargado.set(true);
    }

    this.loadLocationTitle();
  }

  private loadLocationTitle(): void {
    const id = this.locationId();

    if (!id) {
      return;
    }

    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const location = response.data.find((item) => item.id === id);

          if (location) {
            this.locationTitle.set(location.title);
          }
        },
        error: () => {
          // El título es decorativo: no bloquea el check-in si falla.
        },
      });
  }

  protected tokenError(): string | null {
    if (!this.tokenPrecargado() && !this.token()) {
      return 'El token del QR es obligatorio para hacer check-in.';
    }

    return null;
  }

  protected onTokenInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.token.set(value);
    this.message.set(null);
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
      this.finalizarError('La foto debe ser una imagen JPEG, PNG o WebP.');
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      this.finalizarError('La foto no puede superar 5 MB.');
      return;
    }

    this.photoFile = file;
    this.photoName.set(file.name);
    this.photoRawUrl = URL.createObjectURL(file);
    this.photoPreview.set(
      this.sanitizer.bypassSecurityTrustUrl(this.photoRawUrl),
    );
    this.message.set(null);
    this.messageType.set(null);
  }

  protected removePhoto(): void {
    this.clearPhotoSelection();
    this.message.set(null);
    this.messageType.set(null);
  }

  ngOnDestroy(): void {
    this.clearPhotoSelection();
  }

  private clearPhotoSelection(): void {
    this.photoFile = null;
    this.photoName.set(null);
    this.photoPreview.set(null);

    if (this.photoRawUrl) {
      URL.revokeObjectURL(this.photoRawUrl);
      this.photoRawUrl = null;
    }
  }

  protected async realizarCheckIn(): Promise<void> {
    if (!this.locationId() || !this.token()) {
      this.message.set(this.tokenError() ?? 'Faltan datos para el check-in.');
      this.messageType.set('error');
      return;
    }

    this.stage.set('locating');
    this.checking.set(true);
    this.message.set(null);

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

  private procesarPosicion(coords: { latitude: number; longitude: number }): void {
    this.stage.set('idle');

    this.checkInApi
      .createCheckIn({
        locationId: this.locationId()!,
        token: this.token()!,
        latitude: coords.latitude,
        longitude: coords.longitude,
        photo: this.photoFile ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.checking.set(false);
          this.stage.set('success');
          this.message.set(
            this.photoFile
              ? 'Check-in registrado con tu foto. Se actualizó tu progreso en la aventura.'
              : 'Check-in registrado. Se actualizó tu progreso en la aventura.',
          );
          this.messageType.set('success');
        },
        error: (error: unknown) => {
          this.checking.set(false);
          this.stage.set('error');
          this.procesarErrorCheckIn(error);
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
    const status = (error as { status?: number; error?: { code?: string; details?: unknown } })
      .status;
    const body = (error as { error?: { code?: string; details?: unknown } }).error;
    const code = body?.code;
    const details = body?.details as { distanceMeters?: number; radiusMeters?: number } | undefined;

    if (code === 'CHECK_IN_ALREADY_EXISTS' || status === 409) {
      this.finalizarError(
        'Ya registraste un check-in en este punto de interés.',
      );
      return;
    }

    if (code === 'CHECK_IN_OUTSIDE_GEOFENCE' || status === 400) {
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

    if (code === 'INVALID_CHECK_IN_TOKEN' || status === 400) {
      this.finalizarError('El token del QR no es válido o ha expirado. Pide uno nuevo.');
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

  protected irAlProgreso(slug?: string): void {
    if (slug) {
      void this.router.navigate(['/aventuras', slug, 'progreso']);
    } else {
      void this.router.navigate(['/aventuras']);
    }
  }
}
