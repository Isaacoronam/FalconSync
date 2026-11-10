import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdventureApiService } from './adventure-api.service';
import { Adventure, AdventureProgress } from '../models/adventure.model';

const adventure: Adventure = {
  id: 'adv-1',
  title: 'Ruta del Centro',
  slug: 'ruta-del-centro',
  summary: 'Resumen de la aventura.',
  description: 'Descripción larga de la aventura con más de veinte caracteres.',
  difficulty: 'easy',
  estimatedMinutes: 60,
  status: 'published',
  badge: null,
  stopsCount: 3,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

describe('AdventureApiService', () => {
  let service: AdventureApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdventureApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lista aventuras publicadas con paginación', () => {
    let received: { data: Adventure[] } | undefined;

    service.list(1, 20).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/adventures?page=1&limit=20');
    expect(request.request.method).toBe('GET');

    request.flush({ data: [adventure], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });

    expect(received?.data).toEqual([adventure]);
  });

  it('obtiene el detalle de una aventura por slug con sus paradas', () => {
    let received: { data: Adventure & { stops: unknown[] } } | undefined;

    service.getBySlug('ruta-del-centro').subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/adventures/ruta-del-centro');
    expect(request.request.method).toBe('GET');

    request.flush({
      data: { ...adventure, stops: [] },
    });

    expect(received?.data.slug).toBe('ruta-del-centro');
  });

  it('obtiene el progreso de una aventura', () => {
    const progress: AdventureProgress = {
      adventure,
      stops: [],
      totalStops: 0,
      visitedStops: 0,
      remainingStops: 0,
      percentage: 0,
      nextStop: null,
      completed: false,
      completedAt: null,
    };
    let received: { data: typeof progress } | undefined;

    service.getProgress('ruta-del-centro').subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/adventures/ruta-del-centro/progress');
    expect(request.request.method).toBe('GET');

    request.flush({ data: progress });

    expect(received?.data.percentage).toBe(0);
  });

  it('lista aventuras administrativas con filtros', () => {
    let received: unknown;

    service.listAdmin({ q: 'ruta', status: 'published', page: 2, limit: 10 }).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne(
      '/api/admin/adventures?q=ruta&status=published&page=2&limit=10',
    );
    expect(request.request.method).toBe('GET');

    request.flush({ data: [adventure], meta: { page: 2, limit: 10, total: 1, totalPages: 1 } });

    expect(received).toBeDefined();
  });

  it('crea una aventura como borrador', () => {
    let received: { data: Adventure } | undefined;

    service.createAdmin(adventure).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/admin/adventures');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.title).toBe('Ruta del Centro');

    request.flush({ data: adventure });

    expect(received?.data.id).toBe('adv-1');
  });

  it('publica una aventura', () => {
    let received: { data: Adventure } | undefined;

    service.publishAdmin('adv-1').subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/admin/adventures/adv-1/publish');
    expect(request.request.method).toBe('POST');

    request.flush({ data: { ...adventure, status: 'published' } });

    expect(received?.data.status).toBe('published');
  });

  it('añade una parada a una aventura', () => {
    const stop = {
      id: 'stop-1',
      order: 1,
      location: { id: 'loc-1', title: 'Catedral de Coro' },
    };
    let receivedStop: { data: typeof stop } | undefined;

    service.addStop('adv-1', { locationId: 'loc-1', order: 1 }).subscribe((response) => {
      receivedStop = response;
    });

    const request = httpMock.expectOne('/api/admin/adventures/adv-1/stops');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.locationId).toBe('loc-1');

    request.flush({ data: stop });

    expect(receivedStop?.data.id).toBe('stop-1');
  });
});
