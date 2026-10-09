import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../../auth/auth-context.js';
import { useAuth } from '../../../auth/use-auth.js';
import { ToastProvider } from '../../../components/toast-context.js';
import { adminSession, createBridge, dailyFixture, jsonResponse } from '../../../test/fixtures.js';
import { AdminReportsPage } from './reports-page.js';

const DIEGO_ID = '8822e499-ac88-48e3-a555-c7a16b7295d1';
const ANA_ID = '8822e499-ac88-48e3-a555-c7a16b7295d2';

const company = {
  id: '10000000-0000-4000-8000-000000000001',
  legalName: 'PH MOTOPECAS E SERVICOS LTDA',
  tradeName: 'PH Motopeças',
  cnpj: '12.345.678/0001-90',
  stateRegistration: null,
  email: 'contato@phmotopecas.com.br',
  phone: '(88) 99999-0000',
  addressStreet: null,
  addressNumber: null,
  addressComplement: null,
  addressNeighborhood: null,
  addressCity: 'Fortaleza',
  addressState: 'CE',
  addressPostalCode: null,
  primaryContactName: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function managedUser(id: string, name: string, login: string) {
  return {
    id,
    name,
    login,
    role: 'EMPLOYEE',
    isActive: true,
    accessEnabled: true,
    hasAvatar: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function totals(overrides: Record<string, number> = {}) {
  return {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    finalizedDayCount: 1,
    completeDayCount: 1,
    incompleteDayCount: 0,
    provisionalDayCount: 0,
    expectedMinutes: 480,
    workedMinutes: 510,
    balanceMinutes: 30,
    overtimeMinutes: 30,
    missingMinutes: 0,
    knownPartialWorkedMinutes: 0,
    punchCount: 4,
    correctionCount: 0,
    statusCounts: {
      normal: 0,
      overtime: 1,
      missingHours: 0,
      incomplete: 0,
      holiday: 0,
      dayOff: 0,
      closed: 0,
      vacation: 0,
    },
    ...overrides,
  };
}

function reportRow(id: string, name: string, login: string, withDays: boolean, extra = {}) {
  return {
    employeeId: id,
    name,
    login,
    isActive: true,
    hasAvatar: false,
    cpf: '12345678900',
    hireDate: '2025-02-01',
    roleTitle: 'Mecânico de Motocicletas',
    department: 'Oficina',
    totals: totals(),
    days: withDays
      ? [dailyFixture({ businessDate: '2026-09-01', status: 'OVERTIME', isFinalized: true })]
      : null,
    ...extra,
  };
}

interface FetchOptions {
  failReport?: boolean;
}

function installFetch(options: FetchOptions = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/company')) return Promise.resolve(jsonResponse(company));
    if (url.includes('/employees?')) {
      return Promise.resolve(
        jsonResponse({
          items: [
            managedUser(DIEGO_ID, 'DIEGO PEREIRA DANTAS', 'diegodantas'),
            managedUser(ANA_ID, 'ANA SOUZA', 'ana.souza'),
          ],
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        }),
      );
    }
    if (url.includes('/attendance/reports/timesheets')) {
      if (options.failReport) {
        return Promise.resolve(
          jsonResponse(
            {
              status: 400,
              code: 'INVALID_DATE_RANGE',
              message: 'O período não pode terminar em uma data futura.',
              requestId: 'test-request',
              timestamp: '2026-10-09T15:00:00.000Z',
            },
            400,
          ),
        );
      }
      const params = new URL(url).searchParams;
      const employeeId = params.get('employeeId');
      const withDays = params.get('includeDays') === 'true';
      const rows = [
        reportRow(ANA_ID, 'ANA SOUZA', 'ana.souza', withDays, {
          totals: totals({ incompleteDayCount: 1, balanceMinutes: -60, missingMinutes: 60 }),
        }),
        reportRow(DIEGO_ID, 'DIEGO PEREIRA DANTAS', 'diegodantas', withDays),
      ].filter((row) => !employeeId || row.employeeId === employeeId);
      return Promise.resolve(
        jsonResponse({
          from: params.get('from'),
          to: params.get('to'),
          generatedAt: '2026-10-09T15:00:00.000Z',
          employees: rows,
          totals: totals({ expectedMinutes: 960, workedMinutes: 990, incompleteDayCount: 1 }),
        }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <div>Carregando sessão...</div>;
  return <>{children}</>;
}

function renderPage(path = '/admin/relatorios?mes=2026-09') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <MemoryRouter initialEntries={[path]}>
              <AdminReportsPage />
            </MemoryRouter>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T15:00:00.000Z'));
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: createBridge(adminSession),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens on the team summary for the selected month without requiring any choice', async () => {
    const calls = installFetch();
    renderPage();

    expect(await screen.findByText('Fechamento por colaborador')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026 a 30/09/2026 • 30 dias')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Resumo da equipe/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Sorted accent/case-insensitively by name.
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Ana Souza');
    expect(rows[2]).toHaveTextContent('Diego Pereira Dantas');
    expect(screen.getByText(/1 dia com batidas incompletas/)).toBeInTheDocument();
    expect(
      calls.some((url) =>
        url.includes('/attendance/reports/timesheets?from=2026-09-01&to=2026-09-30'),
      ),
    ).toBe(true);
  });

  it('filters the team table by search', async () => {
    installFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Fechamento por colaborador');

    await user.type(screen.getByRole('searchbox', { name: /Buscar colaborador/ }), 'diego');
    const table = screen.getByRole('table');
    expect(within(table).queryByText('Ana Souza')).not.toBeInTheDocument();
    expect(within(table).getByText('Diego Pereira Dantas')).toBeInTheDocument();
  });

  it('opens an individual timesheet from the team table and navigates between collaborators', async () => {
    installFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Fechamento por colaborador');

    await user.click(screen.getByRole('button', { name: 'Abrir espelho de Diego Pereira Dantas' }));

    const document = await screen.findByRole('article', {
      name: 'Espelho de ponto de Diego Pereira Dantas',
    });
    expect(within(document).getAllByText('PH MOTOPECAS E SERVICOS LTDA')).toHaveLength(2);
    expect(within(document).getByText('CNPJ 12.345.678/0001-90')).toBeInTheDocument();
    expect(within(document).getByText('123.456.789-00')).toBeInTheDocument();
    expect(within(document).getByText('Hora extra')).toBeInTheDocument();
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Colaborador anterior' }));
    expect(
      await screen.findByRole('article', { name: 'Espelho de ponto de Ana Souza' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colaborador anterior' })).toBeDisabled();
  });

  it('prints the selected timesheet through the browser print dialog', async () => {
    installFetch();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const user = userEvent.setup();
    renderPage(`/admin/relatorios?mes=2026-09&visao=individual&colaborador=${DIEGO_ID}`);

    await screen.findByRole('article', { name: 'Espelho de ponto de Diego Pereira Dantas' });
    await user.click(screen.getByRole('button', { name: 'Imprimir / Salvar PDF' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('blocks invalid custom periods with a clear message and disabled actions', async () => {
    const calls = installFetch();
    renderPage('/admin/relatorios?periodo=personalizado&de=2026-09-30&ate=2026-09-01');

    expect(
      await screen.findByText('A data inicial deve ser anterior ou igual à data final.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar planilha/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Imprimir espelhos/ })).toBeDisabled();
    expect(calls.some((url) => url.includes('/attendance/reports/timesheets'))).toBe(false);
  });

  it('never queries future months and does not allow moving past the current month', async () => {
    installFetch();
    renderPage('/admin/relatorios?mes=2027-01');

    expect(await screen.findByText(/01\/10\/2026 a 09\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Mês em andamento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
  });

  it('shows the API error with a retry action instead of a blank screen', async () => {
    installFetch({ failReport: true });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O período não pode terminar em uma data futura.',
    );
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });
});
