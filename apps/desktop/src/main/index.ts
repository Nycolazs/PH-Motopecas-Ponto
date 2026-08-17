import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
  type IpcMainInvokeEvent,
} from 'electron';
import { PRODUCT_NAME } from '@ph-ponto/shared';

import { APP_INFO_CHANNEL, type AppInfo } from '../shared/electron-api.js';
import { AuthApiClient } from './auth-api-client.js';
import { registerAuthIpc } from './auth-ipc.js';
import { DesktopAuthSessionService } from './auth-session.service.js';
import { setupAutoUpdater } from './auto-updater.js';
import { RefreshTokenVault, type TokenEncryption } from './refresh-token-vault.js';
import {
  createContentSecurityPolicy,
  createSecureWebPreferences,
  DEFAULT_DEVELOPMENT_ORIGIN,
  isAllowedApplicationUrl,
  isTrustedIpcSender,
  resolveRendererAsset,
  validateApiBaseUrl,
  validateDevelopmentOrigin,
} from './security.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ph-ponto',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const rendererRoot = join(moduleDirectory, '..', 'renderer');
const preloadPath = join(moduleDirectory, '..', 'preload', 'index.cjs');
const appIconPath = join(rendererRoot, 'assets', 'app-icon.png');
const developmentOrigin = app.isPackaged
  ? undefined
  : validateDevelopmentOrigin(process.env.VITE_DEV_SERVER_URL ?? DEFAULT_DEVELOPMENT_ORIGIN);
const apiBaseUrl = validateApiBaseUrl(
  process.env.API_BASE_URL ?? 'https://phmotopecas-api.yacacode.com',
);
const trustedWebContentsIds = new Set<number>();

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedIpcSender(event, trustedWebContentsIds, developmentOrigin)) {
    throw new Error('Untrusted IPC sender.');
  }
}

function registerApplicationProtocol(): void {
  protocol.handle('ph-ponto', (request) => {
    const assetPath = resolveRendererAsset(rendererRoot, request.url);
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function configureSessionSecurity(): void {
  const policy = createContentSecurityPolicy(apiBaseUrl, developmentOrigin);

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function registerIpc(): void {
  ipcMain.handle(APP_INFO_CHANNEL, (event): AppInfo => {
    assertTrustedSender(event);
    return {
      productName: PRODUCT_NAME,
      version: app.getVersion(),
      platform: process.platform,
      packaged: app.isPackaged,
    };
  });

  // Employee desktop sessions are strictly memory-only (never saved across app restarts)
  const encryption: TokenEncryption = {
    isAvailable: () => false,
    encrypt: () => Buffer.from(''),
    decrypt: () => '',
  };
  const vault = new RefreshTokenVault(
    join(app.getPath('userData'), 'auth-refresh-token.vault'),
    encryption,
  );
  const api = new AuthApiClient(
    apiBaseUrl,
    (input, init) => net.fetch(input.toString(), init),
    `${PRODUCT_NAME} (${process.platform})`,
  );
  registerAuthIpc(ipcMain, new DesktopAuthSessionService(api, vault), assertTrustedSender);
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    title: PRODUCT_NAME,
    icon: appIconPath,
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#f4f7fb',
    autoHideMenuBar: true,
    webPreferences: createSecureWebPreferences(preloadPath),
  });

  trustedWebContentsIds.add(window.webContents.id);
  window.webContents.once('destroyed', () => {
    trustedWebContentsIds.delete(window.webContents.id);
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedApplicationUrl(targetUrl, developmentOrigin)) {
      event.preventDefault();
    }
  });
  window.once('ready-to-show', () => window.show());

  if (developmentOrigin === undefined) {
    await window.loadURL('ph-ponto://app/index.html');
  } else {
    await window.loadURL(developmentOrigin);
  }

  return window;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.setName(PRODUCT_NAME);
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window !== undefined) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(async () => {
    registerApplicationProtocol();
    configureSessionSecurity();
    registerIpc();
    setupAutoUpdater();
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
