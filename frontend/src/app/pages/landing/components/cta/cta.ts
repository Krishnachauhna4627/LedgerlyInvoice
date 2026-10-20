import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';

@Component({
  selector: 'app-cta',
  imports: [RouterLink, Icon],
  templateUrl: './cta.html',
  styleUrl: './cta.scss',
})
export class Cta {}
