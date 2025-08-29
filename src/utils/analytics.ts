import { logger } from './logger';

// Track events with Vercel Analytics
export const trackEvent = (name: string, properties?: Record<string, any>) => {
  try {
    // Use Vercel Analytics if available
    if (typeof window !== 'undefined' && window.va) {
      window.va('event', { name, ...properties });
      logger.info(`Analytics event tracked: ${name}`, properties);
    }

    // Also send to our custom analytics endpoint for enhanced tracking
    if (typeof window !== 'undefined') {
      sendCustomAnalytics(name, properties);
    }
  } catch (error) {
    logger.error('Failed to track analytics event', { name, properties, error });
  }
};

// Send custom analytics data to our Edge Function
const sendCustomAnalytics = async (eventName: string, properties?: Record<string, any>) => {
  try {
    const analyticsData = {
      eventName,
      properties,
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connection: (navigator as any).connection
        ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
          }
        : null,
    };

    // Send to our analytics endpoint (fire and forget)
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analyticsData),
    }).catch(error => {
      logger.debug('Custom analytics request failed', error);
    });
  } catch (error) {
    logger.debug('Failed to send custom analytics', error);
  }
};

// Foosball-specific analytics tracking
export const foosballAnalytics = {
  // Match-related events
  trackMatchCreated: (matchType: '1v1' | '2v2', groupCode?: string) => {
    trackEvent('Match Created', {
      matchType,
      groupCode,
      category: 'match',
      action: 'create',
    });
  },

  trackMatchCompleted: (
    matchType: '1v1' | '2v2',
    score1: number,
    score2: number,
    groupCode?: string
  ) => {
    trackEvent('Match Completed', {
      matchType,
      score1,
      score2,
      groupCode,
      category: 'match',
      action: 'complete',
    });
  },

  trackMatchCancelled: (matchType: '1v1' | '2v2', reason?: string) => {
    trackEvent('Match Cancelled', {
      matchType,
      reason,
      category: 'match',
      action: 'cancel',
    });
  },

  // User authentication events
  trackUserLogin: (method: string, isNewUser: boolean = false) => {
    trackEvent('User Login', {
      method,
      isNewUser,
      category: 'auth',
      action: 'login',
    });
  },

  trackUserLogout: () => {
    trackEvent('User Logout', {
      category: 'auth',
      action: 'logout',
    });
  },

  trackUserRegistration: (method: string) => {
    trackEvent('User Registration', {
      method,
      category: 'auth',
      action: 'register',
    });
  },

  // Group management events
  trackGroupCreated: (groupName: string) => {
    trackEvent('Group Created', {
      groupName,
      category: 'group',
      action: 'create',
    });
  },

  trackGroupJoined: (groupName: string, groupCode: string) => {
    trackEvent('Group Joined', {
      groupName,
      groupCode,
      category: 'group',
      action: 'join',
    });
  },

  trackGroupSwitch: (fromGroup: string, toGroup: string) => {
    trackEvent('Group Switch', {
      fromGroup,
      toGroup,
      category: 'group',
      action: 'switch',
    });
  },

  // Navigation events
  trackPageView: (pageName: string, previousPage?: string) => {
    trackEvent('Page View', {
      pageName,
      previousPage,
      category: 'navigation',
      action: 'view',
    });
  },

  trackNavigation: (from: string, to: string) => {
    trackEvent('Navigation', {
      from,
      to,
      category: 'navigation',
      action: 'navigate',
    });
  },

  // Performance events
  trackPerformanceMetric: (metric: string, value: number, componentName?: string) => {
    trackEvent('Performance Metric', {
      metric,
      value,
      componentName,
      category: 'performance',
      action: 'measure',
    });
  },

  trackSlowRender: (componentName: string, renderTime: number) => {
    trackEvent('Slow Render', {
      componentName,
      renderTime,
      category: 'performance',
      action: 'slow_render',
    });
  },

  // Error events
  trackError: (errorType: string, errorMessage: string, componentName?: string) => {
    trackEvent('Error Occurred', {
      errorType,
      errorMessage,
      componentName,
      category: 'error',
      action: 'error',
    });
  },

  // Feature usage events
  trackFeatureUsed: (featureName: string, context?: Record<string, any>) => {
    trackEvent('Feature Used', {
      featureName,
      ...context,
      category: 'feature',
      action: 'use',
    });
  },

  // Admin events
  trackAdminAction: (action: string, target?: string, details?: Record<string, any>) => {
    trackEvent('Admin Action', {
      adminAction: action,
      target,
      ...details,
      category: 'admin',
      action: 'admin_action',
    });
  },
};

// Performance monitoring integration
export const trackPerformanceData = async (performanceData: {
  componentName: string;
  renderTime: number;
  memory?: { used: number; total: number; limit: number };
  timestamp: number;
}) => {
  try {
    // Track slow renders
    if (performanceData.renderTime > 16) {
      foosballAnalytics.trackSlowRender(performanceData.componentName, performanceData.renderTime);
    }

    // Send detailed performance data to our Edge Function
    if (typeof window !== 'undefined') {
      fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(performanceData),
      }).catch(error => {
        logger.debug('Performance data request failed', error);
      });
    }
  } catch (error) {
    logger.error('Failed to track performance data', error);
  }
};

// Health check utility
export const checkEdgeHealth = async (): Promise<{
  healthy: boolean;
  responseTime: number;
  region?: string;
  error?: string;
}> => {
  const startTime = Date.now();

  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-cache',
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        responseTime,
        region: data.edge?.region,
      };
    } else {
      return {
        healthy: false,
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Initialize analytics on app start
export const initializeAnalytics = () => {
  try {
    // Track initial page load
    foosballAnalytics.trackPageView('App Load');

    // Track performance metrics periodically
    if (typeof window !== 'undefined') {
      // Track initial load performance
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          foosballAnalytics.trackPerformanceMetric(
            'Page Load Time',
            navigation.loadEventEnd - navigation.fetchStart
          );
          foosballAnalytics.trackPerformanceMetric(
            'DOM Content Loaded',
            navigation.domContentLoadedEventEnd - navigation.fetchStart
          );
          foosballAnalytics.trackPerformanceMetric(
            'First Contentful Paint',
            navigation.loadEventEnd - navigation.fetchStart
          );
        }
      });

      // Track unhandled errors
      window.addEventListener('error', event => {
        foosballAnalytics.trackError(
          'JavaScript Error',
          event.error?.message || 'Unknown error',
          event.filename
        );
      });

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', event => {
        foosballAnalytics.trackError(
          'Unhandled Promise Rejection',
          event.reason?.message || 'Unknown reason'
        );
      });
    }

    logger.info('Analytics initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize analytics', error);
  }
};
