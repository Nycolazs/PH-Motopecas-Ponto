import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

function MockLayout(): React.JSX.Element {
  return (
    <div>
      <nav>
        <NavLink to="/">Início</NavLink>
        <NavLink to="/gestao">Gestão</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function MockTabComponent(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');

  return (
    <div>
      <button type="button" onClick={() => setActiveTab('A')}>
        Aba A
      </button>
      <button type="button" onClick={() => setActiveTab('B')}>
        Aba B
      </button>

      {activeTab === 'A' && (
        <div key="A" className="tab-transition" data-testid="tab-a">
          Conteúdo Aba A
        </div>
      )}
      {activeTab === 'B' && (
        <div key="B" className="tab-transition" data-testid="tab-b">
          Conteúdo Aba B
        </div>
      )}
    </div>
  );
}

describe('Page and Tab Transitions', () => {
  it('renders page transition classes when navigating between screens', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MockLayout />}>
            <Route
              index
              element={
                <div key="/" className="page-transition" data-testid="page-home">
                  Tela Inicial
                </div>
              }
            />
            <Route
              path="gestao"
              element={
                <div key="/gestao" className="page-transition" data-testid="page-gestao">
                  Tela de Gestão
                </div>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const homePage = screen.getByTestId('page-home');
    expect(homePage).toBeInTheDocument();
    expect(homePage).toHaveClass('page-transition');

    await user.click(screen.getByRole('link', { name: 'Gestão' }));

    const gestaoPage = await screen.findByTestId('page-gestao');
    expect(gestaoPage).toBeInTheDocument();
    expect(gestaoPage).toHaveClass('page-transition');
  });

  it('renders tab transition classes when switching internal tabs', async () => {
    const user = userEvent.setup();

    render(<MockTabComponent />);

    const tabA = screen.getByTestId('tab-a');
    expect(tabA).toBeInTheDocument();
    expect(tabA).toHaveClass('tab-transition');

    await user.click(screen.getByRole('button', { name: 'Aba B' }));

    const tabB = await screen.findByTestId('tab-b');
    expect(tabB).toBeInTheDocument();
    expect(tabB).toHaveClass('tab-transition');
    expect(screen.queryByTestId('tab-a')).not.toBeInTheDocument();
  });
});
