import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';

export interface PickerOption {
  id: number;
  label: string;
  detail?: string;
  // Extra text matched by the search (e.g. GSTIN, HSN code).
  keywords?: string;
}

let nextId = 0;

// Searchable combobox. Each instance keeps its own search text, so pickers on different lines never interfere.
@Component({
  selector: 'app-search-picker',
  imports: [Icon],
  templateUrl: './search-picker.html',
  styleUrl: './search-picker.scss',
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class SearchPicker {
  readonly options = input.required<PickerOption[]>();
  // Text shown while not searching (the current selection).
  readonly selectedLabel = input<string>('');
  readonly placeholder = input('Search…');
  readonly emptyText = input('No matches.');
  readonly invalid = input(false);
  readonly inputId = input(`picker-${nextId++}`);
  readonly describedBy = input<string | null>(null);
  readonly picked = output<number>();

  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly listId = computed(() => `${this.inputId()}-list`);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly active = signal(0);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    if (!q) return all.slice(0, 50);
    return all
      .filter((o) => `${o.label} ${o.detail ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q))
      .slice(0, 50);
  });

  protected readonly displayValue = computed(() => (this.searching() ? this.query() : this.selectedLabel()));

  protected onFocus(): void {
    this.searching.set(true);
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.filtered().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.active.update((i) => (count ? (i + 1) % count : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.update((i) => (count ? (i - 1 + count) % count : 0));
    } else if (event.key === 'Enter') {
      if (this.open() && count) {
        event.preventDefault();
        this.choose(this.filtered()[this.active()]);
      }
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  protected choose(option: PickerOption): void {
    this.picked.emit(option.id);
    this.close();
    this.inputEl().nativeElement.blur();
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = (event.currentTarget as HTMLElement) ?? null;
    if (!host || !host.contains(event.relatedTarget as Node | null)) {
      this.close();
    }
  }

  private close(): void {
    this.open.set(false);
    this.searching.set(false);
    this.query.set('');
  }
}
