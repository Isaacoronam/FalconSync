import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckIn, CheckInPayload } from '../models/adventure.model';

@Injectable({
  providedIn: 'root',
})
export class CheckInApiService {
  private readonly http = inject(HttpClient);
  private readonly checkInsUrl = `${environment.apiUrl}/check-ins`;

  createCheckIn(payload: CheckInPayload): Observable<{ data: CheckIn }> {
    if (!payload.photo) {
      return this.http.post<{ data: CheckIn }>(this.checkInsUrl, payload);
    }

    const formData = new FormData();
    formData.append('locationId', payload.locationId);
    formData.append('token', payload.token);
    formData.append('latitude', String(payload.latitude));
    formData.append('longitude', String(payload.longitude));
    formData.append('image', payload.photo);

    return this.http.post<{ data: CheckIn }>(this.checkInsUrl, formData);
  }
}
