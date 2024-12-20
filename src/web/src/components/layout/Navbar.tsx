import React, { useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { useAuth } from '../../hooks/useAuth';

// Navigation items with proper ARIA labels
const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', ariaLabel: 'Ir para Dashboard' },
  { label: 'Chats', href: '/chats', ariaLabel: 'Gerenciar conversas' },
  { label: 'Campanhas', href: '/campaigns', ariaLabel: 'Gerenciar campanhas' },
  { label: 'Analytics', href: '/analytics', ariaLabel: 'Ver análises' },
] as const;

interface NavbarProps {
  className?: string;
  testId?: string;
}

const Navbar: React.FC<NavbarProps> = memo(({ className, testId }) => {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // Handle logout with loading state
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, [logout, router]);

  // User menu options with proper ARIA labels
  const userMenuOptions = [
    { value: 'profile', label: 'Perfil', ariaLabel: 'Acessar perfil' },
    { value: 'settings', label: 'Configurações', ariaLabel: 'Acessar configurações' },
    { value: 'logout', label: 'Sair', ariaLabel: 'Fazer logout' },
  ];

  // Render mobile menu with animations
  const renderMobileMenu = memo(() => (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="md:hidden fixed inset-x-0 top-16 bg-white dark:bg-gray-800 shadow-lg"
      role="navigation"
      aria-label="Menu de navegação móvel"
    >
      <div className="px-4 py-2 space-y-1">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'block px-4 py-2 rounded-md text-base font-medium transition-colors',
              router.pathname === item.href
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
            )}
            aria-label={item.ariaLabel}
            aria-current={router.pathname === item.href ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </motion.div>
  ));

  // Render user menu with enhanced accessibility
  const renderUserMenu = memo(() => (
    <div className="relative ml-4">
      <Dropdown
        options={userMenuOptions}
        value=""
        onChange={(value) => {
          if (value === 'logout') {
            handleLogout();
          } else {
            router.push(`/${value}`);
          }
        }}
        className="w-48"
        testId="user-menu-dropdown"
        renderOption={(option) => (
          <div className="flex items-center px-4 py-2">
            <span className="flex-grow">{option.label}</span>
          </div>
        )}
      />
    </div>
  ));

  return (
    <nav
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800',
        'border-b border-gray-200 dark:border-gray-700',
        'transition-colors duration-200',
        className
      )}
      data-testid={testId}
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center flex-shrink-0">
            <Link
              href="/dashboard"
              className="flex items-center focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Ir para Dashboard"
            >
              <img
                src="/logo.svg"
                alt="Porfin"
                className="h-8 w-auto"
                width={32}
                height={32}
              />
              <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
                Porfin
              </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  router.pathname === item.href
                    ? 'text-primary-600 dark:text-primary-200'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white'
                )}
                aria-label={item.ariaLabel}
                aria-current={router.pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User menu and mobile menu button */}
          <div className="flex items-center">
            {user && renderUserMenu()}
            
            <Button
              variant="ghost"
              className="md:hidden ml-2"
              aria-label="Abrir menu de navegação"
              aria-expanded="false"
              aria-controls="mobile-menu"
              testId="mobile-menu-button"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {renderMobileMenu()}
      </AnimatePresence>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;