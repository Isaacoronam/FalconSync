export interface TelegramLinkStatus {
  linked: boolean;
  channel: 'telegram';
  linkedAt?: string | null;
  lastSeenAt?: string | null;
}

export interface TelegramLinkCode {
  code: string;
  expiresAt: string;
  ttlMinutes: number;
}

export interface TelegramLinkStatusResponse {
  data: TelegramLinkStatus;
}

export interface TelegramLinkCodeResponse {
  data: TelegramLinkCode;
}
