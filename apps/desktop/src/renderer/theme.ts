export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ph-ponto-theme';

export function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.style.colorScheme = theme;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  }
}
