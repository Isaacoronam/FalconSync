import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';
import { checkInTokenGuard } from './core/guards/check-in-token.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'FALCONSYNC',
    loadComponent: () =>
      import('./features/map/coro-map.component').then((module) => module.CoroMapComponent),
  },
  {
    path: 'lugares',
    title: 'Explora los lugares | FALCONSYNC',
    loadComponent: () =>
      import('./features/lugares/lugar-list/lugar-list.component').then(
        (module) => module.LugarListComponent,
      ),
  },
  {
    path: 'lugares/:slug',
    title: 'Historia del lugar | FALCONSYNC',
    loadComponent: () =>
      import('./features/lugares/lugar-detail/lugar-detail.component').then(
        (module) => module.LugarDetailComponent,
      ),
  },
  {
    path: 'aventuras/:slug/progreso',
    redirectTo: '/lugares',
    pathMatch: 'full',
  },
  {
    path: 'aventuras/:slug',
    redirectTo: '/lugares',
    pathMatch: 'full',
  },
  {
    path: 'aventuras',
    redirectTo: '/lugares',
    pathMatch: 'full',
  },
  {
    path: 'checkin',
    title: 'Escanear QR | FALCONSYNC',
    loadComponent: () =>
      import(
        './features/aventuras/checkin-escaner/checkin-escaner.component'
      ).then((module) => module.CheckinEscanerComponent),
  },
  {
    path: 'checkin/:locationId',
    canActivate: [checkInTokenGuard, authGuard],
    title: 'Check-in | FALCONSYNC',
    loadComponent: () =>
      import('./features/aventuras/checkin/checkin.component').then(
        (module) => module.CheckinComponent,
      ),
  },
  {
    path: 'perfil',
    title: 'Mi perfil | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/perfil/perfil.component').then(
        (module) => module.PerfilComponent,
      ),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | FALCONSYNC',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((module) => module.LoginComponent),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | FALCONSYNC',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (module) => module.RegisterComponent,
      ),
  },
  {
    path: 'cambiar-contrasena',
    title: 'Cambiar contraseña | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (module) => module.ChangePasswordComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then(
        (module) => module.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        title: 'Panel de control | FALCONSYNC',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (module) => module.AdminDashboardComponent,
          ),
      },
      {
        path: 'poi',
        title: 'Puntos de interés | FALCONSYNC',
        loadComponent: () =>
          import('./features/admin/poi/admin-poi-list.component').then(
            (module) => module.AdminPoiListComponent,
          ),
      },
      {
        path: 'poi/nuevo',
        title: 'Nuevo POI | FALCONSYNC',
        loadComponent: () =>
          import('./features/admin/poi/admin-poi-form.component').then(
            (module) => module.AdminPoiFormComponent,
          ),
      },
      {
        path: 'poi/:id/editar',
        title: 'Editar POI | FALCONSYNC',
        loadComponent: () =>
          import('./features/admin/poi/admin-poi-form.component').then(
            (module) => module.AdminPoiFormComponent,
          ),
      },
      {
        path: 'auditoria',
        title: 'Auditoría | FALCONSYNC',
        loadComponent: () =>
          import('./features/admin/audit/admin-audit.component').then(
            (module) => module.AdminAuditComponent,
          ),
      },
      {
        path: 'aventuras',
        redirectTo: 'poi',
        pathMatch: 'full',
      },
      {
        path: 'aventuras/nuevo',
        redirectTo: 'poi',
        pathMatch: 'full',
      },
      {
        path: 'aventuras/:id/editar',
        redirectTo: 'poi',
        pathMatch: 'full',
      },
      {
        path: 'aventuras/:id/paradas',
        redirectTo: 'poi',
        pathMatch: 'full',
      },
      {
        path: 'locations/:id/qr',
        title: 'Imprimir QR | FALCONSYNC',
        loadComponent: () =>
          import(
            './features/admin/aventuras/qr-imprimir/qr-imprimir.component'
          ).then((module) => module.QrImprimirComponent),
      },
    ],
  },
  {
    path: 'acceso-denegado',
    title: 'Acceso denegado | FALCONSYNC',
    loadComponent: () =>
      import('./features/auth/forbidden/forbidden.component').then(
        (module) => module.ForbiddenComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
