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

describe('SetupDashboardPage', () => {
  const mockCompany = {
    id: '77777777-7777-4777-8777-777777777777',
    legalName: 'PH Moto Peças LTDA',
    tradeName: 'PH Motopeças',
    cnpj: '12.345.678/0001-99',
    stateRegistration: '123456789',
    municipalRegistration: '987654321',
    addressStreet: 'Av. Principal',
    addressNumber: '1000',
    addressNeighborhood: 'Centro',
    addressCity: 'São Paulo',
    addressState: 'SP',
    addressPostalCode: '01000-000',
    phone: '(11) 3333-4444',
    email: 'contato@phmotopecas.com.br',
    website: 'https://phmotopecas.com.br',
  };

  const mockSetupStatus = {
    completionPercentage: 83,
    items: [
      {
        id: 'company',
        label: 'Dados da Empresa',
        description: 'Informações cadastrais e endereço da empresa',
        isCompleted: true,
        actionUrl: '/admin/empresa',
      },
      {
        id: 'culture',
        label: 'Quadro de Cultura',
        description: 'Missão, visão, valores e princípios da empresa',
        isCompleted: true,
        actionUrl: '/admin/documentos/cultura',
      },
      {
        id: 'regulations',
        label: 'Regimento Interno',
        description: 'Regras de convivência, jornada e deveres',
        isCompleted: true,
        actionUrl: '/admin/documentos/regimento',
      },
      {
        id: 'job_roles',
        label: 'Cargos e Funções',
        description: 'Estrutura formal de cargos cadastrada',
        isCompleted: true,
        actionUrl: '/admin/cargos',
      },
      {
        id: 'employees',
        label: 'Colaboradores Ativos',
        description: 'Ao menos um colaborador cadastrado na equipe',
        isCompleted: true,
        actionUrl: '/admin/funcionarios',
      },
      {
        id: 'role_assignments',
        label: 'Atribuições e Termos',
        description: 'Todos os colaboradores com cargo e termo assinado',
        isCompleted: false,
        actionUrl: '/admin/funcionarios',
      },
    ],
  };

  beforeEach(() => {
    installBridge();
  });

  it('renders greeting, company title, progress and quick links including Gerar Documento', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/company/setup-status')) {
        return Promise.resolve(jsonResponse(mockSetupStatus));
      }
      if (url.includes('/company')) {
        return Promise.resolve(jsonResponse(mockCompany));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSetupDashboard();

    expect(await screen.findByText(/Bem-vindo ao painel do PH Motopeças/i)).toBeInTheDocument();
    expect(await screen.findByText('83%')).toBeInTheDocument();
    expect(screen.getByText('Progresso de Implantação')).toBeInTheDocument();
    expect(screen.getByText('5 de 6 requisitos concluídos')).toBeInTheDocument();

    // Verify quick links
    expect(screen.getByText('Gerar Documento')).toBeInTheDocument();
    expect(screen.getByText('Modelos rápidos de RH e disciplina')).toBeInTheDocument();
    expect(screen.getAllByText('Dados da Empresa')).toHaveLength(2);
    expect(screen.getAllByText('Cargos e Funções')).toHaveLength(2);
    expect(screen.getByText('Controle de Ponto')).toBeInTheDocument();

    // Verify checklist items
    expect(screen.getByText('Quadro de Cultura')).toBeInTheDocument();
    expect(screen.getByText('Regimento Interno')).toBeInTheDocument();
    expect(screen.getByText('Atribuições e Termos')).toBeInTheDocument();
  });
});
