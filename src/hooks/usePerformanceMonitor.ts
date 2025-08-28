import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>();
  const metricsHistory = useRef<PerformanceMetrics[]>([]);

  // Start performance measurement
  const startMeasurement = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // End performance measurement and log if slow
  const endMeasurement = useCallback(() => {
    if (renderStartTime.current) {
      const endTime = performance.now();
      const renderTime = endTime - renderStartTime.current;

      // Log slow renders (> 16ms for 60fps)
      if (renderTime > 16) {
        logger.warn(`Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }

      // Store metrics
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: endTime
      };

      metricsHistory.current.push(metrics);

      // Keep only last 10 measurements
      if (metricsHistory.current.length > 10) {
        metricsHistory.current = metricsHistory.current.slice(-10);
      }

      renderStartTime.current = undefined;
      return renderTime;
    }
    return 0;
  }, [componentName]);

  // Get memory usage (Chrome only)
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const metrics = metricsHistory.current;
    if (metrics.length === 0) return null;

    const renderTimes = metrics.map(m => m.renderTime);
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);

    return {
      componentName,
      measurements: metrics.length,
      avgRenderTime: Number(avgRenderTime.toFixed(2)),
      maxRenderTime: Number(maxRenderTime.toFixed(2)),
      minRenderTime: Number(minRenderTime.toFixed(2)),
      memory: getMemoryUsage()
    };
  }, [componentName, getMemoryUsage]);

  // Report performance metrics to console (development only)
  const reportMetrics = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      const summary = getPerformanceSummary();
      if (summary) {
        logger.info(`Performance Report - ${componentName}`, summary);
      }
    }
  }, [componentName, getPerformanceSummary]);

  // Auto-start measurement on component mount/update
  useEffect(() => {
    startMeasurement();

    return () => {
      endMeasurement();
    };
  });

  // Report metrics periodically in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        if (metricsHistory.current.length > 0) {
          reportMetrics();
        }
      }, 30000); // Report every 30 seconds

      return () => clearInterval(interval);
    }
  }, [reportMetrics]);

  return {
    startMeasurement,
    endMeasurement,
    getMemoryUsage,
    getPerformanceSummary,
    reportMetrics
  };
}
