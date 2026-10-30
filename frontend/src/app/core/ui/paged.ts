import { Signal, computed, signal } from '@angular/core';

export const PAGE_SIZE = 50;

export interface Paged<T> {
  // The rows to render: the first `limit` of the source.
  readonly rows: Signal<T[]>;
  // Rows not rendered yet.
  readonly remaining: Signal<number>;
  more(): void;
  reset(): void;
}

// Renders a long list a page at a time, so thousands of rows never slow the page down.
// Call reset() when the filters change; edits to the list (save, delete) keep what is already shown.
export function paged<T>(source: Signal<T[]>, pageSize = PAGE_SIZE): Paged<T> {
  const limit = signal(pageSize);
  return {
    rows: computed(() => source().slice(0, limit())),
    remaining: computed(() => Math.max(source().length - limit(), 0)),
    more: () => limit.update((n) => n + pageSize),
    reset: () => limit.set(pageSize),
  };
}
