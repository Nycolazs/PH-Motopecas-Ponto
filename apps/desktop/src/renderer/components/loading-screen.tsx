import { LoaderCircle } from 'lucide-react';

import { Brand } from './brand.js';

export function LoadingScreen(): React.JSX.Element {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <Brand />
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>Carregando sua sessão…</p>
    </main>
  );
}
