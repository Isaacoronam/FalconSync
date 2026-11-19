import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConservationListResponse,
  Evidence,
  EvidenceOwnerType,
} from '../models/conservation.model';

export interface UploadEvidenceInput {
  ownerType: EvidenceOwnerType;
  ownerId: string;
  findingId?: string;
  purpose: string;
  file: File;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

@Injectable({
  providedIn: 'root',
})
export class EvidenceApiService {
  private readonly http = inject(HttpClient);
  private readonly evidenceUrl = `${environment.apiUrl}/evidence`;

  list(
    ownerType: EvidenceOwnerType,
    ownerId: string,
    findingId?: string,
    page = 1,
    limit = 50,
  ): Observable<ConservationListResponse<Evidence>> {
    let params = new HttpParams()
      .set('ownerType', ownerType)
      .set('ownerId', ownerId)
      .set('page', page)
      .set('limit', limit);

    if (findingId) {
      params = params.set('findingId', findingId);
    }

    return this.http.get<ConservationListResponse<Evidence>>(this.evidenceUrl, {
      params,
    });
  }

  upload(input: UploadEvidenceInput): Observable<{ data: Evidence }> {
    const form = new FormData();
    form.set('ownerType', input.ownerType);
    form.set('ownerId', input.ownerId);
    form.set('purpose', input.purpose);
    form.set('file', input.file);

    if (input.findingId) {
      form.set('findingId', input.findingId);
    }

    if (input.capturedAt) {
      form.set('capturedAt', input.capturedAt);
    }

    if (input.latitude !== undefined && input.longitude !== undefined) {
      form.set('latitude', String(input.latitude));
      form.set('longitude', String(input.longitude));
    }

    if (input.accuracyMeters !== undefined) {
      form.set('accuracyMeters', String(input.accuracyMeters));
    }

    return this.http.post<{ data: Evidence }>(this.evidenceUrl, form, {
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
      },
    });
  }

  download(id: string, purpose: string): Observable<Blob> {
    const params = new HttpParams().set('purpose', purpose);
    return this.http.get(`${this.evidenceUrl}/${encodeURIComponent(id)}`, {
      params,
      responseType: 'blob',
    });
  }
}
