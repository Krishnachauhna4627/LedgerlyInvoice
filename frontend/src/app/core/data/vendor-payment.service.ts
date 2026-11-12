import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReceiptMode, VendorPayment, VendorPaymentInput } from './models';

export interface VendorPaymentFilters {
  from?: string;
  to?: string;
  mode?: ReceiptMode;
}

// Money paid to vendors — payment details only (/api/payments).
@Injectable({ providedIn: 'root' })
export class VendorPaymentService {
  private readonly http = inject(HttpClient);

  list(filters: VendorPaymentFilters = {}): Observable<VendorPayment[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<VendorPayment[]>('/api/payments', { params });
  }

  nextNumber(): Observable<{ paymentNumber: string }> {
    return this.http.get<{ paymentNumber: string }>('/api/payments/next-number');
  }

  // Vendor names used on purchases or payments (most recent first), for suggestions.
  vendors(): Observable<string[]> {
    return this.http.get<string[]>('/api/payments/vendors');
  }

  create(input: VendorPaymentInput): Observable<VendorPayment> {
    return this.http.post<VendorPayment>('/api/payments', input);
  }

  update(id: number, input: VendorPaymentInput): Observable<VendorPayment> {
    return this.http.put<VendorPayment>(`/api/payments/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/payments/${id}`);
  }
}
