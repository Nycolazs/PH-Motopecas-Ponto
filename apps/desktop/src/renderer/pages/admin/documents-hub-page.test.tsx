import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { printPdfBlob } from '../../lib/pdf.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { DocumentsHubPage } from './documents-hub-page.js';

const DOCUMENT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const UUID = '6959a6b9-8d98-48db-be01-8a1d7b8ab75f';

function generatedDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    documentType: 'DISCIPLINE_WRITTEN',
    title: 'Advertência Escrita — Diego Pereira',
    companyId: UUID,
    employeeId: UUID,
    employeeName: 'DIEGO PEREIRA DANTAS',
    authorId: UUID,
    authorName: 'ANA LUCIA',
    artifactId: UUID,
    fileSize: 2048,
    version: 1,
    supersededById: null,
    isVoid: false,
    voidReason: null,
    voidedAt: null,
    createdAt: '2026-10-09T13:05:00.000Z',
    ...overrides,
  };
}

function installFetch(items: unknown[] | 'error') {
  const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/documents?')) {
      if (items === 'error') return Promise.resolve(jsonResponse({ message: 'falhou' }, 500));
      return Promise.resolve(
        jsonResponse({
          items,
          pagination: { page: 1, limit: 6, total: items.length, totalPages: 1 },
        }),
      );
    }
    if (url.endsWith(`/documents/${DOCUMENT_ID}/download`)) {
      return Promise.resolve(
        new Response('%PDF-1.7', {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="advertencia_escrita_v1.pdf"',
          },
        }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : <div>Carregando sessão...</div>;
}

function renderHub(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <MemoryRouter>
              <DocumentsHubPage />
            </MemoryRouter>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('DocumentsHubPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: createBridge(adminSession),
    });
    installFetch([]);
  });

  it('lists the latest generated PDFs and opens them in the built-in viewer', async () => {
    installFetch([generatedDocument()]);
    const user = userEvent.setup();
    renderHub();

    const panel = await screen.findByRole('region', { name: 'Últimos PDFs gerados' });
    const card = await within(panel).findByRole('button', {
      name: 'Abrir Advertência Escrita — Diego Pereira',
    });
    expect(card).toHaveTextContent('Diego Pereira Dantas');
    expect(within(panel).getByText('Arquivo criptografado')).toBeInTheDocument();

    await user.click(card);
    const dialog = await screen.findByRole('dialog', {
      name: 'Advertência Escrita — Diego Pereira',
    });
    expect(await within(dialog).findByText('2 páginas')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('img', { name: /Página/ })).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: 'Imprimir' }));
    expect(printPdfBlob).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('explains when no PDF was generated yet', async () => {
    renderHub();
    expect(await screen.findByText(/Nenhum PDF foi gerado ainda/)).toBeInTheDocument();
  });

  it('offers a retry when the latest PDFs cannot be loaded', async () => {
    installFetch('error');
    renderHub();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os últimos documentos.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('groups every document by subject with a clear action link', async () => {
    renderHub();

    expect(await screen.findByRole('heading', { name: 'Documentos & RH' })).toBeInTheDocument();
    const discipline = screen.getByRole('region', { name: 'Medidas disciplinares' });
    expect(within(discipline).getByText('Advertência Verbal')).toBeInTheDocument();
    expect(within(discipline).getByText('Advertência Escrita')).toBeInTheDocument();
    expect(within(discipline).getByText('Suspensão Disciplinar')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Regimento Interno/ })).toHaveAttribute(
      'href',
      '/admin/documentos/regimento',
    );
    expect(screen.getByRole('link', { name: /Espelho de Ponto/ })).toHaveAttribute(
      'href',
      '/admin/relatorios',
    );
    expect(screen.getByRole('link', { name: /Documentos emitidos/ })).toHaveAttribute(
      'href',
      '/admin/documentos',
    );
  });

  it('filters documents with accent-insensitive search and hides empty sections', async () => {
    const user = userEvent.setup();
    renderHub();

    await user.type(
      await screen.findByRole('searchbox', { name: 'Buscar documento' }),
      'suspensao',
    );

    expect(screen.getByText('Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.queryByText('Regimento Interno')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Empresa e regras' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar documento' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar documento' }), 'xyz');
    expect(screen.getByText(/Nenhum documento encontrado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos os documentos' }));
    expect(screen.getByText('Regimento Interno')).toBeInTheDocument();
  });
});
