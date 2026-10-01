import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DocumentsHubPage } from './documents-hub-page.js';

describe('DocumentsHubPage', () => {
  it('renders all document categories, report shortcut, and templates', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentsHubPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Central de Documentos e Relatórios')).toBeInTheDocument();
    expect(screen.getByText('Espelho de Ponto Individual')).toBeInTheDocument();
    expect(screen.getByText('Regimento Interno de Trabalho')).toBeInTheDocument();
    expect(screen.getByText('Quadro de Cultura Organizacional')).toBeInTheDocument();
    expect(screen.getByText('Registro de Advertência Verbal')).toBeInTheDocument();
    expect(screen.getByText('Avaliação de Desempenho e Competências')).toBeInTheDocument();

    // Filter by Medidas Disciplinares
    const disciplinaTab = screen.getByRole('button', { name: /Medidas Disciplinares/i });
    await user.click(disciplinaTab);

    expect(screen.getByText('Registro de Advertência Verbal')).toBeInTheDocument();
    expect(screen.getByText('Aplicação de Advertência Escrita')).toBeInTheDocument();
    expect(screen.getByText('Aplicação de Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.queryByText('Regimento Interno de Trabalho')).not.toBeInTheDocument();
    expect(screen.queryByText('Espelho de Ponto Individual')).not.toBeInTheDocument();

    // Filter by Ponto & Relatórios
    const pontoTab = screen.getByRole('button', { name: /Ponto & Relatórios/i });
    await user.click(pontoTab);

    expect(screen.getByText('Espelho de Ponto Individual')).toBeInTheDocument();
    expect(screen.queryByText('Registro de Advertência Verbal')).not.toBeInTheDocument();
  });

  it('filters templates via live search query', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentsHubPage />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText('Buscar modelo de documento ou relatório...');
    await user.type(searchInput, 'suspensão');

    expect(screen.getByText('Aplicação de Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.queryByText('Regimento Interno de Trabalho')).not.toBeInTheDocument();
    expect(screen.queryByText('Espelho de Ponto Individual')).not.toBeInTheDocument();
  });
});
