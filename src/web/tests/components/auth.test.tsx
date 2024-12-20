import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe } from '@axe-core/react';

// Components under test
import LoginForm from '../../src/components/auth/LoginForm';
import RegisterForm from '../../src/components/auth/RegisterForm';
import PasswordResetForm from '../../src/components/auth/PasswordResetForm';

// Mock hooks and services
import { useAuth } from '../../src/hooks/useAuth';

// Mock useAuth hook
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn(),
    register: vi.fn(),
    resetPassword: vi.fn(),
    loading: false,
    error: null
  }))
}));

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}));

// Test setup helper
const setupTest = () => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Mock localStorage for rate limiting tests
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  
  // Mock date for rate limiting tests
  vi.useFakeTimers();
};

describe('LoginForm', () => {
  beforeEach(setupTest);

  it('should render without accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should implement rate limiting after failed attempts', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null
    });

    render(<LoginForm />);

    // Attempt login multiple times
    for (let i = 0; i < 6; i++) {
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/senha/i), 'wrongpassword');
      await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    }

    // Verify rate limiting message
    expect(screen.getByText(/conta temporariamente bloqueada/i)).toBeInTheDocument();
    
    // Verify login button is disabled
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();
  });

  it('should track and validate device fingerprints', async () => {
    const mockLogin = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null
    });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
      deviceInfo: expect.any(Object)
    }));
  });

  it('should handle token rotation correctly', async () => {
    const mockLogin = vi.fn().mockResolvedValue({ user: { id: '1' } });
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null
    });

    render(<LoginForm />);

    // Login
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    // Advance timer to trigger token rotation
    vi.advanceTimersByTime(3600000); // 1 hour

    expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
      tokenRotation: true
    }));
  });
});

describe('RegisterForm', () => {
  beforeEach(setupTest);

  it('should render without accessibility violations', async () => {
    const { container } = render(<RegisterForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should validate healthcare professional credentials', async () => {
    const mockRegister = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      register: mockRegister,
      loading: false,
      error: null
    });

    render(<RegisterForm />);

    // Fill form with invalid CRM
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Dr. Test');
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'Password123!');
    await userEvent.type(screen.getByLabelText(/crm/i), 'invalid-crm');

    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByText(/crm inválido/i)).toBeInTheDocument();
  });

  it('should enforce LGPD compliance requirements', async () => {
    render(<RegisterForm />);

    // Try to submit without LGPD consent
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    expect(screen.getByText(/consentimento lgpd obrigatório/i)).toBeInTheDocument();

    // Check LGPD consent
    await userEvent.click(screen.getByRole('checkbox', { name: /lgpd/i }));
    expect(screen.queryByText(/consentimento lgpd obrigatório/i)).not.toBeInTheDocument();
  });

  it('should validate Brazilian Portuguese input formats', async () => {
    render(<RegisterForm />);

    // Test CPF validation
    await userEvent.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
    expect(screen.getByText(/cpf inválido/i)).toBeInTheDocument();

    // Test phone number validation
    await userEvent.type(screen.getByLabelText(/telefone/i), '(11) 99999-9999');
    expect(screen.queryByText(/telefone inválido/i)).not.toBeInTheDocument();
  });
});

describe('PasswordResetForm', () => {
  beforeEach(setupTest);

  it('should render without accessibility violations', async () => {
    const { container } = render(<PasswordResetForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should implement rate limiting for password reset attempts', async () => {
    const mockResetPassword = vi.fn().mockRejectedValue(new Error('Reset failed'));
    vi.mocked(useAuth).mockReturnValue({
      resetPassword: mockResetPassword,
      loading: false,
      error: null
    });

    render(<PasswordResetForm />);

    // Attempt password reset multiple times
    for (let i = 0; i < 4; i++) {
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));
    }

    expect(screen.getByText(/muitas tentativas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redefinir senha/i })).toBeDisabled();
  });

  it('should validate email format with Brazilian standards', async () => {
    render(<PasswordResetForm />);

    // Test invalid email format
    await userEvent.type(screen.getByLabelText(/email/i), 'invalid-email');
    await userEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.getByText(/email inválido/i)).toBeInTheDocument();

    // Test valid email format
    await userEvent.clear(screen.getByLabelText(/email/i));
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com.br');
    await userEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.queryByText(/email inválido/i)).not.toBeInTheDocument();
  });
});