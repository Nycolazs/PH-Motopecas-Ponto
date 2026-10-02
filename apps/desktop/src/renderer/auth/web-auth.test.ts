import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebAuthBridge } from './web-auth.js';

const STORAGE_KEY = 'ph_ponto_admin_web_refresh_token';

function fakeAuthResponse(
  accessToken = 'access-token-123',
  refreshToken = 'refresh-token-rotated-456',
  role: 'ADMIN' | 'EMPLOYEE' = 'ADMIN',
) {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresInSeconds: 300,
    user: {
      id: 'admin-uuid-1',
      name: 'Administrador Teste',
      login: 'admin',
      role,
    },
  };
}

describe('WebAuthBridge', () => {
  let bridge: WebAuthBridge;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    bridge = new WebAuthBridge();
  });

  it('uses one single-flight request for concurrent refresh calls', async () => {
    localStorage.setItem(STORAGE_KEY, 'refresh-token-original');

    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchSpy);

    const first = bridge.refresh();
    const second = bridge.refresh();

    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify(fakeAuthResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.session?.accessToken).toBe('access-token-123');
    expect(secondResult.session?.accessToken).toBe('access-token-123');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('refresh-token-rotated-456');
  });

  it('reuses in-flight refresh when restore is called concurrently (e.g. StrictMode)', async () => {
    localStorage.setItem(STORAGE_KEY, 'refresh-token-initial');

    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchSpy);

    const first = bridge.restore();
    const second = bridge.restore();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify(fakeAuthResponse('access-token-strict', 'refresh-token-strict')),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.session?.accessToken).toBe('access-token-strict');
    expect(secondResult.session?.accessToken).toBe('access-token-strict');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('refresh-token-strict');
  });

  it('preserves stored token on network error during restore', async () => {
    localStorage.setItem(STORAGE_KEY, 'refresh-token-saved');

    const networkError = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    await expect(bridge.restore()).rejects.toThrow('Failed to fetch');

    // Token must NOT be deleted on network or server offline failure
    expect(localStorage.getItem(STORAGE_KEY)).toBe('refresh-token-saved');
  });

  it('clears stored token and returns null session on 401 Unauthorized during restore', async () => {
    localStorage.setItem(STORAGE_KEY, 'refresh-token-expired');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'INVALID_CREDENTIALS',
            message: 'Sessão expirada ou inválida.',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const result = await bridge.restore();

    expect(result.session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists token to localStorage on admin login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(fakeAuthResponse('admin-token', 'admin-refresh')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const state = await bridge.login({ login: 'admin', password: 'secret-password' });

    expect(state.session?.accessToken).toBe('admin-token');
    expect(state.session?.user.role).toBe('ADMIN');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('admin-refresh');
  });

  it('clears stored token and calls remote logout', async () => {
    localStorage.setItem(STORAGE_KEY, 'token-to-logout');

    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await bridge.logout();

    expect(result.session).toBeNull();
    expect(result.remoteRevocation).toBe('CONFIRMED');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'token-to-logout' }),
      }),
    );
  });
});
