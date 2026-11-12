import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Purchase, PurchaseInput } from './models';

export interface PurchaseFilters {
  from?: string;
  to?: string;
}

// Purchase bills from vendors, with the items bought (/api/purchases).
@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);

  list(filters: PurchaseFilters = {}): Observable<Purchase[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<Purchase[]>('/api/purchases', { params });
  }

  get(id: number): Observable<Purchase> {
    return this.http.get<Purchase>(`/api/purchases/${id}`);
  }

  nextNumber(): Observable<{ purchaseNumber: string }> {
    return this.http.get<{ purchaseNumber: string }>('/api/purchases/next-number');
  }

  // Vendor names used on purchases or payments (most recent first), for suggestions.
  vendors(): Observable<string[]> {
    return this.http.get<string[]>('/api/purchases/vendors');
  }

  create(input: PurchaseInput): Observable<Purchase> {
    return this.http.post<Purchase>('/api/purchases', input);
  }

  update(id: number, input: PurchaseInput): Observable<Purchase> {
    return this.http.put<Purchase>(`/api/purchases/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/purchases/${id}`);
  }
}
