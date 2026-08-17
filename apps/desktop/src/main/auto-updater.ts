import { app } from 'electron';
import electronUpdaterPkg, { type AppUpdater } from 'electron-updater';

const autoUpdater: AppUpdater = (electronUpdaterPkg as unknown as { autoUpdater: AppUpdater })
  .autoUpdater;

const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // Check every 2 hours

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
      console.log('[AutoUpdater] Verificando atualizações no GitHub...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(
        `[AutoUpdater] Nova versão disponível (${info.version}). Baixando em segundo plano...`,
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
        `[AutoUpdater] Versão ${info.version} baixada com sucesso. Será aplicada ao reiniciar.`,
      );
    });

    // Initial check after 10 seconds of app start
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
        console.warn('[AutoUpdater] Falha na verificação inicial:', err.message);
      });
    }, 10_000);

    // Periodic check
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
        console.warn('[AutoUpdater] Falha na verificação periódica:', err.message);
      });
    }, UPDATE_CHECK_INTERVAL_MS);
  } catch (err) {
    console.warn('[AutoUpdater] Inicialização ignorada:', err);
  }
}
