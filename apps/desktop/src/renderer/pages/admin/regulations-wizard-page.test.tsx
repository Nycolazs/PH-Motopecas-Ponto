import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { RegulationsWizardPage } from './regulations-wizard-page.js';

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

describe('RegulationsWizardPage', () => {
  beforeEach(() => {
    installBridge();
  });

  it('renders the regulations wizard with step 1 and initial company fields', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/regulations')) {
        return Promise.resolve(
          jsonResponse({
            id: 'reg-1',
            companyId: 'company-1',
            currentVersion: null,
            versions: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      if (url.includes('/company')) {
        return Promise.resolve(
          jsonResponse({
            id: 'company-1',
            legalName: 'PH MOTOPECAS LTDA',
            tradeName: 'PH Motopeças',
            cnpj: '00.000.000/0001-00',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<RegulationsWizardPage />);

    expect(
      await screen.findByRole('heading', { name: /Regimento Interno de Trabalho/i }),
    ).toBeVisible();
    expect(screen.getByText('Etapa 1: Informações da Empresa e Princípios')).toBeVisible();
    expect(screen.getByPlaceholderText('Ex: PH Motopeças')).toBeVisible();
    expect(screen.getByRole('button', { name: /Salvar Rascunho/i })).toBeVisible();
  });

  it('navigates from step 1 to step 2 when clicking next', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/regulations')) {
        return Promise.resolve(
          jsonResponse({
            id: 'reg-1',
            companyId: 'company-1',
            currentVersion: null,
            versions: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      if (url.includes('/company')) {
        return Promise.resolve(
          jsonResponse({
            id: 'company-1',
            legalName: 'PH MOTOPECAS LTDA',
            tradeName: 'PH Motopeças',
            cnpj: '00.000.000/0001-00',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<RegulationsWizardPage />);

    expect(await screen.findByText('Etapa 1: Informações da Empresa e Princípios')).toBeVisible();

    const nextBtn = screen.getByRole('button', { name: /Próxima Etapa/i });
    await user.click(nextBtn);

    expect(await screen.findByText('Etapa 2: Jornada, Pontualidade e Horas Extras')).toBeVisible();
  });
});
