/**
 * Theme Store – Dark / Light mode toggle with localStorage persistence.
 *
 * Applies/removes the `light` class on `document.documentElement`
 * to activate the `:root.light` CSS variables defined in `app.css`.
 */

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'synaptic-sandbox-theme';

class ThemeState {
  mode: ThemeMode = $state('dark');

  constructor() {
    this.loadFromStorage();
  }

  /** Load persisted preference and apply to DOM. */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        this.mode = stored;
      }
    } catch {
      // SSR or restricted storage — use default
    }
    this.applyToDOM();
  }

  /** Toggle between dark and light. */
  toggle(): void {
    this.mode = this.mode === 'dark' ? 'light' : 'dark';
    this.applyToDOM();
    this.persist();
  }

  /** Apply the current mode to the document root element. */
  private applyToDOM(): void {
    // Guard for SSR / test environments without a DOM
    if (typeof document === 'undefined') return;

    if (this.mode === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.mode);
    } catch {
      console.error('[UX-DEV] Failed to persist theme preference');
    }
  }
}

export const theme = new ThemeState();
