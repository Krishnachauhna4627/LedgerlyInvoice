import { ViewportScroller } from '@angular/common';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { ThemeService } from './core/theme/theme.service';

// Keep in sync with --header-height so anchor links aren't hidden under the sticky header.
const HEADER_HEIGHT = 72;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(ViewportScroller).setOffset([0, HEADER_HEIGHT]);
    }),
  ],
};
