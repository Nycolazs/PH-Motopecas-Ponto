// @vitest-environment node

import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const filesystem = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
const electronApp = vi.hoisted(() => ({
  isPackaged: true,
  getPath: vi.fn(() => '/test/user-data'),
  getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
  setLoginItemSettings: vi.fn(),
}));

vi.mock('node:fs', () => filesystem);
vi.mock('electron', () => ({ app: electronApp }));

import { initAutoStartDefault, setAutoStartEnabled } from './autostart.js';

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  vi.stubEnv('XDG_CONFIG_HOME', '/test/config');
  electronApp.getPath.mockReturnValue('/test/user-data');
  electronApp.isPackaged = true;
});

describe('Linux autostart sandbox', () => {
  it('creates startup entries without disabling the Electron sandbox', () => {
    setAutoStartEnabled(true);

    expect(filesystem.writeFileSync).toHaveBeenCalledWith(
      join('/test/config', 'autostart', 'ph-ponto.desktop'),
      expect.stringContaining(`Exec="${process.execPath}" --hidden\n`),
      'utf8',
    );
    expect(filesystem.writeFileSync.mock.calls[0]?.[1]).not.toContain('--no-sandbox');
  });

  it('removes a legacy bypass without re-enabling a disabled startup entry', () => {
    filesystem.existsSync.mockReturnValue(true);
    filesystem.readFileSync.mockReturnValue(
      'Exec="/opt/PH-Ponto/ph-ponto" --hidden --no-sandbox\nX-GNOME-Autostart-enabled=false\n',
    );

    initAutoStartDefault();

    expect(filesystem.writeFileSync).toHaveBeenCalledExactlyOnceWith(
      join('/test/config', 'autostart', 'ph-ponto.desktop'),
      'Exec="/opt/PH-Ponto/ph-ponto" --hidden\nX-GNOME-Autostart-enabled=false\n',
      'utf8',
    );
    expect(electronApp.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('does not modify autostart when running a development build', () => {
    electronApp.isPackaged = false;
    initAutoStartDefault();
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
    expect(filesystem.writeFileSync).not.toHaveBeenCalled();
  });
});
