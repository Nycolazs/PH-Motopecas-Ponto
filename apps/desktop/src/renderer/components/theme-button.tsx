import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { applyTheme, readInitialTheme, type Theme } from '../theme.js';

export function ThemeButton(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    const handleThemeChange = (event: Event): void => {
      const customEvent = event as CustomEvent<Theme>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setTheme(customEvent.detail);
      }
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, [theme]);

  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const label = nextTheme === 'dark' ? 'Ativar modo escuro' : 'Ativar modo claro';
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}
