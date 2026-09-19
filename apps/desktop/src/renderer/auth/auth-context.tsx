import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ElectronApi } from '../../shared/electron-api.js';
import { ApiClient } from '../api/client.js';
import {
  AuthContext,
  type AuthContextValue,
  type DesktopSession,
  type LoginInput,
  type SessionPersistence,
} from './auth-types.js';

type AuthBridge = ElectronApi['auth'];
type AuthBridgeResult = Awaited<ReturnType<AuthBridge['restore']>>;

import { webAuth } from './web-auth.js';

function authBridge(): AuthBridge {
  if (typeof window !== 'undefined' && window.phPonto?.auth !== undefined) {
    return window.phPonto.auth;
  }
  return webAuth;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthContextValue['state']>('RESTORING');
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [persistence, setPersistence] = useState<SessionPersistence | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [logoutUnconfirmed, setLogoutUnconfirmed] = useState(false);
  const [restoreUnavailable, setRestoreUnavailable] = useState(false);
  const sessionRef = useRef<DesktopSession | null>(null);
  const refreshPromise = useRef<Promise<DesktopSession> | null>(null);
  const logoutPromise = useRef<Promise<void> | null>(null);
  const sessionGeneration = useRef(0);

  const applyResult = useCallback((result: AuthBridgeResult): DesktopSession | null => {
    sessionRef.current = result.session;
    setSession(result.session);
    setPersistence(result.persistence);
    setState(result.session === null ? 'ANONYMOUS' : 'AUTHENTICATED');
    return result.session;
  }, []);

  const expireSession = useCallback(() => {
    if (sessionRef.current === null) return;
    sessionGeneration.current += 1;
    sessionRef.current = null;
    setSession(null);
    setState('ANONYMOUS');
    setSessionExpired(true);
  }, []);

  const refresh = useCallback(async (): Promise<DesktopSession> => {
    if (logoutPromise.current !== null || sessionRef.current === null) {
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    if (refreshPromise.current !== null) return refreshPromise.current;
    const generation = sessionGeneration.current;
    const pending = authBridge()
      .refresh()
      .then((result) => {
        if (generation !== sessionGeneration.current) throw new Error('AUTHENTICATION_REQUIRED');
        const restored = applyResult(result);
        if (restored === null) throw new Error('AUTHENTICATION_REQUIRED');
        return restored;
      })
      .finally(() => {
        if (refreshPromise.current === pending) refreshPromise.current = null;
      });
    refreshPromise.current = pending;
    return pending;
  }, [applyResult]);

  const api = useMemo(
    () =>
      new ApiClient({
        getSession: () => sessionRef.current,
        refreshSession: refresh,
        onSessionExpired: expireSession,
      }),
    [expireSession, refresh],
  );

  useEffect(() => {
    let active = true;
    const generation = sessionGeneration.current;
    try {
      void authBridge()
        .restore()
        .then((result) => {
          if (!active || generation !== sessionGeneration.current) return;
          applyResult(result);
        })
        .catch(() => {
          if (!active || generation !== sessionGeneration.current) return;
          sessionRef.current = null;
          setSession(null);
          setState('ANONYMOUS');
          setRestoreUnavailable(true);
        });
    } catch {
      sessionRef.current = null;
      setState('ANONYMOUS');
      setRestoreUnavailable(true);
    }
    return () => {
      active = false;
    };
  }, [applyResult]);

  const login = useCallback(
    async (input: LoginInput): Promise<void> => {
      await logoutPromise.current;
      const generation = ++sessionGeneration.current;
      const result = await authBridge().login(input);
      if (generation !== sessionGeneration.current) throw new Error('AUTHENTICATION_REQUIRED');
      const nextSession = applyResult(result);
      if (nextSession === null) throw new Error('AUTHENTICATION_REQUIRED');
      setSessionExpired(false);
      setLogoutUnconfirmed(false);
      setRestoreUnavailable(false);
    },
    [applyResult],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (logoutPromise.current !== null) return logoutPromise.current;

    // Hide employee data immediately, even when remote revocation is slow or offline.
    sessionGeneration.current += 1;
    sessionRef.current = null;
    refreshPromise.current = null;
    setSession(null);
    setPersistence(null);
    setSessionExpired(false);
    setLogoutUnconfirmed(false);
    setState('ANONYMOUS');
    queryClient.clear();

    const pending = (async () => {
      let unconfirmed = false;
      try {
        const result = await authBridge().logout();
        unconfirmed = result.remoteRevocation === 'UNCONFIRMED';
      } catch {
        unconfirmed = true;
      } finally {
        setLogoutUnconfirmed(unconfirmed);
      }
    })();
    logoutPromise.current = pending;
    try {
      await pending;
    } finally {
      logoutPromise.current = null;
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      session,
      persistence,
      sessionExpired,
      logoutUnconfirmed,
      restoreUnavailable,
      api,
      login,
      refresh,
      logout,
    }),
    [
      api,
      login,
      logout,
      logoutUnconfirmed,
      persistence,
      refresh,
      restoreUnavailable,
      session,
      sessionExpired,
      state,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
