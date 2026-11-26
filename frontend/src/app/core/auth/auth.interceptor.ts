import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Adds the session token to API calls, and sends the user back to login if the session has expired.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  const authReq = token && req.url.startsWith('/api/')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      const isAuthAttempt = req.url.startsWith('/api/auth/login') || req.url.startsWith('/api/auth/signup');
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !isAuthAttempt) {
        // e.g. "Your password was changed. Please log in again…" when it was changed on another device.
        auth.logout((err.error as { message?: string } | null)?.message ?? 'Your session has expired. Please log in again.');
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
