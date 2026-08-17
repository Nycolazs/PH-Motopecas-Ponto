export const APP_INFO_CHANNEL = 'app:get-info';
export const AUTH_LOGIN_CHANNEL = 'auth:login';
export const AUTH_RESTORE_CHANNEL = 'auth:restore';
export const AUTH_REFRESH_CHANNEL = 'auth:refresh';
export const AUTH_LOGOUT_CHANNEL = 'auth:logout';

export interface AppInfo {
  productName: 'PH-Ponto';
  version: string;
  platform: string;
  packaged: boolean;
}

export type DesktopUserRole = 'ADMIN' | 'EMPLOYEE';

export interface DesktopAuthUser {
  id: string;
  name: string;
  login: string;
  role: DesktopUserRole;
}

export interface DesktopAuthSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: DesktopAuthUser;
}

export type AuthPersistence = 'ENCRYPTED' | 'MEMORY_ONLY';

export interface DesktopAuthState {
  session: DesktopAuthSession | null;
  persistence: AuthPersistence;
}

export interface DesktopLogoutState extends DesktopAuthState {
  session: null;
  remoteRevocation: 'CONFIRMED' | 'UNCONFIRMED';
}

export interface DesktopLoginInput {
  login: string;
  password: string;
}

export interface DesktopAuthError {
  code: string;
  message: string;
  status?: number;
}

export type AuthIpcResult<T> = { ok: true; value: T } | { ok: false; error: DesktopAuthError };

export interface ElectronApi {
  app: {
    getInfo: () => Promise<AppInfo>;
  };
  auth: {
    login: (input: DesktopLoginInput) => Promise<DesktopAuthState>;
    restore: () => Promise<DesktopAuthState>;
    refresh: () => Promise<DesktopAuthState>;
    logout: () => Promise<DesktopLogoutState>;
  };
}
