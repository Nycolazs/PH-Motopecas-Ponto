import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { DisciplineDocumentPage } from './discipline-document-page.js';

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

describe('DisciplineDocumentPage', () => {
  const mockEmployeeId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    installBridge();
  });

  it('renders page header, mode selectors, employee picker and history table', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/employees') || url.includes('/admins')) {
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
      if (url.includes('/discipline/actions')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<DisciplineDocumentPage />);

    expect(
      await screen.findByRole('heading', { name: /Procedimento e Medidas Disciplinares/i }),
    ).toBeInTheDocument();

    expect(screen.getByText('Conversa / Verbal')).toBeInTheDocument();
    expect(screen.getByText('Advertência Escrita')).toBeInTheDocument();
    expect(screen.getByText('Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.getByText('Histórico Geral de Medidas Disciplinares')).toBeInTheDocument();
  });

  it('loads and displays progression summary when an employee is selected', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.match(/\/employees(\?|$)/) || url.includes('/admins')) {
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
      if (url.includes('/profile')) {
        return Promise.resolve(
          jsonResponse({
            userId: mockEmployeeId,
            cpf: '123.456.789-00',
            rg: '1234567',
            birthDate: '1990-01-01',
            hireDate: '2026-01-01',
            accessEnabled: true,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      if (url.includes('/roles')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes(`/discipline/employees/${mockEmployeeId}/summary`)) {
        return Promise.resolve(
          jsonResponse({
            employeeId: mockEmployeeId,
            employeeName: 'Carlos Alberto Souza',
            verbalCount: 1,
            writtenCount: 1,
            suspensionCount: 1,
            totalSuspensionDays: 2,
            voidedCount: 0,
            currentStage: 'SUSPENSION',
            lastActionDate: '2026-09-15',
            lastActionType: 'SUSPENSION',
            nextSuggestedStage: 'DISMISSAL_REVIEW',
          }),
        );
      }
      if (url.includes('/discipline/actions')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<DisciplineDocumentPage />);

    // Wait for employee option to appear in select
    await screen.findByRole('option', { name: 'Carlos Alberto Souza (carlos.souza)' });

    const select = screen.getByRole('combobox', { name: /Colaborador Envolvido/i });
    await userEvent.selectOptions(select, mockEmployeeId);

    // Progression summary cards should be rendered
    await waitFor(() => {
      expect(screen.getByText('Prontuário Disciplinar')).toBeInTheDocument();
      expect(screen.getByText('Suspensão Disciplinar Ativa')).toBeInTheDocument();
      expect(screen.getByText('2d')).toBeInTheDocument();
    });
  });

  it('switches between discipline types and renders specific form fields', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/employees') || url.includes('/admins')) {
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
      if (url.includes('/discipline/actions')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<DisciplineDocumentPage />);

    await screen.findByRole('heading', { name: /Procedimento e Medidas Disciplinares/i });

    // Default is VERBAL: commitment textarea should be visible
    expect(screen.getByText(/Compromisso Assumido pelo Colaborador/i)).toBeInTheDocument();

    // Switch to WRITTEN
    await userEvent.click(screen.getByText('Advertência Escrita'));
    expect(screen.getByText(/Advertência sobre Reincidência/i)).toBeInTheDocument();

    // Switch to SUSPENSION
    await userEvent.click(screen.getByText('Suspensão Disciplinar'));
    expect(screen.getByText(/Dias de Suspensão/i)).toBeInTheDocument();
    expect(screen.getByText(/Retorno ao Trabalho/i)).toBeInTheDocument();
  });
});
