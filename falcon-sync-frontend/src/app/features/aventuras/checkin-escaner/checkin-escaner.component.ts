import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CheckInSessionService } from '../../../core/services/check-in-session.service';
import { parseCheckInQr } from '../../../core/utils/check-in-qr';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const SCAN_INTERVAL_MS = 350;

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const detector = (window as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }).BarcodeDetector;

  return typeof detector === 'function' ? detector : null;
}

@Component({
  selector: 'app-checkin-escaner',
  imports: [FormsModule, RouterLink],
  templateUrl: './checkin-escaner.component.html',
  styleUrl: './checkin-escaner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckinEscanerComponent implements OnDestroy {
  private readonly session = inject(CheckInSessionService);
  private readonly router = inject(Router);
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly detectorAvailable = getBarcodeDetector() !== null;
  protected readonly cameraAvailable =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  protected readonly scanning = signal(false);
  protected readonly scanError = signal<string | null>(null);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly manualValue = signal('');
  protected readonly manualError = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private detector: BarcodeDetectorLike | null = null;
  private scanTimer: number | null = null;

  ngOnDestroy(): void {
    this.stopCamera();
  }

  protected async startCamera(): Promise<void> {
    this.stopCamera();
    this.scanError.set(null);
    this.cameraError.set(null);

    if (!this.cameraAvailable) {
      this.cameraError.set(
        'Tu navegador no permite abrir la cámara. Usa la entrada manual con el contenido del QR.',
      );
      return;
    }

    const Detector = getBarcodeDetector();

    if (!Detector) {
      this.cameraError.set(
        'Tu navegador no admite la lectura automática de QR. Usa la entrada manual.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = this.videoRef()?.nativeElement;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.detector = new Detector({ formats: ['qr_code'] });
      this.scanning.set(true);
      this.scheduleScan();
    } catch (error) {
      this.stopCamera();
      this.cameraError.set(this.describeCameraError(error));
    }
  }

  protected stopCamera(): void {
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.detector = null;

    const video = this.videoRef()?.nativeElement;

    if (video) {
      video.srcObject = null;
    }

    this.scanning.set(false);
  }

  protected onManualInput(event: Event): void {
    this.manualValue.set((event.target as HTMLTextAreaElement).value);
    this.manualError.set(null);
  }

  protected submitManual(): void {
    const parsed = parseCheckInQr(this.manualValue());

    if (!parsed) {
      this.manualError.set(
        'El contenido no es un QR de check-in válido. Pega el texto completo del código o abre el enlace del QR.',
      );
      return;
    }

    this.openCheckIn(parsed.locationId, parsed.token);
  }

  protected dismissScanError(): void {
    this.scanError.set(null);
  }

  private scheduleScan(): void {
    if (!this.scanning()) {
      return;
    }

    this.scanTimer = window.setTimeout(() => {
      void this.scanFrame();
    }, SCAN_INTERVAL_MS);
  }

  private async scanFrame(): Promise<void> {
    if (!this.scanning()) {
      return;
    }

    const video = this.videoRef()?.nativeElement;
    const detector = this.detector;

    if (!video || !detector) {
      this.scheduleScan();
      return;
    }

    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video);
        const raw = codes.find(
          (code) => typeof code.rawValue === 'string' && code.rawValue.length > 0,
        )?.rawValue;

        if (raw) {
          const parsed = parseCheckInQr(raw);

          if (parsed) {
            this.stopCamera();
            this.openCheckIn(parsed.locationId, parsed.token);
            return;
          }

          this.scanError.set(
            'Ese código QR no pertenece a una parada de FalconSync. Apunta al QR oficial del punto de interés.',
          );
        }
      }
    } catch {
      this.cameraError.set(
        'La cámara dejó de responder. Cierra otras aplicaciones que la usen e inténtalo de nuevo.',
      );
      this.stopCamera();
      return;
    }

    this.scheduleScan();
  }

  private openCheckIn(locationId: string, token: string): void {
    // El token vive solo en este servicio en memoria y nunca se añade a la URL.
    this.session.set(locationId, token);
    void this.router.navigate(['/checkin', locationId]);
  }

  private describeCameraError(error: unknown): string {
    const name = (error as { name?: string } | null)?.name;

    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'No se concedió permiso para usar la cámara. Habilítalo en el navegador o usa la entrada manual.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No se encontró una cámara disponible. Usa la entrada manual con el contenido del QR.';
      case 'NotReadableError':
        return 'La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.';
      default:
        return 'No se pudo abrir la cámara. Usa la entrada manual con el contenido del QR.';
    }
  }
}
