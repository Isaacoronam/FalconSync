import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, firstValueFrom, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthSessionResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UserRole,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = `${environment.apiUrl}/auth`;

  private readonly accessTokenState = signal<string | null>(null);
  private readonly currentUserState = signal<AuthUser | null>(null);
  private refreshInFlight: Observable<AuthSessionResponse> | null = null;

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(
    () => this.accessTokenState() !== null && this.currentUserState() !== null,
  );
  readonly isAdmin = computed(() => this.currentUserState()?.role === 'admin');
  readonly isModerator = computed(
    () => this.currentUserState()?.role === 'moderator',
  );
  readonly mustChangePassword = computed(
    () => this.currentUserState()?.mustChangePassword === true,
  );

  initialize(): Promise<void> {
    return firstValueFrom(this.refresh())
      .then(() => undefined)
      .catch(() => this.clearSession());
  }

  login(payload: LoginPayload): Observable<AuthUser> {
    return this.http
      .post<AuthSessionResponse>(`${this.authUrl}/login`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.data.user),
      );
  }

  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<AuthSessionResponse>(`${this.authUrl}/register`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.data.user),
      );
  }

  refresh(): Observable<AuthSessionResponse> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http
        .post<AuthSessionResponse>(
          `${this.authUrl}/refresh`,
          {},
          { withCredentials: true },
        )
        .pipe(
          tap((response) => this.applySession(response)),
          catchError((error: unknown) => {
            this.clearSession();
            return throwError(() => error);
          }),
          finalize(() => {
            this.refreshInFlight = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.refreshInFlight;
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(
        `${this.authUrl}/logout`,
        {},
        { withCredentials: true },
      )
      .pipe(finalize(() => this.clearSession()));
  }

  changePassword(payload: ChangePasswordPayload): Observable<AuthUser> {
    return this.http
      .post<AuthSessionResponse>(`${this.authUrl}/change-password`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.data.user),
      );
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    const role = this.currentUserState()?.role;
    return role !== undefined && roles.includes(role);
  }

  clearSession(): void {
    this.accessTokenState.set(null);
    this.currentUserState.set(null);
  }

  private applySession(response: AuthSessionResponse): void {
    this.accessTokenState.set(response.data.accessToken);
    this.currentUserState.set(response.data.user);
  }
}
