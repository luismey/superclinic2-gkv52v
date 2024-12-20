'use client';

import React from 'react'; // v18.0.0
import Loading from '../../components/common/Loading';

/**
 * Next.js 13+ loading component that provides a full-screen loading indicator
 * during route transitions and data fetching operations.
 * 
 * Features:
 * - Full-screen loading experience
 * - WCAG 2.1 Level AA compliant
 * - Theme-aware (light/dark mode)
 * - Reduced motion support
 * - Brazilian Portuguese localization
 */
export default function LoadingPage(): JSX.Element {
  return (
    <Loading
      fullScreen
      size="lg"
      text="Carregando..."
      aria-label="Carregando conteúdo, por favor aguarde"
      className="bg-opacity-80 backdrop-blur-sm transition-all duration-300"
    />
  );
}