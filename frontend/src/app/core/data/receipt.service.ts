import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Receipt, ReceiptInput, ReceiptMode } from './models';

export interface ReceiptFilters {
  from?: string;
  to?: string;
  clientId?: number;
  mode?: ReceiptMode;
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly http = inject(HttpClient);

  list(filters: ReceiptFilters = {}): Observable<Receipt[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<Receipt[]>('/api/receipts', { params });
  }

  create(input: ReceiptInput): Observable<Receipt> {
    return this.http.post<Receipt>('/api/receipts', input);
  }

  update(id: number, input: ReceiptInput): Observable<Receipt> {
    return this.http.put<Receipt>(`/api/receipts/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/receipts/${id}`);
  }
}
