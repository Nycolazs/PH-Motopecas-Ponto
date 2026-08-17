// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { AuthApiClient } from './auth-api-client.js';
import { AuthContractError, type ApiAuthResponse } from './auth-contract.js';
import { DesktopAuthSessionService } from './auth-session.service.js';
import type { RefreshTokenVault } from './refresh-token-vault.js';

const originalRefreshToken =
  '487d962c-c34d-486b-83be-c1aac9772f9d.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
const rotatedRefreshToken =
  '23144362-e369-49e4-9241-1920b05e32f7.ZYXWVUTSRQPONMLKJIHGFEDCBAabcdefghijklmnopq';

function apiResponse(
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresInSeconds = 300,
): ApiAuthResponse {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresInSeconds,
    user: {
      id: 'ad49c9bd-9bde-4c4c-bcec-bf209a3d8507',
      name: 'Ana Souza',
      login: 'ana.souza',
      role: 'EMPLOYEE',
    },
  };
}

function createHarness(initialToken: string | undefined = originalRefreshToken) {
  let storedToken: string | undefined = initialToken;
  const apiShape = {
    login: vi.fn().mockResolvedValue(apiResponse('access-login', originalRefreshToken)),
    refresh: vi.fn().mockResolvedValue(apiResponse('access-rotated', rotatedRefreshToken)),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const vaultShape = {
    persistence: vi.fn().mockReturnValue('ENCRYPTED' as const),
    store: vi.fn(async (token: string) => {
      storedToken = token;
      return 'ENCRYPTED' as const;
    }),
    load: vi.fn(async () => storedToken),
    clear: vi.fn(async () => {
      storedToken = undefined;
    }),
  };
  let clock = new Date('2026-08-14T12:00:00.000Z');
  const service = new DesktopAuthSessionService(
    apiShape as unknown as AuthApiClient,
    vaultShape as unknown as RefreshTokenVault,
    () => new Date(clock),
  );

  return {
    service,
    apiShape,
    vaultShape,
    setClock: (value: string) => {
      clock = new Date(value);
    },
  };
}

describe('DesktopAuthSessionService', () => {
  it('never exposes the refresh credential in the renderer session state', async () => {
    const harness = createHarness(undefined);

    const state = await harness.service.login({ login: 'ana.souza', password: 'segredo' });

    expect(state).toEqual({
      persistence: 'ENCRYPTED',
      session: {
        accessToken: 'access-login',
        accessTokenExpiresAt: '2026-08-14T12:05:00.000Z',
        user: expect.objectContaining({ login: 'ana.souza', role: 'EMPLOYEE' }),
      },
    });
    expect(JSON.stringify(state)).not.toContain(originalRefreshToken);
    expect(harness.vaultShape.store).toHaveBeenCalledWith(originalRefreshToken);
  });

  it('uses one single-flight rotation for concurrent refresh calls', async () => {
    const harness = createHarness();
    let resolveRefresh!: (response: ApiAuthResponse) => void;
    harness.apiShape.refresh.mockImplementationOnce(
      () =>
        new Promise<ApiAuthResponse>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const first = harness.service.refresh();
    const second = harness.service.refresh();

    expect(first).toBe(second);
    await vi.waitFor(() => expect(harness.apiShape.refresh).toHaveBeenCalledOnce());
    resolveRefresh(apiResponse('access-rotated', rotatedRefreshToken));
    const [firstState, secondState] = await Promise.all([first, second]);

    expect(firstState).toEqual(secondState);
    expect(harness.apiShape.refresh).toHaveBeenCalledWith(originalRefreshToken);
    expect(harness.vaultShape.store).toHaveBeenCalledOnce();
    expect(harness.vaultShape.store).toHaveBeenCalledWith(rotatedRefreshToken);
  });

  it('clears local state after a rejected refresh replay', async () => {
    const harness = createHarness();
    harness.apiShape.refresh.mockRejectedValueOnce(
      new AuthContractError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sua sessão não é válida. Entre novamente.',
        status: 401,
      }),
    );

    await expect(harness.service.refresh()).rejects.toMatchObject({
      safe: { code: 'AUTHENTICATION_REQUIRED' },
    });
    expect(harness.vaultShape.clear).toHaveBeenCalledOnce();
    await expect(harness.service.restore()).resolves.toMatchObject({ session: null });
  });

  it('refreshes an expired access token before revoking the server session', async () => {
    const harness = createHarness(undefined);
    harness.apiShape.login.mockResolvedValueOnce(
      apiResponse('expired-access', originalRefreshToken, 1),
    );
    await harness.service.login({ login: 'ana.souza', password: 'segredo' });
    harness.setClock('2026-08-14T12:00:02.000Z');

    const state = await harness.service.logout();

    expect(harness.apiShape.refresh).toHaveBeenCalledWith(originalRefreshToken);
    expect(harness.apiShape.logout).toHaveBeenCalledWith('access-rotated');
    expect(state).toMatchObject({ session: null, remoteRevocation: 'CONFIRMED' });
    expect(harness.vaultShape.clear).toHaveBeenCalledOnce();
  });

  it('retries logout once with a rotated access token after a 401', async () => {
    const harness = createHarness(undefined);
    await harness.service.login({ login: 'ana.souza', password: 'segredo' });
    harness.apiShape.logout
      .mockRejectedValueOnce(
        new AuthContractError({
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Sua sessão não é válida. Entre novamente.',
          status: 401,
        }),
      )
      .mockResolvedValueOnce(undefined);

    const state = await harness.service.logout();

    expect(harness.apiShape.refresh).toHaveBeenCalledWith(originalRefreshToken);
    expect(harness.apiShape.logout).toHaveBeenNthCalledWith(1, 'access-login');
    expect(harness.apiShape.logout).toHaveBeenNthCalledWith(2, 'access-rotated');
    expect(state.remoteRevocation).toBe('CONFIRMED');
    expect(harness.vaultShape.clear).toHaveBeenCalledOnce();
  });

  it('clears the local vault and reports an unconfirmed remote logout on network failure', async () => {
    const harness = createHarness(undefined);
    await harness.service.login({ login: 'ana.souza', password: 'segredo' });
    harness.apiShape.logout.mockRejectedValueOnce(
      new AuthContractError({
        code: 'API_UNAVAILABLE',
        message: 'Não foi possível conectar ao servidor.',
      }),
    );

    const state = await harness.service.logout();

    expect(state).toMatchObject({ session: null, remoteRevocation: 'UNCONFIRMED' });
    expect(harness.vaultShape.clear).toHaveBeenCalledOnce();
  });
});
