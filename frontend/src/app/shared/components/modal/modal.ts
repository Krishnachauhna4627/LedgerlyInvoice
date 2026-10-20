import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

// Accessible dialog built on <dialog>: focus trap, Esc to close, backdrop.
// <app-modal [open]="showForm()" title="Add client" (closed)="showForm.set(false)">…form…</app-modal>
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `
    <dialog #dialog [attr.aria-labelledby]="titleId" (close)="closed.emit()" (click)="onBackdrop($event)">
      <div class="head">
        <h2 [id]="titleId">{{ title() }}</h2>
        <button type="button" class="icon-button" aria-label="Close" (click)="dialog.close()">
          <app-icon name="x" [size]="18" />
        </button>
      </div>
      <div class="body"><ng-content /></div>
    </dialog>
  `,
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');
  readonly closed = output();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly titleId = `modal-${Math.random().toString(36).slice(2, 9)}`;

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      el.dataset['size'] = this.size();
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }
}
