import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}">
          <app-icon [name]="toast.kind === 'success' ? 'check-circle' : 'alert-circle'" [size]="18" />
          <span>{{ toast.message }}</span>
          <button type="button" aria-label="Dismiss" (click)="dismiss(toast.id)"><app-icon name="x" [size]="14" /></button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      top: var(--space-4);
      right: var(--space-4);
      left: var(--space-4);
      z-index: 100;
      display: grid;
      justify-items: end;
      gap: var(--space-2);
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      max-width: 420px;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-surface-inverse);
      color: var(--color-on-primary);
      font-size: var(--text-sm);
      box-shadow: var(--shadow-lg);
      pointer-events: auto;
    }
    .toast--success app-icon:first-child { color: var(--color-success); }
    .toast--error app-icon:first-child { color: var(--color-danger); }
    button {
      display: grid;
      place-items: center;
      margin-left: var(--space-2);
      padding: var(--space-1);
      border: 0;
      background: none;
      color: inherit;
      opacity: 0.7;
      cursor: pointer;
    }
  `,
})
export class ToastHost {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;
  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
