import { app } from 'electron';
import electronUpdaterPkg, { type AppUpdater } from 'electron-updater';

const autoUpdater: AppUpdater = (electronUpdaterPkg as unknown as { autoUpdater: AppUpdater })
  .autoUpdater;

let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes throttle

export function triggerBackgroundUpdateCheck(): void {
  if (!app.isPackaged) {
    return;
  }
  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
    return;
  }
  lastCheckTime = now;

  Promise.resolve().then(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.warn('[AutoUpdater] Verificação silenciosa em segundo plano:', err.message);
    });
  });
}

export function setupAutoUpdater(): void {
  // Only execute update checks in packaged production builds
  if (!app.isPackaged) {
    return;
  }

  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Verificando atualizações no GitHub em segundo plano...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(
        `[AutoUpdater] Nova versão detectada (${info.version}). Baixando em segundo plano sem interromper o usuário...`,
      );
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] O aplicativo já está na versão mais recente.');
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Aviso ao verificar/baixar atualização:', err.message);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log(
        `[AutoUpdater] Versão ${info.version} baixada com sucesso em segundo plano. Será aplicada na próxima reinicialização.`,
      );
    });

    // Initial check delayed to 45 seconds after start to ensure 0% impact on startup speed
    setTimeout(() => {
      triggerBackgroundUpdateCheck();
    }, 45_000);

    // Periodic check every 2 hours
    setInterval(() => {
      triggerBackgroundUpdateCheck();
    }, 2 * 60 * 60 * 1000);
  } catch (err) {
    console.warn('[AutoUpdater] Inicialização ignorada:', err);
  }
}
