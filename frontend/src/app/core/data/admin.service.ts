import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminUser, AdminUserDetail, Invoice } from './models';

// Super-user API: every user and company. The backend answers 404 for anyone else.
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/admin/users');
  }

  getUser(id: number): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`/api/admin/users/${id}`);
  }

  getInvoice(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`/api/admin/invoices/${id}`);
  }
}
