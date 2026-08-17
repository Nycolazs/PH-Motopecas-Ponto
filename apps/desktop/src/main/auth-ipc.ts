import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import {
  AUTH_LOGIN_CHANNEL,
  AUTH_LOGOUT_CHANNEL,
  AUTH_REFRESH_CHANNEL,
  AUTH_RESTORE_CHANNEL,
  type AuthIpcResult,
  type DesktopAuthState,
  type DesktopLogoutState,
} from '../shared/electron-api.js';
import { AuthContractError, parseDesktopLoginInput } from './auth-contract.js';
import type { DesktopAuthSessionService } from './auth-session.service.js';

type AssertTrustedSender = (event: IpcMainInvokeEvent) => void;

export function registerAuthIpc(
  ipc: Pick<IpcMain, 'handle'>,
  sessions: DesktopAuthSessionService,
  assertTrustedSender: AssertTrustedSender,
): void {
  ipc.handle(AUTH_LOGIN_CHANNEL, async (event, ...arguments_) => {
    assertTrustedSender(event);
    return handleAuthOperation<DesktopAuthState>(async () => {
      if (arguments_.length !== 1) throw invalidArgumentCount();
      return sessions.login(parseDesktopLoginInput(arguments_[0]));
    });
  });

  ipc.handle(AUTH_RESTORE_CHANNEL, async (event, ...arguments_) => {
    assertTrustedSender(event);
    return handleAuthOperation<DesktopAuthState>(async () => {
      assertEmptyArguments(arguments_);
      return sessions.restore();
    });
  });

  ipc.handle(AUTH_REFRESH_CHANNEL, async (event, ...arguments_) => {
    assertTrustedSender(event);
    return handleAuthOperation<DesktopAuthState>(async () => {
      assertEmptyArguments(arguments_);
      return sessions.refresh();
    });
  });

  ipc.handle(AUTH_LOGOUT_CHANNEL, async (event, ...arguments_) => {
    assertTrustedSender(event);
    return handleAuthOperation<DesktopLogoutState>(async () => {
      assertEmptyArguments(arguments_);
      return sessions.logout();
    });
  });
}

export async function handleAuthOperation<T>(
  operation: () => Promise<T>,
): Promise<AuthIpcResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof AuthContractError) return { ok: false, error: error.safe };
    return {
      ok: false,
      error: {
        code: 'AUTH_REQUEST_FAILED',
        message: 'Não foi possível concluir a autenticação.',
      },
    };
  }
}

function assertEmptyArguments(arguments_: unknown[]): void {
  if (arguments_.length !== 0) throw invalidArgumentCount();
}

function invalidArgumentCount(): AuthContractError {
  return new AuthContractError({
    code: 'INVALID_AUTH_INPUT',
    message: 'A solicitação de autenticação é inválida.',
    status: 400,
  });
}
