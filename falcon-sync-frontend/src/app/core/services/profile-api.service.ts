import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProfileResponse, ProfileUpdatePayload, ProfileUpdateResponse } from '../models/profile.model';

@Injectable({
  providedIn: 'root',
})
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly profileUrl = `${environment.apiUrl}/profile`;

  getProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.profileUrl}/me`);
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<ProfileUpdateResponse> {
    return this.http.patch<ProfileUpdateResponse>(`${this.profileUrl}/me`, payload);
  }

  uploadAvatar(file: File): Observable<ProfileUpdateResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<ProfileUpdateResponse>(`${this.profileUrl}/avatar`, formData);
  }

  deleteAvatar(): Observable<ProfileUpdateResponse> {
    return this.http.delete<ProfileUpdateResponse>(`${this.profileUrl}/avatar`);
  }

  getPrivateImage(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
