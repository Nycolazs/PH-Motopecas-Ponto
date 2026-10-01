import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectInput } from './select-input.js';

describe('SelectInput Component', () => {
  const options = [
    { value: '1', label: 'Carlos Silva', sublabel: '@carlos.silva' },
    { value: '2', label: 'Diego Dantas', sublabel: '@diego' },
    { value: '3', label: 'Emanuel Farias', sublabel: '@emanuel', disabled: true },
  ];

  it('renders with label and placeholder', () => {
    render(
      <SelectInput
        label="Colaborador"
        required
        placeholder="Selecione um colaborador..."
        value=""
        onChange={vi.fn()}
        options={options}
      />,
    );

    expect(screen.getByText('Colaborador')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Selecione um colaborador...')).toBeInTheDocument();
  });

  it('opens options list on click and selects an item', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SelectInput
        label="Colaborador"
        placeholder="Selecione..."
        value=""
        onChange={handleChange}
        options={options}
      />,
    );

    const combobox = screen.getByRole('combobox', { name: /Colaborador/i });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    const optionItem = screen.getByRole('option', { name: /Diego Dantas/i });
    await user.click(optionItem);

    expect(handleChange).toHaveBeenCalledWith('2');
  });

  it('displays selected option label and sublabel', () => {
    render(<SelectInput label="Colaborador" value="1" onChange={vi.fn()} options={options} />);

    expect(screen.getByText('Carlos Silva')).toBeInTheDocument();
    expect(screen.getByText('@carlos.silva')).toBeInTheDocument();
  });

  it('filters options with searchable input', async () => {
    const user = userEvent.setup();

    render(
      <SelectInput label="Colaborador" value="" onChange={vi.fn()} options={options} searchable />,
    );

    await user.click(screen.getByRole('combobox'));
    const searchInput = screen.getByPlaceholderText('Buscar...');
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, 'diego');
    expect(screen.getByText('Diego Dantas')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Silva')).not.toBeInTheDocument();
  });

  it('clears selection when clear button is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SelectInput
        label="Colaborador"
        value="2"
        onChange={handleChange}
        options={options}
        clearable
      />,
    );

    const clearBtn = screen.getByTitle('Limpar seleção');
    await user.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();

    render(<SelectInput label="Colaborador" value="" onChange={vi.fn()} options={options} />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('respects disabled prop on component and individual options', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<SelectInput label="Colaborador" value="" onChange={handleChange} options={options} />);

    await user.click(screen.getByRole('combobox'));
    const disabledOption = screen.getByRole('option', { name: /Emanuel Farias/i });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');

    await user.click(disabledOption);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
