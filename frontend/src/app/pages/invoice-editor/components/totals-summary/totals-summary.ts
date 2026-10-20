import { Component, input } from '@angular/core';
import { InvoiceTotals } from '../../../../core/gst/gst';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-totals-summary',
  imports: [InrPipe],
  template: `
    <dl class="totals">
      <dt>Sub-total</dt>
      <dd>{{ totals().subTotal | inr }}</dd>
      @if (isInterState()) {
        <dt>IGST</dt>
        <dd>{{ totals().totalIgst | inr }}</dd>
      } @else {
        <dt>CGST</dt>
        <dd>{{ totals().totalCgst | inr }}</dd>
        <dt>SGST</dt>
        <dd>{{ totals().totalSgst | inr }}</dd>
      }
      <dt class="grand">Grand total</dt>
      <dd class="grand">{{ totals().grandTotal | inr }}</dd>
    </dl>
    <p class="words">{{ words() }}</p>
    <p class="supply">{{ isInterState() ? 'Inter-state supply — IGST applies.' : 'Intra-state supply — CGST + SGST apply.' }}</p>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
    }
    .totals {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-2) var(--space-4);
      margin: 0;
      font-size: var(--text-sm);
    }
    dt { color: var(--color-text-muted); }
    dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .grand {
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-border);
      color: var(--color-text);
      font-size: var(--text-lg);
      font-weight: 700;
    }
    dd.grand { color: var(--color-primary); }
    .words { margin-top: var(--space-3); font-size: var(--text-sm); font-style: italic; }
    .supply { margin-top: var(--space-1); font-size: var(--text-xs); color: var(--color-text-muted); }
  `,
})
export class TotalsSummary {
  readonly totals = input.required<InvoiceTotals>();
  readonly isInterState = input(false);
  readonly words = input('');
}
