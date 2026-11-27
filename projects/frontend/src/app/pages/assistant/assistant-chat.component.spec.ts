import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AssistantAnswer, AssistantStatus } from '../../models/assistant.model';
import { AssistantApiService } from '../../services/assistant-api.service';
import { AuthService } from '../../services/auth.service';
import { LocationApiService } from '../../services/location-api.service';
import { AssistantChatComponent } from './assistant-chat.component';

type ChatFixture = ComponentFixture<AssistantChatComponent>;

const status: AssistantStatus = {
  corpusVersion: '2026.11.20-1',
  tourist: { enabled: true, available: true },
  technical: { enabled: false, available: false },
};

const answer: AssistantAnswer = {
  answerType: 'extractive',
  answer: 'Coro fue inscrito en la Lista del Patrimonio Mundial.',
  abstained: false,
  abstentionReason: null,
  citations: [
    {
      documentId: 'document-1',
      chunkId: 'S-002#p1.01',
      sourceId: 'S-002',
      title: 'Ficha de Coro',
      institution: 'UNESCO',
      sourceLevel: 'A',
      sourceLabel: 'Oficial UNESCO',
      url: 'https://whc.unesco.org/',
      verifiedAt: '2026-11-20T00:00:00.000Z',
      page: '1',
      section: 'Inscripción',
      kind: 'quote',
      quote: 'Coro fue inscrito en 1993.',
      claimType: 'historical',
      factKey: null,
      factValue: null,
      contradictionGroup: null,
      validAsOf: null,
    },
  ],
  sources: [
    {
      id: 'S-002',
      title: 'Ficha de Coro',
      institution: 'UNESCO',
      level: 'A',
      label: 'Oficial UNESCO',
    },
  ],
  confidenceLabel: 'Oficial UNESCO',
  suggestions: [],
  options: [],
  poi: null,
  corpusVersion: 'corpus-test',
  conversationId: null,
  messageId: null,
  latencyMs: 12,
};

const catedral = {
  id: 'poi-1',
  slug: 'catedral-de-coro',
  title: 'Catedral de Coro',
};

function answerWith(overrides: Partial<AssistantAnswer>): AssistantAnswer {
  return { ...answer, ...overrides };
}

function httpError(httpStatus: number, code?: string, message?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: httpStatus,
    error: code ? { error: { code, message } } : undefined,
  });
}

async function createPage(): Promise<{
  fixture: ChatFixture;
  page: HTMLElement;
}> {
  const fixture = TestBed.createComponent(AssistantChatComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, page: fixture.nativeElement as HTMLElement };
}

function textareaOf(page: HTMLElement): HTMLTextAreaElement {
  return page.querySelector('textarea') as HTMLTextAreaElement;
}

function writeQuestion(fixture: ChatFixture, page: HTMLElement, question: string): void {
  const input = textareaOf(page);
  input.value = question;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function askQuestion(fixture: ChatFixture, page: HTMLElement, question: string): void {
  writeQuestion(fixture, page, question);
  page
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}

function buttonByText(page: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(page.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) {
    throw new Error(`No se encontró el botón "${text}"`);
  }
  return button;
}

function clickButton(fixture: ChatFixture, page: HTMLElement, text: string): void {
  buttonByText(page, text).click();
  fixture.detectChanges();
}

describe('AssistantChatComponent', () => {
  let api: {
    query: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };
  let auth: { hasAnyRole: ReturnType<typeof vi.fn> };
  let locations: { list: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      query: vi.fn().mockReturnValue(of({ data: answer })),
      getStatus: vi.fn().mockReturnValue(of(status)),
    };
    auth = { hasAnyRole: vi.fn().mockReturnValue(false) };
    locations = { list: vi.fn().mockReturnValue(of({ data: [] })) };

    await TestBed.configureTestingModule({
      imports: [AssistantChatComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AssistantApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: LocationApiService, useValue: locations },
      ],
    }).compileComponents();
  });

  it('muestra a Chivito como guía turística sin ofrecer apoyo técnico a perfiles no autorizados', async () => {
    const { page } = await createPage();

    expect(page.textContent).toContain('¿Qué te gustaría descubrir de Coro?');
    expect(page.textContent).toContain('Chivito');
    expect(page.textContent).toContain('Guía turístico de FalconSync');
    expect(page.querySelector('.chat__avatar')).not.toBeNull();
    expect(page.textContent).not.toContain('Apoyo técnico');
    expect(page.querySelector('#chat-question')).not.toBeNull();
  });

  it('carga el estado al iniciar y muestra la disponibilidad con la versión del corpus', async () => {
    const { page } = await createPage();

    expect(api.getStatus).toHaveBeenCalledTimes(1);
    expect(page.textContent).toContain('Chivito disponible · corpus 2026.11.20-1');
    expect(textareaOf(page).disabled).toBe(false);
  });

  it('deshabilita el composer y las preguntas mientras el turista no está disponible', async () => {
    api.getStatus.mockReturnValue(of({ ...status, tourist: { enabled: true, available: false } }));
    const { page } = await createPage();

    expect(page.textContent).toContain('Chivito en preparación');
    expect(textareaOf(page).disabled).toBe(true);
    expect(buttonByText(page, 'Enviar pregunta').disabled).toBe(true);
    expect(buttonByText(page, '¿Qué es Coro?').disabled).toBe(true);
  });

  it('muestra el error de estado y vuelve a pedirlo con Reintentar', async () => {
    api.getStatus.mockReturnValueOnce(throwError(() => httpError(500)));
    const { fixture, page } = await createPage();

    expect(page.textContent).toContain('No se pudo verificar el estado');
    expect(textareaOf(page).disabled).toBe(true);

    clickButton(fixture, page, 'Reintentar');

    expect(api.getStatus).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain('Chivito disponible');
    expect(textareaOf(page).disabled).toBe(false);
  });

  it('envía la pregunta turística sin lugar de seguimiento y presenta la cita recibida', async () => {
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Cuándo fue inscrita Coro?');

    expect(api.query).toHaveBeenCalledWith('tourist', {
      question: '¿Cuándo fue inscrita Coro?',
      locale: 'es',
    });
    expect(page.textContent).toContain('Coro fue inscrito en 1993.');
    expect(page.textContent).toContain('Ficha de Coro');
    expect(page.querySelectorAll('.chat-message__avatar')).toHaveLength(1);
    expect(page.querySelector('.chat-message--assistant')?.textContent).toContain('Chivito');
  });

  it.each(['ASSISTANT_UNAVAILABLE', 'ASSISTANT_MODEL_UNAVAILABLE'])(
    'ante un 503 (%s) muestra un mensaje general y vuelve a pedir el estado',
    async (code) => {
      api.query.mockReturnValue(
        throwError(() => httpError(503, code, 'Detalle interno del servidor')),
      );
      const { fixture, page } = await createPage();

      askQuestion(fixture, page, '¿Qué puedo visitar en Coro?');

      expect(api.getStatus).toHaveBeenCalledTimes(2);
      expect(page.textContent).toContain(
        'Chivito no está disponible en este momento. Inténtalo más tarde.',
      );
      expect(page.textContent).not.toContain('Detalle interno del servidor');
    },
  );

  it('conserva el mensaje de otros errores de consulta', async () => {
    api.query.mockReturnValue(
      throwError(() =>
        httpError(400, 'INVALID_QUESTION', 'La pregunta debe tener entre 3 y 2000 caracteres.'),
      ),
    );
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Qué es Coro?');

    expect(page.textContent).toContain('La pregunta debe tener entre 3 y 2000 caracteres.');
    expect(api.getStatus).toHaveBeenCalledTimes(1);
  });

  it('no duplica el texto de abstención y lo muestra con un estilo discreto', async () => {
    const abstention = 'No hay una fuente vigente que informe el horario de la catedral.';
    api.query.mockReturnValue(
      of({
        data: answerWith({
          answerType: 'abstention',
          answer: abstention,
          abstained: true,
          abstentionReason: 'NO_CURRENT_STATUS',
          citations: [],
        }),
      }),
    );
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿A qué hora abre la catedral?');

    expect(page.textContent?.split(abstention)).toHaveLength(2);
    expect(page.textContent).not.toContain('No se encontró evidencia suficiente para responder.');
    expect(page.querySelector('.chat-message--abstained')).not.toBeNull();
  });

  it('envía una sugerencia como pregunta nueva, sin lugar de seguimiento', async () => {
    api.query.mockReturnValue(
      of({
        data: answerWith({
          answerType: 'abstention',
          answer: 'No tengo evidencia suficiente sobre ese horario.',
          abstained: true,
          abstentionReason: 'NO_EVIDENCE',
          suggestions: ['¿Qué es Coro?'],
          poi: catedral,
        }),
      }),
    );
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Cuál es el horario de la catedral?');
    clickButton(fixture, page, '¿Qué es Coro?');

    expect(api.query).toHaveBeenCalledTimes(2);
    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: '¿Qué es Coro?',
      locale: 'es',
    });
  });

  it('una sugerencia no borra el borrador que el usuario está escribiendo', async () => {
    api.query.mockReturnValue(of({ data: answerWith({ suggestions: ['¿Qué es Coro?'] }) }));
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Qué es FALCONSYNC?');
    writeQuestion(fixture, page, 'Borrador en curso');
    clickButton(fixture, page, '¿Qué es Coro?');

    expect(textareaOf(page).value).toBe('Borrador en curso');
  });

  it('envía el título y el identificador de la opción elegida', async () => {
    api.query.mockReturnValue(
      of({
        data: answerWith({
          answerType: 'clarification',
          answer: '¿A cuál lugar te refieres?',
          abstained: true,
          abstentionReason: 'AMBIGUOUS_POI',
          options: [
            { id: 'poi-1', title: 'Catedral de Coro' },
            { id: 'poi-2', title: 'Lugar alternativo' },
          ],
        }),
      }),
    );
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Dónde está la catedral?');
    clickButton(fixture, page, 'Catedral de Coro');

    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: 'Catedral de Coro',
      contextLocationId: 'poi-1',
      locale: 'es',
    });
  });

  it('envía el lugar de la respuesta anterior como pista en la siguiente pregunta escrita', async () => {
    api.query.mockReturnValue(of({ data: answerWith({ poi: catedral }) }));
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Dónde está la catedral?');
    askQuestion(fixture, page, '¿Qué se puede visitar allí?');

    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: '¿Qué se puede visitar allí?',
      contextLocationId: 'poi-1',
      locale: 'es',
    });
  });

  it('conserva el lugar de seguimiento hasta que una respuesta trae otro lugar', async () => {
    const otroLugar = { id: 'poi-2', slug: 'otro-lugar', title: 'Otro lugar' };
    api.query
      .mockReturnValueOnce(of({ data: answerWith({ poi: catedral }) }))
      .mockReturnValueOnce(of({ data: answerWith({ poi: null }) }))
      .mockReturnValueOnce(of({ data: answerWith({ poi: otroLugar }) }));
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Dónde está la catedral?');
    askQuestion(fixture, page, '¿Qué es FALCONSYNC?');
    askQuestion(fixture, page, '¿Y su horario?');
    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: '¿Y su horario?',
      contextLocationId: 'poi-1',
      locale: 'es',
    });

    askQuestion(fixture, page, '¿Y los accesos?');
    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: '¿Y los accesos?',
      contextLocationId: 'poi-2',
      locale: 'es',
    });
  });

  it('no muestra selector de lugar ni consulta la lista de lugares', async () => {
    const { page } = await createPage();

    expect(page.querySelector('select')).toBeNull();
    expect(page.textContent).not.toContain('Acotar a un lugar');
    expect(locations.list).not.toHaveBeenCalled();
  });

  it('muestra el alcance actualizado de la guía y sus preguntas de inicio', async () => {
    const { page } = await createPage();

    expect(page.querySelector('h1')?.textContent).toContain('Conoce Coro con Chivito');
    expect(page.textContent).toContain('Cada respuesta muestra sus fuentes.');
    expect(page.textContent).toContain('¿Qué es FALCONSYNC?');
    expect(page.textContent).not.toContain('Respuestas con citas');
  });

  it('habilita el apoyo técnico cuando el servicio lo tiene disponible', async () => {
    auth.hasAnyRole.mockReturnValue(true);
    api.getStatus.mockReturnValue(of({ ...status, technical: { enabled: true, available: true } }));
    const { fixture, page } = await createPage();

    expect(buttonByText(page, 'Apoyo técnico preliminar').disabled).toBe(false);
    clickButton(fixture, page, 'Apoyo técnico preliminar');

    expect(page.textContent).toContain('El apoyo técnico es preliminar.');
  });

  it('muestra el apoyo técnico deshabilitado mientras está en preparación', async () => {
    auth.hasAnyRole.mockReturnValue(true);
    const { fixture, page } = await createPage();

    expect(buttonByText(page, 'Apoyo técnico (en preparación)').disabled).toBe(true);
    clickButton(fixture, page, 'Apoyo técnico (en preparación)');

    expect(page.textContent).not.toContain('El apoyo técnico es preliminar.');
  });

  it('ofrece abrir el bot de Telegram desde la guía turística', async () => {
    const { page } = await createPage();

    const link = page.querySelector('.chat-telegram__action') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://t.me/Falconsync_bot');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('aria-label')).toBe('Abrir @Falconsync_bot en Telegram');
    expect(link?.querySelector('.chat-telegram__icon svg')).not.toBeNull();
    expect(link?.textContent).toContain('@Falconsync_bot');
  });

  it('oculta el acceso a Telegram en el apoyo técnico', async () => {
    auth.hasAnyRole.mockReturnValue(true);
    api.getStatus.mockReturnValue(of({ ...status, technical: { enabled: true, available: true } }));
    const { fixture, page } = await createPage();

    expect(page.querySelector('.chat-telegram')).not.toBeNull();
    clickButton(fixture, page, 'Apoyo técnico preliminar');

    expect(page.querySelector('.chat-telegram')).toBeNull();
  });

  it('no reutiliza el lugar de seguimiento en apoyo técnico ni al volver a turismo', async () => {
    auth.hasAnyRole.mockReturnValue(true);
    api.getStatus.mockReturnValue(of({ ...status, technical: { enabled: true, available: true } }));
    api.query.mockReturnValueOnce(of({ data: answerWith({ poi: catedral }) }));
    const { fixture, page } = await createPage();

    askQuestion(fixture, page, '¿Dónde está la catedral?');
    clickButton(fixture, page, 'Apoyo técnico preliminar');
    askQuestion(
      fixture,
      page,
      '¿Qué medidas preventivas se recomiendan antes de intervenir un muro?',
    );

    expect(api.query).toHaveBeenLastCalledWith('technical', {
      question: '¿Qué medidas preventivas se recomiendan antes de intervenir un muro?',
      locale: 'es',
    });

    clickButton(fixture, page, 'Visita y patrimonio');
    askQuestion(fixture, page, '¿Qué es Coro?');

    expect(api.query).toHaveBeenLastCalledWith('tourist', {
      question: '¿Qué es Coro?',
      locale: 'es',
    });
  });

  it('baja el historial al último mensaje cuando llega una respuesta', async () => {
    const { fixture, page } = await createPage();
    const history = page.querySelector('.chat__messages') as HTMLElement;
    const scrollTo = vi.fn();
    Object.defineProperty(history, 'scrollTo', { configurable: true, value: scrollTo });

    askQuestion(fixture, page, '¿Qué es Coro?');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(history.getAttribute('aria-label')).toBe('Historial de la conversación');
    expect(history.tabIndex).toBe(0);
    expect(scrollTo).toHaveBeenCalled();
    const options = scrollTo.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
    expect(options?.top).toBe(history.scrollHeight);
    expect(['smooth', 'auto']).toContain(options?.behavior);
  });

  it('no arrastra la vista si la persona está leyendo mensajes anteriores', async () => {
    const response = new Subject<{ data: AssistantAnswer }>();
    api.query.mockReturnValue(response.asObservable());
    const { fixture, page } = await createPage();
    const history = page.querySelector('.chat__messages') as HTMLElement;
    const scrollTo = vi.fn();
    let scrollTop = 0;
    Object.defineProperties(history, {
      scrollTo: { configurable: true, value: scrollTo },
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
    });

    askQuestion(fixture, page, '¿Qué es Coro?');
    fixture.detectChanges();
    scrollTo.mockClear();

    scrollTop = 500;
    history.dispatchEvent(new Event('scroll'));
    scrollTop = 300;
    history.dispatchEvent(new Event('scroll'));

    response.next({ data: answer });
    response.complete();
    fixture.detectChanges();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
