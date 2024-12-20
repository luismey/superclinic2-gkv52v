import React from 'react'; // v18.0.0
import Link from 'next/link'; // v13.0.0
import { usePathname } from 'next/navigation'; // v13.0.0
import { cn } from 'class-variance-authority'; // v1.0.0
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'; // v2.0.0

import {
  DASHBOARD_ROUTES,
  SETTINGS_ROUTES,
} from '../../constants/routes';

// Props interfaces
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  href: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
  label: string;
  isActive: boolean;
}

// Navigation items configuration
const NAV_ITEMS = [
  {
    href: DASHBOARD_ROUTES.HOME,
    icon: HomeIcon,
    label: 'Dashboard',
  },
  {
    href: DASHBOARD_ROUTES.CHATS,
    icon: ChatBubbleLeftRightIcon,
    label: 'Chats',
  },
  {
    href: DASHBOARD_ROUTES.CAMPAIGNS,
    icon: MegaphoneIcon,
    label: 'Campaigns',
  },
  {
    href: DASHBOARD_ROUTES.ANALYTICS,
    icon: ChartBarIcon,
    label: 'Analytics',
  },
  {
    href: SETTINGS_ROUTES.ROOT,
    icon: Cog6ToothIcon,
    label: 'Settings',
  },
];

// Navigation item component with accessibility support
const NavItem: React.FC<NavItemProps> = ({ href, icon: Icon, label, isActive }) => {
  return (
    <Link
      href={href}
      className={cn(
        // Base styles
        'flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700',
        'transition-colors duration-200 ease-in-out',
        'hover:bg-gray-100 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary-500',
        // Active state styles
        isActive && 'bg-primary-50 text-primary-700 hover:bg-primary-100',
        // Tablet hover state for icon
        'group md:px-2 md:hover:px-3'
      )}
      aria-current={isActive ? 'page' : undefined}
      role="menuitem"
    >
      <Icon
        className={cn(
          'h-5 w-5 flex-shrink-0',
          'transition-transform duration-200',
          'md:group-hover:scale-90'
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'truncate text-sm font-medium',
          'transition-opacity duration-200',
          'md:opacity-0 md:group-hover:opacity-100'
        )}
      >
        {label}
      </span>
    </Link>
  );
};

// Main Sidebar component
export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // Base styles
        'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)]',
        'bg-white shadow-md',
        'transition-all duration-300 ease-in-out',
        'will-change-transform',
        // Mobile styles (collapsed state)
        'w-64',
        isCollapsed ? '-translate-x-full' : 'translate-x-0',
        // Tablet styles (hover expand)
        'md:relative md:top-0 md:w-20 md:translate-x-0',
        'md:hover:w-64 md:hover:shadow-lg',
        // Desktop styles (always expanded)
        'lg:w-64 lg:translate-x-0'
      )}
      aria-label="Main navigation"
      role="navigation"
    >
      {/* Mobile close button */}
      <button
        className={cn(
          'absolute -right-10 top-2 rounded-r-lg bg-white p-2',
          'text-gray-500 shadow-md md:hidden',
          'hover:text-gray-700 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary-500'
        )}
        onClick={onToggle}
        aria-label={isCollapsed ? 'Open navigation' : 'Close navigation'}
        aria-expanded={!isCollapsed}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isCollapsed ? 'M4 6h16M4 12h16M4 18h16' : 'M6 18L18 6M6 6l12 12'}
          />
        </svg>
      </button>

      {/* Navigation menu */}
      <nav
        className="flex h-full flex-col gap-2 p-4 focus-visible:outline-none"
        role="menu"
        aria-label="Main menu"
      >
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={pathname === item.href}
          />
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;