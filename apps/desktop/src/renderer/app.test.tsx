import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app.js';
import {
  adminSession,
  createBridge,
  dailyFixture,
  employeeSession,
  historyFixture,
  jsonResponse,
  monthlyFixture,
  overviewFixture,
  punchFixture,
} from './test/fixtures.js';

function installBridge(value = createBridge(null)): void {
  Object.defineProperty(window, 'phPonto', { configurable: true, value });
}

function authenticatedFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/attendance/today')) return Promise.resolve(jsonResponse(dailyFixture()));
    if (url.includes('/attendance/monthly')) return Promise.resolve(jsonResponse(monthlyFixture()));
    if (url.includes('/attendance/history')) return Promise.resolve(jsonResponse(historyFixture()));
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe('PH-Ponto employee application', () => {
  beforeEach(() => {
    window.location.hash = '#/';
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('validates login in pt-BR and authenticates through the secure bridge', async () => {
    const bridge = createBridge(null);
    bridge.auth.login = vi.fn().mockResolvedValue({
      session: employeeSession,
      persistence: 'ENCRYPTED',
    });
    installBridge(bridge);
    vi.stubGlobal('fetch', authenticatedFetch());
    const user = userEvent.setup();

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Bater Ponto' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um login com pelo menos 3 caracteres.')).toBeVisible();
    expect(screen.getByText('Informe sua senha.')).toBeVisible();

    await user.type(screen.getByLabelText('Login'), 'joao.silva');
    await user.type(screen.getByLabelText('Senha'), 'segredo');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Seu ponto de hoje' })).toBeVisible();
    expect(bridge.auth.login).toHaveBeenCalledWith({ login: 'joao.silva', password: 'segredo' });
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('routes ADMIN users to web admin panel and renders operation dashboard', async () => {
    Object.defineProperty(window, 'phPonto', { configurable: true, value: undefined });
    window.localStorage.setItem('ph_ponto_admin_web_refresh_token', 'admin-refresh-token');
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse({
            accessToken: adminSession.accessToken,
            accessTokenExpiresInSeconds: 900,
            refreshToken: 'new-admin-refresh-token',
            user: adminSession.user,
          }),
        );
      }
      if (url.includes('/attendance/overview')) {
        return Promise.resolve(jsonResponse(overviewFixture()));
      }
      if (url.includes('/adjustment-requests/pending-count')) {
        return Promise.resolve(jsonResponse({ pendingCount: 0 }));
      }
      if (url.includes('/employees')) {
        return Promise.resolve(
          jsonResponse({
            items: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
          }),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Painel Operacional' })).toBeVisible();
    expect(screen.getByText('Ana Admin')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Bater ponto' })).not.toBeInTheDocument();
  });

  it('registers a punch and shows only the authoritative server timestamp', async () => {
    installBridge(createBridge(employeeSession));
    const result = punchFixture();
    const headers: string[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/attendance/today')) return Promise.resolve(jsonResponse(dailyFixture()));
        if (url.includes('/attendance/monthly'))
          return Promise.resolve(jsonResponse(monthlyFixture()));
        if (url.includes('/time-punches')) {
          headers.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
          return Promise.resolve(jsonResponse(result, 201));
        }
        throw new Error(`Unexpected request: ${url}`);
      });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Bater ponto' }));

    expect(await screen.findByText('Ponto registrado com sucesso')).toBeVisible();
    expect(screen.getByText('Horário oficial: 08:03')).toBeVisible();
    expect(screen.getByText('Trabalhando')).toBeVisible();
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('reuses the same idempotency key after an unknown network outcome', async () => {
    installBridge(createBridge(employeeSession));
    const keys: string[] = [];
    let punchAttempts = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/attendance/today')) return Promise.resolve(jsonResponse(dailyFixture()));
        if (url.includes('/attendance/monthly'))
          return Promise.resolve(jsonResponse(monthlyFixture()));
        if (url.includes('/time-punches')) {
          keys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
          punchAttempts += 1;
          return punchAttempts === 1
            ? Promise.reject(new TypeError('network unavailable'))
            : Promise.resolve(jsonResponse(punchFixture(), 201));
        }
        throw new Error(`Unexpected request: ${url}`);
      });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Bater ponto' }));
    expect(await screen.findByText('O ponto não foi confirmado.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível registrar o ponto porque o servidor está indisponível.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ponto registrado com sucesso')).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows owned history and validates a future custom period', async () => {
    installBridge(createBridge(employeeSession));
    vi.stubGlobal('fetch', authenticatedFetch());
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByRole('link', { name: 'Histórico' }));
    expect(await screen.findByRole('heading', { name: 'Histórico de pontos' })).toBeVisible();
    expect(screen.getByRole('cell', { name: /14 de ago/i })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Período personalizado' }));
    const form = screen.getByRole('button', { name: 'Aplicar período' }).closest('form');
    expect(form).not.toBeNull();
    const scoped = within(form!);
    await user.clear(scoped.getByLabelText('Data inicial'));
    await user.type(scoped.getByLabelText('Data inicial'), '2026-08-14');
    await user.clear(scoped.getByLabelText('Data final'));
    await user.type(scoped.getByLabelText('Data final'), '2026-08-13');
    await user.click(scoped.getByRole('button', { name: 'Aplicar período' }));
    expect(
      await screen.findByText('A data final deve ser igual ou posterior à inicial.'),
    ).toBeVisible();
  });

  it('rotates the secure session once after an API 401', async () => {
    const bridge = createBridge(employeeSession);
    bridge.auth.refresh = vi.fn().mockResolvedValue({
      session: { ...employeeSession, accessToken: 'rotated-access-token' },
      persistence: 'ENCRYPTED',
    });
    installBridge(bridge);
    let todayCalls = 0;
    const authorizations: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        authorizations.push(new Headers(init?.headers).get('Authorization') ?? '');
        if (url.includes('/attendance/today')) {
          todayCalls += 1;
          if (todayCalls === 1) return Promise.resolve(jsonResponse({}, 401));
          return Promise.resolve(jsonResponse(dailyFixture()));
        }
        if (url.includes('/attendance/monthly'))
          return Promise.resolve(jsonResponse(monthlyFixture()));
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Seu ponto de hoje' })).toBeVisible();
    expect(bridge.auth.refresh).toHaveBeenCalledTimes(1);
    expect(authorizations).toContain('Bearer employee-access-token');
    expect(authorizations).toContain('Bearer rotated-access-token');
  });

  it('returns to login screen when rotation fails', async () => {
    const bridge = createBridge(employeeSession);
    bridge.auth.refresh = vi.fn().mockRejectedValue(new Error('AUTHENTICATION_REQUIRED'));
    installBridge(bridge);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/attendance/today')) return Promise.resolve(jsonResponse({}, 401));
        if (url.includes('/attendance/monthly')) {
          return Promise.resolve(jsonResponse(monthlyFixture()));
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Bater Ponto' })).toBeVisible();
  });

  it('keeps the local session and shows unavailable API state when refresh cannot reach the server', async () => {
    const bridge = createBridge(employeeSession);
    bridge.auth.refresh = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('O servidor está indisponível.'), { code: 'API_UNAVAILABLE' }),
      );
    installBridge(bridge);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/attendance/today')) return Promise.resolve(jsonResponse({}, 401));
        if (url.includes('/attendance/monthly')) {
          return Promise.resolve(jsonResponse(monthlyFixture()));
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar os dados' }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Bater Ponto' })).not.toBeInTheDocument();
  });

  it('shows a forbidden state without exposing employee data', async () => {
    installBridge(createBridge(employeeSession));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/attendance/today')) {
          return Promise.resolve(
            jsonResponse(
              {
                status: 403,
                code: 'FORBIDDEN',
                message: 'Você não tem permissão para esta ação.',
                requestId: 'request-1',
                timestamp: '2026-08-14T12:00:00.000Z',
              },
              403,
            ),
          );
        }
        if (url.includes('/attendance/monthly')) {
          return Promise.resolve(jsonResponse(monthlyFixture()));
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Bater ponto' })).not.toBeInTheDocument();
  });

  it('clears local state when remote logout revocation is unconfirmed', async () => {
    const bridge = createBridge(employeeSession);
    bridge.auth.logout = vi.fn().mockResolvedValue({
      session: null,
      persistence: 'ENCRYPTED',
      remoteRevocation: 'UNCONFIRMED',
    });
    installBridge(bridge);
    vi.stubGlobal('fetch', authenticatedFetch());
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Sair do PH-Ponto' }));

    expect(await screen.findByRole('heading', { name: 'Bater Ponto' })).toBeVisible();
  });

  it('switches light and dark themes with an accessible control', async () => {
    installBridge(createBridge(null));
    const user = userEvent.setup();
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Ativar modo escuro' });
    await user.click(button);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
  });
});
