import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { PREVIEW_TILES, sparkPaths } from '../product-preview/preview-data';

// Mockup of the dashboard's stat tiles: value, sparkline and change from last period.
@Component({
  selector: 'app-preview-tiles',
  imports: [Icon],
  templateUrl: './preview-tiles.html',
  styleUrl: './preview-tiles.scss',
})
export class PreviewTiles {
  protected readonly tiles = PREVIEW_TILES.map((t) => ({ ...t, spark: sparkPaths(t.series) }));
}
