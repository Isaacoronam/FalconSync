import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AssistantStatus } from '../models/assistant.model';
import { AssistantApiService } from './assistant-api.service';

describe('AssistantApiService', () => {
  let service: AssistantApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AssistantApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('envía consultas turísticas con el lugar de seguimiento opcional', () => {
    service
      .query('tourist', {
        question: '¿Qué puedo visitar en el casco histórico?',
        contextLocationId: 'location-1',
        locale: 'es',
      })
      .subscribe();

    const request = httpMock.expectOne('/api/assistant/tourist/query');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      question: '¿Qué puedo visitar en el casco histórico?',
      contextLocationId: 'location-1',
      locale: 'es',
    });
    request.flush({ data: {} });
  });

  it('envía consultas turísticas sin lugar de seguimiento cuando no existe', () => {
    service.query('tourist', { question: '¿Qué es Coro?', locale: 'es' }).subscribe();

    const request = httpMock.expectOne('/api/assistant/tourist/query');
    expect(request.request.body).toEqual({
      question: '¿Qué es Coro?',
      locale: 'es',
    });
    expect(request.request.body).not.toHaveProperty('contextLocationId');
    request.flush({ data: {} });
  });

  it('continúa conversaciones técnicas con el identificador de conversación', () => {
    service
      .query('technical', {
        question: '¿Qué precauciones considerar en un muro de tapia?',
        conversationId: 'conversation-1',
        locale: 'es',
      })
      .subscribe();

    const request = httpMock.expectOne('/api/assistant/inspection/query');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      question: '¿Qué precauciones considerar en un muro de tapia?',
      conversationId: 'conversation-1',
      locale: 'es',
    });
    request.flush({ data: {} });
  });

  it('consulta el estado del asistente y devuelve su contenido', () => {
    const status: AssistantStatus = {
      corpusVersion: '2026.11.20-1',
      tourist: { enabled: true, available: true },
      technical: { enabled: false, available: false },
    };
    const received: AssistantStatus[] = [];

    service.getStatus().subscribe((value) => received.push(value));

    const request = httpMock.expectOne('/api/assistant/status');
    expect(request.request.method).toBe('GET');
    request.flush({ data: status });
    expect(received).toEqual([status]);
  });
});
