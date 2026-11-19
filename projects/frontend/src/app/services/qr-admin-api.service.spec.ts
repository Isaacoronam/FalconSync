import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QrAdminApiService } from './qr-admin-api.service';

describe('QrAdminApiService', () => {
  let service: QrAdminApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(QrAdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('rota el QR de un POI en formato SVG', () => {
    let received: unknown;

    service.rotateQr('loc-1', 'svg').subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne(
      '/api/admin/locations/loc-1/qr/rotate?format=svg',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});

    request.flush({
      data: {
        location: { id: 'loc-1', title: 'Catedral de Coro' },
        token: 'token-opaco',
        tokenVersion: 1,
        rotatedAt: '2026-11-05T12:00:00.000Z',
        format: 'svg',
        qrDataUrl: 'data:image/svg+xml;base64,...',
      },
    });

    expect(received).toBeDefined();
  });

  it('rota el QR en formato PNG por defecto cuando se omite', () => {
    service.rotateQr('loc-1').subscribe();

    const request = httpMock.expectOne(
      '/api/admin/locations/loc-1/qr/rotate?format=svg',
    );
    expect(request.request.method).toBe('POST');
    request.flush({
      data: {
        location: { id: 'loc-1', title: 'Catedral de Coro' },
        token: 'token-opaco',
        tokenVersion: 1,
        rotatedAt: '2026-11-05T12:00:00.000Z',
        format: 'svg',
        qrDataUrl: 'data:image/svg+xml;base64,...',
      },
    });
  });
});
