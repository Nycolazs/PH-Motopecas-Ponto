// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notificationSpy, electronApp, updaterMock } = vi.hoisted(() => {
  const notificationInstance = {
    on: vi.fn(),
    show: vi.fn(),
  };

  const notificationSpyFn = vi.fn();

  class MockNotification {
    public static isSupported = vi.fn(() => true);
    public on = notificationInstance.on;
    public show = notificationInstance.show;
    public constructor(options?: unknown) {
      notificationSpyFn(options);
    }
  }

  const appMock = {
    isPackaged: true,
    getVersion: () => '0.1.8',
  };

  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const mockUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    allowDowngrade: true,
    logger: null as unknown,
    checkForUpdates: vi.fn().mockResolvedValue({}),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event]?.push(handler);
    }),
    emit: (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((handler) => handler(...args));
    },
    reset: () => {
      for (const k of Object.keys(listeners)) {
        delete listeners[k];
      }
    },
  };

  return {
    notificationSpy: {
      spy: notificationSpyFn,
      instance: notificationInstance,
      MockNotification,
    },
    electronApp: appMock,
    updaterMock: mockUpdater,
  };
});

vi.mock('electron', () => ({
  app: electronApp,
  Notification: notificationSpy.MockNotification,
}));

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: updaterMock,
  },
  autoUpdater: updaterMock,
}));

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkForUpdatesNow,
  getUpdateStatus,
  getUpdater,
  IDLE_SECONDS_BEFORE_INSTALL,
  installUpdateNow,
  isUnsupportedPlatformError,
  MANUAL_CHECK_THROTTLE_MS,
  onUpdateStatus,
  recordLaunchedVersion,
  RETRY_AFTER_ERROR_MS,
  INSTALL_POLL_INTERVAL_MS,
  isSafeMomentToInstall,
  resetUpdaterInstanceForTesting,
  setupAutoUpdater,
  triggerBackgroundUpdateCheck,
} from './auto-updater.js';

describe('Electron Auto-Updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    electronApp.isPackaged = true;
    updaterMock.reset();
    resetUpdaterInstanceForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not check for updates when the app is not packaged (dev mode)', () => {
    electronApp.isPackaged = false;
    setupAutoUpdater();
    triggerBackgroundUpdateCheck({ force: true });

    expect(updaterMock.checkForUpdates).not.toHaveBeenCalled();
    expect(updaterMock.on).not.toHaveBeenCalled();
  });

  it('properly configures autoUpdater options in packaged builds', () => {
    setupAutoUpdater();

    expect(updaterMock.autoDownload).toBe(true);
    expect(updaterMock.autoInstallOnAppQuit).toBe(true);
    expect(updaterMock.allowPrerelease).toBe(false);
    expect(updaterMock.allowDowngrade).toBe(false);
    expect(updaterMock.logger).toBeDefined();
    expect(updaterMock.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
    expect(updaterMock.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    expect(updaterMock.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
    expect(updaterMock.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
    expect(updaterMock.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('throttles background update checks within the 5-minute interval unless forced', async () => {
    triggerBackgroundUpdateCheck();
    await Promise.resolve();
    expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1);

    // Call again immediately without force
    triggerBackgroundUpdateCheck();
    await Promise.resolve();
    expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1);

    // Call with force: true
    triggerBackgroundUpdateCheck({ force: true });
    await Promise.resolve();
    expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(2);

    // Advance timer past 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    triggerBackgroundUpdateCheck();
    await Promise.resolve();
    expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it('handles update check failures silently without throwing uncaught exceptions', async () => {
    updaterMock.checkForUpdates.mockRejectedValueOnce(new Error('GitHub API rate limited'));

    expect(() => triggerBackgroundUpdateCheck({ force: true })).not.toThrow();
    await Promise.resolve();
  });

  it('notifies when an update is downloaded and installs immediately on click', () => {
    setupAutoUpdater({ canInstallNow: () => false });

    updaterMock.emit('update-downloaded', { version: '0.1.7' });

    expect(notificationSpy.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'PH-Ponto - Atualização pronta',
        body: expect.stringContaining('0.1.7'),
      }),
    );
    expect(notificationSpy.instance.show).toHaveBeenCalled();
    expect(updaterMock.quitAndInstall).not.toHaveBeenCalled();

    const clickHandler = notificationSpy.instance.on.mock.calls.find(
      ([event]) => event === 'click',
    )?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    expect(updaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('installs silently and relaunches as soon as the app is idle', () => {
    let busy = true;
    setupAutoUpdater({ canInstallNow: () => !busy });

    updaterMock.emit('update-downloaded', { version: '0.1.7' });
    expect(updaterMock.quitAndInstall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS * 3);
    expect(updaterMock.quitAndInstall).not.toHaveBeenCalled();

    busy = false;
    vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS);
    expect(updaterMock.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(updaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);

    // Never triggers a second installation.
    vi.advanceTimersByTime(INSTALL_POLL_INTERVAL_MS * 5);
    expect(updaterMock.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('installs right away when the update finishes while the app sits in the tray', () => {
    setupAutoUpdater({ canInstallNow: () => true });
    updaterMock.emit('update-downloaded', { version: '0.1.7' });
    expect(updaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('treats a hidden window or a long-idle machine as a safe moment to install', () => {
    expect(isSafeMomentToInstall(false, 0)).toBe(true);
    expect(isSafeMomentToInstall(true, 10)).toBe(false);
    expect(isSafeMomentToInstall(true, IDLE_SECONDS_BEFORE_INSTALL)).toBe(true);
  });

  it('safely obtains updater instance through getUpdater', () => {
    const updater = getUpdater();
    expect(updater).toBe(updaterMock);
  });

  describe('status shown on the login screen', () => {
    it('reports the whole lifecycle: checking, downloading with progress and ready', () => {
      const seen: string[] = [];
      onUpdateStatus((status) => seen.push(`${status.state}:${status.percent ?? '-'}`));
      setupAutoUpdater({ canInstallNow: () => false });

      expect(getUpdateStatus()).toMatchObject({ state: 'idle', currentVersion: '0.1.8' });
      updaterMock.emit('checking-for-update');
      updaterMock.emit('update-available', { version: '0.1.9' });
      updaterMock.emit('download-progress', { percent: 41.7 });
      updaterMock.emit('download-progress', { percent: 41.9 });
      updaterMock.emit('update-downloaded', { version: '0.1.9' });

      expect(seen).toEqual(['checking:-', 'downloading:0', 'downloading:41', 'ready:100']);
      expect(getUpdateStatus()).toMatchObject({ state: 'ready', availableVersion: '0.1.9' });

      // A later periodic check must not hide the ready update.
      updaterMock.emit('checking-for-update');
      updaterMock.emit('error', new Error('offline'));
      expect(getUpdateStatus().state).toBe('ready');
    });

    it('marks the app as up to date with the time of the check', () => {
      setupAutoUpdater();
      updaterMock.emit('checking-for-update');
      updaterMock.emit('update-not-available', { version: '0.1.8' });
      expect(getUpdateStatus().state).toBe('up-to-date');
      expect(getUpdateStatus().lastCheckedAt).not.toBeNull();
    });

    it('shows an error and retries sooner than the regular cycle', async () => {
      setupAutoUpdater();
      vi.advanceTimersByTime(15_000); // startup check
      await Promise.resolve();
      updaterMock.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));
      expect(getUpdateStatus().state).toBe('error');

      updaterMock.checkForUpdates.mockClear();
      vi.advanceTimersByTime(RETRY_AFTER_ERROR_MS);
      await Promise.resolve();
      expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('asks for a manual download when macOS refuses an unsigned update', () => {
      expect(
        isUnsupportedPlatformError(
          'darwin',
          'Could not get code signature for running application',
        ),
      ).toBe(true);
      expect(isUnsupportedPlatformError('win32', 'Could not get code signature')).toBe(false);
      expect(isUnsupportedPlatformError('darwin', 'net::ERR_TIMED_OUT')).toBe(false);
    });

    it('installs on demand only when an update is ready', () => {
      setupAutoUpdater({ canInstallNow: () => false });
      expect(installUpdateNow()).toBe(false);
      expect(updaterMock.quitAndInstall).not.toHaveBeenCalled();

      updaterMock.emit('update-downloaded', { version: '0.1.9' });
      expect(installUpdateNow()).toBe(true);
      expect(updaterMock.quitAndInstall).toHaveBeenCalledWith(true, true);
      expect(getUpdateStatus().state).toBe('installing');
    });

    it('lets the screen force a check, ignoring repeated clicks', async () => {
      setupAutoUpdater();
      checkForUpdatesNow();
      checkForUpdatesNow();
      await Promise.resolve();
      expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(MANUAL_CHECK_THROTTLE_MS + 1);
      checkForUpdatesNow();
      await Promise.resolve();
      expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(2);
    });

    it('checks again after the computer wakes up', async () => {
      let resume: (() => void) | undefined;
      setupAutoUpdater({ onResume: (callback) => (resume = callback) });
      expect(resume).toBeDefined();
      resume?.();
      vi.advanceTimersByTime(20_000);
      await Promise.resolve();
      expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('remembers the launched version to announce a completed update', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ph-ponto-version-'));
      const marker = join(dir, 'last-version.json');

      expect(recordLaunchedVersion(marker, '0.1.8')).toBeNull();
      expect(recordLaunchedVersion(marker, '0.1.8')).toBeNull();
      expect(getUpdateStatus().updatedFrom).toBeNull();

      writeFileSync(marker, JSON.stringify({ version: '0.1.7' }));
      expect(recordLaunchedVersion(marker, '0.1.8')).toBe('0.1.7');
      expect(getUpdateStatus().updatedFrom).toBe('0.1.7');
      expect(JSON.parse(readFileSync(marker, 'utf8'))).toEqual({ version: '0.1.8' });
    });

    it('reports development builds as disabled', () => {
      electronApp.isPackaged = false;
      resetUpdaterInstanceForTesting();
      expect(getUpdateStatus().state).toBe('disabled');
    });
  });
});
