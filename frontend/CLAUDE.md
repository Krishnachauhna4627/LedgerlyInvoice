# Ledgerly Invoice — Frontend Rules

Angular 22 (standalone components, signals), SCSS. Every change to this app must follow the rules below.

## 1. Web and mobile compatible (responsive)

Every screen must work on phone, tablet and desktop. There is no separate mobile app; one responsive UI serves all.

- Design **mobile-first**: write base styles for small screens, then add larger layouts with `min-width` media queries.
- Use only the shared breakpoints from `src/styles/_breakpoints.scss` (never hard-code pixel widths in components). `src/styles` is on the Sass include path, so in a component stylesheet write `@use 'breakpoints' as bp;` and then `@include bp.up(md) { … }`:

  | Name | Min width | Typical device   |
  |------|-----------|------------------|
  | `sm` | 576px     | large phone      |
  | `md` | 768px     | tablet           |
  | `lg` | 1024px    | laptop / desktop |
  | `xl` | 1280px    | wide desktop     |

- Layout with flexbox / CSS grid; no fixed widths on page containers. Use `max-width` + `width: 100%`.
- No horizontal scrolling at 360px width. Tables must scroll inside their own container or collapse into cards on small screens.
- Touch targets (buttons, links, inputs) are at least 44×44px.
- Navigation: full nav bar on `lg`+, hamburger / drawer menu below `lg`.
- Images use `max-width: 100%` and `NgOptimizedImage` where possible.
- Before a page is considered done, check it at 360px, 768px and 1280px.

## 2. Theme — one place, consistent everywhere

The current (default) theme is **Clean Indigo**. The theme must look identical across every page, and must be changeable from one single place.

### Where the theme lives

```
src/styles.scss            # the only global stylesheet; just @use's the files below
src/styles/
  _breakpoints.scss        # breakpoint mixins: bp.up(md), bp.down(sm)
  _tokens.scss             # non-color tokens: spacing, radius, font sizes, shadows
  _base.scss               # reset + shared classes: .container, .btn, .eyebrow, .sr-only
  themes/
    _clean-indigo.scss     # Clean Indigo color values (default)
    _<other-theme>.scss    # future themes, same variable names
src/app/core/theme/
  theme.service.ts         # switches theme at runtime + remembers user's choice
  themes.ts                # list of available themes (id + label)
```

### Rules

- **Never hard-code a color, font, spacing, radius or shadow in a component.** Always use the CSS variables (`var(--color-primary)`, `var(--space-4)`, …). If a value you need does not exist, add a token — do not inline it.
- Every theme file defines **the same set of variables**, scoped to `[data-theme="<id>"]` on `<html>`. Clean Indigo is also applied to `:root` as the fallback.
- Changing the whole app's look = editing one theme file. Adding a theme = add one file in `themes/` + one entry in `themes.ts`.
- Shadows that need a color derive it with `color-mix()` from a theme variable, so they follow the theme too.
- Users can pick their own theme; `ThemeService` sets `data-theme` on `<html>` and saves the choice (localStorage now, user profile later). Default is `clean-indigo`.
- Dark mode, if added, is just another theme using the same variables.

### Clean Indigo palette

| Variable                  | Value     | Use                                  |
|---------------------------|-----------|--------------------------------------|
| `--color-primary`         | `#4F46E5` | primary buttons, links, active state |
| `--color-primary-hover`   | `#4338CA` | hover / pressed                      |
| `--color-primary-light`   | `#6366F1` | gradients (logo, CTA band)           |
| `--color-primary-soft`    | `#EEF2FF` | selected rows, badges, highlights    |
| `--color-on-primary`      | `#FFFFFF` | text on primary                      |
| `--color-bg`              | `#F8FAFC` | page background                      |
| `--color-bg-tint`         | `#F5F7FF` | tinted section backgrounds           |
| `--color-surface`         | `#FFFFFF` | cards, panels, modals                |
| `--color-surface-inverse` | `#1E2A47` | dark bars (e.g. mock window title bar) |
| `--color-border`          | `#E2E8F0` | dividers, input borders              |
| `--color-text`            | `#0F172A` | main text                            |
| `--color-text-muted`      | `#64748B` | secondary text, hints                |
| `--color-success`         | `#16A34A` | paid, success                        |
| `--color-warning`         | `#D97706` | due soon, warnings                   |
| `--color-danger`          | `#DC2626` | overdue, errors, destructive actions |
| `--font-family`           | `'Inter', system-ui, sans-serif` | all text      |

## 3. Modules and pages — every page is its own component

The app is built module by module. **Module 1 is the public website landing page.**

- The landing page is the default route (`''`). Anyone who opens the website lands there first. Unknown URLs redirect to it (or to a not-found page once one exists).
- **Every page is its own standalone component in its own folder.** Never put two pages in one component, and never build a page inside `app.html`.
- Sections of a page that are large or reused (hero, features, pricing, footer, …) become their own child components.
- `app.html` holds only the app shell: `<router-outlet />` plus global layout (header/footer) if needed.
- Every route is lazy-loaded with `loadComponent` (or `loadChildren` for a module with several pages).

### Folder structure

```
src/app/
  core/                     # singletons: services, guards, interceptors, theme
  shared/
    components/             # reusable UI pieces
      icon/                 # <app-icon name="…" />; add new icons to icons.ts
      logo-mark/            # the Ledgerly logo square
    pipes/  directives/
  layout/                   # header, footer, nav, shells used by many pages
    site-header/            # public website header (desktop nav + mobile menu)
    app-topbar/             # header for logged-in pages (user, company, log out)
  pages/
    landing/                # Module 1 — public website
      landing.ts | .html | .scss | .spec.ts
      components/           # hero, product-preview, features, how-it-works, cta
    auth/                   # Module 2 — /login: login + signup on one page
      components/           # login-form, signup-form
    dashboard/              # Module 3 — /dashboard, first page after login
      components/           # stat-cards, recent-invoices, quick-actions
    <next-page>/            # each new page gets its own folder
  app.routes.ts             # all top-level routes
```

### Routes example

```ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.Landing) },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/auth').then(m => m.Auth) },
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
  { path: '**', redirectTo: '' },
];
```

### Generating

Use the CLI so naming stays consistent:

```bash
ng generate component pages/<page-name>
ng generate component pages/<page-name>/components/<section-name>
ng generate component shared/components/<name>
```

## 4. General conventions

- Standalone components only (no NgModules). Use signals for component state, `inject()` for DI.
- Use the new control flow (`@if`, `@for`, `@switch`) in templates.
- File names follow the Angular 22 default (`landing.ts`, not `landing.component.ts`).
- Component styles stay small (the build budget warns at 4kB per component); shared styles go in `src/styles/`.
- API calls go through services in `core/` (or a feature service), never directly from a page component. Always call relative `/api/...` URLs; in development `proxy.conf.json` forwards them to the backend on `http://localhost:3000`.
- Show API failures with `toApiError()` (`core/api/api-error.ts`): its `message` goes in a `.form-alert`, its `fieldErrors` onto the matching form controls.

## 5. Authentication

- `AuthService` (`core/auth/`) owns the session: token in localStorage, current user in the `user` signal. `authInterceptor` adds `Authorization: Bearer <token>` to `/api/` calls and sends the user to `/login` on a 401.
- Every page that needs a logged-in user uses `canActivate: [authGuard]`; it loads the user before the page renders, so the page can read `AuthService.user()` directly. Logged-in pages use `<app-topbar />`.
- `/login` uses `guestGuard` (logged-in users go straight to `/dashboard`).

## 6. Forms

- Reactive forms (`NonNullableFormBuilder`) with the shared classes from `src/styles/_forms.scss`: `.field`, `.field__label`, `.input` (+ `.is-invalid`), `.field__error`, `.form-alert`.
- Every input has a `<label for>`, the right `autocomplete`, and `aria-invalid` / `aria-describedby` pointing at its error.
- Show a field's error once it is touched or the form was submitted. Client-side rules mirror the backend's, but the backend is the authority.
- Data tables (database schema) are owned by the backend; see `../backend/CLAUDE.md` for the migration rule.
