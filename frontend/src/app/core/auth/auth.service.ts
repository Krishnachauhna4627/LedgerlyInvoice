import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthResponse, LoginRequest, PasswordChange, ProfileUpdate, SignupRequest, User } from './auth.models';

const TOKEN_KEY = 'ledgerly.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(readToken());
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

  // Fetches the logged-in user once per visit; resolves to null (and logs out) if the token is no longer valid.
  loadCurrentUser(): Observable<User | null> {
    const cached = this.user();
    if (cached) {
      return of(cached);
    }
    return this.http.get<{ user: User }>('/api/auth/me').pipe(
      map(({ user }) => {
        this.user.set(user);
        return user;
      }),
      catchError(() => {
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

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    writeToken(null);
  }

  private startSession({ token, user }: AuthResponse): User {
    this.token.set(token);
    this.user.set(user);
    writeToken(token);
    return user;
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage unavailable — the session lasts until the tab is closed.
  }
}
