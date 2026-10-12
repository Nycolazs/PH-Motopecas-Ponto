import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { helpPathForScreen, useHelpContext } from './help-routes.js';

/** F1 opens the guide of the screen being used, like in desktop programs. */
export function useHelpShortcut(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { base } = useHelpContext();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'F1' || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      navigate(helpPathForScreen(base, pathname));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [base, navigate, pathname]);
}
