import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { AcknowledgmentDocumentPage } from './acknowledgment-document-page.js';

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

describe('AcknowledgmentDocumentPage', () => {
  beforeEach(() => {
    installBridge();
  });

  it('renders compliance banner, mode buttons and employee selector', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/acknowledgments/status')) {
        return Promise.resolve(
          jsonResponse({
            totalActiveEmployees: 5,
            regulationAcknowledgedCount: 3,
            roleAcknowledgedCount: 2,
            isFullyCompliant: false,
          }),
        );
      }
      if (url.includes('/admins')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'João da Silva',
                login: 'joao.silva',
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
      if (url.includes('/regulations')) {
        return Promise.resolve(
          jsonResponse({
            id: '22222222-2222-4222-8222-222222222222',
            companyId: '33333333-3333-4333-8333-333333333333',
            currentVersion: {
              id: '44444444-4444-4444-8444-444444444444',
              companyRegulationId: '22222222-2222-4222-8222-222222222222',
              versionNumber: 1,
              title: 'Regimento Interno 2026',
              effectiveDate: '2026-09-25',
              content: {
                title: 'Regimento Interno de Trabalho',
                effectiveDate: '2026-09-25',
                companyInfo: {
                  tradeName: 'PH Motopeças',
                  legalName: 'PH MOTOPECAS LTDA',
                  cnpj: '00.000.000/0001-00',
                  presentation: 'Apresentação da PH Motopeças detalhada para o regimento.',
                  principles: ['Ética', 'Compromisso'],
                },
                workSchedule: {
                  weeklyHours: '44 horas',
                  lunchDurationMinutes: 60,
                  toleranceMinutes: 5,
                  overtimePolicy: 'Horas extras pré-aprovadas.',
                  punchRules: 'Registro obrigatório no início e término.',
                },
                conductEthics: {
                  dressCode: 'Uniforme completo e limpo.',
                  customerServiceEthics: 'Atendimento cortês.',
                  confidentiality: 'Sigilo total sobre dados e clientes.',
                  prohibitions: ['Uso indevido de equipamentos'],
                },
                technologyPolicy: {
                  internetUsage: 'Uso estritamente profissional.',
                  personalDevicePolicy: 'Celular apenas em intervalos.',
                  companyEquipmentCare: 'Zelo pelas ferramentas e computadores.',
                  communicationTools: 'Comunicação oficial interna.',
                },
                disciplineRules: {
                  warningVerbalRules: 'Advertência verbal em falha leve.',
                  warningWrittenRules: 'Advertência escrita em reincidência.',
                  suspensionRules: 'Suspensão de 1 a 3 dias.',
                  terminationRules: 'Demissão por justa causa conforme CLT art. 482.',
                },
                additionalClauses: [],
              },
              publishedAt: '2026-09-25T12:00:00.000Z',
              createdById: '55555555-5555-4555-8555-555555555555',
              createdAt: '2026-09-25T12:00:00.000Z',
            },
            versions: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      if (url.includes('/acknowledgments')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '66666666-6666-4666-8666-666666666666',
                employeeId: '11111111-1111-4111-8111-111111111111',
                employeeName: 'João da Silva',
                acknowledgmentType: 'REGULATION',
                generatedDocumentId: '77777777-7777-4777-8777-777777777777',
                acknowledgedAt: '2026-09-25T12:00:00.000Z',
                createdById: '55555555-5555-4555-8555-555555555555',
                createdAt: '2026-09-25T12:00:00.000Z',
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<AcknowledgmentDocumentPage />);

    expect(
      await screen.findByRole('heading', { name: /Termos de Ciência de Documentos/i }),
    ).toBeVisible();
    expect(await screen.findByText('Colaboradores Ativos')).toBeVisible();
    expect(screen.getByText('3 de 5')).toBeVisible();
    expect(screen.getByText('Termo de Ciência do Regimento Interno')).toBeVisible();
    expect(screen.getByText('Termo de Ciência da Descrição de Cargo')).toBeVisible();
    expect(await screen.findByText('João da Silva (joao.silva)')).toBeVisible();
  });

  it('switches between regimento and cargo modes', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/acknowledgments/status')) {
        return Promise.resolve(
          jsonResponse({
            totalActiveEmployees: 1,
            regulationAcknowledgedCount: 1,
            roleAcknowledgedCount: 1,
            isFullyCompliant: true,
          }),
        );
      }
      if (url.includes('/admins')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'João da Silva',
                login: 'joao.silva',
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
      if (url.includes('/regulations')) {
        return Promise.resolve(
          jsonResponse({
            id: '22222222-2222-4222-8222-222222222222',
            companyId: '33333333-3333-4333-8333-333333333333',
            currentVersion: null,
            versions: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      if (url.includes('/acknowledgments')) {
        return Promise.resolve(jsonResponse({ items: [], total: 0, limit: 50, offset: 0 }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<AcknowledgmentDocumentPage />);

    const roleModeBtn = await screen.findByText('Termo de Ciência da Descrição de Cargo');
    await user.click(roleModeBtn);

    expect(await screen.findByText('Cargo Principal Atribuído')).toBeVisible();
  });
});
