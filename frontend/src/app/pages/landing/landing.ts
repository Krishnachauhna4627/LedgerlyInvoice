import { Component } from '@angular/core';
import { SiteHeader } from '../../layout/site-header/site-header';
import { Cta } from './components/cta/cta';
import { Features } from './components/features/features';
import { Hero } from './components/hero/hero';
import { HowItWorks } from './components/how-it-works/how-it-works';

// Module 1 — public website landing page (default route).
@Component({
  selector: 'app-landing',
  imports: [SiteHeader, Hero, Features, HowItWorks, Cta],
  templateUrl: './landing.html',
})
export class Landing {}
