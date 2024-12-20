import React from 'react'; // v18.0.0
import { cn } from 'class-variance-authority'; // v1.0.0
import { COLORS } from '../../constants/ui';

interface FooterProps {
  className?: string;
}

/**
 * Footer component implementing Material Design 3.0 principles with responsive layout,
 * proper semantic structure, and accessibility features.
 * 
 * @param {FooterProps} props - Component props
 * @returns {React.ReactElement} Footer component with navigation and branding
 */
const Footer: React.FC<FooterProps> = React.memo(({ className }) => {
  const currentYear = new Date().getFullYear();

  // Navigation sections following semantic structure
  const navigationSections = [
    {
      title: 'Produto',
      links: [
        { label: 'Recursos', href: '/recursos' },
        { label: 'Preços', href: '/precos' },
        { label: 'Integrações', href: '/integracoes' },
        { label: 'Casos de Sucesso', href: '/casos-de-sucesso' },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { label: 'Sobre', href: '/sobre' },
        { label: 'Blog', href: '/blog' },
        { label: 'Carreiras', href: '/carreiras' },
        { label: 'Contato', href: '/contato' },
      ],
    },
    {
      title: 'Suporte',
      links: [
        { label: 'Central de Ajuda', href: '/ajuda' },
        { label: 'Documentação', href: '/docs' },
        { label: 'Status', href: '/status' },
        { label: 'Política de Privacidade', href: '/privacidade' },
      ],
    },
  ];

  // Social media links with proper accessibility labels
  const socialLinks = [
    { label: 'LinkedIn', href: 'https://linkedin.com/company/porfin', icon: 'linkedin' },
    { label: 'Twitter', href: 'https://twitter.com/porfinapp', icon: 'twitter' },
    { label: 'Instagram', href: 'https://instagram.com/porfinapp', icon: 'instagram' },
  ];

  return (
    <footer 
      className={cn(
        // Base styles with responsive padding and theme support
        'w-full bg-white dark:bg-gray-900',
        'border-t border-gray-200 dark:border-gray-800',
        'py-12 px-4 sm:px-6 lg:px-8',
        className
      )}
      // Schema.org markup for SEO
      itemScope 
      itemType="http://schema.org/WPFooter"
    >
      <div className="max-w-7xl mx-auto">
        {/* Main footer grid with responsive columns */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand section */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src="/logo.svg" 
                alt="Porfin" 
                className="h-8 w-auto"
                loading="lazy"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Transformando a gestão de clínicas com IA e WhatsApp
            </p>
          </div>

          {/* Navigation sections */}
          {navigationSections.map((section) => (
            <nav 
              key={section.title}
              className="space-y-4"
              aria-label={section.title}
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className={cn(
                        'text-sm text-gray-600 dark:text-gray-400',
                        'hover:text-primary dark:hover:text-primary-light',
                        'transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-primary dark:focus-visible:ring-primary-light'
                      )}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom section with social links and copyright */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            {/* Copyright text */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {currentYear} Porfin. Todos os direitos reservados.
            </p>

            {/* Social media links */}
            <div className="flex space-x-6">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-gray-500 dark:text-gray-400',
                    'hover:text-primary dark:hover:text-primary-light',
                    'transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-primary dark:focus-visible:ring-primary-light'
                  )}
                  aria-label={link.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="sr-only">{link.label}</span>
                  <i className={`icon-${link.icon} h-6 w-6`} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;