import React, { useCallback, useEffect, useState, memo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';

// Internal components
import Navbar from './Navbar';
import Sidebar from './Sidebar';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Types
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main layout component for the Porfin platform dashboard
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA accessibility
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({ children, className }) => {
  // State management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  // Hooks
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, userRole } = useAuth();
  const { connected: wsConnected, error: wsError } = useWebSocket();

  /**
   * Handles sidebar visibility toggling with enhanced animation
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => {
      // Persist state in localStorage
      localStorage.setItem('sidebarOpen', String(!prev));
      return !prev;
    });
  }, []);

  /**
   * Handles offline mode and reconnection
   */
  const handleConnectionStatus = useCallback(() => {
    setOfflineMode(!wsConnected);
    
    if (!wsConnected) {
      // Show offline notification
      console.warn('Aplicativo operando em modo offline');
    }
  }, [wsConnected]);

  // Initialize sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    }
  }, []);

  // Monitor WebSocket connection
  useEffect(() => {
    handleConnectionStatus();
  }, [wsConnected, handleConnectionStatus]);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Early return if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div 
      className={clsx(
        // Base layout styles
        'min-h-screen bg-gray-50 dark:bg-gray-900',
        'transition-colors duration-200',
        // Offline mode indicator
        offlineMode && 'border-t-4 border-yellow-500',
        className
      )}
      data-testid="dashboard-layout"
    >
      {/* Top navigation */}
      <Navbar 
        className={clsx(
          'fixed top-0 left-0 right-0 z-50',
          offlineMode && 'border-t-4 border-yellow-500'
        )}
        testId="dashboard-navbar"
      />

      {/* Main container */}
      <div className="flex h-screen overflow-hidden pt-16">
        {/* Sidebar navigation */}
        <Sidebar 
          isCollapsed={!isSidebarOpen}
          onToggle={handleSidebarToggle}
        />

        {/* Main content area */}
        <main 
          className={clsx(
            // Base content styles
            'flex-1 overflow-y-auto',
            'px-4 py-8 md:px-6 lg:px-8',
            // Sidebar state transitions
            'transition-all duration-300',
            isSidebarOpen ? 'lg:pl-64' : 'lg:pl-20',
            // Loading state
            wsError && 'opacity-50'
          )}
          role="main"
          aria-label="Conteúdo principal"
        >
          {/* Connection error alert */}
          {wsError && (
            <div 
              className="mb-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900"
              role="alert"
            >
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                {wsError}
              </p>
            </div>
          )}

          {/* Page content */}
          {children}
        </main>
      </div>
    </div>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;