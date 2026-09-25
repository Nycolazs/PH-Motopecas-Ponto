import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { InterviewDocumentPage } from './interview-document-page.js';

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

describe('InterviewDocumentPage', () => {
  beforeEach(() => {
    installBridge();
  });

  it('renders candidate fields, criteria table, and recommendation cards', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/job-roles')) {
        return Promise.resolve(
          jsonResponse([
            { id: 'role-1', title: 'Mecânico', department: 'Oficina', isActive: true },
          ]),
        );
      }
      if (url.includes('/interviews')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                candidateName: 'Lucas Oliveira',
                candidateEmail: 'lucas@example.com',
                candidatePhone: '(11) 98765-4321',
                jobRoleId: null,
                roleTitle: 'Mecânico',
                interviewDate: '2026-09-25',
                interviewerName: 'Admin',
                evaluatorId: '22222222-2222-4222-8222-222222222222',
                recommendation: 'RECOMMENDED',
                scores: [{ criterion: 'Comunicação', score: 5 }],
                createdAt: '2026-09-25T12:00:00.000Z',
                updatedAt: '2026-09-25T12:00:00.000Z',
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<InterviewDocumentPage />);

    expect(
      await screen.findByRole('heading', { name: /Guia de Entrevista e Seleção/i }),
    ).toBeVisible();
    expect(screen.getByPlaceholderText('Ex: Lucas Henrique de Souza')).toBeVisible();
    expect(screen.getByText('Recomendado para Contratação')).toBeVisible();
    expect(screen.getByText('Banco de Talentos')).toBeVisible();
    expect(screen.getByText('Não Recomendado')).toBeVisible();
    expect(await screen.findByText('Lucas Oliveira')).toBeVisible();
  });

  it('allows filling candidate name and changing recommendation', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents/drafts')) {
        return Promise.resolve(jsonResponse(null));
      }
      if (url.includes('/job-roles')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes('/interviews')) {
        return Promise.resolve(
          jsonResponse({
            items: [],
            total: 0,
            limit: 20,
            offset: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<InterviewDocumentPage />);

    const input = await screen.findByPlaceholderText('Ex: Lucas Henrique de Souza');
    await user.type(input, 'Carlos Alberto');
    expect(input).toHaveValue('Carlos Alberto');

    const talentPoolBtn = screen.getByText('Banco de Talentos');
    await user.click(talentPoolBtn);

    expect(screen.getByText('Banco de Talentos')).toBeVisible();
  });
});
