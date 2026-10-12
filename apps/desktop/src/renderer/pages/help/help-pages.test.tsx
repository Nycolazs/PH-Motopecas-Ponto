import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { HelpHint } from '../../help/help-hint.js';
import { useHelpShortcut } from '../../help/use-help-shortcut.js';
import type { DesktopAuthSession } from '../../../shared/electron-api.js';
import { adminSession, createBridge, employeeSession, jsonResponse } from '../../test/fixtures.js';
import { HelpArticlePage } from './help-article-page.js';
import { HelpCenterPage } from './help-center-page.js';

function Location(): React.JSX.Element {
  const location = useLocation();
  return <output aria-label="Endereço atual">{`${location.pathname}${location.search}`}</output>;
}

function Shortcut(): null {
  useHelpShortcut();
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session } = useAuth();
  return session ? <>{children}</> : <p>Carregando sessão...</p>;
}

function renderHelp(session: DesktopAuthSession, path: string): void {
  Object.defineProperty(window, 'phPonto', { configurable: true, value: createBridge(session) });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
  const base = session.user.role === 'ADMIN' ? '/admin/ajuda' : '/ajuda';
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <AuthGate>
          <MemoryRouter initialEntries={[path]}>
            <Shortcut />
            <Location />
            <Routes>
              <Route path={base} element={<HelpCenterPage />} />
              <Route path={`${base}/:slug`} element={<HelpArticlePage />} />
              <Route
                path="*"
                element={
                  <HelpHint
                    article="registros-de-ponto"
                    section="inserir-manual"
                    title="Como inserir um ponto?"
                  >
                    Use Inserir Ponto Manual.
                  </HelpHint>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Central de Ajuda', () => {
  it('searches without accents and opens the guide at the matching section', async () => {
    const user = userEvent.setup();
    renderHelp(adminSession, '/admin/ajuda');

    const search = await screen.findByRole('searchbox', { name: 'Pesquisar na ajuda' });
    await user.type(search, 'ferias');
    const results = screen.getByRole('heading', { name: /resultado/ }).parentElement!;
    const first = within(results).getAllByRole('link')[0]!;
    expect(first).toHaveTextContent('Jornadas, feriados e férias');

    await user.type(search, '{Enter}');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Jornadas, feriados e férias' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Endereço atual')).toHaveTextContent(
      '/admin/ajuda/jornadas-e-calendario?secao=ferias',
    );
  });

  it('explains when nothing matches and lists the subjects', async () => {
    const user = userEvent.setup();
    renderHelp(adminSession, '/admin/ajuda');
    await user.type(await screen.findByRole('searchbox'), 'xyzabc');
    expect(screen.getByText('Nada encontrado para “xyzabc”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos os assuntos' }));
    expect(screen.getByRole('region', { name: 'Ponto do dia a dia' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Siga o roteiro de primeiros passos/ }),
    ).toBeInTheDocument();
  });

  it('shows a guide with steps, screenshots, zoom and a link to the screen', async () => {
    const user = userEvent.setup();
    renderHelp(adminSession, '/admin/ajuda/registros-de-ponto?secao=inserir-manual');

    expect(
      await screen.findByRole('heading', { level: 1, name: /Registros de Ponto/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Registros de Ponto' })).toHaveAttribute(
      'href',
      '/admin/pontos',
    );
    const section = screen.getByRole('region', { name: 'Inserir um ponto esquecido' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(4);
    expect(within(section).getByText('Passo 1:')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /Ampliar imagem/ }));
    const zoom = screen.getByRole('dialog', { name: 'Janela Inserir Ponto Manual' });
    await user.keyboard('{Escape}');
    expect(zoom).not.toBeInTheDocument();

    expect(screen.getByRole('navigation', { name: 'Nesta página' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Aprovar ou recusar solicitações de ajuste' }),
    ).toBeInTheDocument();
  });

  it('shows employees only their guides', async () => {
    renderHelp(employeeSession, '/ajuda');
    expect(
      await screen.findByRole('region', { name: 'Aplicativo do colaborador' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Documentos & RH' })).not.toBeInTheDocument();
    expect(screen.queryByText(/primeiros passos/i)).not.toBeInTheDocument();
  });

  it('sends employees back to the help center from an admin guide', async () => {
    renderHelp(employeeSession, '/ajuda/administradores');
    expect(
      await screen.findByRole('searchbox', { name: 'Pesquisar na ajuda' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Endereço atual')).toHaveTextContent(/^\/ajuda$/);
  });

  it('hides "Abrir esta tela" when the screen belongs to the other profile', async () => {
    renderHelp(adminSession, '/admin/ajuda/bater-ponto');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Como bater o ponto' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Abrir / })).not.toBeInTheDocument();
  });
});

describe('Ajuda nas telas', () => {
  it('opens a quick explanation from the "?" and links to the step-by-step', async () => {
    const user = userEvent.setup();
    renderHelp(adminSession, '/admin/pontos');

    const button = await screen.findByRole('button', { name: 'Ajuda: Como inserir um ponto?' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const popover = screen.getByRole('dialog', { name: 'Como inserir um ponto?' });
    expect(popover).toHaveTextContent('Use Inserir Ponto Manual.');

    await user.keyboard('{Escape}');
    expect(popover).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByRole('link', { name: /Ver passo a passo/ }));
    expect(screen.getByLabelText('Endereço atual')).toHaveTextContent(
      '/admin/ajuda/registros-de-ponto?secao=inserir-manual',
    );
  });

  it('opens the guide of the current screen with F1', async () => {
    const user = userEvent.setup();
    renderHelp(adminSession, '/admin/pontos');
    await screen.findByRole('button', { name: /Ajuda:/ });
    await user.keyboard('{F1}');
    expect(screen.getByLabelText('Endereço atual')).toHaveTextContent(
      '/admin/ajuda/registros-de-ponto',
    );
  });
});
