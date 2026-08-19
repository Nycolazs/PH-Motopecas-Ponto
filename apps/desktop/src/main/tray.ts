import { app, Menu, nativeImage, Tray, type BrowserWindow, type NativeImage } from 'electron';
import { PRODUCT_NAME } from '@ph-ponto/shared';
import { isAutoStartEnabled, setAutoStartEnabled } from './autostart.js';

let tray: Tray | null = null;

export function setupSystemTray(
  getMainWindow: () => BrowserWindow | null,
  appIcon: NativeImage,
): Tray | null {
  try {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const trayIcon =
      isWin || isMac
        ? appIcon.resize({ width: 16, height: 16 })
        : appIcon.resize({ width: 22, height: 22 });

    const finalIcon = trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon;
    tray = new Tray(finalIcon);
    tray.setToolTip(`${PRODUCT_NAME} - PH Motopeças`);

    const updateContextMenu = (): void => {
      const openAtLogin = isAutoStartEnabled();
      const autoStartLabel = isWin ? 'Iniciar com o Windows' : 'Iniciar com o Sistema';

      const contextMenu = Menu.buildFromTemplate([
        {
          label: `Abrir ${PRODUCT_NAME}`,
          click: () => {
            const win = getMainWindow();
            if (win) {
              if (!win.isVisible()) win.show();
              if (win.isMinimized()) win.restore();
              win.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: autoStartLabel,
          type: 'checkbox',
          checked: openAtLogin,
          click: (menuItem) => {
            setAutoStartEnabled(menuItem.checked);
            updateContextMenu();
          },
        },
        { type: 'separator' },
        {
          label: `Sair do ${PRODUCT_NAME}`,
          click: () => {
            const win = getMainWindow();
            if (win) {
              win.destroy();
            }
            app.quit();
          },
        },
      ]);

      tray?.setContextMenu(contextMenu);
    };

    updateContextMenu();

    tray.on('click', () => {
      const win = getMainWindow();
      if (win) {
        if (!win.isVisible()) {
          win.show();
        } else {
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      }
    });

    tray.on('double-click', () => {
      const win = getMainWindow();
      if (win) {
        if (!win.isVisible()) win.show();
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });

    return tray;
  } catch (err) {
    console.warn('[Tray] Erro ao inicializar bandeja do sistema:', err);
    return null;
  }
}

export function destroySystemTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
}
