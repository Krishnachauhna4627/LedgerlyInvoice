import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { ForgotPasswordForm } from './components/forgot-password-form/forgot-password-form';
import { LoginForm } from './components/login-form/login-form';
import { SignupForm } from './components/signup-form/signup-form';

// Login, signup and forgot password share one page; their links swap the form in place.
@Component({
  selector: 'app-auth',
  imports: [RouterLink, Icon, LogoMark, ForgotPasswordForm, LoginForm, SignupForm],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class Auth {
  protected readonly mode = signal<'login' | 'signup' | 'forgot'>('login');
  protected readonly perks = ['GST-ready invoices in seconds', 'Customers and products/services in one place', 'Export to PDF or Excel'];
}
