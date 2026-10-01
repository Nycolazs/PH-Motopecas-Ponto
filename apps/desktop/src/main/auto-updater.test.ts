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

import {
  getUpdater,
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

  it('displays a native notification on update-downloaded and restarts on click', () => {
    setupAutoUpdater();

    // Trigger update-downloaded event
    updaterMock.emit('update-downloaded', { version: '0.1.7' });

    expect(notificationSpy.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'PH-Ponto - Atualização Disponível',
        body: expect.stringContaining('0.1.7'),
      }),
    );
    expect(notificationSpy.instance.show).toHaveBeenCalled();

    // Trigger click on notification
    const clickHandler = notificationSpy.instance.on.mock.calls.find(
      ([event]) => event === 'click',
    )?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    expect(updaterMock.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('safely obtains updater instance through getUpdater', () => {
    const updater = getUpdater();
    expect(updater).toBe(updaterMock);
  });
});
