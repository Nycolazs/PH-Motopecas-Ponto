import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/auth-context.js';
import { useAuth } from '../auth/use-auth.js';
import { adminSession, createBridge, jsonResponse } from '../test/fixtures.js';
import { AbsenceJustificationModal, addDaysToBusinessDate } from './absence-justification-modal.js';
import { AbsenceJustificationsCard } from './absence-justifications-card.js';
import { ToastProvider } from './toast-context.js';

const EMPLOYEE = { id: '6959a6b9-8d98-48db-be01-8a1d7b8ab75f', name: 'MARIANA COSTA LIMA' };
const ADMIN = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Gestora', login: 'gestora' };

function justification(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    employee: { id: EMPLOYEE.id, name: EMPLOYEE.name, login: 'mariana.costa' },
    kind: 'MEDICAL_CERTIFICATE',
    startDate: '2026-10-27',
    endDate: '2026-10-28',
    daysCount: 2,
    reason: 'Atestado da Dra. Ana, CRM 123',
    createdBy: ADMIN,
    createdAt: '2026-10-28T12:00:00.000Z',
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    attachments: [],
    ...overrides,
  };
}

type Call = { url: string; method: string; body: unknown };

function installFetch(handler: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const call = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

function Gate({ children }: { children: React.ReactNode }) {
  return useAuth().session ? <>{children}</> : null;
}

function renderWithProviders(ui: React.ReactNode) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ToastProvider>
        <AuthProvider>
          <Gate>{ui}</Gate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('abono e atestado', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: createBridge(adminSession),
    });
  });

  it('computes the covered period across months', () => {
    expect(addDaysToBusinessDate('2026-10-30', 0)).toBe('2026-10-30');
    expect(addDaysToBusinessDate('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('abona one day with a reason', async () => {
    const calls = installFetch((call) =>
      call.method === 'POST'
        ? jsonResponse(
            justification({
              kind: 'ALLOWANCE',
              startDate: '2026-10-29',
              endDate: '2026-10-29',
              daysCount: 1,
            }),
            201,
          )
        : jsonResponse({}),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AbsenceJustificationModal
        isOpen
        onClose={onClose}
        employee={EMPLOYEE}
        initialDate="2026-10-29"
      />,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Justificar falta — Mariana Costa Lima',
    });
    expect(within(dialog).getByRole('radio', { name: /Abono/ })).toBeChecked();
    expect(within(dialog).queryByLabelText(/Dias de afastamento/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abonar dia' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Descreva o motivo.');

    await user.type(within(dialog).getByLabelText(/Motivo do abono/), 'Liberado pela gerência');
    await user.click(within(dialog).getByRole('button', { name: 'Abonar dia' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.find((call) => call.method === 'POST')).toMatchObject({
      url: expect.stringContaining('/absence-justifications'),
      body: {
        employeeId: EMPLOYEE.id,
        kind: 'ALLOWANCE',
        startDate: '2026-10-29',
        endDate: '2026-10-29',
        reason: 'Liberado pela gerência',
      },
    });
  });

  it('registers a multi-day atestado and shows API conflicts', async () => {
    installFetch(() =>
      jsonResponse(
        {
          status: 409,
          code: 'JUSTIFICATION_OVERLAP',
          message: 'Já existe um abono em 29/10/2026 para este colaborador.',
          requestId: 'req-1',
          timestamp: '2026-10-30T12:00:00.000Z',
        },
        409,
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <AbsenceJustificationModal
        isOpen
        onClose={vi.fn()}
        employee={EMPLOYEE}
        initialDate="2026-10-28"
      />,
    );

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /Atestado médico/ }));
    const days = within(dialog).getByLabelText(/Dias de afastamento/);
    await user.clear(days);
    await user.type(days, '3');
    expect(
      within(dialog).getByText('Cobre de 28/10/2026 a 30/10/2026 (3 dias).'),
    ).toBeInTheDocument();
    await user.clear(days);
    await user.type(days, '40');
    await user.type(within(dialog).getByLabelText(/Detalhes do atestado/), 'Repouso');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar atestado' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Informe de 1 a 31 dias');

    await user.clear(days);
    await user.type(days, '3');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar atestado' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe um abono em 29/10/2026',
    );
  });

  it('lists justifications and cancels one with a reason', async () => {
    const calls = installFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse(
          justification({
            revokedAt: '2026-10-30T12:00:00.000Z',
            revokedBy: ADMIN,
            revokeReason: 'Lançado errado',
          }),
        );
      }
      return jsonResponse({
        items: [
          justification(),
          justification({
            id: '22222222-2222-4333-8444-555555555555',
            kind: 'ALLOWANCE',
            startDate: '2026-10-02',
            endDate: '2026-10-02',
            daysCount: 1,
            reason: 'Abono antigo',
            revokedAt: '2026-10-03T12:00:00.000Z',
            revokedBy: ADMIN,
            revokeReason: 'Dia trabalhado',
          }),
        ],
      });
    });
    const onJustify = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AbsenceJustificationsCard employee={EMPLOYEE} onJustify={onJustify} />);

    const card = await screen.findByRole('region', { name: 'Abonos e atestados' });
    expect(
      await within(card).findByText('Atestado médico · 27/10/2026 a 28/10/2026 · 2 dias'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Cancelado')).toBeInTheDocument();
    expect(within(card).getByText(/cancelado por Gestora: Dia trabalhado/)).toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: /^Cancelar / })).toHaveLength(1);

    await user.click(within(card).getByRole('button', { name: 'Justificar falta' }));
    expect(onJustify).toHaveBeenCalled();

    await user.click(within(card).getByRole('button', { name: /^Cancelar atestado/ }));
    const confirm = screen.getByRole('dialog', { name: 'Cancelar justificativa' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar justificativa' }));
    expect(within(confirm).getByRole('alert')).toHaveTextContent('Descreva o motivo');
    await user.type(within(confirm).getByLabelText(/Motivo do cancelamento/), 'Lançado errado');
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar justificativa' }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toMatchObject({
        url: expect.stringContaining('/revoke'),
        body: { reason: 'Lançado errado' },
      }),
    );
  });

  it('attaches the photo of the atestado right after registering it', async () => {
    const calls = installFetch((call) =>
      call.url.endsWith('/attachments')
        ? jsonResponse(justification({ attachments: [] }), 201)
        : jsonResponse(justification(), 201),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AbsenceJustificationModal
        isOpen
        onClose={onClose}
        employee={EMPLOYEE}
        initialDate="2026-10-27"
      />,
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByLabelText('Escolher foto ou PDF do atestado'),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByText('Atestado médico', { exact: true }));

    const input = within(dialog).getByLabelText('Escolher foto ou PDF do atestado');
    // A file picker filters by type, but a file can still arrive with another type.
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, new File(['nota'], 'nota.txt', { type: 'text/plain' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('"nota.txt" não é aceito');

    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'IMG_2041.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(input, photo);
    expect(await within(dialog).findByText('IMG_2041.jpg')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Remover IMG_2041.jpg' }),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Detalhes do atestado/), 'Dra. Ana, CRM 123');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar atestado' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.url.replace(/^.*\/absence-justifications/, ''))).toEqual([
      '',
      '/11111111-2222-4333-8444-555555555555/attachments',
    ]);
    expect(posts[1]?.body).toMatchObject({
      fileName: 'IMG_2041.jpg',
      dataBase64: expect.stringMatching(/^data:image\/jpeg;base64,/),
    });
  });

  it('shows the attached files, opens a photo and attaches more later', async () => {
    const attachment = {
      id: '33333333-2222-4333-8444-555555555555',
      fileName: 'atestado.jpg',
      mimeType: 'image/jpeg',
      byteSize: 845_120,
      createdAt: '2026-10-28T12:00:00.000Z',
      uploadedBy: ADMIN,
    };
    const calls = installFetch((call) => {
      if (call.url.includes(`/attachments/${attachment.id}`)) {
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      if (call.method === 'POST')
        return jsonResponse(justification({ attachments: [attachment] }), 201);
      return jsonResponse({ items: [justification({ attachments: [attachment] })] });
    });
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:atestado'),
        revokeObjectURL: vi.fn(),
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AbsenceJustificationsCard employee={EMPLOYEE} onJustify={vi.fn()} />);

    const files = await screen.findByRole('list', { name: 'Arquivos do atestado' });
    expect(within(files).getByRole('button', { name: 'Abrir atestado.jpg' })).toHaveTextContent(
      '825 KB',
    );
    await user.click(within(files).getByRole('button', { name: 'Abrir atestado.jpg' }));
    const viewer = await screen.findByRole('dialog', { name: 'atestado.jpg' });
    expect(
      await within(viewer).findByRole('img', { name: 'Atestado: atestado.jpg' }),
    ).toHaveAttribute('src', 'blob:atestado');
    await user.keyboard('{Escape}');
    expect(viewer).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Anexar arquivo ao atestado/ }));
    await user.upload(
      screen.getByLabelText('Escolher arquivo para anexar ao atestado'),
      new File(['%PDF-1.4'], 'verso.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toMatchObject({
        url: expect.stringContaining('/attachments'),
        body: { fileName: 'verso.pdf', dataBase64: expect.stringContaining('application/pdf') },
      }),
    );
  });
});
