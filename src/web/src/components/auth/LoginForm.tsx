import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import Input from '../common/Input';
import Button from '../common/Button';

// Login form schema with enhanced validation
const loginSchema = z.object({
  email: z
    .string()
    .email('E-mail inválido')
    .min(1, 'E-mail é obrigatório'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'
    ),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Check for existing lockout
  useEffect(() => {
    const storedLockout = localStorage.getItem('loginLockout');
    if (storedLockout) {
      const lockoutTime = new Date(storedLockout);
      if (lockoutTime > new Date()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('loginLockout');
      }
    }
  }, []);

  // Handle form submission with rate limiting
  const onSubmit = async (data: LoginFormData) => {
    try {
      // Check for lockout
      if (lockoutUntil && lockoutUntil > new Date()) {
        const remainingTime = Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000 / 60);
        setError('root', {
          message: `Conta temporariamente bloqueada. Tente novamente em ${remainingTime} minutos.`,
        });
        return;
      }

      // Attempt login
      await login({
        email: data.email,
        password: data.password,
        remember_me: data.rememberMe,
      });

      // Reset attempt count on success
      setAttemptCount(0);
      localStorage.removeItem('loginLockout');

      // Redirect to dashboard
      router.push('/dashboard');

    } catch (error) {
      // Increment attempt count
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      // Implement lockout if max attempts exceeded
      if (newAttemptCount >= MAX_ATTEMPTS) {
        const lockoutTime = new Date(Date.now() + LOCKOUT_DURATION);
        setLockoutUntil(lockoutTime);
        localStorage.setItem('loginLockout', lockoutTime.toISOString());
        setError('root', {
          message: 'Número máximo de tentativas excedido. Conta temporariamente bloqueada.',
        });
      }
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className="flex flex-col space-y-4 w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md"
      noValidate
    >
      <div className="space-y-6">
        <Input
          id="email"
          name="email"
          type="email"
          label="E-mail"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
          autoComplete="email"
          inputMode="email"
          required
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Senha"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
          autoComplete="current-password"
          required
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            {...register('rememberMe')}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Lembrar-me
          </span>
        </label>

        <a
          href="/forgot-password"
          className="text-primary-600 text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Esqueceu a senha?
        </a>
      </div>

      {(error || errors.root) && (
        <div className="text-red-500 text-sm mt-2 font-medium" role="alert">
          {error || errors.root?.message}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={loading}
        disabled={loading || (lockoutUntil && lockoutUntil > new Date())}
      >
        Entrar
      </Button>

      <p className="text-gray-600 dark:text-gray-400 text-xs mt-4 text-center">
        Ao fazer login, você concorda com nossa{' '}
        <a href="/privacy" className="text-primary-600 hover:underline">
          Política de Privacidade
        </a>{' '}
        e{' '}
        <a href="/terms" className="text-primary-600 hover:underline">
          Termos de Uso
        </a>
        .
      </p>
    </form>
  );
};

export default LoginForm;