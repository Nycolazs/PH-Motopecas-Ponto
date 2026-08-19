import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { app } from 'electron';

function getLinuxAutostartPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(configHome, 'autostart', 'ph-ponto.desktop');
}

function getLinuxDesktopEntryContent(): string {
  const execPath = process.execPath;
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=PH-Ponto
GenericName=Controle de Ponto
Comment=Sistema de Controle de Ponto - PH Motopeças
Exec="${execPath}" --hidden --no-sandbox
Icon=ph-ponto
Terminal=false
StartupNotify=false
X-GNOME-Autostart-enabled=true
Categories=Office;Utility;
`;
}

export function isAutoStartEnabled(): boolean {
  if (process.platform === 'linux') {
    const desktopPath = getLinuxAutostartPath();
    if (existsSync(desktopPath)) {
      try {
        const content = readFileSync(desktopPath, 'utf8');
        return !content.includes('X-GNOME-Autostart-enabled=false');
      } catch {
        return false;
      }
    }
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  }

  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

export function setAutoStartEnabled(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--hidden'],
    });
  } catch (err) {
    console.warn('[AutoStart] Erro ao configurar login item settings:', err);
  }

  if (process.platform === 'linux') {
    const desktopPath = getLinuxAutostartPath();
    try {
      if (enabled) {
        mkdirSync(dirname(desktopPath), { recursive: true });
        writeFileSync(desktopPath, getLinuxDesktopEntryContent(), 'utf8');
      } else if (existsSync(desktopPath)) {
        unlinkSync(desktopPath);
      }
    } catch (err) {
      console.warn('[AutoStart] Erro ao manipular arquivo autostart do Linux:', err);
    }
  }
}

export function initAutoStartDefault(): void {
  if (!app.isPackaged) return;

  try {
    const markerPath = join(app.getPath('userData'), '.autostart_configured');
    if (!existsSync(markerPath)) {
      setAutoStartEnabled(true);
      writeFileSync(
        markerPath,
        JSON.stringify({ configuredAt: new Date().toISOString(), enabled: true }),
        'utf8',
      );
      console.log('[AutoStart] Inicialização automática com o sistema habilitada com sucesso.');
    }
  } catch (err) {
    console.warn('[AutoStart] Não foi possível salvar configuração padrão de inicialização:', err);
  }
}
