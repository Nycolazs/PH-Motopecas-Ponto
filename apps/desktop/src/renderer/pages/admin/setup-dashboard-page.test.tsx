import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { SetupDashboardPage } from './setup-dashboard-page.js';

function installBridge(session = adminSession): void {
  const bridge = createBridge(session);
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <div>Carregando sessão...</div>;
  return <>{children}</>;
}

function renderSetupDashboard(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <MemoryRouter>
            <SetupDashboardPage />
          </MemoryRouter>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('SetupDashboardPage (Início & Metas)', () => {
  const mockCompany = {
    id: '77777777-7777-4777-8777-777777777777',
    legalName: 'PH Moto Peças LTDA',
    tradeName: 'PH Motopeças',
    cnpj: '12345678000199',
    stateRegistration: '123456789',
    addressStreet: 'Av. Principal',
    addressNumber: '1000',
    addressComplement: null,
    addressNeighborhood: 'Centro',
    addressCity: 'São Paulo',
    addressState: 'SP',
    addressPostalCode: '01000-000',
    phone: '(11) 3333-4444',
    email: 'contato@phmotopecas.com.br',
    primaryContactName: 'Nycolas',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const mockOverview = {
    businessDate: '2026-10-01',
    totalActiveEmployees: 13,
    clockedInTodayCount: 12,
    currentlyWorkingCount: 11,
    incompleteCount: 0,
    notClockedInCount: 1,
    employees: [],
    recentPunches: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        employeeId: '22222222-2222-4222-8222-222222222222',
        employeeName: 'DIEGO PEREIRA DANTAS',
        occurredAt: '2026-10-01T11:00:00.000Z',
        effectiveOccurredAt: '2026-10-01T11:00:00.000Z',
        kind: 'CLOCK_IN',
        origin: 'EMPLOYEE',
        adjustmentSequence: 0,
      },
    ],
    recentAdjustments: [],
  };

  const mockJobRoles = [
    {
      id: '33333333-3333-4333-8333-333333333331',
      title: 'Atendente de Balcão e Peças',
      department: 'Comercial e Balcão',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: '33333333-3333-4333-8333-333333333332',
      title: 'Mecânico Geral de Motocicletas',
      department: 'Oficina Mecânica',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  const mockAckStatus = {
    totalActiveEmployees: 13,
    regulationAcknowledgedCount: 13,
    roleAcknowledgedCount: 13,
    isFullyCompliant: true,
  };

  const mockVacations = {
    items: [
      {
        id: '8b5d1ed2-1dff-4c13-8a61-14f7c4bc4ecf',
        employeeId: '8822e499-ac88-48e3-a555-c7a16b7295dd',
        employee: {
          id: '8822e499-ac88-48e3-a555-c7a16b7295dd',
          name: 'ÍTALO RENAN DA SILVA MARTINS',
          login: 'italo',
        },
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        daysCount: 30,
        note: null,
        createdById: 'b90d59fb-c14f-4b24-8888-936d74757f2b',
        createdBy: {
          id: 'b90d59fb-c14f-4b24-8888-936d74757f2b',
          name: 'Admin',
          login: 'admin',
        },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  };

  beforeEach(() => {
    installBridge();
  });

  it('renders business data, team metrics, executive goals and collaborator insights', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/company')) {
        return Promise.resolve(jsonResponse(mockCompany));
      }
      if (url.includes('/attendance/overview')) {
        return Promise.resolve(jsonResponse(mockOverview));
      }
      if (url.includes('/attendance/incompletes')) {
        return Promise.resolve(
          jsonResponse({
            month: '2026-10',
            totalIncompleteDays: 0,
            totalAffectedEmployees: 0,
            items: [],
          }),
        );
      }
      if (url.includes('/adjustment-requests/pending-count')) {
        return Promise.resolve(jsonResponse({ pendingCount: 0 }));
      }
      if (url.includes('/job-roles')) {
        return Promise.resolve(jsonResponse(mockJobRoles));
      }
      if (url.includes('/acknowledgments/status')) {
        return Promise.resolve(jsonResponse(mockAckStatus));
      }
      if (url.includes('/vacations')) {
        return Promise.resolve(jsonResponse(mockVacations));
      }
      if (url.includes('/performance/reviews')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSetupDashboard();

    // 1. Business header & greeting
    expect(await screen.findByText(/Bem-vindo ao painel do PH Motopeças/i)).toBeInTheDocument();
    expect(await screen.findByText(/12.345.678\/0001-99/i)).toBeInTheDocument();
    expect(screen.getByText(/Painel Executivo & Metas/i)).toBeInTheDocument();
    expect(screen.getByText(/Operação em Tempo Real/i)).toBeInTheDocument();

    // 2. Executive KPIs
    expect(await screen.findByText('Quadro de Equipe')).toBeInTheDocument();
    const countPills = await screen.findAllByText('13');
    expect(countPills.length).toBeGreaterThan(0);
    expect(screen.getByText('Presença Hoje')).toBeInTheDocument();
    const presencePills = await screen.findAllByText('92%');
    expect(presencePills.length).toBeGreaterThan(0);
    expect(screen.getByText('(12/13)')).toBeInTheDocument();
    expect(screen.getByText('Saúde Operacional')).toBeInTheDocument();
    expect(screen.getByText('Conformidade CLT')).toBeInTheDocument();

    // 3. Strategic Goals (Metas)
    expect(screen.getByText('Metas & Indicadores de Gestão')).toBeInTheDocument();
    expect(screen.getByText('Meta 1: Pontualidade & Assiduidade')).toBeInTheDocument();
    expect(screen.getByText('Meta 2: Regularidade de Registros')).toBeInTheDocument();
    expect(screen.getByText('Meta 3: Cobertura Documental CLT')).toBeInTheDocument();
    expect(screen.getByText('Meta 4: Desenvolvimento & Feedback')).toBeInTheDocument();

    // 4. Organizational Structure & Roles (The Business)
    expect(screen.getByText('Estrutura Organizacional & Cargos')).toBeInTheDocument();
    expect(screen.getByText('Comercial e Balcão')).toBeInTheDocument();
    expect(screen.getByText('• Atendente de Balcão e Peças')).toBeInTheDocument();
    expect(screen.getByText('Oficina Mecânica')).toBeInTheDocument();
    expect(screen.getByText('• Mecânico Geral de Motocicletas')).toBeInTheDocument();

    // 5. Vacations & Collaborator Planning (The Collaborators)
    expect(screen.getByText('Planejamento de Escalas & Férias')).toBeInTheDocument();
    expect(screen.getByText('Ítalo Renan da Silva Martins')).toBeInTheDocument();
    expect(screen.getByText(/01\/09\/2026 até 30\/09\/2026 \(30 dias\)/i)).toBeInTheDocument();

    // 6. Quick Management Actions
    expect(screen.getByText('Ações Rápidas de Gestão')).toBeInTheDocument();
    const operationalLinks = screen.getAllByText('Painel Operacional');
    expect(operationalLinks.length).toBeGreaterThan(0);
    expect(screen.getByText('Gerar Documento')).toBeInTheDocument();
    expect(screen.getByText('Ajustes de Ponto')).toBeInTheDocument();
    expect(screen.getByText('Relatórios & Espelho')).toBeInTheDocument();

    // 7. Recent Punches
    expect(screen.getByText('Últimos Registros da Equipe')).toBeInTheDocument();
    expect(screen.getByText('Diego Pereira Dantas')).toBeInTheDocument();
  });
});
