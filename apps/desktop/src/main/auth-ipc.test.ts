// @vitest-environment node

import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_LOGIN_CHANNEL,
  AUTH_LOGOUT_CHANNEL,
  AUTH_REFRESH_CHANNEL,
  AUTH_RESTORE_CHANNEL,
  type DesktopAuthState,
} from '../shared/electron-api.js';
import { handleAuthOperation, registerAuthIpc } from './auth-ipc.js';
import type { DesktopAuthSessionService } from './auth-session.service.js';

type RegisteredHandler = Parameters<IpcMain['handle']>[1];

const state: DesktopAuthState = {
  persistence: 'ENCRYPTED',
  session: {
    accessToken: 'access-token',
    accessTokenExpiresAt: '2026-08-14T12:05:00.000Z',
    user: {
      id: 'ad49c9bd-9bde-4c4c-bcec-bf209a3d8507',
      name: 'Ana Souza',
      login: 'ana.souza',
      role: 'EMPLOYEE',
    },
  },
};

function harness() {
  const handlers = new Map<string, RegisteredHandler>();
  const ipc = {
    handle: vi.fn((channel: string, handler: RegisteredHandler) => {
      handlers.set(channel, handler);
    }),
  } as unknown as Pick<IpcMain, 'handle'>;
  const sessionsShape = {
    login: vi.fn().mockResolvedValue(state),
    restore: vi.fn().mockResolvedValue(state),
    refresh: vi.fn().mockResolvedValue(state),
    logout: vi.fn().mockResolvedValue({
      session: null,
      persistence: 'ENCRYPTED',
      remoteRevocation: 'CONFIRMED',
    }),
  };
  const assertTrusted = vi.fn();
  registerAuthIpc(ipc, sessionsShape as unknown as DesktopAuthSessionService, assertTrusted);

  return { handlers, sessionsShape, assertTrusted };
}

function handlerFor(handlers: Map<string, RegisteredHandler>, channel: string): RegisteredHandler {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing ${channel} test handler.`);
  return handler;
}

describe('auth IPC registration', () => {
  it('registers only the four purpose-specific auth operations', () => {
    const { handlers } = harness();
    expect([...handlers.keys()]).toEqual([
      AUTH_LOGIN_CHANNEL,
      AUTH_RESTORE_CHANNEL,
      AUTH_REFRESH_CHANNEL,
      AUTH_LOGOUT_CHANNEL,
    ]);
  });

  it('checks the sender and validates the exact login payload', async () => {
    const { handlers, sessionsShape, assertTrusted } = harness();
    const event = {} as IpcMainInvokeEvent;
    const handler = handlerFor(handlers, AUTH_LOGIN_CHANNEL);

    await expect(handler(event, { login: 'ana.souza', password: 'segredo' })).resolves.toEqual({
      ok: true,
      value: state,
    });
    expect(assertTrusted).toHaveBeenCalledWith(event);
    expect(sessionsShape.login).toHaveBeenCalledWith({
      login: 'ana.souza',
      password: 'segredo',
    });

    await expect(
      handler(event, { login: 'ana.souza', password: 'segredo', refreshToken: 'secret' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_AUTH_INPUT' } });
    expect(sessionsShape.login).toHaveBeenCalledOnce();
  });

  it('does not call a session operation for an untrusted sender', async () => {
    const { handlers, sessionsShape, assertTrusted } = harness();
    const event = {} as IpcMainInvokeEvent;
    assertTrusted.mockImplementationOnce(() => {
      throw new Error('Untrusted IPC sender.');
    });

    await expect(handlerFor(handlers, AUTH_REFRESH_CHANNEL)(event)).rejects.toThrow(
      'Untrusted IPC sender.',
    );
    expect(sessionsShape.refresh).not.toHaveBeenCalled();
  });

  it('rejects arguments on no-input operations and sanitizes unexpected failures', async () => {
    const { handlers, sessionsShape } = harness();
    const event = {} as IpcMainInvokeEvent;

    await expect(
      handlerFor(handlers, AUTH_LOGOUT_CHANNEL)(event, { accessToken: 'forged' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_AUTH_INPUT' } });
    expect(sessionsShape.logout).not.toHaveBeenCalled();

    await expect(
      handleAuthOperation(async () => {
        throw new Error('internal path and secret');
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'AUTH_REQUEST_FAILED',
        message: 'Não foi possível concluir a autenticação.',
      },
    });
  });
});
