import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminLocation,
  AdminLocationFilters,
  AdminLocationPayload,
  AdminLocationsResponse,
  AdminSummary,
  AuditResponse,
} from '../models/admin.model';

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/admin`;

  getSummary(): Observable<{ data: AdminSummary }> {
    return this.http.get<{ data: AdminSummary }>(`${this.adminUrl}/summary`);
  }

  listLocations(filters: AdminLocationFilters = {}): Observable<AdminLocationsResponse> {
    let params = new HttpParams();

    if (filters.q) {
      params = params.set('q', filters.q);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.category && filters.category !== 'all') {
      params = params.set('category', filters.category);
    }

    params = params
      .set('page', String(filters.page ?? 1))
      .set('limit', String(filters.limit ?? 20));

    return this.http.get<AdminLocationsResponse>(`${this.adminUrl}/locations`, { params });
  }

  getLocation(id: string): Observable<{ data: AdminLocation }> {
    return this.http.get<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}`,
    );
  }

  createLocation(payload: AdminLocationPayload): Observable<{ data: AdminLocation }> {
    return this.http.post<{ data: AdminLocation }>(`${this.adminUrl}/locations`, payload);
  }

  updateLocation(
    id: string,
    payload: Partial<AdminLocationPayload>,
  ): Observable<{ data: AdminLocation }> {
    return this.http.patch<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}`,
      payload,
    );
  }

  archiveLocation(id: string): Observable<{ data: AdminLocation }> {
    return this.http.delete<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}`,
    );
  }

  restoreLocation(id: string): Observable<{ data: AdminLocation }> {
    return this.http.post<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}/restore`,
      {},
    );
  }

  uploadLocationImage(id: string, file: File): Observable<{ data: AdminLocation }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}/images`,
      formData,
    );
  }

  removeLocationImage(id: string, url: string): Observable<{ data: AdminLocation }> {
    return this.http.delete<{ data: AdminLocation }>(
      `${this.adminUrl}/locations/${encodeURIComponent(id)}/images`,
      { body: { url } },
    );
  }

  listAudit(page = 1, limit = 20): Observable<AuditResponse> {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));

    return this.http.get<AuditResponse>(`${this.adminUrl}/audit`, { params });
  }
}
