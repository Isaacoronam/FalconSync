import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

  it('envía el check-in con ubicación y token', () => {
    let received: unknown;

    service.createCheckIn(payload).subscribe((response) => {
      received = response;
    });

    const request = httpMock.expectOne('/api/check-ins');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('Authorization')).toBeNull();

    request.flush({ data: { id: 'ci-1', user: 'user-1', location: 'loc-1' } });

    expect(received).toBeDefined();
  });
});
