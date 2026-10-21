import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { Reveal } from '../../../../shared/directives/reveal';

@Component({
  selector: 'app-cta',
  imports: [RouterLink, Icon, Reveal],
  templateUrl: './cta.html',
  styleUrl: './cta.scss',
})
export class Cta {}
