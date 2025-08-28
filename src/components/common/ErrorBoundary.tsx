import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger } from '../../utils/logger';

// Performance monitoring utilities
const performanceMonitor = {
  measureRender: (componentName: string, startTime: number) => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 16) { // More than 16ms (60fps threshold)
      logger.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }

    return renderTime;
  },

  measureMemory: () => {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  },

  reportPerformanceMetrics: () => {
    const memory = performanceMonitor.measureMemory();
    if (memory) {
      logger.info('Performance metrics', {
        memory: `${memory.used}MB / ${memory.total}MB (limit: ${memory.limit}MB)`,
        memoryUsagePercent: Math.round((memory.used / memory.limit) * 100)
      });
    }
  }
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  level?: 'page' | 'component' | 'section';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private readonly maxRetries = 3;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}`;

    // Log error with context
    logger.error('React Error Boundary caught an error', {
      errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      level: this.props.level || 'component',
      retryCount: this.retryCount,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Update state with error info
    this.setState({
      errorInfo,
      errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to external error tracking service (if configured)
    this.reportError(error, errorInfo, errorId);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    // This could be enhanced to report to services like Sentry, LogRocket, etc.
    // For now, we'll just log it
    if (import.meta.env.PROD) {
      // In production, you might want to send errors to a monitoring service
      console.error('Production Error:', {
        errorId,
        message: error.message,
        componentStack: errorInfo.componentStack,
      });
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    } else {
      // Max retries reached, reload the page
      window.location.reload();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private renderErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;
    const { showErrorDetails = import.meta.env.DEV } = this.props;

    if (!showErrorDetails || !error) return null;

    return (
      <details className="mt-4 p-4 bg-gray-50 rounded-lg border">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
          <Bug className="inline w-4 h-4 mr-2" />
          Technical Details (Error ID: {errorId})
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <strong className="text-gray-700">Error:</strong>
            <pre className="mt-1 p-2 bg-red-50 text-red-800 rounded text-xs overflow-x-auto">
              {error.name}: {error.message}
            </pre>
          </div>
          {error.stack && (
            <div>
              <strong className="text-gray-700">Stack Trace:</strong>
              <pre className="mt-1 p-2 bg-gray-100 text-gray-800 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                {error.stack}
              </pre>
            </div>
          )}
          {errorInfo?.componentStack && (
            <div>
              <strong className="text-gray-700">Component Stack:</strong>
              <pre className="mt-1 p-2 bg-blue-50 text-blue-800 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                {errorInfo.componentStack}
              </pre>
            </div>
          )}
        </div>
      </details>
    );
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component' } = this.props;
      const { error, errorId } = this.state;

      // Different error UI based on level
      if (level === 'page') {
        return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>

              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h1>

              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>

              <div className="space-y-3">
                {this.retryCount < this.maxRetries ? (
                  <button
                    onClick={this.handleRetry}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </button>
                ) : (
                  <button
                    onClick={this.handleReload}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </button>
                )}

                <button
                  onClick={this.handleGoHome}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded flex items-center justify-center"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </button>
              </div>

              {this.renderErrorDetails()}
            </div>
          </div>
        );
      }

      if (level === 'section') {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Section Error
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This section encountered an error and couldn't load properly.
                </p>
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={this.handleRetry}
                    className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
            {this.renderErrorDetails()}
          </div>
        );
      }

      // Default component-level error UI
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 my-2">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                Component failed to load
              </p>
              <button
                onClick={this.handleRetry}
                className="text-xs text-yellow-700 hover:text-yellow-900 underline mt-1"
              >
                Retry
              </button>
            </div>
          </div>
          {this.renderErrorDetails()}
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

// Hook for error reporting from functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    const errorId = `hook_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.error('Manual error report from useErrorHandler', {
      errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      timestamp: new Date().toISOString(),
    });

    // In production, report to monitoring service
    if (import.meta.env.PROD) {
      console.error('Manual Error Report:', {
        errorId,
        message: error.message,
        componentStack: errorInfo?.componentStack,
      });
    }
  }, []);
}

export default ErrorBoundary;
