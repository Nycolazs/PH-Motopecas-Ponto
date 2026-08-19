import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
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
import { setupAutoUpdater, triggerBackgroundUpdateCheck } from './auto-updater.js';
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
import { destroySystemTray, setupSystemTray } from './tray.js';

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
  process.env.API_BASE_URL ??
    (app.isPackaged ? 'https://ponto-api.phmotopecas.com' : 'http://localhost:3000'),
);
const trustedWebContentsIds = new Set<number>();

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
  destroySystemTray();
});

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedIpcSender(event, trustedWebContentsIds, developmentOrigin)) {
    throw new Error('Untrusted IPC sender.');
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function registerApplicationProtocol(): void {
  protocol.handle('ph-ponto', async (request) => {
    try {
      const assetPath = resolveRendererAsset(rendererRoot, request.url);
      const data = await readFile(assetPath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(assetPath),
        },
      });
    } catch (err) {
      console.error('Failed to load application asset:', request.url, err);
      return new Response('Asset Not Found', { status: 404 });
    }
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

  ipcMain.on('updater:check-background', (event) => {
    assertTrustedSender(event);
    triggerBackgroundUpdateCheck();
  });
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

  mainWindow = window;

  trustedWebContentsIds.add(window.webContents.id);
  window.webContents.once('destroyed', () => {
    trustedWebContentsIds.delete(window.webContents.id);
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedApplicationUrl(targetUrl, developmentOrigin)) {
      event.preventDefault();
    }
  });

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  const startHidden = process.argv.includes('--hidden');

  window.once('ready-to-show', () => {
    if (!startHidden) {
      window.show();
    }
  });

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
    if (mainWindow !== null) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerApplicationProtocol();
    configureSessionSecurity();
    registerIpc();
    setupAutoUpdater();
    setupSystemTray(() => mainWindow, appIconPath);
    await createMainWindow();

    app.on('activate', () => {
      if (mainWindow === null) {
        void createMainWindow();
      } else {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Background tray keeps process alive on Windows/Linux
    }
  });
}
