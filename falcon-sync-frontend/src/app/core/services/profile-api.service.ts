import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CheckInPhotoResponse,
  GalleryResponse,
  ProfileResponse,
  ProfileUpdatePayload,
  ProfileUpdateResponse,
} from '../models/profile.model';

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

  getGallery(
    page = 1,
    limit = 9,
    hasPhoto?: boolean,
  ): Observable<GalleryResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    if (hasPhoto !== undefined) {
      params = params.set('hasPhoto', String(hasPhoto));
    }

    return this.http.get<GalleryResponse>(`${this.profileUrl}/check-ins`, {
      params,
    });
  }

  uploadCheckInPhoto(
    checkInId: string,
    file: File,
  ): Observable<CheckInPhotoResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.put<CheckInPhotoResponse>(
      `${this.profileUrl}/check-ins/${checkInId}/photo`,
      formData,
    );
  }

  deleteCheckInPhoto(checkInId: string): Observable<CheckInPhotoResponse> {
    return this.http.delete<CheckInPhotoResponse>(
      `${this.profileUrl}/check-ins/${checkInId}/photo`,
    );
  }

  getPrivateImage(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
