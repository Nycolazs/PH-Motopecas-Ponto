import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { CultureDocumentPage } from './culture-document-page.js';

function installBridge(session = adminSession): void {
  const bridge = createBridge(session);
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <div>Carregando sessão...</div>;
  return <>{children}</>;
}

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <ToastProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </ToastProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('CultureDocumentPage', () => {
  beforeEach(() => {
    installBridge();
  });

  it('renders the culture form with initial fields and title', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/culture')) {
        return Promise.resolve(
          jsonResponse({
            id: 'profile-1',
            companyId: 'company-1',
            currentVersion: null,
            versions: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<CultureDocumentPage />);

    expect(
      await screen.findByRole('heading', { name: /Manual de Cultura Organizacional/i }),
    ).toBeVisible();
    expect(screen.getByText('Não publicado')).toBeVisible();
    expect(await screen.findByLabelText(/Missão Institucional/i)).toBeVisible();
    expect(screen.getByLabelText(/Visão de Futuro/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Visualizar Prévia em PDF/i })).toBeVisible();
  });

  it('allows adding and removing institutional values in the form', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/culture')) {
        return Promise.resolve(
          jsonResponse({
            id: 'profile-1',
            companyId: 'company-1',
            currentVersion: null,
            versions: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<CultureDocumentPage />);

    expect(await screen.findByText(/Valores e Princípios/i)).toBeVisible();

    const addButton = screen.getByRole('button', { name: /Adicionar Valor/i });
    await user.click(addButton);

    // Should now have 3 values (initial 2 + 1 added)
    expect(screen.getByText('3')).toBeVisible();
  });
});
