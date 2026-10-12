import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ElectronApi, UpdateStatus } from '../../shared/electron-api.js';
import { createBridge } from '../test/fixtures.js';
import { AppVersionBadge } from './app-version-badge.js';

function status(overrides: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    state: 'up-to-date',
    currentVersion: '0.1.8',
    availableVersion: null,
    percent: null,
    lastCheckedAt: '2026-10-12T13:30:00.000Z',
    updatedFrom: null,
    ...overrides,
  };
}

function installBridge(initial: UpdateStatus) {
  let push: ((next: UpdateStatus) => void) | undefined;
  const updates = {
    getStatus: vi.fn(async () => initial),
    onStatus: vi.fn((listener: (next: UpdateStatus) => void) => {
      push = listener;
      return () => {
        push = undefined;
      };
    }),
    checkNow: vi.fn(async () => initial),
    installNow: vi.fn(async () => undefined),
    openDownloadPage: vi.fn(async () => undefined),
  };
  const bridge: ElectronApi = { ...createBridge(null), updates };
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
  return { updates, push: (next: UpdateStatus) => act(() => push?.(next)) };
}

describe('AppVersionBadge', () => {
  afterEach(() => {
    Object.defineProperty(window, 'phPonto', { configurable: true, value: undefined });
  });

  it('shows the installed version and that it is up to date', async () => {
    const { updates } = installBridge(status());
    const user = userEvent.setup();
    render(<AppVersionBadge />);

    const badge = await screen.findByRole('status');
    expect(badge).toHaveTextContent('PH-Ponto v0.1.8');
    expect(badge).toHaveTextContent('Atualizado');
    expect(badge).toHaveAttribute('title', 'Última verificação às 10:30.');

    await user.click(screen.getByRole('button', { name: 'Verificar atualizações agora' }));
    expect(updates.checkNow).toHaveBeenCalledTimes(1);
  });

  it('follows the download live and offers to install when ready', async () => {
    const { updates, push } = installBridge(status({ state: 'checking' }));
    const user = userEvent.setup();
    render(<AppVersionBadge />);
    expect(await screen.findByText('Verificando atualizações…')).toBeInTheDocument();

    push(status({ state: 'downloading', availableVersion: '0.1.9', percent: 45 }));
    expect(screen.getByText('Baixando v0.1.9 · 45%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Download da atualização' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );

    push(status({ state: 'ready', availableVersion: '0.1.9', percent: 100 }));
    expect(screen.getByText('v0.1.9 pronta para instalar')).toBeInTheDocument();
    expect(screen.getByText(/instalada sozinha/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    expect(updates.installNow).toHaveBeenCalledTimes(1);
  });

  it('announces a completed update', async () => {
    installBridge(status({ updatedFrom: '0.1.7' }));
    render(<AppVersionBadge />);
    expect(await screen.findByText('Atualizado agora (antes v0.1.7)')).toBeInTheDocument();
  });

  it('lets the user retry after a failed check', async () => {
    const { updates } = installBridge(status({ state: 'error' }));
    const user = userEvent.setup();
    render(<AppVersionBadge />);
    expect(await screen.findByText('Falha ao verificar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(updates.checkNow).toHaveBeenCalledTimes(1);
  });

  it('points to the download page when the computer cannot update by itself', async () => {
    const { updates } = installBridge(status({ state: 'manual' }));
    const user = userEvent.setup();
    render(<AppVersionBadge />);
    await user.click(await screen.findByRole('button', { name: 'Baixar' }));
    expect(updates.openDownloadPage).toHaveBeenCalledTimes(1);
  });

  it('still shows the version with an older desktop bridge', async () => {
    Object.defineProperty(window, 'phPonto', { configurable: true, value: createBridge(null) });
    render(<AppVersionBadge />);
    expect(await screen.findByRole('status')).toHaveTextContent('PH-Ponto v0.1.0');
  });

  it('renders nothing on the web', () => {
    const { container } = render(<AppVersionBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
