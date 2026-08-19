import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import { PRODUCT_NAME } from '@ph-ponto/shared';

let tray: Tray | null = null;

export function setupSystemTray(
  getMainWindow: () => BrowserWindow | null,
  appIconPath: string,
): Tray | null {
  try {
    const rawIcon = nativeImage.createFromPath(appIconPath);
    const trayIcon =
      process.platform === 'win32' ? rawIcon.resize({ width: 16, height: 16 }) : rawIcon;

    tray = new Tray(trayIcon);
    tray.setToolTip(`${PRODUCT_NAME} - PH Motopeças`);

    const updateContextMenu = (): void => {
      const loginSettings = app.getLoginItemSettings();
      const openAtLogin = loginSettings.openAtLogin;

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
          label: 'Iniciar com o Windows',
          type: 'checkbox',
          checked: openAtLogin,
          click: (menuItem) => {
            const shouldOpenAtLogin = menuItem.checked;
            app.setLoginItemSettings({
              openAtLogin: shouldOpenAtLogin,
              args: ['--hidden'],
            });
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
