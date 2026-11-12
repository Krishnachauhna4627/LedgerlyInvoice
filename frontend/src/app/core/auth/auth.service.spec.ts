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
