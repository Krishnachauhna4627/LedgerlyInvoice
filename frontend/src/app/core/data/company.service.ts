import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Company, CompanyInput } from './models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  get(): Observable<Company> {
    return this.http.get<Company>('/api/company');
  }

  update(input: CompanyInput): Observable<Company> {
    return this.http.put<Company>('/api/company', input);
  }
}
