import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AddFindingPayload,
  ConservationListResponse,
  ConvertReportPayload,
  CreateAssetPayload,
  CreateInspectionPayload,
  CreateReportPayload,
  HeritageAsset,
  Inspection,
  InspectorOption,
  Intervention,
  ProposeInterventionPayload,
  Report,
  ReviewInspectionPayload,
  TriageReportPayload,
} from '../models/conservation.model';

@Injectable({
  providedIn: 'root',
})
export class ConservationApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listMyReports(page = 1, limit = 20): Observable<ConservationListResponse<Report>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ConservationListResponse<Report>>(`${this.apiUrl}/reports/mine`, {
      params,
    });
  }

  listReportQueue(): Observable<ConservationListResponse<Report>> {
    return this.http.get<ConservationListResponse<Report>>(`${this.apiUrl}/reports/queue`);
  }

  getReport(id: string): Observable<{ data: Report }> {
    return this.http.get<{ data: Report }>(`${this.apiUrl}/reports/${encodeURIComponent(id)}`);
  }

  createReport(payload: CreateReportPayload): Observable<{ data: Report }> {
    return this.http.post<{ data: Report }>(`${this.apiUrl}/reports`, payload);
  }

  triageReport(
    id: string,
    version: number,
    payload: TriageReportPayload,
  ): Observable<{ data: Report }> {
    return this.http.patch<{ data: Report }>(
      `${this.apiUrl}/reports/${encodeURIComponent(id)}/triage`,
      payload,
      { headers: this.versionHeaders(version) },
    );
  }

  convertReport(
    id: string,
    version: number,
    payload: ConvertReportPayload,
  ): Observable<{ data: { report: Report; inspection: Inspection } }> {
    return this.http.post<{ data: { report: Report; inspection: Inspection } }>(
      `${this.apiUrl}/reports/${encodeURIComponent(id)}/convert`,
      payload,
      { headers: this.versionHeaders(version) },
    );
  }

  listInspections(state?: string): Observable<{ data: Inspection[] }> {
    let params = new HttpParams();
    if (state) {
      params = params.set('state', state);
    }
    return this.http.get<{ data: Inspection[] }>(`${this.apiUrl}/inspections`, {
      params,
    });
  }

  getInspection(id: string): Observable<{ data: Inspection }> {
    return this.http.get<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}`,
    );
  }

  createInspection(payload: CreateInspectionPayload): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(`${this.apiUrl}/inspections`, payload);
  }

  startInspection(id: string, version: number): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/start`,
      {},
      { headers: this.versionHeaders(version) },
    );
  }

  resumeInspection(id: string, version: number): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/resume`,
      {},
      { headers: this.versionHeaders(version) },
    );
  }

  addFinding(
    id: string,
    version: number,
    payload: AddFindingPayload,
  ): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/findings`,
      payload,
      { headers: this.versionHeaders(version) },
    );
  }

  submitInspection(
    id: string,
    version: number,
    noFindingsDeclared: boolean,
  ): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/submit`,
      { noFindingsDeclared },
      { headers: this.versionHeaders(version) },
    );
  }

  reviewInspection(
    id: string,
    version: number,
    payload: ReviewInspectionPayload,
  ): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/review`,
      payload,
      { headers: this.versionHeaders(version) },
    );
  }

  closeInspection(
    id: string,
    version: number,
    justification?: string,
  ): Observable<{ data: Inspection }> {
    return this.http.post<{ data: Inspection }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/close`,
      { justification },
      { headers: this.versionHeaders(version) },
    );
  }

  proposeIntervention(
    id: string,
    payload: ProposeInterventionPayload,
  ): Observable<{ data: Intervention }> {
    return this.http.post<{ data: Intervention }>(
      `${this.apiUrl}/inspections/${encodeURIComponent(id)}/interventions`,
      payload,
    );
  }

  transitionIntervention(
    id: string,
    version: number,
    action: 'approve' | 'reject' | 'start' | 'complete' | 'verify',
    reason?: string,
  ): Observable<{ data: Intervention }> {
    return this.http.patch<{ data: Intervention }>(
      `${this.apiUrl}/interventions/${encodeURIComponent(id)}`,
      { action, reason },
      { headers: this.versionHeaders(version) },
    );
  }

  listAssets(): Observable<{ data: HeritageAsset[] }> {
    return this.http.get<{ data: HeritageAsset[] }>(`${this.apiUrl}/heritage-assets`);
  }

  createAsset(payload: CreateAssetPayload): Observable<{ data: HeritageAsset }> {
    return this.http.post<{ data: HeritageAsset }>(`${this.apiUrl}/heritage-assets`, payload);
  }

  listInspectors(): Observable<{ data: InspectorOption[] }> {
    return this.http.get<{ data: InspectorOption[] }>(`${this.apiUrl}/inspectors`);
  }

  private versionHeaders(version: number): HttpHeaders {
    return new HttpHeaders({ 'If-Match': `"${version}"` });
  }
}
