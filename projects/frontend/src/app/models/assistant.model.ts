export type AssistantScope = 'tourist' | 'technical';
export type AssistantAnswerType =
  | 'extractive'
  | 'structured'
  | 'contextual'
  | 'mixed'
  | 'abstention'
  | 'clarification'
  | 'greeting';
export type AssistantAbstentionReason =
  'NO_EVIDENCE' | 'OUT_OF_SCOPE' | 'NO_CURRENT_STATUS' | 'RIGHTS_RESTRICTED' | 'AMBIGUOUS_POI';
export type AssistantClaimType =
  | 'historical'
  | 'normative'
  | 'current_status'
  | 'technical_guidance'
  | 'tourism'
  | 'tradition'
  | 'context';

export interface AssistantCitation {
  documentId: string;
  chunkId: string;
  sourceId: string;
  title: string;
  institution: string;
  sourceLevel: 'A' | 'B' | 'C' | 'D' | 'E';
  sourceLabel: string;
  url: string | null;
  verifiedAt: string | null;
  page: string | null;
  section: string | null;
  kind: 'quote' | 'fact' | 'context';
  quote: string;
  claimType: AssistantClaimType | null;
  factKey: string | null;
  factValue: string | null;
  contradictionGroup: string | null;
  validAsOf: string | null;
}

export interface AssistantSource {
  id: string;
  title: string;
  institution: string;
  level: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
}

/** Disponibilidad de un modo del asistente. */
export interface AssistantScopeStatus {
  enabled: boolean;
  available: boolean;
}

/** Contenido de `data` en GET /api/assistant/status. */
export interface AssistantStatus {
  corpusVersion: string | null;
  tourist: AssistantScopeStatus;
  technical: AssistantScopeStatus;
}

export interface AssistantStatusResponse {
  data: AssistantStatus;
}

/** Lugar posible cuando la pregunta es ambigua (answerType 'clarification'). */
export interface AssistantOption {
  id: string;
  title: string;
}

/** Lugar al que se refiere la respuesta. */
export interface AssistantPoi {
  id: string;
  slug: string;
  title: string;
}

export interface AssistantAnswer {
  answerType: AssistantAnswerType;
  answer: string;
  abstained: boolean;
  abstentionReason: AssistantAbstentionReason | null;
  citations: AssistantCitation[];
  sources: AssistantSource[];
  confidenceLabel: string | null;
  /** De 0 a 3 preguntas que el asistente sí puede responder. */
  suggestions: string[];
  options: AssistantOption[];
  poi: AssistantPoi | null;
  corpusVersion: string;
  latencyMs: number;
  /** Solo se rellena en el asistente técnico. */
  conversationId: string | null;
  /** Solo se rellena en el asistente técnico. */
  messageId: string | null;
}

export interface AssistantQueryResponse {
  data: AssistantAnswer;
}

export interface AssistantQueryRequest {
  question: string;
  /**
   * Lugar de la respuesta anterior. Es solo una pista de seguimiento y nunca filtra la
   * búsqueda. El frontend solo lo envía en el modo turista.
   */
  contextLocationId?: string;
  /** Solo se envía en el asistente técnico. */
  conversationId?: string;
  locale: 'es';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: AssistantCitation[];
  abstained: boolean;
  suggestions: string[];
  options: AssistantOption[];
}
