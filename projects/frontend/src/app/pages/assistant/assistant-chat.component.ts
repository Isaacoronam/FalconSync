import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AssistantCitation,
  AssistantOption,
  AssistantPoi,
  AssistantQueryRequest,
  AssistantScope,
  AssistantStatus,
  ChatMessage,
} from '../../models/assistant.model';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { AssistantApiService } from '../../services/assistant-api.service';
import { CHIVITO, TECHNICAL_GUIDE_NAME } from '../../services/utils/chivito';
import { apiErrorMessage } from '../../services/utils/api-error';

const TOURIST_PROMPTS = [
  '¿Qué es Coro?',
  '¿Qué es FALCONSYNC?',
  '¿Qué es el adobe y qué es la tapia?',
  '¿Dónde está la Catedral y a qué hora son las misas?',
];

const TECHNICAL_PROMPTS = [
  '¿Qué factores conviene documentar al observar un muro de tapia?',
  '¿Qué diferencias constructivas hay entre tapia y adobe?',
  '¿Qué medidas preventivas se recomiendan antes de intervenir un muro?',
];

const UNAVAILABLE_MESSAGE = 'Chivito no está disponible en este momento. Inténtalo más tarde.';
const QUERY_ERROR_MESSAGE = 'No se pudo consultar a Chivito.';

type StatusState = 'loading' | 'ready' | 'error';

interface AvailabilityView {
  tone: 'available' | 'error' | 'neutral';
  label: string;
}

/** El backend responde 503 cuando no puede atender la consulta en este momento. */
function isAssistantUnavailable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 503;
}

@Component({
  selector: 'app-assistant-chat',
  imports: [RouterLink],
  templateUrl: './assistant-chat.component.html',
  styleUrl: './assistant-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantChatComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly assistantApi = inject(AssistantApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly chivito = CHIVITO;
  protected readonly technicalGuideName = TECHNICAL_GUIDE_NAME;
  protected readonly telegramBotUrl = environment.telegramBotUrl;
  protected readonly mode = signal<AssistantScope>('tourist');
  protected readonly draft = signal('');
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<AssistantStatus | null>(null);
  protected readonly statusState = signal<StatusState>('loading');
  protected readonly canUseTechnical = computed(() =>
    this.auth.hasAnyRole('historian', 'inspector'),
  );
  protected readonly touristAvailable = computed(() => this.status()?.tourist.available === true);
  protected readonly technicalAvailable = computed(
    () => this.status()?.technical.available === true,
  );
  /** Solo es true si el estado está listo y el modo activo está disponible. */
  protected readonly canUseChat = computed(() => {
    if (this.statusState() !== 'ready') {
      return false;
    }

    return this.mode() === 'tourist' ? this.touristAvailable() : this.technicalAvailable();
  });
  protected readonly availability = computed<AvailabilityView>(() => {
    if (this.statusState() === 'loading') {
      return { tone: 'neutral', label: 'Comprobando disponibilidad…' };
    }

    if (this.statusState() === 'error') {
      return { tone: 'error', label: 'No se pudo verificar el estado' };
    }

    if (!this.touristAvailable()) {
      return { tone: 'neutral', label: 'Chivito en preparación' };
    }

    const corpusVersion = this.status()?.corpusVersion;
    return {
      tone: 'available',
      label: corpusVersion ? `Chivito disponible · corpus ${corpusVersion}` : 'Chivito disponible',
    };
  });
  protected readonly thinkingLabel = computed(() =>
    this.mode() === 'tourist' ? 'Chivito está pensando…' : 'Buscando en las fuentes disponibles…',
  );
  protected readonly prompts = computed(() =>
    this.mode() === 'tourist' ? TOURIST_PROMPTS : TECHNICAL_PROMPTS,
  );
  protected readonly characterCount = computed(() => this.draft().length);
  private conversationId: string | null = null;
  /** Último lugar de una respuesta turística. Vive solo en memoria. */
  private trackedPlace: Pick<AssistantPoi, 'id' | 'title'> | null = null;
  /** Cambia al cambiar de modo para descartar respuestas de la conversación anterior. */
  private conversationEpoch = 0;
  private messageSequence = 0;
  private statusRequest: Subscription | null = null;
  private readonly messagesRef = viewChild<ElementRef<HTMLElement>>('messageHistory');
  /** Indica si el historial debe seguir el mensaje más reciente. */
  private followLatest = true;
  private lastScrollTop = 0;

  constructor() {
    afterRenderEffect(() => {
      const hasContent = this.messages().length > 0 || this.sending() || this.error() !== null;
      if (hasContent) {
        this.scrollMessagesToEnd();
      }
    });
  }

  ngOnInit(): void {
    this.loadStatus();
  }

  protected loadStatus(): void {
    this.statusRequest?.unsubscribe();
    this.statusState.set('loading');
    this.statusRequest = this.assistantApi
      .getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.status.set(status);
          this.statusState.set('ready');
        },
        error: () => {
          this.status.set(null);
          this.statusState.set('error');
        },
      });
  }

  protected setMode(mode: AssistantScope): void {
    if (mode === 'technical' && (!this.canUseTechnical() || !this.technicalAvailable())) {
      return;
    }

    if (this.mode() !== mode) {
      this.mode.set(mode);
      this.messages.set([]);
      this.conversationId = null;
      this.trackedPlace = null;
      this.conversationEpoch += 1;
      this.sending.set(false);
      this.error.set(null);
      this.followLatest = true;
    }
  }

  protected updateDraft(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.draft.set(target.value);
    }
  }

  protected usePrompt(prompt: string): void {
    this.draft.set(prompt);
    this.error.set(null);
  }

  protected send(): void {
    this.submitQuestion(this.draft().trim(), this.trackedPlace?.id, true);
  }

  /** Una sugerencia es una pregunta nueva: no lleva lugar de seguimiento. */
  protected askSuggestion(suggestion: string): void {
    this.submitQuestion(suggestion.trim());
  }

  /** Una opción de aclaración indica el lugar exacto al que se refiere la pregunta. */
  protected askOption(option: AssistantOption): void {
    this.submitQuestion(option.title.trim(), option.id);
  }

  protected onEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.send();
  }

  /**
   * Sigue el final solo si la persona está cerca de él. Desplazarse hacia arriba
   * desactiva el seguimiento para no arrastrar la vista mientras lee.
   */
  protected onMessagesScroll(): void {
    const history = this.messagesRef()?.nativeElement;
    if (!history) {
      return;
    }

    const scrolledUp = history.scrollTop < this.lastScrollTop - 1;
    const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight <= 80;
    this.lastScrollTop = history.scrollTop;

    if (nearBottom) {
      this.followLatest = true;
    } else if (scrolledUp) {
      this.followLatest = false;
    }
  }

  protected citationDetails(citation: AssistantCitation): string {
    return [
      citation.sourceLabel,
      citation.institution,
      citation.page ? `p. ${citation.page}` : null,
      citation.section,
    ]
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Envía una pregunta al modo activo. `contextLocationId` solo viaja en turismo.
   * Si `fromComposer` es true, el borrador se limpia al recibir la respuesta.
   */
  private submitQuestion(question: string, contextLocationId?: string, fromComposer = false): void {
    if (!this.canUseChat() || this.sending() || question.length < 2 || question.length > 2000) {
      return;
    }

    const scope = this.mode();
    const epoch = this.conversationEpoch;
    const request: AssistantQueryRequest = {
      question,
      locale: 'es',
      ...(scope === 'tourist' && contextLocationId ? { contextLocationId } : {}),
      ...(scope === 'technical' && this.conversationId
        ? { conversationId: this.conversationId }
        : {}),
    };

    this.sending.set(true);
    this.error.set(null);
    this.followLatest = true;
    this.assistantApi
      .query(scope, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          // Una respuesta de la conversación anterior no debe mezclarse con el modo actual.
          if (epoch !== this.conversationEpoch) {
            return;
          }

          this.messages.update((messages) => [
            ...messages,
            {
              id: this.nextMessageId(),
              role: 'user',
              content: question,
              citations: [],
              abstained: false,
              suggestions: [],
              options: [],
            },
            {
              id: this.nextMessageId(),
              role: 'assistant',
              content: data.answer,
              citations: data.citations,
              abstained: data.abstained,
              suggestions: data.suggestions,
              options: data.options,
            },
          ]);
          if (scope === 'technical') {
            this.conversationId = data.conversationId;
          }
          // Sin lugar nuevo se conserva el anterior como pista.
          if (scope === 'tourist' && data.poi) {
            this.trackedPlace = { id: data.poi.id, title: data.poi.title };
          }
          if (fromComposer) {
            this.draft.set('');
          }
          this.sending.set(false);
        },
        error: (error: unknown) => {
          const unavailable = isAssistantUnavailable(error);
          if (unavailable) {
            this.loadStatus();
          }

          if (epoch !== this.conversationEpoch) {
            return;
          }

          this.error.set(
            unavailable ? UNAVAILABLE_MESSAGE : apiErrorMessage(error, QUERY_ERROR_MESSAGE),
          );
          this.sending.set(false);
        },
      });
  }

  /** Baja al último mensaje sin arrastrar la vista si la persona lee hacia arriba. */
  private scrollMessagesToEnd(): void {
    const history = this.messagesRef()?.nativeElement;
    if (!history || !this.followLatest) {
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof history.scrollTo === 'function') {
      history.scrollTo({
        top: history.scrollHeight,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    } else {
      // jsdom no implementa scrollTo; el fallback mantiene las pruebas estables.
      history.scrollTop = history.scrollHeight;
    }
  }

  private nextMessageId(): string {
    this.messageSequence += 1;
    return `chat-message-${this.messageSequence}`;
  }
}
