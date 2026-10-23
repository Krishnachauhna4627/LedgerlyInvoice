import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { from, mergeMap, map, toArray } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Invoice } from '../../core/data/models';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { Icon } from '../../shared/components/icon/icon';
import { InvoiceDocument } from '../../shared/components/invoice-document/invoice-document';
import { PageHeader } from '../../shared/components/page-header/page-header';

// Loaded a few at a time so printing a long list doesn't flood the server.
const CONCURRENT_LOADS = 4;

// /invoices/print?ids=1,2,3 — several invoices on one page, each starting on a new A4 sheet,
// so they print (or save as one PDF) in one go.
@Component({
  selector: 'app-invoice-print-page',
  imports: [RouterLink, Icon, InvoiceDocument, PageHeader],
  templateUrl: './invoice-print.html',
  styleUrl: './invoice-print.scss',
})
export class InvoicePrint {
  private readonly invoiceService = inject(InvoiceService);
  private readonly injector = inject(Injector);

  private readonly ids = (inject(ActivatedRoute).snapshot.queryParamMap.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  protected readonly invoices = signal<Invoice[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly count = this.ids.length;

  constructor() {
    if (!this.ids.length) {
      this.loadError.set('No invoices were chosen to print.');
      return;
    }
    from(this.ids.map((id, index) => ({ id, index })))
      .pipe(
        mergeMap(({ id, index }) => this.invoiceService.get(id).pipe(map((invoice) => ({ invoice, index }))), CONCURRENT_LOADS),
        toArray(),
        // Keep the order they were chosen in.
        map((results) => results.sort((a, b) => a.index - b.index).map((r) => r.invoice)),
      )
      .subscribe({
        next: (invoices) => {
          this.invoices.set(invoices);
          // Open the print dialog once the documents are on the page.
          afterNextRender(() => window.print(), { injector: this.injector });
        },
        error: (err: unknown) => this.loadError.set(toApiError(err).message),
      });
  }

  protected print(): void {
    window.print();
  }
}
