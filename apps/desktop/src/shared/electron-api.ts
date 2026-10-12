export const APP_INFO_CHANNEL = 'app:get-info';
export const AUTH_LOGIN_CHANNEL = 'auth:login';
export const AUTH_RESTORE_CHANNEL = 'auth:restore';
export const AUTH_REFRESH_CHANNEL = 'auth:refresh';
export const AUTH_LOGOUT_CHANNEL = 'auth:logout';
export const UPDATE_GET_STATUS_CHANNEL = 'updater:get-status';
export const UPDATE_CHECK_NOW_CHANNEL = 'updater:check-now';
export const UPDATE_INSTALL_NOW_CHANNEL = 'updater:install-now';
export const UPDATE_OPEN_DOWNLOAD_PAGE_CHANNEL = 'updater:open-download-page';
/** Main → renderer push of every update status change. */
export const UPDATE_STATUS_EVENT = 'updater:status';

export interface AppInfo {
  productName: 'PH-Ponto';
  version: string;
  platform: string;
  packaged: boolean;
}

/**
 * Lifecycle of the automatic update, as shown to the user:
 * - `disabled`: development build, updates are not checked.
 * - `manual`: the platform cannot install by itself (e.g. unsigned macOS build); offer a download.
 */
export type UpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'manual'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  /** Version being downloaded / ready / available for manual download. */
  availableVersion: string | null;
  /** Download progress, 0–100, while `downloading`. */
  percent: number | null;
  /** ISO instant of the last finished check. */
  lastCheckedAt: string | null;
  /** Version that was installed before this launch, when the app was just updated. */
  updatedFrom: string | null;
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
    checkForUpdatesInBackground?: () => void;
  };
  updates?: {
    getStatus: () => Promise<UpdateStatus>;
    /** Subscribes to status changes; returns the unsubscribe function. */
    onStatus: (listener: (status: UpdateStatus) => void) => () => void;
    checkNow: () => Promise<UpdateStatus>;
    installNow: () => Promise<void>;
    openDownloadPage: () => Promise<void>;
  };
  auth: {
    login: (input: DesktopLoginInput) => Promise<DesktopAuthState>;
    restore: () => Promise<DesktopAuthState>;
    refresh: () => Promise<DesktopAuthState>;
    logout: () => Promise<DesktopLogoutState>;
  };
}
