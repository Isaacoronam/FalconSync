import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProfileApiService } from './profile-api.service';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('pagina la galería y filtra por presencia de foto', () => {
    service.getGallery(2, 9, true).subscribe();

    const request = httpMock.expectOne(
      '/api/profile/check-ins?page=2&limit=9&hasPhoto=true',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [],
      meta: { page: 2, limit: 9, total: 0, totalPages: 0 },
    });
  });

  it('omite el filtro de foto cuando no se indica', () => {
    service.getGallery(1, 9).subscribe();

    const request = httpMock.expectOne('/api/profile/check-ins?page=1&limit=9');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [],
      meta: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });
  });

  it('sube la foto de un check-in con multipart', () => {
    const file = new File(['contenido'], 'visita.png', {
      type: 'image/png',
    });

    service.uploadCheckInPhoto('ci-1', file).subscribe();

    const request = httpMock.expectOne('/api/profile/check-ins/ci-1/photo');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('image')).toBe(file);
    request.flush({ data: { checkIn: { id: 'ci-1' } } });
  });

  it('elimina la foto de un check-in', () => {
    service.deleteCheckInPhoto('ci-1').subscribe();

    const request = httpMock.expectOne('/api/profile/check-ins/ci-1/photo');
    expect(request.request.method).toBe('DELETE');
    request.flush({ data: { checkIn: { id: 'ci-1' } } });
  });

  it('descarga las imágenes privadas como blob autenticado', () => {
    const blob = new Blob(['imagen'], { type: 'image/png' });
    let received: Blob | undefined;

    service.getPrivateImage('/api/profile/check-ins/ci-1/photo?v=1').subscribe(
      (response) => {
        received = response;
      },
    );

    const request = httpMock.expectOne(
      '/api/profile/check-ins/ci-1/photo?v=1',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(blob);

    expect(received).toBeInstanceOf(Blob);
  });
});
