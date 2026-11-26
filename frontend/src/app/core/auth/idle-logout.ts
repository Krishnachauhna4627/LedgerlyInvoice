import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, IDLE_LOGOUT_MESSAGE } from './auth.service';

// How often activity is written to storage, and how often the idle time is checked.
const MARK_EVERY_MS = 15 * 1000;
const CHECK_EVERY_MS = 30 * 1000;
const LOGGED_OUT_ELSEWHERE = 'You were logged out. Please log in again.';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// Logs the user out after IDLE_TIMEOUT_MS (10 minutes) without using the app. Activity in any tab counts,
// since the last-activity time is shared through localStorage. Started by AppShell (the logged-in layout);
// authGuard also checks on navigation, which covers coming back to a closed or sleeping tab.
@Injectable()
export class IdleLogout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private lastMark = 0;

  start(destroyRef: DestroyRef): void {
    const view = this.document.defaultView;
    if (!view) return;
    this.auth.markActive();
    this.lastMark = Date.now();

    // Outside Angular: these events fire constantly and never need change detection.
    this.zone.runOutsideAngular(() => {
      const onActivity = () => {
        const now = Date.now();
        if (now - this.lastMark < MARK_EVERY_MS) return;
        // Coming back after the limit (e.g. a laptop waking up) logs out instead of extending the session.
        if (this.auth.isIdleExpired()) return this.zone.run(() => this.expire());
        this.lastMark = now;
        this.auth.markActive();
      };
      const onVisible = () => {
        if (this.document.visibilityState === 'visible') this.check();
      };
      // Another tab changed the stored session (e.g. logged out): check straight away.
      const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === 'ledgerly.token') this.check();
      };
      view.addEventListener('storage', onStorage);
      const timer = view.setInterval(() => this.check(), CHECK_EVERY_MS);
      for (const type of ACTIVITY_EVENTS) view.addEventListener(type, onActivity, { passive: true, capture: true });
      this.document.addEventListener('visibilitychange', onVisible);

      destroyRef.onDestroy(() => {
        view.clearInterval(timer);
        for (const type of ACTIVITY_EVENTS) view.removeEventListener(type, onActivity, { capture: true });
        this.document.removeEventListener('visibilitychange', onVisible);
        view.removeEventListener('storage', onStorage);
      });
    });
  }

  private check(): void {
    if (!this.auth.isLoggedIn()) return;
    // Logged out (or into another account) in another tab: follow it here too.
    if (!this.auth.hasStoredSession()) return this.zone.run(() => this.expire(LOGGED_OUT_ELSEWHERE));
    if (this.auth.isIdleExpired()) this.zone.run(() => this.expire());
  }

  private expire(message = IDLE_LOGOUT_MESSAGE): void {
    if (!this.auth.isLoggedIn()) return;
    this.auth.logout(message);
    this.router.navigateByUrl('/login');
  }
}
