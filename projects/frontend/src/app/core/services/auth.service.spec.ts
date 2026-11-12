import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSessionResponse, AuthUser } from '../models/auth.model';
import { AuthService } from './auth.service';

const user: AuthUser = {
  id: 'user-1',
  name: 'Ana Pérez',
  email: 'ana@example.com',
  role: 'user',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

const session: AuthSessionResponse = {
  data: {
    user,
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('inicia sesión, conserva el token en memoria y expone el usuario', () => {
    let received: AuthUser | undefined;

    service.login({ email: 'ana@example.com', password: 'UsuarioSegura123' }).subscribe((result) => {
      received = result;
    });

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush(session);

    expect(received?.email).toBe('ana@example.com');
    expect(service.accessToken()).toBe('access-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAdmin()).toBe(false);
  });

  it('reutiliza una sola petición de refresh mientras está en curso', () => {
    let completed = 0;

    service.refresh().subscribe(() => completed++);
    service.refresh().subscribe(() => completed++);

    const requests = httpMock.match('/api/auth/refresh');
    expect(requests.length).toBe(1);

    requests[0].flush(session);

    expect(completed).toBe(2);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('limpia la sesión si el refresh es rechazado', () => {
    service.refresh().subscribe({ error: () => undefined });

    const request = httpMock.expectOne('/api/auth/refresh');
    request.flush(
      { error: { code: 'SESSION_REQUIRED', message: 'Sin sesión' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('actualiza el usuario y el token al cambiar la contraseña', () => {
    service.changePassword({ currentPassword: 'UsuarioSegura123', newPassword: 'NuevaSegura456' }).subscribe();

    const request = httpMock.expectOne('/api/auth/change-password');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      data: {
        user: { ...user, mustChangePassword: false },
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });

    expect(service.accessToken()).toBe('new-access-token');
  });

  it('cierra la sesión local aunque falle la petición de logout', () => {
    service.login({ email: 'ana@example.com', password: 'UsuarioSegura123' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush(session);

    let failed = false;
    service.logout().subscribe({
      error: () => {
        failed = true;
      },
    });

    const request = httpMock.expectOne('/api/auth/logout');
    request.flush(
      { error: { code: 'INTERNAL_ERROR', message: 'Fallo' } },
      { status: 500, statusText: 'Server Error' },
    );

    expect(failed).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });
});
