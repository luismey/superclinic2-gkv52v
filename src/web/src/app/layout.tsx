'use client';

import { Inter } from 'next/font/google'; // v13.0.0
import { Provider } from 'react-redux'; // v8.1.0
import { ThemeProvider, createTheme } from '@mui/material'; // v5.0.0
import CookieConsent from '@porfin/cookie-consent'; // v1.0.0
import { useEffect } from 'react';

import '../styles/globals.css';
import { store } from '../store';
import { initializeFirebase } from '../lib/firebase';

// Configure Inter font with Latin subset for Portuguese characters
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial']
});

// Healthcare-optimized theme colors
const THEME_COLORS = {
  primary: '#0066CC',
  secondary: '#4A90E2',
  accent: '#00CC99',
  warning: '#FFB020',
  error: '#FF4D4D',
  success: '#00CC66',
  background: '#FFFFFF',
  text: '#2C3E50',
  border: '#E5E7EB'
};

// Create theme with healthcare-specific design tokens
const theme = createTheme({
  palette: {
    primary: {
      main: THEME_COLORS.primary,
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: THEME_COLORS.secondary,
      contrastText: '#FFFFFF'
    },
    error: {
      main: THEME_COLORS.error
    },
    warning: {
      main: THEME_COLORS.warning
    },
    success: {
      main: THEME_COLORS.success
    },
    background: {
      default: THEME_COLORS.background,
      paper: '#FFFFFF'
    },
    text: {
      primary: THEME_COLORS.text
    }
  },
  typography: {
    fontFamily: inter.style.fontFamily,
    fontSize: 16,
    h1: { fontSize: '2.488rem' },
    h2: { fontSize: '2.074rem' },
    h3: { fontSize: '1.728rem' },
    h4: { fontSize: '1.44rem' },
    h5: { fontSize: '1.2rem' },
    h6: { fontSize: '1rem' }
  },
  spacing: 8, // 8px grid system
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: '44px' // WCAG touch target size
        }
      }
    }
  }
});

// Metadata configuration for SEO and security
export const metadata = {
  title: 'Porfin - Gestão de Consultório Inteligente',
  description: 'Plataforma de gestão com IA para profissionais de saúde',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: THEME_COLORS.primary,
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.svg'
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION
  },
  // LGPD and healthcare security headers
  security: {
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'connect-src': ["'self'", 'https://*.porfin.com.br', 'https://api.whatsapp.com'],
      'img-src': ["'self'", 'data:', 'https:', 'blob:'],
      'script-src': ["'self'", "'unsafe-inline'", 'https://*.porfin.com.br'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'frame-src': ["'self'", 'https://api.whatsapp.com']
    },
    permissions: {
      camera: '()',
      microphone: '()',
      geolocation: '()'
    }
  },
  // LGPD compliance metadata
  lgpd: {
    privacyPolicy: '/privacy',
    cookiePolicy: '/cookies',
    dataRetention: '12 months',
    dpo: {
      name: process.env.NEXT_PUBLIC_DPO_NAME,
      email: process.env.NEXT_PUBLIC_DPO_EMAIL
    }
  }
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  // Initialize Firebase on mount
  useEffect(() => {
    initializeFirebase().catch(console.error);
  }, []);

  return (
    <html lang="pt-BR" className={inter.className}>
      <head>
        <meta charSet="utf-8" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Porfin" />
        
        {/* LGPD compliance meta tags */}
        <meta name="privacy-policy" content="/privacy" />
        <meta name="cookie-policy" content="/cookies" />
        <meta name="data-retention" content="12 months" />
        <meta name="dpo-contact" content={process.env.NEXT_PUBLIC_DPO_EMAIL} />
      </head>
      <body>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            {/* LGPD-compliant cookie consent banner */}
            <CookieConsent
              location="bottom"
              buttonText="Aceitar"
              declineButtonText="Recusar"
              cookieName="porfin_consent"
              style={{ background: THEME_COLORS.primary }}
              buttonStyle={{ background: THEME_COLORS.accent, color: '#fff' }}
              expires={365}
              enableDeclineButton
              onAccept={() => {
                // Enable analytics and tracking features
              }}
              onDecline={() => {
                // Disable non-essential cookies and tracking
              }}
            >
              Utilizamos cookies para melhorar sua experiência. Para saber mais, acesse nossa{' '}
              <a href="/privacy" style={{ color: '#fff' }}>
                Política de Privacidade
              </a>
              .
            </CookieConsent>

            {/* Main application content */}
            <main className="min-h-screen bg-background text-text antialiased">
              {children}
            </main>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}