import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { printPdfBlob } from '../lib/pdf.js';
import { DocumentPreviewDialog } from './document-preview-dialog.js';
import { ToastProvider } from './toast-context.js';

function renderDialog(onConfirm: () => Promise<unknown>, pdf: Blob | null = new Blob(['%PDF'])) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <DocumentPreviewDialog
        isOpen
        title="Advertência Escrita — Diego Pereira"
        description="Confira a medida antes de emiti-la."
        pdf={pdf}
        confirmLabel="Emitir Medida"
        isConfirming={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ToastProvider>,
  );
  return { onClose };
}

describe('DocumentPreviewDialog', () => {
  it('only shows the preview until the administrator saves or prints', async () => {
    const onConfirm = vi.fn().mockResolvedValue({});
    renderDialog(onConfirm);

    expect(
      screen.getByRole('dialog', { name: 'Advertência Escrita — Diego Pereira' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 páginas')).toBeInTheDocument();
    expect(screen.getByText(/Esta é só uma prévia/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('saves the PDF in the archive before opening the print dialog', async () => {
    const order: string[] = [];
    const onConfirm = vi.fn(async () => {
      order.push('saved');
    });
    vi.mocked(printPdfBlob).mockImplementationOnce(async () => {
      order.push('printed');
    });
    const user = userEvent.setup();
    renderDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Imprimir e Salvar' }));

    await waitFor(() => expect(order).toEqual(['saved', 'printed']));
  });

  it('does not print when saving fails', async () => {
    vi.mocked(printPdfBlob).mockClear();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Revisão alterada'));
    const user = userEvent.setup();
    renderDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Imprimir e Salvar' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(printPdfBlob).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Imprimir e Salvar' })).toBeEnabled();
  });

  it('can save without printing', async () => {
    vi.mocked(printPdfBlob).mockClear();
    const onConfirm = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: 'Emitir Medida' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(printPdfBlob).not.toHaveBeenCalled();
  });

  it('waits for the PDF before enabling actions and closes with Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(vi.fn(), null);
    expect(screen.getByRole('button', { name: 'Emitir Medida' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Imprimir e Salvar' })).toBeDisabled();
    expect(screen.getByText('Carregando documento...')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
