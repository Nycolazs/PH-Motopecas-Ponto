import type {
  AuthIpcResult,
  DesktopAuthError,
  DesktopAuthState,
  DesktopLoginInput,
  DesktopLogoutState,
  ElectronApi,
} from '../shared/electron-api.js';

// Sandboxed Electron preload scripts use Electron's limited CommonJS loader.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const channels = Object.freeze({
  appInfo: 'app:get-info',
  authLogin: 'auth:login',
  authRestore: 'auth:restore',
  authRefresh: 'auth:refresh',
  authLogout: 'auth:logout',
}) satisfies {
  appInfo: typeof import('../shared/electron-api.js').APP_INFO_CHANNEL;
  authLogin: typeof import('../shared/electron-api.js').AUTH_LOGIN_CHANNEL;
  authRestore: typeof import('../shared/electron-api.js').AUTH_RESTORE_CHANNEL;
  authRefresh: typeof import('../shared/electron-api.js').AUTH_REFRESH_CHANNEL;
  authLogout: typeof import('../shared/electron-api.js').AUTH_LOGOUT_CHANNEL;
};

class DesktopAuthBridgeError extends Error {
  public readonly code: string;
  public readonly status: number | undefined;

  public constructor(error: DesktopAuthError) {
    super(error.message);
    this.name = 'DesktopAuthBridgeError';
    this.code = error.code;
    this.status = error.status;
  }
}

async function invokeAuth<T>(channel: string, ...arguments_: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...arguments_)) as AuthIpcResult<T>;
  if (result.ok) return result.value;
  throw new DesktopAuthBridgeError(result.error);
}

const electronApi: ElectronApi = Object.freeze({
  app: Object.freeze({
    getInfo: async () =>
      (await ipcRenderer.invoke(channels.appInfo)) as Awaited<
        ReturnType<ElectronApi['app']['getInfo']>
      >,
    checkForUpdatesInBackground: () => {
      ipcRenderer.send('updater:check-background');
    },
  }),
  auth: Object.freeze({
    login: async (input: DesktopLoginInput) =>
      invokeAuth<DesktopAuthState>(channels.authLogin, input),
    restore: async () => invokeAuth<DesktopAuthState>(channels.authRestore),
    refresh: async () => invokeAuth<DesktopAuthState>(channels.authRefresh),
    logout: async () => invokeAuth<DesktopLogoutState>(channels.authLogout),
  }),
});

contextBridge.exposeInMainWorld('phPonto', electronApi);
