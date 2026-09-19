import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopAuthState, DesktopLogoutState } from '../../shared/electron-api.js';
import { createBridge, employeeSession } from '../test/fixtures.js';
import { AuthProvider } from './auth-context.js';
import { useAuth } from './use-auth.js';

async function renderAuth(bridge = createBridge(employeeSession)) {
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
  const queryClient = new QueryClient();
  const hook = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  });
  await waitFor(() => expect(hook.result.current.state).toBe('AUTHENTICATED'));
  queryClient.setQueryData(['attendance', employeeSession.user.id], { punchCount: 1 });
  return { ...hook, queryClient };
}

const loggedOut: DesktopLogoutState = {
  session: null,
  persistence: 'MEMORY_ONLY',
  remoteRevocation: 'CONFIRMED',
};

describe('session logout', () => {
  it('immediately clears identity and cached employee data while remote logout is pending', async () => {
    const bridge = createBridge(employeeSession);
    let finishLogout!: (result: DesktopLogoutState) => void;
    bridge.auth.logout = vi.fn(
      () =>
        new Promise<DesktopLogoutState>((resolve) => {
          finishLogout = resolve;
        }),
    );
    const { result, queryClient } = await renderAuth(bridge);

    let logout!: Promise<void>;
    act(() => {
      logout = result.current.logout();
    });
    expect(result.current.state).toBe('ANONYMOUS');
    expect(result.current.session).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await expect(result.current.refresh()).rejects.toThrow('AUTHENTICATION_REQUIRED');

    await act(async () => {
      finishLogout(loggedOut);
      await logout;
    });
    expect(bridge.auth.logout).toHaveBeenCalledOnce();
  });

  it('does not restore the old session when an in-flight refresh finishes after logout', async () => {
    const bridge = createBridge(employeeSession);
    let finishRefresh!: (result: DesktopAuthState) => void;
    bridge.auth.refresh = vi.fn(
      () =>
        new Promise<DesktopAuthState>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const { result } = await renderAuth(bridge);
    const refresh = result.current.refresh();
    const rejectedRefresh = expect(refresh).rejects.toThrow('AUTHENTICATION_REQUIRED');

    await act(async () => {
      await result.current.logout();
    });
    await act(async () => {
      finishRefresh({ session: employeeSession, persistence: 'ENCRYPTED' });
      await rejectedRefresh;
    });
    expect(result.current.state).toBe('ANONYMOUS');
    expect(result.current.session).toBeNull();
  });

  it('serializes a new login after a single remote logout', async () => {
    const bridge = createBridge(employeeSession);
    let finishLogout!: (result: DesktopLogoutState) => void;
    bridge.auth.logout = vi.fn(
      () =>
        new Promise<DesktopLogoutState>((resolve) => {
          finishLogout = resolve;
        }),
    );
    bridge.auth.login = vi.fn(bridge.auth.login);
    const { result } = await renderAuth(bridge);
    let first!: Promise<void>;
    let second!: Promise<void>;
    let login!: Promise<void>;
    act(() => {
      first = result.current.logout();
      second = result.current.logout();
      login = result.current.login({ login: 'joao.silva', password: 'segredo' });
    });
    expect(bridge.auth.logout).toHaveBeenCalledOnce();
    expect(bridge.auth.login).not.toHaveBeenCalled();

    await act(async () => {
      finishLogout(loggedOut);
      await Promise.all([first, second, login]);
    });
    expect(bridge.auth.login).toHaveBeenCalledOnce();
    expect(result.current.state).toBe('AUTHENTICATED');
  });

  it.each(['unconfirmed', 'rejected'])(
    'keeps the employee signed out when remote revocation is %s',
    async (outcome) => {
      const bridge = createBridge(employeeSession);
      bridge.auth.logout =
        outcome === 'unconfirmed'
          ? vi.fn().mockResolvedValue({ ...loggedOut, remoteRevocation: 'UNCONFIRMED' })
          : vi.fn().mockRejectedValue(new Error('Offline'));
      const { result, queryClient } = await renderAuth(bridge);
      await act(async () => {
        await result.current.logout();
      });
      expect(result.current.session).toBeNull();
      expect(result.current.logoutUnconfirmed).toBe(true);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    },
  );
});
