import { createContext } from 'react';
import type { ElectronApi } from '../../shared/electron-api.js';
import type { ApiClient } from '../api/client.js';

type AuthBridge = ElectronApi['auth'];
type AuthBridgeResult = Awaited<ReturnType<AuthBridge['restore']>>;
export type DesktopSession = NonNullable<AuthBridgeResult['session']>;
export type SessionPersistence = AuthBridgeResult['persistence'];

export interface LoginInput {
  login: string;
  password: string;
}

export interface AuthContextValue {
  state: 'RESTORING' | 'ANONYMOUS' | 'AUTHENTICATED';
  session: DesktopSession | null;
  persistence: SessionPersistence | null;
  sessionExpired: boolean;
  logoutUnconfirmed: boolean;
  restoreUnavailable: boolean;
  api: ApiClient;
  login: (input: LoginInput) => Promise<void>;
  refresh: () => Promise<DesktopSession>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
