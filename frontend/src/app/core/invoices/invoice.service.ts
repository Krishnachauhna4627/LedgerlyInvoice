import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Invoice, InvoiceInput, InvoiceListItem, InvoiceQuery, InvoiceStatus } from '../data/models';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);

  // Total invoices for the sidebar badge; refreshed after anything that adds or removes one.
  readonly count = signal(0);

  refreshCount(): void {
    this.http.get<{ count: number }>('/api/invoices/count').subscribe({
      next: ({ count }) => this.count.set(count),
      error: () => undefined,
    });
  }

  list(query: InvoiceQuery = {}): Observable<InvoiceListItem[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<InvoiceListItem[]>('/api/invoices', { params });
  }

  get(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`/api/invoices/${id}`);
  }

  nextNumber(): Observable<{ invoiceNumber: string }> {
    return this.http.get<{ invoiceNumber: string }>('/api/invoices/next-number');
  }

  create(input: InvoiceInput): Observable<Invoice> {
    return this.http.post<Invoice>('/api/invoices', input).pipe(tap(() => this.refreshCount()));
  }

  update(id: number, input: InvoiceInput): Observable<Invoice> {
    return this.http.put<Invoice>(`/api/invoices/${id}`, input);
  }

  setStatus(id: number, status: InvoiceStatus): Observable<Invoice> {
    return this.http.patch<Invoice>(`/api/invoices/${id}/status`, { status });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/invoices/${id}`).pipe(tap(() => this.refreshCount()));
  }
}
