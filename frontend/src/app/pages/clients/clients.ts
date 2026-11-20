import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { Client } from '../../core/data/models';
import { stateLabel } from '../../core/gst/gst-states';
import { downloadCsv } from '../../core/ui/csv';
import { todayIso } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { ClientForm } from '../../shared/components/client-form/client-form';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { BalancePipe } from '../../shared/pipes/balance.pipe';
import { InrPipe } from '../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-clients-page',
  imports: [PageHeader, Icon, Modal, ClientForm, BalancePipe, InrPipe, RouterLink, ShowMore],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
})
export class Clients {
  private readonly clientService = inject(ClientService);
  private readonly toast = inject(ToastService);

  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');

  // Add/edit modal: open with `editing` = the client, or null for a new one.
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Client | null>(null);
  protected readonly deleting = signal<Client | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly stateLabel = stateLabel;
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.clients();
    return this.clients().filter((c) =>
      [c.name, c.gstin, c.phone, c.email].some((value) => (value ?? '').toLowerCase().includes(term)),
    );
  });

  protected readonly page = paged(this.filtered);

  // Totals of the closing balances shown: Dr balances are receivable, Cr balances payable.
  protected readonly closingTotals = computed(() => {
    let receivable = 0;
    let payable = 0;
    for (const c of this.filtered()) {
      if (c.closingBalance > 0) receivable += c.closingBalance;
      else payable -= c.closingBalance;
    }
    return { receivable, payable };
  });

  constructor() {
    // A new search starts again from the first page.
    effect(() => {
      this.search();
      this.page.reset();
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.clientService.list().subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  // Download the list shown (search applied) for Excel, with each party's receivable / payable and the totals.
  protected exportExcel(): void {
    const money = (n: number) => Math.abs(n).toFixed(2);
    const side = (n: number) => (n > 0 ? 'Dr' : n < 0 ? 'Cr' : '');
    const { receivable, payable } = this.closingTotals();
    downloadCsv(
      `ledgers-party-detail-${todayIso()}.csv`,
      ['Name', 'Address', 'GSTIN', 'Phone', 'Email', 'State', 'Opening bal.', 'Dr/Cr', 'Debit', 'Credit', 'Closing bal.', 'Dr/Cr',
        'Receivable (Dr)', 'Payable (Cr)'],
      [
        ...this.filtered().map((c) => [
          c.name,
          c.address,
          c.gstin,
          c.phone,
          c.email,
          stateLabel(c.stateCode),
          money(c.openingBalance),
          side(c.openingBalance),
          c.debit.toFixed(2),
          c.credit.toFixed(2),
          money(c.closingBalance),
          side(c.closingBalance),
          c.closingBalance > 0 ? c.closingBalance.toFixed(2) : '',
          c.closingBalance < 0 ? money(c.closingBalance) : '',
        ]),
        ['Total', '', '', '', '', '', '', '', '', '', '', '', receivable.toFixed(2), payable.toFixed(2)],
      ],
    );
  }

  protected openForm(client: Client | null): void {
    this.editing.set(client);
    this.formOpen.set(true);
  }

  protected onSaved(saved: Client): void {
    this.clients.update((list) => {
      const others = list.filter((c) => c.id !== saved.id);
      return [...others, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    this.formOpen.set(false);
  }

  protected confirmDelete(): void {
    const client = this.deleting();
    if (!client || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.clientService.delete(client.id).subscribe({
      next: () => {
        this.clients.update((list) => list.filter((c) => c.id !== client.id));
        this.toast.success('Customer deleted');
        this.deleting.set(null);
        this.deleteBusy.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }
}
