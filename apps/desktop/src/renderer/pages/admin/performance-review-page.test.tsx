import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { PerformanceReviewPage } from './performance-review-page.js';

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

describe('PerformanceReviewPage', () => {
  const mockEmployeeId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    installBridge();
  });

  it('renders page header, 8 canonical criteria, and live score card', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/employees')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: mockEmployeeId,
                name: 'Carlos Alberto Souza',
                login: 'carlos.souza',
                role: 'EMPLOYEE',
                isActive: true,
                accessEnabled: true,
                hasAvatar: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
          }),
        );
      }
      if (url.includes('/performance/reviews')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<PerformanceReviewPage />);

    expect(
      await screen.findByRole('heading', { name: /Avaliação de Desempenho e Competências/i }),
    ).toBeInTheDocument();

    // Check all 8 canonical criteria are present
    expect(screen.getByText('Pontualidade e Assiduidade')).toBeInTheDocument();
    expect(screen.getByText('Produtividade e Agilidade')).toBeInTheDocument();
    expect(screen.getByText('Conhecimento Técnico e Qualidade')).toBeInTheDocument();
    expect(screen.getByText('Trabalho em Equipe e Cooperação')).toBeInTheDocument();
    expect(screen.getByText('Respeito e Conduta Ética')).toBeInTheDocument();
    expect(screen.getByText('Proatividade e Iniciativa')).toBeInTheDocument();
    expect(screen.getByText('Organização e Ferramentas')).toBeInTheDocument();
    expect(screen.getByText('Segurança do Trabalho')).toBeInTheDocument();

    // Live score card shows initial 3.00 Regular
    expect(screen.getByText('3.00')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('displays past evaluations in history table', async () => {
    const mockCompanyId = '00000000-0000-4000-8000-000000000000';
    const mockEvaluatorId = '22222222-2222-4222-8222-222222222222';
    const mockReviewId = '33333333-3333-4333-8333-333333333333';
    const mockDocId = '44444444-4444-4444-8444-444444444444';

    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/employees')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: mockEmployeeId,
                name: 'Carlos Alberto Souza',
                login: 'carlos.souza',
                role: 'EMPLOYEE',
                isActive: true,
                accessEnabled: true,
                hasAvatar: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
          }),
        );
      }
      if (url.includes('/performance/reviews')) {
        return Promise.resolve(
          jsonResponse([
            {
              id: mockReviewId,
              companyId: mockCompanyId,
              employeeId: mockEmployeeId,
              employeeName: 'Carlos Alberto Souza',
              evaluatorId: mockEvaluatorId,
              evaluatorName: 'Gestor Teste',
              evaluationPeriod: '1º Trimestre / 2026',
              evaluationDate: '2026-03-31',
              meanScore: 4.25,
              classification: 'GOOD',
              scores: [
                {
                  criterionKey: 'PUNCTUALITY_ATTENDANCE',
                  criterionTitle: 'Pontualidade e Assiduidade',
                  score: 4,
                  feedback: null,
                },
              ],
              strengths: 'Muito dedicado',
              improvements: null,
              actionPlan: null,
              evaluatorComments: null,
              employeeComments: null,
              generatedDocumentId: mockDocId,
              isSuperseded: false,
              supersededById: null,
              supersededAt: null,
              supersessionReason: null,
              createdAt: '2026-04-01T10:00:00.000Z',
              updatedAt: '2026-04-01T10:00:00.000Z',
            },
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<PerformanceReviewPage />);

    expect(await screen.findByText('1º Trimestre / 2026')).toBeInTheDocument();
    expect(screen.getByText('4.25')).toBeInTheDocument();
    expect(screen.getByText('Bom')).toBeInTheDocument();
    expect(screen.getByText('Vigente')).toBeInTheDocument();
  });
});
