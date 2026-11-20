import { Component } from '@angular/core';
import { PREVIEW_RECEIVABLE, PREVIEW_TREND, PREVIEW_TREND_TOP } from '../product-preview/preview-data';

const R = 40;
const CIRCUMFERENCE = 2 * Math.PI * R;

// Mockup of the dashboard's "Sales vs purchases" bars and receivable donut.
@Component({
  selector: 'app-preview-charts',
  templateUrl: './preview-charts.html',
  styleUrl: './preview-charts.scss',
})
export class PreviewCharts {
  protected readonly trend = PREVIEW_TREND.map((m) => ({
    ...m,
    salesPct: (m.sales / PREVIEW_TREND_TOP) * 100,
    purchasesPct: (m.purchases / PREVIEW_TREND_TOP) * 100,
  }));
  protected readonly ticks = ['₹250k', '₹125k', '₹0'];

  protected readonly r = R;
  protected readonly donut = (() => {
    const { received, receivable } = PREVIEW_RECEIVABLE;
    const receivedShare = received / (received + receivable);
    const receivedLen = receivedShare * CIRCUMFERENCE;
    return {
      receivedPct: Math.round(receivedShare * 100),
      receivablePct: 100 - Math.round(receivedShare * 100),
      received: { dash: `${receivedLen - 2} ${CIRCUMFERENCE}`, offset: 0 },
      receivable: { dash: `${CIRCUMFERENCE - receivedLen - 2} ${CIRCUMFERENCE}`, offset: -receivedLen },
    };
  })();
}
