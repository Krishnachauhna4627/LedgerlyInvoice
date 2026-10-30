import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { DisplayStatus, InvoiceListItem, InvoiceSort } from '../../core/data/models';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { PERIODS, Period, periodRange } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReceiptForm } from '../../shared/components/receipt-form/receipt-form';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InvoiceTable, MenuRequest } from './components/invoice-table/invoice-table';
import { RowAction, RowMenu } from './components/row-menu/row-menu';
import { exportInvoicesCsv } from './invoice-csv';

type StatusFilter = DisplayStatus | 'all';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'draft', label: 'Draft' },
];

const SORTS: { value: InvoiceSort; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Amount: high to low' },
  { value: 'amount_asc', label: 'Amount: low to high' },
  { value: 'number_asc', label: 'Invoice number' },
  { value: 'status', label: 'Status: overdue → unpaid → paid' },
];

// Period, search and sort are sent to the server; the status filter runs locally so every chip can show its count.
@Component({
  selector: 'app-invoices-page',
  imports: [RouterLink, Icon, Modal, PageHeader, InvoiceTable, RowMenu, ReceiptForm, ShowMore],
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
})
export class Invoices {
  private readonly invoiceService = inject(InvoiceService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  // Links (e.g. the dashboard tiles) can open the list pre-filtered: /invoices?period=this_month&status=overdue
  private readonly urlFilters = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly periods = PERIODS;
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly sorts = SORTS;

  protected readonly period = signal<Period>(
    PERIODS.find((p) => p.value === this.urlFilters.get('period'))?.value ?? 'all',
  );
  protected readonly status = signal<StatusFilter>(
    STATUS_FILTERS.find((s) => s.value === this.urlFilters.get('status'))?.value ?? 'all',
  );
  protected readonly sort = signal<InvoiceSort>('date_desc');
  protected readonly searchInput = signal('');
  private readonly search = toSignal(
    toObservable(this.searchInput).pipe(
      debounceTime(300),
      map((s) => s.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  private readonly reloadTick = signal(0);

  protected readonly rows = signal<InvoiceListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly menu = signal<MenuRequest | null>(null);
  protected readonly pendingDelete = signal<InvoiceListItem[] | null>(null);
  protected readonly busy = signal(false);
  // Invoice whose customer the "Record receipt" dialog is for.
  protected readonly receiptFor = signal<InvoiceListItem | null>(null);

  private readonly query = computed(() => ({
    ...periodRange(this.period()),
    search: this.search(),
    sort: this.sort(),
    tick: this.reloadTick(),
  }));

  protected readonly counts = computed(() => {
    const counts: Record<StatusFilter, number> = { all: 0, paid: 0, unpaid: 0, overdue: 0, draft: 0 };
    for (const row of this.rows()) {
      counts.all++;
      counts[row.displayStatus]++;
    }
    return counts;
  });

  protected readonly visible = computed(() => {
    const status = this.status();
    return status === 'all' ? this.rows() : this.rows().filter((r) => r.displayStatus === status);
  });
  protected readonly page = paged(this.visible);

  protected readonly selectedRows = computed(() => this.visible().filter((r) => this.selected().has(r.id)));

  protected readonly hasFilters = computed(
    () => this.period() !== 'all' || this.status() !== 'all' || this.search() !== '',
  );
  protected readonly periodLabel = computed(() => PERIODS.find((p) => p.value === this.period())?.label ?? '');
  protected readonly statusLabel = computed(() => STATUS_FILTERS.find((s) => s.value === this.status())?.label ?? '');

  constructor() {
    toObservable(this.query)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ tick: _tick, ...query }) =>
          this.invoiceService.list(query).pipe(
            map((rows) => ({ rows, error: null as string | null })),
            catchError((err: unknown) => of({ rows: [] as InvoiceListItem[], error: toApiError(err).message })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ rows, error }) => {
        this.rows.set(rows);
        this.error.set(error);
        this.loading.set(false);
      });

    // Changing filters clears the selection so bulk actions never hit rows you can't see,
    // and goes back to the first page.
    effect(() => {
      this.query();
      this.status();
      this.selected.set(new Set());
      this.page.reset();
    });
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected clearFilters(): void {
    this.period.set('all');
    this.status.set('all');
    this.searchInput.set('');
  }

  protected toggle(id: number): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleAll(select: boolean): void {
    this.selected.set(select ? new Set(this.visible().map((r) => r.id)) : new Set());
  }

  protected toggleMenu(request: MenuRequest): void {
    this.menu.set(this.menu()?.invoice.id === request.invoice.id ? null : request);
  }

  // Opens every selected invoice (or every one shown) on one page, ready to print or save as a single PDF.
  protected printInvoices(): void {
    const rows = this.selectedRows().length ? this.selectedRows() : this.visible();
    this.router.navigate(['/invoices/print'], { queryParams: { ids: rows.map((r) => r.id).join(',') } });
  }

  protected exportCsv(): void {
    const rows = this.selectedRows().length ? this.selectedRows() : this.visible();
    exportInvoicesCsv(rows);
  }

  protected onAction(invoice: InvoiceListItem, action: RowAction): void {
    switch (action) {
      case 'view':
        this.router.navigate(['/invoices', invoice.id]);
        break;
      case 'edit':
        this.router.navigate(['/invoices', invoice.id, 'edit']);
        break;
      case 'duplicate':
        this.router.navigate(['/invoices/new'], { queryParams: { from: invoice.id } });
        break;
      case 'receipt':
        this.receiptFor.set(invoice);
        break;
      case 'ledger':
        this.router.navigate(['/clients', invoice.clientId]);
        break;
      case 'delete':
        this.pendingDelete.set([invoice]);
        break;
    }
  }

  // A receipt can settle invoices (oldest first), so reload to show their new status.
  protected onReceiptSaved(): void {
    this.receiptFor.set(null);
    this.reload();
  }

  protected confirmDelete(): void {
    const invoices = this.pendingDelete();
    if (!invoices?.length) return;
    this.busy.set(true);
    forkJoin(invoices.map((inv) => this.invoiceService.delete(inv.id))).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingDelete.set(null);
        this.toast.success(invoices.length === 1 ? `${invoices[0].invoiceNumber} deleted.` : `${invoices.length} invoices deleted.`);
        this.reload();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.pendingDelete.set(null);
        this.toast.error(toApiError(err).message);
        this.reload();
      },
    });
  }
}
