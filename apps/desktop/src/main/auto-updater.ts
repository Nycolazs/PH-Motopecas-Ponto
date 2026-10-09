import { createRequire } from 'node:module';
import { app, Notification } from 'electron';
import electronUpdaterPkg, { type AppUpdater } from 'electron-updater';

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
  if (installTimer !== null) clearInterval(installTimer);
  installTimer = null;
  installStarted = false;
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

function installDownloadedUpdate(updater: AppUpdater): void {
  if (installStarted) return;
  installStarted = true;
  if (installTimer !== null) clearInterval(installTimer);
  installTimer = null;
  console.log('[AutoUpdater] Instalando atualização em segundo plano e reabrindo o aplicativo...');
  try {
    // Silent install (no wizard) and relaunch PH-Ponto right after.
    updater.quitAndInstall(true, true);
  } catch (err) {
    installStarted = false;
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
    });

    updater.on('update-available', (info) => {
      console.log(
        `[AutoUpdater] Nova versão detectada (${info.version}). Baixando automaticamente em segundo plano...`,
      );
    });

    updater.on('update-not-available', () => {
      console.log('[AutoUpdater] O aplicativo já está na versão mais recente.');
    });

    updater.on('error', (err) => {
      console.warn('[AutoUpdater] Aviso ao verificar/baixar atualização:', err.message);
    });

    updater.on('update-downloaded', (info) => {
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
  } catch (err) {
    console.warn('[AutoUpdater] Inicialização ignorada:', err);
  }
}
