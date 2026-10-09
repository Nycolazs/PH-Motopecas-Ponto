import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/auth-context.js';
import { useAuth } from '../../auth/use-auth.js';
import { ToastProvider } from '../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../test/fixtures.js';
import { AdminNotificationsPage, formatWhatsapp } from './notifications-page.js';

const ADMIN_ID = '6959a6b9-8d98-48db-be01-8a1d7b8ab75f';

function settings(state: string, overrides: Record<string, unknown> = {}) {
  return {
    whatsapp: { state, phone: state === 'CONNECTED' ? '5585988887777' : null, connectedAt: null },
    lateArrival: { enabled: true, toleranceMinutes: 5 },
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

  it('blocks invalid tolerance values', async () => {
    installFetch('CONNECTED');
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText('Tolerância (minutos)');
    await user.clear(input);
    await user.type(input, '500');
    expect(screen.getByRole('alert')).toHaveTextContent('entre 0 e 120');
    expect(screen.getByRole('button', { name: 'Salvar regra' })).toBeDisabled();
  });

  it('formats stored numbers for display', () => {
    expect(formatWhatsapp('5585999990000')).toBe('(85) 99999-0000');
    expect(formatWhatsapp('14155550000')).toBe('+14155550000');
  });
});
