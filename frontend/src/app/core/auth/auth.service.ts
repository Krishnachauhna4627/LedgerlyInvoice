import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, retry, throwError, timer } from 'rxjs';
import { AuthResponse, LoginRequest, PasswordChange, ProfileUpdate, SignupRequest, User } from './auth.models';

const TOKEN_KEY = 'ledgerly.token';
// The super user's own token, kept while they are logged in as another user (see loginAs).
const ADMIN_TOKEN_KEY = 'ledgerly.adminToken';
// When the user last used the app (ms timestamp), shared by all tabs so activity in one keeps the others open.
const LAST_ACTIVITY_KEY = 'ledgerly.lastActivity';
// Logged out after this long without using the app (see IdleLogout).
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const IDLE_LOGOUT_MESSAGE = 'You were logged out after 10 minutes without activity. Please log in again.';
export const PASSWORD_CHANGED_MESSAGE = 'Your password was changed. Please log in again with your new password.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(readToken());
  private readonly adminToken = signal<string | null>(readToken(ADMIN_TOKEN_KEY));
  // True while the super user is using the app as another user.
  readonly isImpersonating = computed(() => this.adminToken() !== null);
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.token() !== null);
  // A message for the login page after being logged out (password changed, inactivity, …). Read once with takeNotice().
  private readonly notice = signal<string | null>(null);
  // This tab's last activity (ms), in case storage isn't available.
  private lastActivity = 0;

  constructor() {
    // Opening the site after being away (tab closed, computer asleep, logged in yesterday…): an idle
    // session ends before any page decides where to go.
    this.expireIfIdle();
  }

  getToken(): string | null {
    return this.token();
  }

  login(body: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/login', body).pipe(map((res) => this.startSession(res)));
  }

  signup(body: SignupRequest): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/signup', body).pipe(map((res) => this.startSession(res)));
  }

  // Emails the account a one-time link to set a new password. The reply is the same whether or not the email has an account.
  forgotPassword(email: string): Observable<string> {
    return this.http
      .post<{ message: string }>('/api/auth/forgot-password', { email })
      .pipe(map(({ message }) => message));
  }

  // Sets a new password with the token from a "Forgot password" email. Ends every session of the account.
  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>('/api/auth/reset-password', { token, password });
  }

  // The message for the login page, if any; cleared once read.
  takeNotice(): string | null {
    const notice = this.notice();
    this.notice.set(null);
    return notice;
  }

  // Records that the user is using the app (throttled by the caller).
  markActive(): void {
    this.lastActivity = Date.now();
    writeValue(LAST_ACTIVITY_KEY, String(this.lastActivity));
  }

  // True when the session has gone unused for longer than IDLE_TIMEOUT_MS (in any tab).
  // No record counts as expired: every login records activity, so a stored session without one is old
  // (e.g. from before this check existed) and must log in again.
  isIdleExpired(): boolean {
    // The shared record (every tab keeps it fresh); this tab's own copy only when storage is blocked.
    const stored = Number(readToken(LAST_ACTIVITY_KEY)) || 0;
    const last = storageUnavailable ? this.lastActivity : stored;
    return !last || Date.now() - last > IDLE_TIMEOUT_MS;
  }

  // Ends a stored session that has gone unused for too long, so no page (not even /login) treats the
  // user as logged in. Returns true when it logged out.
  expireIfIdle(): boolean {
    if (!this.isLoggedIn() || !this.isIdleExpired()) return false;
    this.logout(IDLE_LOGOUT_MESSAGE);
    return true;
  }

  // False once another tab has logged out (the stored token is gone or replaced).
  // Always true when storage isn't usable (blocked by the browser), so that never logs anyone out.
  hasStoredSession(): boolean {
    if (storageUnavailable) return true;
    const stored = readToken();
    return stored !== null && stored === this.token();
  }

  // Fetches the logged-in user once per visit. Resolves to null (and logs out) only when the server
  // says the token is no longer valid (401). Server or network errors are retried a few times
  // (1s, 2s, 4s — enough to ride out a server/database restart) and then re-thrown with the token
  // kept, so a brief outage never logs the user out.
  loadCurrentUser(): Observable<User | null> {
    const cached = this.user();
    if (cached) {
      return of(cached);
    }
    return this.http.get<{ user: User }>('/api/auth/me').pipe(
      retry({
        count: 3,
        delay: (err, attempt) => (isUnauthorized(err) ? throwError(() => err) : timer(1000 * 2 ** (attempt - 1))),
      }),
      map(({ user }) => {
        this.user.set(user);
        return user;
      }),
      catchError((err: unknown) => {
        if (!isUnauthorized(err)) {
          return throwError(() => err);
        }
        // The interceptor has usually logged out already, with the server's reason for the login page; keep it.
        if (this.isLoggedIn()) this.logout();
        return of(null);
      }),
    );
  }

  updateProfile(body: ProfileUpdate): Observable<User> {
    return this.http.put<{ user: User }>('/api/auth/me', body).pipe(
      map(({ user }) => {
        this.user.set(user);
        return user;
      }),
    );
  }

  changePassword(body: PasswordChange): Observable<void> {
    return this.http.put<void>('/api/auth/me/password', body);
  }

  // Super user only: switches this browser to the given user's session, keeping the admin's own
  // token so they can come back with returnToAdmin(). Reload the app afterwards so no data of the
  // previous account stays in memory.
  loginAs(userId: number): Observable<User> {
    return this.http.post<AuthResponse>(`/api/admin/users/${userId}/login-as`, {}).pipe(
      map((res) => {
        if (!this.adminToken()) {
          this.adminToken.set(this.token());
          writeToken(this.token(), ADMIN_TOKEN_KEY);
        }
        return this.startSession(res);
      }),
    );
  }

  // Ends a "log in as" session and restores the super user's own. Reload the app afterwards.
  returnToAdmin(): void {
    const admin = this.adminToken();
    if (!admin) return;
    this.token.set(admin);
    this.user.set(null);
    writeToken(admin);
    this.adminToken.set(null);
    writeToken(null, ADMIN_TOKEN_KEY);
  }

  // Ends the session in this browser. `notice` is shown on the login page.
  logout(notice: string | null = null): void {
    this.notice.set(notice);
    this.token.set(null);
    this.user.set(null);
    writeToken(null);
    this.adminToken.set(null);
    writeToken(null, ADMIN_TOKEN_KEY);
  }

  private startSession({ token, user }: AuthResponse): User {
    this.markActive();
    this.token.set(token);
    this.user.set(user);
    writeToken(token);
    return user;
  }
}

// Set once writing to localStorage has failed (blocked or full); cross-tab checks are skipped then.
let storageUnavailable = false;

function isUnauthorized(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 401;
}

function readToken(key = TOKEN_KEY): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    storageUnavailable = true;
    return null;
  }
}

function writeToken(token: string | null, key = TOKEN_KEY): void {
  try {
    if (token) {
      localStorage.setItem(key, token);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable — the session lasts until the tab is closed.
    storageUnavailable = true;
  }
}

function writeValue(key: string, value: string | null): void {
  writeToken(value, key);
}
