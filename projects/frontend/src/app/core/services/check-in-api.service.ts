import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckInPayload, CheckInResponse } from '../models/adventure.model';

@Injectable({
  providedIn: 'root',
})
export class CheckInApiService {
  private readonly http = inject(HttpClient);
  private readonly checkInsUrl = `${environment.apiUrl}/check-ins`;

  /**
   * La visita se registra primero en JSON, sin foto. La foto se sube después
   * con PUT /api/profile/check-ins/:id/photo para que un fallo de imagen no
   * revierta el check-in ni la insignia.
   */
  createCheckIn(payload: CheckInPayload): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(this.checkInsUrl, {
      locationId: payload.locationId,
      token: payload.token,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
  }
}
