import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DocumentsHubPage } from './documents-hub-page.js';

function renderHub(): void {
  render(
    <MemoryRouter>
      <DocumentsHubPage />
    </MemoryRouter>,
  );
}

describe('DocumentsHubPage', () => {
  it('groups every document by subject with a clear action link', () => {
    renderHub();

    expect(screen.getByRole('heading', { name: 'Documentos & RH' })).toBeInTheDocument();
    const discipline = screen.getByRole('region', { name: 'Medidas disciplinares' });
    expect(within(discipline).getByText('Advertência Verbal')).toBeInTheDocument();
    expect(within(discipline).getByText('Advertência Escrita')).toBeInTheDocument();
    expect(within(discipline).getByText('Suspensão Disciplinar')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Regimento Interno/ })).toHaveAttribute(
      'href',
      '/admin/documentos/regimento',
    );
    expect(screen.getByRole('link', { name: /Espelho de Ponto/ })).toHaveAttribute(
      'href',
      '/admin/relatorios',
    );
    expect(screen.getByRole('link', { name: /Documentos emitidos/ })).toHaveAttribute(
      'href',
      '/admin/documentos',
    );
  });

  it('filters documents with accent-insensitive search and hides empty sections', async () => {
    const user = userEvent.setup();
    renderHub();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar documento' }), 'suspensao');

    expect(screen.getByText('Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.queryByText('Regimento Interno')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Empresa e regras' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar documento' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar documento' }), 'xyz');
    expect(screen.getByText(/Nenhum documento encontrado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos os documentos' }));
    expect(screen.getByText('Regimento Interno')).toBeInTheDocument();
  });
});
