import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CashBankLedger, CashBankSummaryRow, DashboardPeriod, DashboardSummary, PurchaseReport, SalesExportRow, SalesReport } from './models';

export interface DateRange {
  from?: string;
  to?: string;
}

const rangeParams = ({ from, to }: DateRange) => {
  let params = new HttpParams();
  if (from) params = params.set('from', from);
  if (to) params = params.set('to', to);
  return params;
};

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  dashboard(period: DashboardPeriod = 'this_month'): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/reports/dashboard', { params: { period } });
  }

  sales(range: DateRange): Observable<SalesReport> {
    return this.http.get<SalesReport>('/api/reports/sales', { params: rangeParams(range) });
  }

  purchases(range: DateRange): Observable<PurchaseReport> {
    return this.http.get<PurchaseReport>('/api/reports/purchases', { params: rangeParams(range) });
  }

  // Cash and each bank account for the period: opening, in, out, closing.
  cashBank(range: DateRange): Observable<CashBankSummaryRow[]> {
    return this.http.get<CashBankSummaryRow[]>('/api/reports/cash-bank', { params: rangeParams(range) });
  }

  // Cash book / one bank book with a running balance.
  cashBankLedger(key: string, range: DateRange): Observable<CashBankLedger> {
    return this.http.get<CashBankLedger>(`/api/reports/cash-bank/${encodeURIComponent(key)}`, { params: rangeParams(range) });
  }

  salesExport(range: DateRange): Observable<SalesExportRow[]> {
    return this.http.get<SalesExportRow[]>('/api/reports/sales/export', { params: rangeParams(range) });
  }
}
