import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// How long the splash screen in index.html stays, counted from page load. Keep in step with --duration-splash.
const SPLASH_MS = 2000;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err))
  .finally(hideSplash);

// Fades the splash out once it has been up for SPLASH_MS (or straight away if loading took longer), then removes it.
function hideSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('splash--hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // In case transitionend never fires (e.g. reduced motion, background tab).
    setTimeout(() => splash.remove(), 1000);
  }, Math.max(SPLASH_MS - performance.now(), 0));
}
