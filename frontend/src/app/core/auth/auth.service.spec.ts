import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService.loadCurrentUser', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('ledgerly.token', 'test-token');
    localStorage.setItem('ledgerly.lastActivity', String(Date.now()));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('logs out on 401', () => {
    let result: unknown = 'pending';
    auth.loadCurrentUser().subscribe((u) => (result = u));
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('keeps the session when the server is briefly down, and recovers', () => {
    let result: unknown = 'pending';
    auth.loadCurrentUser().subscribe((u) => (result = u));
    http.expectOne('/api/auth/me').flush({}, { status: 500, statusText: 'Server Error' });
    vi.advanceTimersByTime(1000);
    http.expectOne('/api/auth/me').flush({ user: { id: 1, name: 'Test' } });
    expect(result).toEqual({ id: 1, name: 'Test' });
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('keeps the token and re-throws after repeated server errors', () => {
    let failed = false;
    auth.loadCurrentUser().subscribe({ error: () => (failed = true) });
    for (const wait of [0, 1000, 2000, 4000]) {
      vi.advanceTimersByTime(wait);
      http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    }
    expect(failed).toBe(true);
    expect(auth.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('ledgerly.token')).toBe('test-token');
  });
});

describe('AuthService idle sessions', () => {
  afterEach(() => localStorage.clear());

  function start(lastActivity: number | null): AuthService {
    localStorage.setItem('ledgerly.token', 'test-token');
    if (lastActivity !== null) localStorage.setItem('ledgerly.lastActivity', String(lastActivity));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.inject(AuthService);
  }

  it('keeps a session used within the last 10 minutes', () => {
    const auth = start(Date.now() - 2 * 60 * 1000);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.takeNotice()).toBeNull();
  });

  it('ends a session unused for more than 10 minutes when the site is opened (e.g. logged in yesterday)', () => {
    const auth = start(Date.now() - 24 * 60 * 60 * 1000);
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('ledgerly.token')).toBeNull();
    expect(auth.takeNotice()).toContain('10 minutes');
  });

  it('ends an old session that has no activity record', () => {
    const auth = start(null);
    expect(auth.isLoggedIn()).toBe(false);
  });
});
