import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

const page = (title: string) => `${title} — Ledgerly Invoices`;

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing) },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: page('Log in'),
    loadComponent: () => import('./pages/auth/auth').then((m) => m.Auth),
  },
  // Logged-in area: every child page renders inside the sidebar shell.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'dashboard',
        title: page('Dashboard'),
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'invoices',
        title: page('Invoices'),
        loadComponent: () => import('./pages/invoices/invoices').then((m) => m.Invoices),
      },
      {
        path: 'invoices/new',
        title: page('New invoice'),
        loadComponent: () => import('./pages/invoice-editor/invoice-editor').then((m) => m.InvoiceEditor),
      },
      {
        path: 'invoices/:id/edit',
        title: page('Edit invoice'),
        loadComponent: () => import('./pages/invoice-editor/invoice-editor').then((m) => m.InvoiceEditor),
      },
      {
        path: 'invoices/:id',
        title: page('Invoice'),
        loadComponent: () => import('./pages/invoice-view/invoice-view').then((m) => m.InvoiceView),
      },
      {
        path: 'clients',
        title: page('Clients'),
        loadComponent: () => import('./pages/clients/clients').then((m) => m.Clients),
      },
      {
        path: 'items',
        title: page('Items'),
        loadComponent: () => import('./pages/items/items').then((m) => m.Items),
      },
      {
        path: 'reports',
        title: page('Reports'),
        loadComponent: () => import('./pages/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'settings',
        title: page('Settings'),
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
