import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelegramLinkCodeResponse, TelegramLinkStatusResponse } from '../models/channel-link.model';

@Injectable({
  providedIn: 'root',
})
export class ChannelLinkApiService {
  private readonly http = inject(HttpClient);
  private readonly telegramUrl = `${environment.apiUrl}/channels/telegram`;

  getTelegramStatus(): Observable<TelegramLinkStatusResponse> {
    return this.http.get<TelegramLinkStatusResponse>(this.telegramUrl);
  }

  createTelegramCode(): Observable<TelegramLinkCodeResponse> {
    return this.http.post<TelegramLinkCodeResponse>(`${this.telegramUrl}/link-code`, {});
  }

  unlinkTelegram(): Observable<TelegramLinkStatusResponse> {
    return this.http.delete<TelegramLinkStatusResponse>(this.telegramUrl);
  }
}
