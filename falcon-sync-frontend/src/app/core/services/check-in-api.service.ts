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
    return this.http.post<{ data: CheckIn }>(this.checkInsUrl, payload);
  }
}
