import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChannelLinkApiService } from './channel-link-api.service';

describe('ChannelLinkApiService', () => {
  let service: ChannelLinkApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ChannelLinkApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('consulta el estado del vínculo de Telegram', () => {
    service.getTelegramStatus().subscribe();

    const request = httpMock.expectOne('/api/channels/telegram');
    expect(request.request.method).toBe('GET');
    request.flush({ data: { linked: false, channel: 'telegram' } });
  });

  it('genera un código de vinculación', () => {
    service.createTelegramCode().subscribe();

    const request = httpMock.expectOne('/api/channels/telegram/link-code');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      data: {
        code: 'ABCD2345',
        expiresAt: '2026-11-25T18:00:00.000Z',
        ttlMinutes: 10,
      },
    });
  });

  it('revoca el vínculo de Telegram', () => {
    service.unlinkTelegram().subscribe();

    const request = httpMock.expectOne('/api/channels/telegram');
    expect(request.request.method).toBe('DELETE');
    request.flush({ data: { linked: false, channel: 'telegram' } });
  });
});
