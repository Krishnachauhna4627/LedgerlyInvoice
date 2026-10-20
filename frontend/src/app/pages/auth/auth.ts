import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { LoginForm } from './components/login-form/login-form';
import { SignupForm } from './components/signup-form/signup-form';

// Login and signup share one page; the Sign up button swaps the form in place.
@Component({
  selector: 'app-auth',
  imports: [RouterLink, Icon, LogoMark, LoginForm, SignupForm],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class Auth {
  protected readonly mode = signal<'login' | 'signup'>('login');
  protected readonly perks = ['GST-ready invoices in seconds', 'Customers and items in one place', 'Export to PDF or Excel'];
}
