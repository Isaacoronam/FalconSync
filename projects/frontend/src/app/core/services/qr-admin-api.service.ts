import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QrRotateResponse } from '../models/adventure.model';

@Injectable({
  providedIn: 'root',
})
export class QrAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/locations`;

  rotateQr(locationId: string, format: 'svg' | 'png' = 'svg'): Observable<QrRotateResponse> {
    const params = new HttpParams().set('format', format);

    return this.http.post<QrRotateResponse>(
      `${this.baseUrl}/${encodeURIComponent(locationId)}/qr/rotate`,
      {},
      { params },
    );
  }
}
