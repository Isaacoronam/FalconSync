import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminPanoramaFilters,
  AdminPanoramaListResponse,
  AdminPanoramaResponse,
  PanoramaCreatePayload,
  PanoramaFilters,
  PanoramaListResponse,
  PanoramaResponse,
  PanoramaUpdatePayload,
} from '../models/panorama.model';

@Injectable({
  providedIn: 'root',
})
export class PanoramaApiService {
  private readonly http = inject(HttpClient);
  private readonly panoramasUrl = `${environment.apiUrl}/panoramas`;
  private readonly adminUrl = `${environment.apiUrl}/admin/panoramas`;

  list(filters: PanoramaFilters = {}): Observable<PanoramaListResponse> {
    let params = new HttpParams();

    if (filters.locationId) {
      params = params.set('locationId', filters.locationId);
    }

    if (filters.assetId) {
      params = params.set('assetId', filters.assetId);
    }

    if (filters.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<PanoramaListResponse>(this.panoramasUrl, { params });
  }

  get(id: string): Observable<PanoramaResponse> {
    return this.http.get<PanoramaResponse>(
      `${this.panoramasUrl}/${encodeURIComponent(id)}`,
    );
  }

  listAdmin(
    filters: AdminPanoramaFilters = {},
  ): Observable<AdminPanoramaListResponse> {
    let params = new HttpParams();

    if (filters.q) {
      params = params.set('q', filters.q);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.visibility && filters.visibility !== 'all') {
      params = params.set('visibility', filters.visibility);
    }

    if (filters.locationId) {
      params = params.set('locationId', filters.locationId);
    }

    params = params
      .set('page', String(filters.page ?? 1))
      .set('limit', String(filters.limit ?? 20));

    return this.http.get<AdminPanoramaListResponse>(this.adminUrl, { params });
  }

  getAdmin(id: string): Observable<AdminPanoramaResponse> {
    return this.http.get<AdminPanoramaResponse>(
      `${this.adminUrl}/${encodeURIComponent(id)}`,
    );
  }

  create(
    payload: PanoramaCreatePayload,
    image: File,
  ): Observable<AdminPanoramaResponse> {
    return this.http.post<AdminPanoramaResponse>(
      this.adminUrl,
      this.toFormData(payload, image),
    );
  }

  update(
    id: string,
    version: number,
    payload: PanoramaUpdatePayload,
  ): Observable<AdminPanoramaResponse> {
    return this.http.patch<AdminPanoramaResponse>(
      `${this.adminUrl}/${encodeURIComponent(id)}`,
      payload,
      { headers: { 'If-Match': `"${version}"` } },
    );
  }

  approve(id: string, version: number): Observable<AdminPanoramaResponse> {
    return this.postTransition(id, 'approve', version);
  }

  publish(id: string, version: number): Observable<AdminPanoramaResponse> {
    return this.postTransition(id, 'publish', version);
  }

  archive(id: string, version: number): Observable<AdminPanoramaResponse> {
    return this.postTransition(id, 'archive', version);
  }

  fetchBlob(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  private postTransition(
    id: string,
    action: 'approve' | 'publish' | 'archive',
    version: number,
  ): Observable<AdminPanoramaResponse> {
    return this.http.post<AdminPanoramaResponse>(
      `${this.adminUrl}/${encodeURIComponent(id)}/${action}`,
      {},
      { headers: { 'If-Match': `"${version}"` } },
    );
  }

  private toFormData(payload: PanoramaCreatePayload, image: File): FormData {
    const formData = new FormData();

    formData.append('image', image);
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('locationId', payload.locationId);
    formData.append('visibility', payload.visibility);
    formData.append('author', payload.author);
    formData.append('license', payload.license);
    formData.append('credit', payload.credit);
    formData.append('rightsDocumented', String(payload.rightsDocumented));
    formData.append('permitDocumented', String(payload.permitDocumented));
    formData.append('peopleBlurred', String(payload.peopleBlurred));
    formData.append('consentDocumented', String(payload.consentDocumented));
    formData.append('fallbackAlt', payload.fallbackAlt);
    formData.append('fallbackDescription', payload.fallbackDescription);
    formData.append('hotspots', JSON.stringify(payload.hotspots));

    this.appendOptional(formData, 'capturedAt', payload.capturedAt);
    this.appendOptional(formData, 'licenseUrl', payload.licenseUrl);
    this.appendOptional(formData, 'rightsNotes', payload.rightsNotes);
    this.appendOptional(formData, 'consentNotes', payload.consentNotes);
    this.appendOptional(formData, 'transcript', payload.transcript);

    return formData;
  }

  private appendOptional(
    formData: FormData,
    field: string,
    value: string | null,
  ): void {
    if (value !== null && value !== '') {
      formData.append(field, value);
    }
  }
}
