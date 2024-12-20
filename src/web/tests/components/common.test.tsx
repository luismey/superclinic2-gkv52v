import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.4.3
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7.0
import '@testing-library/jest-dom/extend-expect'; // v5.16.5

import Button from '../../src/components/common/Button';
import Input from '../../src/components/common/Input';
import Select from '../../src/components/common/Select';
import { COLORS, SPACING } from '../../src/constants/ui';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock functions
const mockOnClick = jest.fn();
const mockOnChange = jest.fn();
const mockOnBlur = jest.fn();

// Test data
const selectOptions = [
  { value: 'option1', label: 'Opção 1' },
  { value: 'option2', label: 'Opção 2' },
];

describe('Button Component', () => {
  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <Button onClick={mockOnClick}>Clique aqui</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders all variants correctly', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost'] as const;
    variants.forEach(variant => {
      const { getByRole } = render(
        <Button variant={variant} onClick={mockOnClick}>
          Botão {variant}
        </Button>
      );
      const button = getByRole('button');
      expect(button).toHaveClass(`bg-${variant}`);
      expect(button).toBeInTheDocument();
    });
  });

  it('handles size variations with proper touch targets', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach(size => {
      const { getByRole } = render(
        <Button size={size} onClick={mockOnClick}>
          Botão {size}
        </Button>
      );
      const button = getByRole('button');
      const styles = window.getComputedStyle(button);
      const minHeight = parseInt(styles.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(SPACING.touch.minimum);
    });
  });

  it('handles disabled state correctly', () => {
    render(
      <Button disabled onClick={mockOnClick}>
        Botão Desativado
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('shows loading state with spinner', () => {
    render(
      <Button loading onClick={mockOnClick}>
        Carregando
      </Button>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});

describe('Input Component', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnBlur.mockClear();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <Input
        id="test-input"
        name="test"
        label="Campo de teste"
        value=""
        onChange={mockOnChange}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates Brazilian CPF format', async () => {
    const { getByLabelText } = render(
      <Input
        id="cpf"
        name="cpf"
        label="CPF"
        value=""
        pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
        onChange={mockOnChange}
      />
    );
    
    const input = getByLabelText('CPF');
    await userEvent.type(input, '123.456.789-00');
    expect(input).toHaveValue('123.456.789-00');
    
    await userEvent.type(input, 'invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('CPF inválido');
  });

  it('validates Brazilian phone number format', async () => {
    const { getByLabelText } = render(
      <Input
        id="phone"
        name="phone"
        label="Telefone"
        value=""
        pattern="\([1-9]{2}\) (?:[2-8]|9[1-9])[0-9]{3}-[0-9]{4}"
        onChange={mockOnChange}
      />
    );
    
    const input = getByLabelText('Telefone');
    await userEvent.type(input, '(11) 98765-4321');
    expect(input).toHaveValue('(11) 98765-4321');
  });

  it('handles required field validation', async () => {
    render(
      <Input
        id="required-field"
        name="required"
        label="Campo obrigatório"
        value=""
        required
        onChange={mockOnChange}
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    });
  });
});

describe('Select Component', () => {
  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnBlur.mockClear();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <Select
        name="test-select"
        label="Selecione uma opção"
        options={selectOptions}
        value=""
        onChange={mockOnChange}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles keyboard navigation correctly', async () => {
    render(
      <Select
        name="test-select"
        label="Selecione uma opção"
        options={selectOptions}
        value=""
        onChange={mockOnChange}
      />
    );
    
    const select = screen.getByRole('combobox');
    select.focus();
    
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    expect(select).toHaveFocus();
    
    fireEvent.keyDown(select, { key: 'Enter' });
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('displays options in Portuguese', () => {
    render(
      <Select
        name="test-select"
        label="Selecione uma opção"
        options={selectOptions}
        value=""
        onChange={mockOnChange}
      />
    );
    
    selectOptions.forEach(option => {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    });
  });

  it('handles required field validation', async () => {
    render(
      <Select
        name="required-select"
        label="Seleção obrigatória"
        options={selectOptions}
        value=""
        required
        onChange={mockOnChange}
      />
    );
    
    const select = screen.getByRole('combobox');
    fireEvent.blur(select);
    
    await waitFor(() => {
      expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    });
  });
});

// Theme support tests
describe('Theme Support', () => {
  it('applies dark mode styles correctly', () => {
    document.documentElement.classList.add('dark');
    
    const { getByRole } = render(
      <Button variant="primary" onClick={mockOnClick}>
        Dark Mode Button
      </Button>
    );
    
    const button = getByRole('button');
    expect(button).toHaveClass('dark:bg-primary-500');
    
    document.documentElement.classList.remove('dark');
  });
});