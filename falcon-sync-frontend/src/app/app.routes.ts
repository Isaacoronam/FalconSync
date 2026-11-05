import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'CoroMap | FalconSync',
    loadComponent: () =>
      import('./features/map/coro-map.component').then((module) => module.CoroMapComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
