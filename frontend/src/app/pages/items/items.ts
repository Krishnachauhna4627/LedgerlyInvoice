import { Component, computed, effect, inject, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { ItemService } from '../../core/data/item.service';
import { Item } from '../../core/data/models';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { ItemForm } from '../../shared/components/item-form/item-form';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InrPipe } from '../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-items-page',
  imports: [PageHeader, Icon, Modal, ItemForm, InrPipe, ShowMore],
  templateUrl: './items.html',
  styleUrl: './items.scss',
})
export class Items {
  private readonly itemService = inject(ItemService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<Item[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Item | null>(null);
  protected readonly deleting = signal<Item | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (i) => i.name.toLowerCase().includes(term) || (i.hsnSac ?? '').toLowerCase().includes(term),
    );
  });

  protected readonly page = paged(this.filtered);

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
    this.itemService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected openForm(item: Item | null): void {
    this.editing.set(item);
    this.formOpen.set(true);
  }

  protected onSaved(saved: Item): void {
    this.items.update((list) => {
      const others = list.filter((i) => i.id !== saved.id);
      return [...others, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    this.formOpen.set(false);
  }

  protected confirmDelete(): void {
    const item = this.deleting();
    if (!item || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.itemService.delete(item.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((i) => i.id !== item.id));
        this.toast.success('Product/service deleted');
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
