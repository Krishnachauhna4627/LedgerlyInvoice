import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { ProductPreview } from '../product-preview/product-preview';

@Component({
  selector: 'app-hero',
  imports: [RouterLink, Icon, ProductPreview],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly perks = ['Easy to use', 'GST compliant', 'No installation required'];
}
