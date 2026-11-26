import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { ForgotPasswordForm } from './components/forgot-password-form/forgot-password-form';
import { LoginForm } from './components/login-form/login-form';
import { ResetPasswordForm } from './components/reset-password-form/reset-password-form';
import { SignupForm } from './components/signup-form/signup-form';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

// Login, signup, forgot password and reset password (/reset-password, from the email link) share one page;
// their links swap the form in place.
@Component({
  selector: 'app-auth',
  imports: [RouterLink, Icon, LogoMark, ForgotPasswordForm, LoginForm, ResetPasswordForm, SignupForm],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class Auth {
  private readonly router = inject(Router);
  protected readonly mode = signal<AuthMode>(inject(ActivatedRoute).snapshot.data['mode'] ?? 'login');

  // From the reset page, go to the real /login address (a refresh there must not show the used link again).
  protected toLogin(): void {
    if (this.router.url.startsWith('/reset-password')) this.router.navigateByUrl('/login');
    else this.mode.set('login');
  }
  protected readonly perks = ['GST-ready invoices in seconds', 'Customers and products/services in one place', 'Export to PDF or Excel'];
}
