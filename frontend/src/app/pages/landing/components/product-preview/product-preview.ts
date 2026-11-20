import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { LogoMark } from '../../../../shared/components/logo-mark/logo-mark';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { PreviewCharts } from '../preview-charts/preview-charts';
import { PreviewTiles } from '../preview-tiles/preview-tiles';
import { PREVIEW_INVOICES, PREVIEW_NAV } from './preview-data';

// Static miniature of the logged-in dashboard (sidebar + overview), shown in the landing hero.
@Component({
  selector: 'app-product-preview',
  imports: [Icon, LogoMark, StatusBadge, PreviewCharts, PreviewTiles],
  templateUrl: './product-preview.html',
  styleUrl: './product-preview.scss',
})
export class ProductPreview {
  protected readonly nav = PREVIEW_NAV;
  protected readonly invoices = PREVIEW_INVOICES;
}
