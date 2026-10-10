import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import {
  AdminNotificationsPage,
  formatWhatsapp,
  isCompleteWhatsapp,
  maskWhatsappInput,
} from './notifications-page.js';

const ADMIN_ID = '6959a6b9-8d98-48db-be01-8a1d7b8ab75f';

function settings(state: string, overrides: Record<string, unknown> = {}) {
  return {
    whatsapp: { state, phone: state === 'CONNECTED' ? '5585988887777' : null, connectedAt: null },
    lateArrival: {
      enabled: true,
      toleranceMinutes: 10,
      source: 'REGULATION',
      regulationVersion: 3,
    },
    recipients: [
      {
        userId: ADMIN_ID,
        name: 'ANA LUCIA',
        login: 'ana',
        whatsappPhone: null,
        lateArrivalAlerts: false,
      },
    ],
    ...overrides,
  };
}

function installFetch(state: string) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        ...(init?.body ? { body: String(init.body) } : {}),
      });
      if (url.endsWith('/notifications/settings'))
        return Promise.resolve(jsonResponse(settings(state)));
      if (url.endsWith('/notifications/whatsapp/qr')) {
        return Promise.resolve(
          jsonResponse({
            qrCode: 'data:image/png;base64,iVBORw0KGgo=',
            status: { state: 'WAITING_QR', phone: null, connectedAt: null },
          }),
        );
      }
      if (url.endsWith('/notifications/outbox')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/notifications/recipients/')) {
        return Promise.resolve(
          jsonResponse({
            userId: ADMIN_ID,
            name: 'ANA LUCIA',
            login: 'ana',
            whatsappPhone: '5585999990000',
            lateArrivalAlerts: true,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    }),
  );
  return calls;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : <div>Carregando sessão...</div>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <MemoryRouter>
              <AdminNotificationsPage />
            </MemoryRouter>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminNotificationsPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: createBridge(adminSession),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('explains when the WhatsApp service is not installed on the server', async () => {
    installFetch('NOT_CONFIGURED');
    renderPage();
    expect(await screen.findByText('Não configurado no servidor')).toBeInTheDocument();
    expect(screen.getByText(/ainda não foi instalado no servidor/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conectar WhatsApp/ })).not.toBeInTheDocument();
  });

  it('shows the QR code and pairing steps while waiting for the phone', async () => {
    installFetch('WAITING_QR');
    renderPage();
    expect(await screen.findByAltText('QR Code para conectar o WhatsApp')).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(screen.getByText(/Aparelhos conectados/)).toBeInTheDocument();
  });

  it('saves an administrator WhatsApp and enables late-arrival alerts', async () => {
    const calls = installFetch('CONNECTED');
    const user = userEvent.setup();
    renderPage();

    const row = (await screen.findByRole('textbox', { name: 'WhatsApp de Ana Lucia' })).closest(
      'li',
    )!;
    expect(screen.getByText(/Enviando pelo número/)).toHaveTextContent('(85) 98888-7777');
    await user.type(within(row).getByRole('textbox'), '(85) 99999-0000');
    await user.click(within(row).getByRole('checkbox', { name: /Recebe alertas/ }));
    await user.click(within(row).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')).toMatchObject({
        url: expect.stringContaining(`/notifications/recipients/${ADMIN_ID}`),
        body: JSON.stringify({ whatsappPhone: '(85) 99999-0000', lateArrivalAlerts: true }),
      }),
    );
  });

  it('uses the tolerance registered in the Regimento Interno', async () => {
    const calls = installFetch('CONNECTED');
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('10 minutos')).toBeInTheDocument();
    expect(screen.getByText(/Definida no Regimento Interno \(versão 3\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alterar no Regimento' })).toHaveAttribute(
      'href',
      '/admin/documentos/regimento',
    );
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/mais de 10 min depois do horário de abertura/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Enviar alerta de atraso' }));
    await user.click(screen.getByRole('button', { name: 'Salvar regra' }));
    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/notifications/late-arrival'))).toMatchObject({
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      }),
    );
  });

  it('masks the WhatsApp number while typing and rejects letters', async () => {
    installFetch('CONNECTED');
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByRole('textbox', { name: 'WhatsApp de Ana Lucia' });
    await user.type(input, '34324234asd');
    expect(input).toHaveValue('(34) 3242-34');
    expect(screen.getByRole('alert')).toHaveTextContent('Número incompleto');
    const row = input.closest('li')!;
    expect(within(row).getByRole('button', { name: 'Salvar' })).toBeDisabled();

    await user.type(input, '567');
    expect(input).toHaveValue('(34) 32423-4567');
    expect(within(row).getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('applies the Brazilian phone mask', () => {
    expect(maskWhatsappInput('85999990000')).toBe('(85) 99999-0000');
    expect(maskWhatsappInput('8532221111')).toBe('(85) 3222-1111');
    expect(maskWhatsappInput('+55 (85) 99999-0000')).toBe('+5585999990000');
    expect(maskWhatsappInput('5585999990000')).toBe('(85) 99999-0000');
    expect(maskWhatsappInput('abc')).toBe('');
    expect(maskWhatsappInput('8')).toBe('(8');
    expect(isCompleteWhatsapp('(85) 99999-0000')).toBe(true);
    expect(isCompleteWhatsapp('(85) 9999')).toBe(false);
  });

  it('formats stored numbers for display', () => {
    expect(formatWhatsapp('5585999990000')).toBe('(85) 99999-0000');
    expect(formatWhatsapp('14155550000')).toBe('+14155550000');
  });
});
