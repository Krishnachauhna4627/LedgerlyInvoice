import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { DEFAULT_THEME, THEMES, ThemeId } from './themes';

const STORAGE_KEY = 'ledgerly.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly themes = THEMES;
  readonly current = signal<ThemeId>(this.loadSaved());

  constructor() {
    effect(() => {
      const theme = this.current();
      this.document.documentElement.dataset['theme'] = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage unavailable (private mode etc.) — theme still applies for this visit.
      }
    });
  }

  setTheme(theme: ThemeId): void {
    this.current.set(theme);
  }

  private loadSaved(): ThemeId {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (THEMES.some((t) => t.id === saved)) {
        return saved as ThemeId;
      }
    } catch {
      // Fall through to the default.
    }
    return DEFAULT_THEME;
  }
}
