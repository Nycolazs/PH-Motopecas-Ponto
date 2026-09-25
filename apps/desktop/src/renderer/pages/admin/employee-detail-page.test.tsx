import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { AdminEmployeeDetailPage } from './employee-detail-page.js';

function installBridge(session = adminSession): void {
  const bridge = createBridge(session);
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <div>Carregando sessão...</div>;
  return <>{children}</>;
}

function renderDetailPage(
  employeeId = '11111111-1111-4111-8111-111111111111',
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/admin/funcionarios/${employeeId}`]}>
              <Routes>
                <Route path="/admin/funcionarios/:id" element={<AdminEmployeeDetailPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AdminEmployeeDetailPage', () => {
  const mockEmployeeId = '11111111-1111-4111-8111-111111111111';

  const mockEmployee = {
    id: mockEmployeeId,
    name: 'Carlos da Silva',
    login: 'carlos.silva',
    role: 'EMPLOYEE',
    isActive: true,
    accessEnabled: true,
    hasAvatar: false,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  };

  const mockProfile = {
    userId: mockEmployeeId,
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    birthDate: '1990-05-15',
    phone: '(11) 98765-4321',
    personalEmail: 'carlos@exemplo.com',
    hireDate: '2026-01-10',
    addressStreet: 'Rua das Motos',
    addressNumber: '42',
    addressComplement: null,
    addressNeighborhood: 'Oficinas',
    addressCity: 'São Paulo',
    addressState: 'SP',
    addressPostalCode: '01001-000',
    notes: 'Mecânico especialista em motores.',
    accessEnabled: true,
    roleAssignment: {
      id: '22222222-2222-4222-8222-222222222222',
      employeeId: mockEmployeeId,
      jobRoleId: '33333333-3333-4333-8333-333333333333',
      jobRoleVersionId: '44444444-4444-4444-8444-444444444444',
      roleTitle: 'Mecânico Chefe',
      versionNumber: 1,
      startDate: '2026-01-10',
      endDate: null,
      isPrincipal: true,
      notes: 'Responsável pela oficina principal.',
      createdAt: '2026-01-10T08:00:00.000Z',
    },
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  };

  const mockTimeline = {
    items: [
      {
        id: 'evt-1',
        category: 'EMPLOYMENT',
        title: 'Admissão Formal',
        description: 'Contratação para início imediato na oficina.',
        occurredAt: '2026-01-10T08:00:00.000Z',
        businessDate: '2026-01-10',
        actorName: 'Administrador Chefe',
        metadata: null,
      },
      {
        id: 'doc-1',
        category: 'DOCUMENT',
        title: 'Ciência do Regimento Interno',
        description: 'Documento emitido: ACKNOWLEDGMENT_REGULATION',
        occurredAt: '2026-01-11T09:00:00.000Z',
        businessDate: '2026-01-11',
        actorName: 'Administrador Chefe',
        documentId: '55555555-5555-4555-8555-555555555555',
        documentType: 'ACKNOWLEDGMENT_REGULATION',
        metadata: { artifactId: '66666666-6666-4666-8666-666666666666' },
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
  };

  const mockDocuments = {
    items: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        documentType: 'ACKNOWLEDGMENT_REGULATION',
        title: 'Termo de Ciência do Regimento Interno',
        companyId: '77777777-7777-4777-8777-777777777777',
        employeeId: mockEmployeeId,
        employeeName: 'Carlos da Silva',
        authorId: '88888888-8888-4888-8888-888888888888',
        authorName: 'Administrador Chefe',
        artifactId: '66666666-6666-4666-8666-666666666666',
        fileSize: 1024,
        version: 1,
        supersededById: null,
        isVoid: false,
        voidReason: null,
        voidedAt: null,
        createdAt: '2026-01-11T09:00:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    },
  };

  const mockMonthly = {
    month: '2026-01',
    totals: {
      workedMinutes: 960,
      expectedMinutes: 960,
      balanceMinutes: 0,
    },
    days: [],
  };

  beforeEach(() => {
    installBridge();
  });

  it('renders employee profile overview with name, role and contact info in Resumo tab', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/employees/${mockEmployeeId}/profile`)) {
        return Promise.resolve(jsonResponse(mockProfile));
      }
      if (url.includes(`/employees/${mockEmployeeId}`)) {
        return Promise.resolve(jsonResponse(mockEmployee));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDetailPage(mockEmployeeId);

    expect(await screen.findByText('Carlos da Silva')).toBeInTheDocument();
    expect(screen.getByText('Login: carlos.silva')).toBeInTheDocument();
    expect(screen.getByText('Acesso Ativo')).toBeInTheDocument();
    expect(screen.getByText('Mecânico Chefe (v1)')).toBeInTheDocument();
    expect(screen.getByText('123.456.789-00')).toBeInTheDocument();
    expect(screen.getByText('carlos@exemplo.com')).toBeInTheDocument();
    expect(
      screen.getByText('Rua das Motos, 42 - Oficinas, São Paulo/SP (CEP: 01001-000)'),
    ).toBeInTheDocument();
  });

  it('switches between tabs: Histórico, Documentos, Avaliações, Ponto and Acesso', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/employees/${mockEmployeeId}/profile`)) {
        return Promise.resolve(jsonResponse(mockProfile));
      }
      if (url.includes(`/employees/${mockEmployeeId}/timeline`)) {
        return Promise.resolve(jsonResponse(mockTimeline));
      }
      if (url.includes(`/documents?`)) {
        return Promise.resolve(jsonResponse(mockDocuments));
      }
      if (url.includes('/attendance/admin/employees/')) {
        return Promise.resolve(jsonResponse(mockMonthly));
      }
      if (url.includes(`/employees/${mockEmployeeId}`)) {
        return Promise.resolve(jsonResponse(mockEmployee));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDetailPage(mockEmployeeId);
    expect(await screen.findByText('Carlos da Silva')).toBeInTheDocument();

    const user = userEvent.setup();
    const tabsNav = screen.getByLabelText('Abas de Perfil');

    // 1. Click Histórico tab
    const historicoTab = within(tabsNav).getByRole('button', { name: /histórico/i });
    await user.click(historicoTab);
    expect(await screen.findByText('Admissão Formal')).toBeInTheDocument();
    expect(screen.getByText('Ciência do Regimento Interno')).toBeInTheDocument();

    // 2. Click Documentos tab
    const documentosTab = within(tabsNav).getByRole('button', { name: /documentos/i });
    await user.click(documentosTab);
    expect(await screen.findByText('Termo de Ciência do Regimento Interno')).toBeInTheDocument();

    // 3. Click Avaliações tab
    const avaliacoesTab = within(tabsNav).getByRole('button', { name: /avaliações/i });
    await user.click(avaliacoesTab);
    expect(await screen.findByText(/avaliações de desempenho e competências/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. pontualidade e assiduidade/i)).toBeInTheDocument();

    // 4. Click Acesso ao App tab
    const acessoTab = within(tabsNav).getByRole('button', { name: /acesso ao app/i });
    await user.click(acessoTab);
    expect(await screen.findByText('Controle de Acesso ao Sistema')).toBeInTheDocument();
    expect(screen.getByText('Acesso Liberado para Login')).toBeInTheDocument();
    expect(screen.getByText('Desativar Acesso')).toBeInTheDocument();
    expect(screen.getByText('Encerrar Todas as Sessões')).toBeInTheDocument();

    // 5. Click Ponto & Frequência tab
    const pontoTab = within(tabsNav).getByRole('button', { name: /ponto & frequência/i });
    await user.click(pontoTab);
    expect(await screen.findByText('Mês de Referência:')).toBeInTheDocument();
  });

  it('opens termination modal when Desligar Colaborador button is clicked', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/employees/${mockEmployeeId}/profile`)) {
        return Promise.resolve(jsonResponse(mockProfile));
      }
      if (url.includes(`/employees/${mockEmployeeId}`)) {
        return Promise.resolve(jsonResponse(mockEmployee));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDetailPage(mockEmployeeId);
    expect(await screen.findByText('Carlos da Silva')).toBeInTheDocument();

    const user = userEvent.setup();
    const terminateBtn = screen.getByRole('button', { name: /desligar colaborador/i });
    await user.click(terminateBtn);

    expect(await screen.findByText(/registrar desligamento de colaborador/i)).toBeInTheDocument();
    expect(screen.getByText(/demissão sem justa causa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar desligamento/i })).toBeInTheDocument();
  });
});
