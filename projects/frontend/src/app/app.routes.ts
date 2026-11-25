import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  curatorGuard,
  guestGuard,
  inspectorGuard,
} from './services/guards/auth.guard';
import { checkInTokenGuard } from './services/guards/check-in-token.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'FALCONSYNC',
    loadComponent: () =>
      import('./pages/map/coro-map.component').then((module) => module.CoroMapComponent),
  },
  {
    path: 'lugares',
    title: 'Explora los lugares | FALCONSYNC',
    loadComponent: () =>
      import('./pages/lugares/lugar-list/lugar-list.component').then(
        (module) => module.LugarListComponent,
      ),
  },
  {
    path: 'guia',
    title: 'Guía patrimonial | FALCONSYNC',
    loadComponent: () =>
      import('./pages/assistant/assistant-chat.component').then(
        (module) => module.AssistantChatComponent,
      ),
  },
  {
    path: 'lugares/:slug',
    title: 'Historia del lugar | FALCONSYNC',
    loadComponent: () =>
      import('./pages/lugares/lugar-detail/lugar-detail.component').then(
        (module) => module.LugarDetailComponent,
      ),
  },
  {
    path: 'panoramas',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'panoramas/:id',
    title: 'Visita 360° | FALCONSYNC',
    loadComponent: () =>
      import('./pages/panoramas/panorama-map-redirect.component').then(
        (module) => module.PanoramaMapRedirectComponent,
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
        './pages/aventuras/checkin-escaner/checkin-escaner.component'
      ).then((module) => module.CheckinEscanerComponent),
  },
  {
    path: 'checkin/:locationId',
    canActivate: [checkInTokenGuard, authGuard],
    title: 'Check-in | FALCONSYNC',
    loadComponent: () =>
      import('./pages/aventuras/checkin/checkin.component').then(
        (module) => module.CheckinComponent,
      ),
  },
  {
    path: 'perfil',
    title: 'Mi perfil | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/perfil/perfil.component').then(
        (module) => module.PerfilComponent,
      ),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | FALCONSYNC',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/login/login.component').then((module) => module.LoginComponent),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | FALCONSYNC',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/register/register.component').then(
        (module) => module.RegisterComponent,
      ),
  },
  {
    path: 'cambiar-contrasena',
    title: 'Cambiar contraseña | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/auth/change-password/change-password.component').then(
        (module) => module.ChangePasswordComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./components/admin/layout/admin-layout.component').then(
        (module) => module.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        title: 'Panel de control | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/dashboard/admin-dashboard.component').then(
            (module) => module.AdminDashboardComponent,
          ),
      },
      {
        path: 'poi',
        title: 'Puntos de interés | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/poi/admin-poi-list.component').then(
            (module) => module.AdminPoiListComponent,
          ),
      },
      {
        path: 'poi/nuevo',
        title: 'Nuevo POI | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/poi/admin-poi-form.component').then(
            (module) => module.AdminPoiFormComponent,
          ),
      },
      {
        path: 'poi/:id/editar',
        title: 'Editar POI | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/poi/admin-poi-form.component').then(
            (module) => module.AdminPoiFormComponent,
          ),
      },
      {
        path: 'panoramas',
        pathMatch: 'full',
        title: 'Panoramas 360° | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/panoramas/admin-panorama-list.component').then(
            (module) => module.AdminPanoramaListComponent,
          ),
      },
      {
        path: 'panoramas/nuevo',
        title: 'Nuevo panorama | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/panoramas/admin-panorama-form.component').then(
            (module) => module.AdminPanoramaFormComponent,
          ),
      },
      {
        path: 'panoramas/:id/editar',
        title: 'Editar panorama | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/panoramas/admin-panorama-form.component').then(
            (module) => module.AdminPanoramaFormComponent,
          ),
      },
      {
        path: 'panoramas/:id',
        title: 'Detalle del panorama | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/panoramas/admin-panorama-detail.component').then(
            (module) => module.AdminPanoramaDetailComponent,
          ),
      },
      {
        path: 'usuarios',
        title: 'Usuarios | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/usuarios/admin-usuarios.component').then(
            (module) => module.AdminUsuariosComponent,
          ),
      },
      {
        path: 'aventuras',
        pathMatch: 'full',
        title: 'Aventuras | FALCONSYNC',
        loadComponent: () =>
          import(
            './pages/admin/aventuras/admin-aventura-list/admin-aventura-list.component'
          ).then((module) => module.AdminAventuraListComponent),
      },
      {
        path: 'aventuras/nuevo',
        title: 'Nueva aventura | FALCONSYNC',
        loadComponent: () =>
          import(
            './pages/admin/aventuras/admin-aventura-form/admin-aventura-form.component'
          ).then((module) => module.AdminAventuraFormComponent),
      },
      {
        path: 'aventuras/:id/editar',
        title: 'Editar aventura | FALCONSYNC',
        loadComponent: () =>
          import(
            './pages/admin/aventuras/admin-aventura-form/admin-aventura-form.component'
          ).then((module) => module.AdminAventuraFormComponent),
      },
      {
        path: 'aventuras/:id/paradas',
        title: 'Paradas de aventura | FALCONSYNC',
        loadComponent: () =>
          import(
            './pages/admin/aventuras/admin-aventura-stops/admin-aventura-stops.component'
          ).then((module) => module.AdminAventuraStopsComponent),
      },
      {
        path: 'auditoria',
        title: 'Auditoría | FALCONSYNC',
        loadComponent: () =>
          import('./pages/admin/audit/admin-audit.component').then(
            (module) => module.AdminAuditComponent,
          ),
      },
      {
        path: 'locations/:id/qr',
        title: 'Imprimir QR | FALCONSYNC',
        loadComponent: () =>
          import(
            './pages/admin/aventuras/qr-imprimir/qr-imprimir.component'
          ).then((module) => module.QrImprimirComponent),
      },
    ],
  },
  {
    path: 'reportes',
    title: 'Mis reportes | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/conservation/report-list/report-list.component').then(
        (module) => module.ReportListComponent,
      ),
  },
  {
    path: 'reportes/:id',
    title: 'Detalle del reporte | FALCONSYNC',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/conservation/report-detail/report-detail.component').then(
        (module) => module.ReportDetailComponent,
      ),
  },
  {
    path: 'inspecciones',
    title: 'Inspecciones | FALCONSYNC',
    canActivate: [authGuard, inspectorGuard],
    loadComponent: () =>
      import('./pages/conservation/inspection-list/inspection-list.component').then(
        (module) => module.InspectionListComponent,
      ),
  },
  {
    path: 'inspecciones/:id',
    title: 'Detalle de la inspección | FALCONSYNC',
    canActivate: [authGuard, inspectorGuard],
    loadComponent: () =>
      import('./pages/conservation/inspection-detail/inspection-detail.component').then(
        (module) => module.InspectionDetailComponent,
      ),
  },
  {
    path: 'curaduria/panoramas',
    pathMatch: 'full',
    title: 'Curaduría de panoramas | FALCONSYNC',
    canActivate: [authGuard, curatorGuard],
    data: { mode: 'curate' },
    loadComponent: () =>
      import('./pages/admin/panoramas/admin-panorama-list.component').then(
        (module) => module.AdminPanoramaListComponent,
      ),
  },
  {
    path: 'curaduria/panoramas/:id',
    title: 'Revisión del panorama | FALCONSYNC',
    canActivate: [authGuard, curatorGuard],
    data: { mode: 'curate' },
    loadComponent: () =>
      import('./pages/admin/panoramas/admin-panorama-detail.component').then(
        (module) => module.AdminPanoramaDetailComponent,
      ),
  },
  {
    path: 'acceso-denegado',
    title: 'Acceso denegado | FALCONSYNC',
    loadComponent: () =>
      import('./pages/auth/forbidden/forbidden.component').then(
        (module) => module.ForbiddenComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
