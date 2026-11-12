import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FalconLocation,
  LocationCategory,
  LocationCircuit,
  LocationTag,
  LocationsResponse,
} from '../models/location.model';

export interface LocationListFilters {
  category?: LocationCategory | 'all';
  circuit?: LocationCircuit | 'all';
  tag?: LocationTag | 'all';
  includeProvisional?: boolean;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocationApiService {
  private readonly http = inject(HttpClient);
  private readonly locationsUrl = `${environment.apiUrl}/locations`;

  list(filters: LocationListFilters = {}): Observable<LocationsResponse> {
    let params = new HttpParams();

    if (filters.limit) {
      params = params.set('limit', String(filters.limit));
    }

    if (filters.category && filters.category !== 'all') {
      params = params.set('category', filters.category);
    }

    if (filters.circuit && filters.circuit !== 'all') {
      params = params.set('circuit', filters.circuit);
    }

    if (filters.tag && filters.tag !== 'all') {
      params = params.set('tag', filters.tag);
    }

    if (filters.includeProvisional) {
      params = params.set('includeProvisional', 'true');
    }

    return this.http.get<LocationsResponse>(this.locationsUrl, { params });
  }

  getBySlug(slug: string): Observable<{ data: FalconLocation }> {
    return this.http.get<{ data: FalconLocation }>(
      `${this.locationsUrl}/${encodeURIComponent(slug)}`,
    );
  }
}
