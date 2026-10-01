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

export function setupAutoUpdater(): void {
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
        `[AutoUpdater] Versão ${info.version} baixada com sucesso em segundo plano. O instalador será executado automaticamente ao encerrar ou reiniciar o aplicativo.`,
      );

      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: 'PH-Ponto - Atualização Disponível',
            body: `A versão ${info.version} foi baixada e está pronta. Clique aqui para reiniciar e atualizar agora.`,
            silent: false,
          });

          notification.on('click', () => {
            updater.quitAndInstall(false, true);
          });

          notification.show();
        }
      } catch (notifErr) {
        console.warn('[AutoUpdater] Não foi possível exibir notificação nativa:', notifErr);
      }
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
