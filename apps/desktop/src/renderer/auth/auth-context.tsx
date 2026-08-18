import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const [state, setState] = useState<AuthContextValue['state']>('RESTORING');
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [persistence, setPersistence] = useState<SessionPersistence | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [logoutUnconfirmed, setLogoutUnconfirmed] = useState(false);
  const [restoreUnavailable, setRestoreUnavailable] = useState(false);
  const sessionRef = useRef<DesktopSession | null>(null);
  const refreshPromise = useRef<Promise<DesktopSession> | null>(null);

  const applyResult = useCallback((result: AuthBridgeResult): DesktopSession | null => {
    sessionRef.current = result.session;
    setSession(result.session);
    setPersistence(result.persistence);
    setState(result.session === null ? 'ANONYMOUS' : 'AUTHENTICATED');
    return result.session;
  }, []);

  const expireSession = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setState('ANONYMOUS');
    setSessionExpired(true);
  }, []);

  const refresh = useCallback(async (): Promise<DesktopSession> => {
    if (refreshPromise.current !== null) return refreshPromise.current;
    const pending = authBridge()
      .refresh()
      .then((result) => {
        const restored = applyResult(result);
        if (restored === null) throw new Error('AUTHENTICATION_REQUIRED');
        return restored;
      })
      .finally(() => {
        refreshPromise.current = null;
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
    try {
      void authBridge()
        .restore()
        .then((result) => {
          if (!active) return;
          applyResult(result);
        })
        .catch(() => {
          if (!active) return;
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
      const result = await authBridge().login(input);
      const nextSession = applyResult(result);
      if (nextSession === null) throw new Error('AUTHENTICATION_REQUIRED');
      setSessionExpired(false);
      setLogoutUnconfirmed(false);
      setRestoreUnavailable(false);
    },
    [applyResult],
  );

  const logout = useCallback(async (): Promise<void> => {
    let unconfirmed = false;
    try {
      const result = await authBridge().logout();
      unconfirmed = result.remoteRevocation === 'UNCONFIRMED';
    } catch {
      unconfirmed = true;
    } finally {
      sessionRef.current = null;
      setSession(null);
      setPersistence(null);
      setSessionExpired(false);
      setLogoutUnconfirmed(unconfirmed);
      setState('ANONYMOUS');
    }
  }, []);

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
