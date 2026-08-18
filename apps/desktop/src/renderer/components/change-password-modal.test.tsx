import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/auth-context.js';
import { ChangePasswordModal } from './change-password-modal.js';
import { ToastProvider } from './toast-context.js';
import { createBridge, employeeSession, jsonResponse } from '../test/fixtures.js';

function installBridge(session = employeeSession): void {
  const bridge = createBridge(session);
  Object.defineProperty(window, 'phPonto', { configurable: true, value: bridge });
}

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    installBridge();
  });

  it('renders modal fields and handles successful password change', async () => {
    const handleClose = vi.fn();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/users/me/change-password')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordModal isOpen={true} onClose={handleClose} />);

    expect(await screen.findByRole('heading', { name: 'Alterar Minha Senha' })).toBeVisible();

    const currentInput = screen.getByPlaceholderText('Digite sua senha atual');
    const newInput = screen.getByPlaceholderText('Mínimo de 8 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repita a nova senha');
    const submitButton = screen.getByRole('button', { name: 'Salvar Nova Senha' });

    expect(submitButton).toBeDisabled();

    await user.type(currentInput, 'senha-antiga');
    await user.type(newInput, 'nova-senha-segura');
    await user.type(confirmInput, 'nova-senha-segura');

    expect(submitButton).not.toBeDisabled();
    await user.click(submitButton);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/users/me/change-password' }),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'senha-antiga',
          newPassword: 'nova-senha-segura',
        }),
      }),
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('displays error when backend rejects the current password', async () => {
    const handleClose = vi.fn();
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/users/me/change-password')) {
        return Promise.resolve(
          jsonResponse(
            {
              status: 400,
              code: 'INVALID_CURRENT_PASSWORD',
              message: 'A senha atual informada está incorreta.',
              requestId: 'req-123',
              timestamp: '2026-08-16T19:00:00.000Z',
            },
            400,
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordModal isOpen={true} onClose={handleClose} />);

    expect(await screen.findByRole('heading', { name: 'Alterar Minha Senha' })).toBeVisible();

    const currentInput = screen.getByPlaceholderText('Digite sua senha atual');
    const newInput = screen.getByPlaceholderText('Mínimo de 8 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repita a nova senha');
    const submitButton = screen.getByRole('button', { name: 'Salvar Nova Senha' });

    await user.type(currentInput, 'senha-errada');
    await user.type(newInput, 'nova-senha-segura');
    await user.type(confirmInput, 'nova-senha-segura');

    await user.click(submitButton);

    expect(await screen.findByText('A senha atual informada está incorreta.')).toBeVisible();
    expect(handleClose).not.toHaveBeenCalled();
  });
});
