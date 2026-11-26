import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssistantQueryRequest,
  AssistantQueryResponse,
  AssistantScope,
  AssistantStatus,
  AssistantStatusResponse,
} from '../models/assistant.model';

@Injectable({
  providedIn: 'root',
})
export class AssistantApiService {
  private readonly http = inject(HttpClient);
  private readonly assistantUrl = `${environment.apiUrl}/assistant`;

  getStatus(): Observable<AssistantStatus> {
    return this.http
      .get<AssistantStatusResponse>(`${this.assistantUrl}/status`)
      .pipe(map((response) => response.data));
  }

  query(scope: AssistantScope, request: AssistantQueryRequest): Observable<AssistantQueryResponse> {
    const endpoint = scope === 'tourist' ? 'tourist/query' : 'inspection/query';

    return this.http.post<AssistantQueryResponse>(`${this.assistantUrl}/${endpoint}`, request);
  }
}
