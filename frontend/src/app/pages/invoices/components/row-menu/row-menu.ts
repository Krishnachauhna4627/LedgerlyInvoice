import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { InvoiceListItem } from '../../../../core/data/models';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

export type RowAction = 'view' | 'edit' | 'duplicate' | 'receipt' | 'ledger' | 'delete';

const MENU_WIDTH = 200;

// Actions menu for one invoice. Uses position: fixed so the table's scroll container can't clip it.
// Closes on outside click, Esc, scroll or resize; arrow keys move between items.
@Component({
  selector: 'app-row-menu',
  imports: [Icon],
  templateUrl: './row-menu.html',
  styleUrl: './row-menu.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close(true)',
    '(window:resize)': 'close()',
  },
})
export class RowMenu {
  readonly invoice = input.required<InvoiceListItem>();
  readonly anchor = input.required<HTMLElement>();
  readonly action = output<RowAction>();
  readonly closed = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly position = signal({ top: 0, left: 0 });

  protected readonly items = computed(() => {
    const inv = this.invoice();
    const list: { action: RowAction; label: string; icon: IconName; danger?: boolean }[] = [
      { action: 'view', label: 'View', icon: 'eye' },
      { action: 'edit', label: 'Edit', icon: 'pencil' },
      { action: 'duplicate', label: 'Duplicate', icon: 'copy' },
    ];
    // Paid / unpaid follows the customer's receipts, so payments are recorded rather than ticked.
    if (inv.clientId) {
      if (inv.status === 'unpaid') list.push({ action: 'receipt', label: 'Record receipt', icon: 'rupee' });
      list.push({ action: 'ledger', label: 'Customer ledger', icon: 'receipt' });
    }
    list.push({ action: 'delete', label: 'Delete', icon: 'trash', danger: true });
    return list;
  });

  constructor() {
    const onScroll = () => this.close();
    afterNextRender(() => {
      this.place();
      this.buttons()[0]?.focus();
      window.addEventListener('scroll', onScroll, true);
    });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, true));
  }

  protected choose(action: RowAction): void {
    this.action.emit(action);
    this.close(action !== 'delete');
  }

  close(returnFocus = false): void {
    if (returnFocus) this.anchor().focus();
    this.closed.emit();
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (!this.host.nativeElement.contains(target) && !this.anchor().contains(target)) {
      this.close();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const buttons = this.buttons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      buttons[(to + buttons.length) % buttons.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(buttons.length - 1);
    else if (event.key === 'Tab') this.close();
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  }

  // Below the ⋯ button, right-aligned to it; flips above when there's no room underneath.
  private place(): void {
    const rect = this.anchor().getBoundingClientRect();
    const height = this.host.nativeElement.querySelector('.menu')?.getBoundingClientRect().height ?? 0;
    const below = rect.bottom + 4;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    this.position.set({ top, left });
  }
}
