import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-panorama-map-redirect',
  template: `
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    } @else {
      <p role="status">Abriendo la escena 360° en el mapa…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanoramaMapRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se indicó la escena 360° que quieres abrir.');
      return;
    }

    void this.router
      .navigate(['/'], {
        queryParams: { panorama: id },
        replaceUrl: true,
      })
      .then((navigated) => {
        if (!navigated) {
          this.error.set('No se pudo abrir la escena 360° en el mapa.');
        }
      })
      .catch(() => this.error.set('No se pudo abrir la escena 360° en el mapa.'));
  }
}
