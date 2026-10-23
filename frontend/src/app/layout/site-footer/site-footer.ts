import { Component } from '@angular/core';

// Public website footer: business name, address, contact and trademark notice.
@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  protected readonly year = new Date().getFullYear();
}
