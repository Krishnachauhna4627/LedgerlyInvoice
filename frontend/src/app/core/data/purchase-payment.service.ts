import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PurchasePayment, PurchasePaymentInput, ReceiptMode } from './models';

export interface PurchasePaymentFilters {
  from?: string;
  to?: string;
  mode?: ReceiptMode;
}

// Money paid to vendors for purchases (/api/purchase-payments).
@Injectable({ providedIn: 'root' })
export class PurchasePaymentService {
  private readonly http = inject(HttpClient);

  list(filters: PurchasePaymentFilters = {}): Observable<PurchasePayment[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<PurchasePayment[]>('/api/purchase-payments', { params });
  }

  get(id: number): Observable<PurchasePayment> {
    return this.http.get<PurchasePayment>(`/api/purchase-payments/${id}`);
  }

  nextNumber(): Observable<{ paymentNumber: string }> {
    return this.http.get<{ paymentNumber: string }>('/api/purchase-payments/next-number');
  }

  // Vendor names used before, most recent first (for suggestions).
  vendors(): Observable<string[]> {
    return this.http.get<string[]>('/api/purchase-payments/vendors');
  }

  create(input: PurchasePaymentInput): Observable<PurchasePayment> {
    return this.http.post<PurchasePayment>('/api/purchase-payments', input);
  }

  update(id: number, input: PurchasePaymentInput): Observable<PurchasePayment> {
    return this.http.put<PurchasePayment>(`/api/purchase-payments/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/purchase-payments/${id}`);
  }
}
