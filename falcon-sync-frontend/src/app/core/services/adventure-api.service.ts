import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Adventure,
  AdminAdventureFilters,
  AdminAdventurePayload,
  AdminAdventuresResponse,
  AdminAdventureStop,
  AdminAdventureStopPayload,
  AdventureProgress,
  AdventureStop,
} from '../models/adventure.model';

const ADVENTURE_FIELDS =
  'id title slug summary difficulty estimatedMinutes coverImage badge status stopsCount createdAt updatedAt';

@Injectable({
  providedIn: 'root',
})
export class AdventureApiService {
  private readonly http = inject(HttpClient);
  private readonly adventuresUrl = `${environment.apiUrl}/adventures`;
  private readonly adminUrl = `${environment.apiUrl}/admin/adventures`;

  list(page = 1, limit = 20): Observable<{ data: Adventure[]; meta: AdminAdventuresResponse['meta'] }> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get<{ data: Adventure[]; meta: AdminAdventuresResponse['meta'] }>(
      this.adventuresUrl,
      { params },
    );
  }

  getBySlug(slug: string): Observable<{ data: Adventure & { stops: AdventureStop[] } }> {
    return this.http.get<{ data: Adventure & { stops: AdventureStop[] } }>(
      `${this.adventuresUrl}/${encodeURIComponent(slug)}`,
    );
  }

  getProgress(slug: string): Observable<{ data: AdventureProgress }> {
    return this.http.get<{ data: AdventureProgress }>(
      `${this.adventuresUrl}/${encodeURIComponent(slug)}/progress`,
    );
  }

  listAdmin(filters: AdminAdventureFilters = {}): Observable<AdminAdventuresResponse> {
    let params = new HttpParams();

    if (filters.q) {
      params = params.set('q', filters.q);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    params = params
      .set('page', String(filters.page ?? 1))
      .set('limit', String(filters.limit ?? 20));

    return this.http.get<AdminAdventuresResponse>(`${this.adminUrl}`, { params });
  }

  getAdmin(id: string): Observable<{ data: Adventure & { stops: AdminAdventureStop[] } }> {
    return this.http.get<{ data: Adventure & { stops: AdminAdventureStop[] } }>(
      `${this.adminUrl}/${encodeURIComponent(id)}`,
    );
  }

  createAdmin(payload: AdminAdventurePayload): Observable<{ data: Adventure }> {
    return this.http.post<{ data: Adventure }>(this.adminUrl, payload);
  }

  updateAdmin(
    id: string,
    payload: Partial<AdminAdventurePayload>,
  ): Observable<{ data: Adventure }> {
    return this.http.patch<{ data: Adventure }>(
      `${this.adminUrl}/${encodeURIComponent(id)}`,
      payload,
    );
  }

  publishAdmin(id: string): Observable<{ data: Adventure }> {
    return this.http.post<{ data: Adventure }>(
      `${this.adminUrl}/${encodeURIComponent(id)}/publish`,
      {},
    );
  }

  archiveAdmin(id: string): Observable<{ data: Adventure }> {
    return this.http.post<{ data: Adventure }>(
      `${this.adminUrl}/${encodeURIComponent(id)}/archive`,
      {},
    );
  }

  restoreAdmin(id: string): Observable<{ data: Adventure }> {
    return this.http.post<{ data: Adventure }>(
      `${this.adminUrl}/${encodeURIComponent(id)}/restore`,
      {},
    );
  }

  addStop(
    adventureId: string,
    payload: AdminAdventureStopPayload,
  ): Observable<{ data: AdminAdventureStop }> {
    return this.http.post<{ data: AdminAdventureStop }>(
      `${this.adminUrl}/${encodeURIComponent(adventureId)}/stops`,
      payload,
    );
  }

  updateStop(
    adventureId: string,
    stopId: string,
    payload: Partial<AdminAdventureStopPayload>,
  ): Observable<{ data: AdminAdventureStop }> {
    return this.http.patch<{ data: AdminAdventureStop }>(
      `${this.adminUrl}/${encodeURIComponent(adventureId)}/stops/${encodeURIComponent(stopId)}`,
      payload,
    );
  }

  deleteStop(adventureId: string, stopId: string): Observable<{ data: { id: string } }> {
    return this.http.delete<{ data: { id: string } }>(
      `${this.adminUrl}/${encodeURIComponent(adventureId)}/stops/${encodeURIComponent(stopId)}`,
    );
  }

  reorderStops(
    adventureId: string,
    order: string[],
  ): Observable<{ data: AdminAdventureStop[] }> {
    return this.http.put<{ data: AdminAdventureStop[] }>(
      `${this.adminUrl}/${encodeURIComponent(adventureId)}/stops/reorder`,
      { order },
    );
  }
}
