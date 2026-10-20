import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSummary, SalesExportRow, SalesReport } from './models';

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

  dashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/reports/dashboard');
  }

  sales(range: DateRange): Observable<SalesReport> {
    return this.http.get<SalesReport>('/api/reports/sales', { params: rangeParams(range) });
  }

  salesExport(range: DateRange): Observable<SalesExportRow[]> {
    return this.http.get<SalesExportRow[]>('/api/reports/sales/export', { params: rangeParams(range) });
  }
}
