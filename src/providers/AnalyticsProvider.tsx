import React, { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { initializeAnalytics } from '../utils/analytics';
import { logger } from '../utils/logger';

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  useEffect(() => {
    // Initialize custom analytics tracking
    initializeAnalytics();

    // Log analytics initialization
    logger.info('Vercel Analytics and Speed Insights initialized');
  }, []);

  return (
    <>
      {children}

      {/* Vercel Analytics - Privacy-friendly analytics */}
      <Analytics />

      {/* Vercel Speed Insights - Core Web Vitals tracking */}
      <SpeedInsights />
    </>
  );
}

// Hook for accessing analytics in components
export function useAnalytics() {
  // This could be expanded to provide analytics context
  // For now, components can import analytics functions directly
  return {
    // Add any analytics context or utilities here
    analyticsEnabled: true,
  };
}
