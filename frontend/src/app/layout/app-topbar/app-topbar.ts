import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/components/icon/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';

// Top bar for logged-in pages.
@Component({
  selector: 'app-topbar',
  imports: [RouterLink, Icon, LogoMark],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
})
export class AppTopbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly initials = computed(() =>
    (this.user()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
