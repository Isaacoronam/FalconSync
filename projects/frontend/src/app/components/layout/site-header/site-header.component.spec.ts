import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SiteHeaderComponent } from './site-header.component';

function authenticatedAuthStub() {
  return {
    currentUser: signal({
      id: 'user-1',
      name: 'Ana',
      surname: 'Pérez',
      email: 'ana@example.com',
      role: 'user' as const,
      isActive: true,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    isAuthenticated: signal(true),
    isAdmin: signal(false),
    canCreateReport: signal(true),
    canPublishPanoramas: signal(false),
    isInspector: signal(false),
    logout: () => of(void 0),
  };
}

async function createHeader(authStub?: ReturnType<typeof authenticatedAuthStub>) {
  await TestBed.configureTestingModule({
    imports: [SiteHeaderComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      ...(authStub ? [{ provide: AuthService, useValue: authStub }] : []),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SiteHeaderComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('SiteHeaderComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.style.overflow = '';
  });

  it('muestra la marca y las acciones de visitante', async () => {
    const fixture = await createHeader();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.brand__name')?.textContent).toContain('FALCONSYNC');
    expect(element.querySelector('.brand__mark')?.getAttribute('width')).toBe('48');
    expect(element.textContent).toContain('Iniciar sesión');
    expect(element.textContent).toContain('Crear cuenta');
  });

  it('muestra el nombre completo y las áreas del usuario autenticado', async () => {
    const fixture = await createHeader(authenticatedAuthStub());
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.site-nav__user')?.textContent).toContain('Ana Pérez');

    const accountTrigger = element.querySelector('.site-nav__user') as HTMLButtonElement;
    accountTrigger.click();
    fixture.detectChanges();

    expect(element.querySelector('#account-menu')?.textContent).toContain('Mi perfil');
    expect(element.querySelector('#account-menu')?.textContent).toContain('Cambiar contraseña');

    const areasTrigger = [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Áreas'),
    );
    expect(areasTrigger).toBeDefined();
    areasTrigger?.click();
    fixture.detectChanges();

    expect(element.querySelector('#areas-menu')?.textContent).toContain('Reportes');
  });

  it('abre y cierra la hoja móvil con bloqueo de scroll', async () => {
    const fixture = await createHeader();
    const element = fixture.nativeElement as HTMLElement;
    const burger = element.querySelector('.site-nav__burger') as HTMLButtonElement;
    const dialog = element.querySelector('.mobile-nav') as HTMLDialogElement;

    burger.click();
    fixture.detectChanges();

    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    const close = element.querySelector('.mobile-nav__close') as HTMLButtonElement;
    close.click();
    fixture.detectChanges();

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
