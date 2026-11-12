import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Company, CompanyInput } from './models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  // The company (with its signature image, ~50kB) is fetched once per session and shared by every page.
  // Keyed by token so logging out or "log in as" another user never reuses the previous company.
  private cache: { token: string | null; company$: Observable<Company> } | null = null;

  // `fresh` skips the cache (the settings page, which edits the company, always loads the latest).
  get(fresh = false): Observable<Company> {
    const token = this.auth.getToken();
    if (fresh || !this.cache || this.cache.token !== token) {
      const company$ = this.http.get<Company>('/api/company').pipe(
        tap({ error: () => (this.cache = null) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache = { token, company$ };
    }
    return this.cache.company$;
  }

  update(input: CompanyInput): Observable<Company> {
    return this.http.put<Company>('/api/company', input).pipe(tap((company) => this.remember(company)));
  }

  uploadSignature(signature: string): Observable<Company> {
    return this.http.put<Company>('/api/company/signature', { signature }).pipe(tap((company) => this.remember(company)));
  }

  removeSignature(): Observable<Company> {
    return this.http.delete<Company>('/api/company/signature').pipe(tap((company) => this.remember(company)));
  }

  private remember(company: Company): void {
    this.cache = { token: this.auth.getToken(), company$: of(company) };
  }
}
