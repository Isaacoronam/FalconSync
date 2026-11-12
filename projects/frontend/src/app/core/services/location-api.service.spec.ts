import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FalconLocation } from '../models/location.model';
import { LocationApiService } from './location-api.service';

const catedral: FalconLocation = {
  id: '1',
  title: 'Catedral de Coro',
  slug: 'catedral-de-coro',
  category: 'religious',
  description: 'Templo colonial frente a la Plaza Bolívar.',
  address: 'Frente a la Plaza Bolívar, casco histórico de Coro',
  circuits: ['casco-historico'],
  tags: ['colonial', 'unesco'],
  historicalPeriod: 'Siglos XVI-XVIII',
  location: {
    type: 'Point',
    coordinates: [-69.6778073, 11.4075246],
  },
  images: ['/images/locations/catedral-de-coro.jpg'],
  conservationStatus: 'unknown',
  sourceUrl: 'https://www.openstreetmap.org/way/370610638',
  coordinateSource: 'OpenStreetMap way 370610638',
  coordinateVerifiedAt: '2026-11-06T00:00:00.000Z',
  verificationLevel: 'single-source',
  isProvisional: false,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

describe('LocationApiService', () => {
  let service: LocationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LocationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lista los lugares sin filtro', () => {
    service.list().subscribe((response) => {
      expect(response.meta.total).toBe(1);
      expect(response.data[0].slug).toBe('catedral-de-coro');
      expect(response.data[0].images).toEqual(['/images/locations/catedral-de-coro.jpg']);
    });

    const request = httpMock.expectOne('/api/locations');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [catedral],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
  });

  it('envía los filtros de categoría, circuito y etiqueta a la API', () => {
    service
      .list({
        category: 'religious',
        circuit: 'casco-historico',
        tag: 'unesco',
        includeProvisional: true,
      })
      .subscribe();

    const request = httpMock.expectOne(
      '/api/locations?category=religious&circuit=casco-historico&tag=unesco&includeProvisional=true',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [catedral],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
  });
});
