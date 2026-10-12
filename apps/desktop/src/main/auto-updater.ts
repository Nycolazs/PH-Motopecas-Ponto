import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { app, Notification } from 'electron';
import electronUpdaterPkg, { type AppUpdater } from 'electron-updater';

import type { UpdateStatus } from '../shared/electron-api.js';

const require = createRequire(import.meta.url);

let updaterInstance: AppUpdater | null = null;

export function getUpdater(): AppUpdater | null {
  if (updaterInstance !== null) return updaterInstance;

  try {
    const fromRequire = require('electron-updater') as { autoUpdater?: AppUpdater };
    if (fromRequire?.autoUpdater) {
      updaterInstance = fromRequire.autoUpdater;
      return updaterInstance;
    }
  } catch {
    // Continue to ESM fallback
  }

  try {
    const pkg = electronUpdaterPkg as unknown as {
      autoUpdater?: AppUpdater;
      default?: { autoUpdater?: AppUpdater };
    };
    updaterInstance = pkg.autoUpdater ?? pkg.default?.autoUpdater ?? null;
    return updaterInstance;
  } catch (err) {
    console.warn('[AutoUpdater] Não foi possível carregar electron-updater:', err);
    return null;
  }
}

export function resetUpdaterInstanceForTesting(): void {
  updaterInstance = null;
  lastCheckTime = 0;
  lastManualCheckTime = 0;
  if (installTimer !== null) clearInterval(installTimer);
  installTimer = null;
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  installStarted = false;
  statusListeners.clear();
  status = initialStatus();
}

/** Public page where every version can be downloaded by hand. */
export const DOWNLOAD_PAGE_URL = 'https://github.com/Nycolazs/PH-Motopecas-Ponto/releases/latest';
/** A failed check is retried sooner than the regular 30-minute cycle. */
export const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000;
/** "Verificar agora" from the screen is ignored when repeated within this window. */
export const MANUAL_CHECK_THROTTLE_MS = 30 * 1000;

function initialStatus(): UpdateStatus {
  return {
    state: app.isPackaged ? 'idle' : 'disabled',
    currentVersion: app.getVersion(),
    availableVersion: null,
    percent: null,
    lastCheckedAt: null,
    updatedFrom: null,
  };
}

let status: UpdateStatus = initialStatus();
const statusListeners = new Set<(status: UpdateStatus) => void>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastManualCheckTime = 0;

export function getUpdateStatus(): UpdateStatus {
  return status;
}

/** Notifies `listener` of every status change; returns the unsubscribe function. */
export function onUpdateStatus(listener: (status: UpdateStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStatus(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch };
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch (err) {
      console.warn('[AutoUpdater] Falha ao repassar status:', err);
    }
  }
}

/**
 * Records the version of this launch and reports the previous one when it changed, so the
 * login screen can say "Atualizado para a versão X". Never throws (first run, read-only disk).
 */
export function recordLaunchedVersion(markerPath: string, currentVersion: string): string | null {
  let previous: string | null = null;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf8')) as { version?: unknown };
    if (typeof parsed.version === 'string') previous = parsed.version;
  } catch {
    // First launch or unreadable marker.
  }
  try {
    writeFileSync(markerPath, JSON.stringify({ version: currentVersion }), { mode: 0o600 });
  } catch (err) {
    console.warn('[AutoUpdater] Não foi possível registrar a versão atual:', err);
  }
  const updatedFrom = previous !== null && previous !== currentVersion ? previous : null;
  if (updatedFrom !== null) setStatus({ updatedFrom });
  return updatedFrom;
}

/**
 * macOS only installs updates of apps signed with an Apple Developer ID. Our macOS builds
 * are not signed, so Squirrel.Mac rejects them; those users are pointed to the download.
 */
export function isUnsupportedPlatformError(platform: string, message: string): boolean {
  return platform === 'darwin' && /code ?signature|not signed|signature/i.test(message);
}

/** Seconds without keyboard/mouse input before an update may be applied automatically. */
export const IDLE_SECONDS_BEFORE_INSTALL = 180;
/** How often a downloaded update re-checks whether it can be installed. */
export const INSTALL_POLL_INTERVAL_MS = 60_000;

let installTimer: ReturnType<typeof setInterval> | null = null;
let installStarted = false;

/**
 * PH-Ponto lives in the system tray and starts with the OS, so it is almost never
 * quit; relying on `autoInstallOnAppQuit` alone left downloaded updates pending
 * forever. An update is applied as soon as the app is not in use: the window is
 * hidden in the tray/minimized, or nobody touched the machine for a few minutes.
 */
export function isSafeMomentToInstall(windowInUse: boolean, systemIdleSeconds: number): boolean {
  return !windowInUse || systemIdleSeconds >= IDLE_SECONDS_BEFORE_INSTALL;
}

export interface AutoUpdaterOptions {
  /** Returns true when installing now would not interrupt anyone. */
  canInstallNow?: () => boolean;
  /** Registers a callback for when the computer wakes up or is unlocked. */
  onResume?: (callback: () => void) => void;
}

let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes throttle

export function triggerBackgroundUpdateCheck(options: { force?: boolean } = {}): void {
  if (!app.isPackaged) {
    return;
  }
  const updater = getUpdater();
  if (!updater) {
    return;
  }
  const now = Date.now();
  if (!options.force && now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
    return;
  }
  lastCheckTime = now;

  Promise.resolve().then(() => {
    updater.checkForUpdates().catch((err: Error) => {
      console.warn('[AutoUpdater] Verificação em segundo plano:', err.message);
    });
  });
}

/** "Verificar agora" from the screen: forced check, lightly throttled against repeated clicks. */
export function checkForUpdatesNow(): UpdateStatus {
  if (!app.isPackaged) return status;
  if (['downloading', 'ready', 'installing', 'manual'].includes(status.state)) return status;
  const now = Date.now();
  if (now - lastManualCheckTime < MANUAL_CHECK_THROTTLE_MS) return status;
  lastManualCheckTime = now;
  triggerBackgroundUpdateCheck({ force: true });
  return status;
}

/** "Atualizar agora": only acts when an update was fully downloaded. */
export function installUpdateNow(): boolean {
  const updater = getUpdater();
  if (updater === null || status.state !== 'ready') return false;
  installDownloadedUpdate(updater);
  return true;
}

function scheduleRetryAfterError(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    triggerBackgroundUpdateCheck({ force: true });
  }, RETRY_AFTER_ERROR_MS);
}

function installDownloadedUpdate(updater: AppUpdater): void {
  if (installStarted) return;
  installStarted = true;
  if (installTimer !== null) clearInterval(installTimer);
  installTimer = null;
  setStatus({ state: 'installing', percent: null });
  console.log('[AutoUpdater] Instalando atualização em segundo plano e reabrindo o aplicativo...');
  try {
    // Silent install (no wizard) and relaunch PH-Ponto right after.
    updater.quitAndInstall(true, true);
  } catch (err) {
    installStarted = false;
    setStatus({ state: 'ready' });
    console.warn('[AutoUpdater] Não foi possível iniciar a instalação:', err);
  }
}

export function setupAutoUpdater(options: AutoUpdaterOptions = {}): void {
  // Only execute update checks in packaged production builds
  if (!app.isPackaged) {
    return;
  }

  try {
    const updater = getUpdater();
    if (!updater) {
      return;
    }

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;

    updater.logger = {
      info(message?: unknown, ...optionalParams: unknown[]) {
        console.log('[AutoUpdater]', message, ...optionalParams);
      },
      warn(message?: unknown, ...optionalParams: unknown[]) {
        console.warn('[AutoUpdater]', message, ...optionalParams);
      },
      error(message?: unknown, ...optionalParams: unknown[]) {
        console.error('[AutoUpdater]', message, ...optionalParams);
      },
      debug() {},
    };

    updater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Verificando atualizações no GitHub em segundo plano...');
      // A download in progress or a ready update must stay visible during later checks.
      if (['idle', 'up-to-date', 'error'].includes(status.state)) {
        setStatus({ state: 'checking' });
      }
    });

    updater.on('update-available', (info) => {
      console.log(
        `[AutoUpdater] Nova versão detectada (${info.version}). Baixando automaticamente em segundo plano...`,
      );
      if (status.state !== 'ready' && status.state !== 'installing') {
        setStatus({ state: 'downloading', availableVersion: info.version, percent: 0 });
      }
    });

    updater.on('download-progress', (progress: { percent?: number }) => {
      if (status.state !== 'downloading') return;
      const percent = Math.max(0, Math.min(100, Math.floor(progress.percent ?? 0)));
      if (percent !== status.percent) setStatus({ percent });
    });

    updater.on('update-not-available', () => {
      console.log('[AutoUpdater] O aplicativo já está na versão mais recente.');
      setStatus({
        state: 'up-to-date',
        availableVersion: null,
        percent: null,
        lastCheckedAt: new Date().toISOString(),
      });
    });

    updater.on('error', (err) => {
      console.warn('[AutoUpdater] Aviso ao verificar/baixar atualização:', err.message);
      if (status.state === 'ready' || status.state === 'installing') return;
      if (isUnsupportedPlatformError(process.platform, err.message)) {
        setStatus({ state: 'manual', percent: null, lastCheckedAt: new Date().toISOString() });
        return;
      }
      setStatus({ state: 'error', percent: null, lastCheckedAt: new Date().toISOString() });
      scheduleRetryAfterError();
    });

    updater.on('update-downloaded', (info) => {
      setStatus({
        state: 'ready',
        availableVersion: info.version,
        percent: 100,
        lastCheckedAt: new Date().toISOString(),
      });
      console.log(
        `[AutoUpdater] Versão ${info.version} baixada. Será instalada automaticamente assim que o aplicativo não estiver em uso.`,
      );

      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: 'PH-Ponto - Atualização pronta',
            body: `A versão ${info.version} será instalada automaticamente quando o computador estiver livre. Clique para atualizar agora.`,
            silent: true,
          });

          notification.on('click', () => {
            installDownloadedUpdate(updater);
          });

          notification.show();
        }
      } catch (notifErr) {
        console.warn('[AutoUpdater] Não foi possível exibir notificação nativa:', notifErr);
      }

      const tryInstall = (): void => {
        if (installStarted) return;
        let safe = false;
        try {
          safe = options.canInstallNow?.() ?? false;
        } catch (err) {
          console.warn('[AutoUpdater] Falha ao avaliar momento de instalação:', err);
        }
        if (safe) installDownloadedUpdate(updater);
      };

      if (installTimer !== null) clearInterval(installTimer);
      installTimer = setInterval(tryInstall, INSTALL_POLL_INTERVAL_MS);
      tryInstall();
    });

    // Initial check delayed to 15 seconds after start to ensure 0% impact on startup speed
    setTimeout(() => {
      triggerBackgroundUpdateCheck();
    }, 15_000);

    // Periodic check every 30 minutes
    setInterval(
      () => {
        triggerBackgroundUpdateCheck();
      },
      30 * 60 * 1000,
    );

    // Store PCs sleep overnight: check again shortly after they wake up or are unlocked,
    // once the network is back (throttled, so this never floods GitHub).
    try {
      options.onResume?.(() => {
        setTimeout(() => triggerBackgroundUpdateCheck(), 20_000);
      });
    } catch (err) {
      console.warn('[AutoUpdater] Não foi possível observar a retomada do sistema:', err);
    }
  } catch (err) {
    console.warn('[AutoUpdater] Inicialização ignorada:', err);
  }
}
