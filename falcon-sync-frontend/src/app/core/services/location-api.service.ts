import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FalconLocation, LocationCategory, LocationsResponse } from '../models/location.model';

@Injectable({
  providedIn: 'root',
})
export class LocationApiService {
  private readonly http = inject(HttpClient);
  private readonly locationsUrl = `${environment.apiUrl}/locations`;

  list(category: LocationCategory | 'all' = 'all'): Observable<LocationsResponse> {
    const params = category === 'all' ? undefined : new HttpParams().set('category', category);

    return this.http.get<LocationsResponse>(this.locationsUrl, { params });
  }

  getBySlug(slug: string): Observable<{ data: FalconLocation }> {
    return this.http.get<{ data: FalconLocation }>(
      `${this.locationsUrl}/${encodeURIComponent(slug)}`,
    );
  }
}
