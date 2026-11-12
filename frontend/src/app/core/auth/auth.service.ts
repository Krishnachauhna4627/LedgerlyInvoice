import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, retry, throwError, timer } from 'rxjs';
import { AuthResponse, LoginRequest, PasswordChange, ProfileUpdate, SignupRequest, User } from './auth.models';

const TOKEN_KEY = 'ledgerly.token';
// The super user's own token, kept while they are logged in as another user (see loginAs).
const ADMIN_TOKEN_KEY = 'ledgerly.adminToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(readToken());
  private readonly adminToken = signal<string | null>(readToken(ADMIN_TOKEN_KEY));
  // True while the super user is using the app as another user.
  readonly isImpersonating = computed(() => this.adminToken() !== null);
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.token() !== null);

  getToken(): string | null {
    return this.token();
  }

  login(body: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/login', body).pipe(map((res) => this.startSession(res)));
  }

  signup(body: SignupRequest): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/signup', body).pipe(map((res) => this.startSession(res)));
  }

  // Emails the account a new password. The reply is the same whether or not the email has an account.
  forgotPassword(email: string): Observable<string> {
    return this.http
      .post<{ message: string }>('/api/auth/forgot-password', { email })
      .pipe(map(({ message }) => message));
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
        this.logout();
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

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    writeToken(null);
    this.adminToken.set(null);
    writeToken(null, ADMIN_TOKEN_KEY);
  }

  private startSession({ token, user }: AuthResponse): User {
    this.token.set(token);
    this.user.set(user);
    writeToken(token);
    return user;
  }
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 401;
}

function readToken(key = TOKEN_KEY): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
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
  }
}
