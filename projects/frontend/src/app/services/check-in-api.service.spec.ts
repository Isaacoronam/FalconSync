import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CheckInApiService } from './check-in-api.service';
import { CheckInPayload } from '../models/adventure.model';

const payload: CheckInPayload = {
  locationId: 'loc-1',
  token: 'token-qr-opaco',
  latitude: 11.4075246,
  longitude: -69.6778073,
};

describe('CheckInApiService', () => {
  let service: CheckInApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CheckInApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('envía el check-in como JSON con ubicación y token', () => {
    let received: unknown;

    service.createCheckIn(payload).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/check-ins');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body).not.toBeInstanceOf(FormData);
    expect(request.request.headers.get('Authorization')).toBeNull();

    request.flush({
      data: { id: 'ci-1', user: 'user-1', location: 'loc-1' },
      achievementsAwarded: [],
    });

    expect(received).toBeDefined();
  });

  it('no incluye la foto en la primera petición', () => {
    const file = new File(['contenido'], 'visita.png', {
      type: 'image/png',
    });

    service.createCheckIn({ ...payload, photo: file }).subscribe();

    const request = httpMock.expectOne('/api/check-ins');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body.photo).toBeUndefined();

    request.flush({
      data: { id: 'ci-1', user: 'user-1', location: 'loc-1' },
      achievementsAwarded: [],
    });
  });

  it('devuelve las insignias otorgadas por el check-in', () => {
    let received: { achievementsAwarded: unknown[] } | undefined;

    service.createCheckIn(payload).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/check-ins');
    request.flush({
      data: { id: 'ci-1' },
      achievementsAwarded: [
        {
          id: 'ach-1',
          type: 'location',
          sourceId: 'loc-1',
          sourceSlug: 'catedral',
          name: 'Catedral de Coro',
          description: 'Sello de visita.',
          image: null,
          category: 'religious',
          awardedAt: '2026-11-08T10:00:00.000Z',
          sourceActive: true,
        },
      ],
    });

    expect(received?.achievementsAwarded.length).toBe(1);
  });
});
