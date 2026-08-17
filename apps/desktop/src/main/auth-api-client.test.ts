// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { AuthApiClient, type FetchLike } from './auth-api-client.js';
import { AuthContractError, parseDesktopLoginInput } from './auth-contract.js';

const refreshToken =
  '487d962c-c34d-486b-83be-c1aac9772f9d.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
const responseBody = {
  accessToken: 'signed.access.token',
  refreshToken,
  accessTokenExpiresInSeconds: 300,
  user: {
    id: 'ad49c9bd-9bde-4c4c-bcec-bf209a3d8507',
    name: 'Ana Souza',
    login: 'ana.souza',
    role: 'EMPLOYEE',
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('desktop auth contracts', () => {
  it('accepts only the narrow login IPC payload', () => {
    expect(parseDesktopLoginInput({ login: 'ana.souza', password: 'segredo' })).toEqual({
      login: 'ana.souza',
      password: 'segredo',
    });
    expect(() =>
      parseDesktopLoginInput({ login: 'ana.souza', password: 'segredo', refreshToken }),
    ).toThrowError(AuthContractError);
    try {
      parseDesktopLoginInput({ login: 'ana.souza', password: 'segredo', refreshToken });
    } catch (error) {
      expect(error).toMatchObject({ safe: { code: 'INVALID_AUTH_INPUT' } });
    }
    expect(() => parseDesktopLoginInput({ login: 'a', password: '' })).toThrow();
  });
});

describe('AuthApiClient', () => {
  it('posts login only to the fixed API origin and validates the response', async () => {
    const fetcher = vi.fn<FetchLike>().mockResolvedValue(jsonResponse(responseBody));
    const client = new AuthApiClient(
      'https://api.phmotopecas.example',
      fetcher,
      'PH-Ponto (win32)',
    );

    const response = await client.login({ login: 'ana.souza', password: 'segredo' });

    expect(response).toEqual(responseBody);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url.toString()).toBe('https://api.phmotopecas.example/auth/login');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(JSON.parse(init?.body as string)).toEqual({
      login: 'ana.souza',
      password: 'segredo',
      deviceName: 'PH-Ponto (win32)',
    });
  });

  it('preserves bounded pt-BR client errors without leaking request payloads', async () => {
    const fetcher = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Login ou senha inválidos.',
          requestId: 'request-id',
        },
        401,
      ),
    );
    const client = new AuthApiClient('http://localhost:3000', fetcher, 'PH-Ponto (darwin)');

    await expect(client.login({ login: 'ana.souza', password: 'segredo' })).rejects.toMatchObject({
      safe: {
        code: 'INVALID_CREDENTIALS',
        message: 'Login ou senha inválidos.',
        status: 401,
      },
    });
  });

  it('sanitizes server failures and rejects responses from a different origin', async () => {
    const failed = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse({ message: 'internal stack and secret' }, 500));
    const client = new AuthApiClient('https://api.example.com', failed, 'PH-Ponto');
    await expect(client.refresh(refreshToken)).rejects.toMatchObject({
      safe: {
        code: 'API_UNAVAILABLE',
        message: 'O servidor está indisponível. Tente novamente em alguns instantes.',
      },
    });

    const redirectedResponse = jsonResponse(responseBody);
    Object.defineProperty(redirectedResponse, 'url', {
      configurable: true,
      value: 'https://attacker.example/auth/login',
    });
    const redirected = vi.fn<FetchLike>().mockResolvedValue(redirectedResponse);
    const redirectedClient = new AuthApiClient('https://api.example.com', redirected, 'PH-Ponto');
    await expect(
      redirectedClient.login({ login: 'ana.souza', password: 'segredo' }),
    ).rejects.toMatchObject({ safe: { code: 'UNTRUSTED_API_RESPONSE' } });
  });

  it('does not send a refresh token when revoking with the access credential', async () => {
    const fetcher = vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new AuthApiClient('https://api.example.com', fetcher, 'PH-Ponto');

    await client.logout('access-token');

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url.toString()).toBe('https://api.example.com/auth/logout');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
    expect(init?.body).toBeUndefined();
  });
});
