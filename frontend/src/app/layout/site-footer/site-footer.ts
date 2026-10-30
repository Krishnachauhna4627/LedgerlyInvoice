import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';

// Public website footer: business name, address, contact, Made in India badge and trademark notice.
@Component({
  selector: 'app-site-footer',
  imports: [NgOptimizedImage],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {}
