import { Component, signal } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';

interface NavLink {
  label: string;
  fragment?: string;
}

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, Icon, LogoMark],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  protected readonly links: NavLink[] = [
    { label: 'Home' },
    { label: 'Features', fragment: 'features' },
    { label: 'How it works', fragment: 'how-it-works' },
  ];

  // Fragment must match too, so only the section currently linked to is highlighted.
  protected readonly activeOptions: IsActiveMatchOptions = {
    paths: 'exact',
    fragment: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
  };

  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
