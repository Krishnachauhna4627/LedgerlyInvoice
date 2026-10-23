import { Component, computed, inject, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { Client } from '../../core/data/models';
import { stateLabel } from '../../core/gst/gst-states';
import { ToastService } from '../../core/ui/toast.service';
import { ClientForm } from '../../shared/components/client-form/client-form';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-clients-page',
  imports: [PageHeader, Icon, Modal, ClientForm],
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

  constructor() {
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
        this.toast.success('Client deleted');
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
