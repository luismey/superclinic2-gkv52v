'use client';

import React from 'react'; // ^18.0.0
import Loading from '../../../components/common/Loading';

/**
 * Loading component for the analytics dashboard that provides visual feedback
 * during data fetching and processing operations.
 * 
 * Features:
 * - Full-screen overlay for immersive loading experience
 * - Analytics-specific loading message
 * - WCAG 2.1 Level AA compliant
 * - Theme-aware styling
 * - Reduced motion support
 */
const AnalyticsLoading: React.FC = () => {
  return (
    <Loading
      size="lg"
      text="Loading analytics data..."
      fullScreen
      aria-label="Loading analytics dashboard"
      className="bg-surface/80 backdrop-blur-sm"
    />
  );
};

export default AnalyticsLoading;