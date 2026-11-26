import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Purchase, PurchaseLine } from '../../../../core/data/models';
import { stateName } from '../../../../core/gst/gst-states';
import { formatDmy } from '../../../../core/ui/dates';
import { Icon } from '../../../../shared/components/icon/icon';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

// Purchase register laid out like the invoices table: on md+ one row per bill line with the bill-level
// cells spanning its rows; stacked cards on phones.
@Component({
  selector: 'app-purchase-table',
  imports: [RouterLink, Icon, InrPipe],
  templateUrl: './purchase-table.html',
  styleUrl: './purchase-table.scss',
})
export class PurchaseTable {
  readonly purchases = input.required<Purchase[]>();
  readonly remove = output<Purchase>();

  protected readonly formatDmy = formatDmy;

  // Lines to show; a bill always has at least one, but render a placeholder row if not.
  protected rowsOf(p: Purchase): (PurchaseLine | null)[] {
    return p.lines.length ? p.lines : [null];
  }

  // '03' → '03-Punjab'.
  protected stateText(code: string | null): string {
    return code ? `${code}-${stateName(code)}` : '—';
  }

  // "Cement", or "Cement + 2 more".
  protected itemsText(p: Purchase): string {
    const [first, ...rest] = p.lines;
    if (!first) return '—';
    return rest.length ? `${first.description} + ${rest.length} more` : first.description;
  }
}
