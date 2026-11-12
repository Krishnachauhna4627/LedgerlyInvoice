import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ToastService } from '../ui/toast.service';
import { AuthService } from './auth.service';

// Pages that need a logged-in user.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  const toast = inject(ToastService);
  return auth.loadCurrentUser().pipe(
    map((user) => (user ? true : router.createUrlTree(['/login']))),
    // Server unreachable (not a 401): keep the session and open the page anyway; it shows its own
    // load error and the user is loaded again on the next navigation.
    catchError(() => {
      toast.error("Couldn't reach the server. Please check your connection and try again.");
      return of(true);
    }),
  );
};

// Admin-only pages (use after authGuard, which has loaded the user). Others go to the dashboard.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user()?.isAdmin ? true : inject(Router).createUrlTree(['/dashboard']);
};

// Login/signup page: already logged-in users go straight to the dashboard.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
