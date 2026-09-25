import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DocumentsHubPage } from './documents-hub-page.js';

describe('DocumentsHubPage', () => {
  it('renders all document categories and templates', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentsHubPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('O que você precisa gerar hoje?')).toBeInTheDocument();
    expect(screen.getByText('Regimento Interno')).toBeInTheDocument();
    expect(screen.getByText('Quadro de Cultura da Empresa')).toBeInTheDocument();
    expect(screen.getByText('Registro de Advertência Verbal')).toBeInTheDocument();
    expect(screen.getByText('Avaliação de Desempenho Periódica')).toBeInTheDocument();

    // Filter by Disciplina
    const disciplinaTab = screen.getByRole('button', { name: /03 Disciplina/i });
    await user.click(disciplinaTab);

    expect(screen.getByText('Registro de Advertência Verbal')).toBeInTheDocument();
    expect(screen.getByText('Advertência Escrita')).toBeInTheDocument();
    expect(screen.getByText('Suspensão Disciplinar')).toBeInTheDocument();
    expect(screen.queryByText('Regimento Interno')).not.toBeInTheDocument();
  });
});
