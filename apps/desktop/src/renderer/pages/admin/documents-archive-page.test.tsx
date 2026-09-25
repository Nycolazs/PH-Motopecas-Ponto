import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { DocumentsArchivePage } from './documents-archive-page.js';

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

describe('DocumentsArchivePage', () => {
  beforeEach(() => {
    installBridge();
  });

  const mockDocuments = {
    items: [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        documentType: 'CULTURE',
        title: 'Manual de Cultura Organizacional',
        companyId: 'b0000000-0000-4000-8000-000000000002',
        employeeId: null,
        employeeName: null,
        authorId: 'c0000000-0000-4000-8000-000000000003',
        authorName: 'Administrador',
        artifactId: 'd0000000-0000-4000-8000-000000000004',
        fileSize: 12345,
        version: 1,
        supersededById: null,
        isVoid: false,
        voidReason: null,
        voidedAt: null,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  it('renders archive heading, search input, and document item', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents')) {
        return Promise.resolve(jsonResponse(mockDocuments));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<DocumentsArchivePage />);

    expect(
      await screen.findByRole('heading', { name: /Arquivo de Documentos Oficiais/i }),
    ).toBeVisible();
    expect(screen.getByPlaceholderText(/Buscar por título ou colaborador/i)).toBeVisible();
    expect(await screen.findByText('Manual de Cultura Organizacional')).toBeVisible();
    expect(screen.getAllByText('Cultura Organizacional').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Ativo')).toBeVisible();
  });

  it('opens void modal when clicking void button', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/documents')) {
        return Promise.resolve(jsonResponse(mockDocuments));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<DocumentsArchivePage />);

    expect(await screen.findByText('Manual de Cultura Organizacional')).toBeVisible();

    const voidButton = screen.getByTitle('Anular Documento');
    await user.click(voidButton);

    expect(await screen.findByRole('heading', { name: /Anular Documento Oficial/i })).toBeVisible();
    expect(
      screen.getByPlaceholderText(/Informe o motivo formal da anulação deste documento/i),
    ).toBeVisible();
  });
});
