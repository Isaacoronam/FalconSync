import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QrAdminApiService } from '../../../../core/services/qr-admin-api.service';
import { apiErrorMessage } from '../../../../core/utils/api-error';

@Component({
  selector: 'app-qr-imprimir',
  imports: [RouterLink],
  templateUrl: './qr-imprimir.component.html',
  styleUrl: './qr-imprimir.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrImprimirComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly qrApi = inject(QrAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly locationId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly token = signal<string | null>(null);
  protected readonly tokenVersion = signal<number | null>(null);
  protected readonly rotatedAt = signal<string | null>(null);
  protected readonly locationTitle = signal<string | null>(null);

  ngOnInit(): void {
    this.locationId.set(this.route.snapshot.paramMap.get('id'));
  }

  protected generarQR(): void {
    const id = this.locationId();

    if (!id) {
      return;
    }

    this.generating.set(true);
    this.error.set(null);
    this.success.set(null);
    this.qrDataUrl.set(null);
    this.token.set(null);

    this.qrApi
      .rotateQr(id, 'svg')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.generating.set(false);
          const data = response.data;

          this.qrDataUrl.set(data.qrDataUrl);
          this.token.set(data.token);
          this.tokenVersion.set(data.tokenVersion);
          this.rotatedAt.set(data.rotatedAt);
          this.locationTitle.set(data.location.title);
          this.success.set(
            'QR generado. Imprime o descarga ahora: el token solo se muestra una vez.',
          );
        },
        error: (error: unknown) => {
          this.generating.set(false);
          this.error.set(apiErrorMessage(error, 'No se pudo generar el QR.'));
        },
      });
  }

  protected imprimir(): void {
    window.print();
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected descargarSVG(): void {
    const dataUrl = this.qrDataUrl();

    if (!dataUrl) {
      return;
    }

    const link = document.createElement('a');
    const base64 = dataUrl.split(',')[1];
    const blob = new Blob([atob(base64)], { type: 'image/svg+xml' });
    link.href = URL.createObjectURL(blob);
    link.download = `qr-${this.locationId()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}
