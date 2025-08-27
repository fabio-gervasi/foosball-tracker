import { logger } from './logger';
import { handleApiError } from './errorHandler';

// Request interceptor interface
export interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onRequestError?: (error: any) => any;
}

// Response interceptor interface
export interface ResponseInterceptor {
  onResponse?: (response: Response, data: any) => any | Promise<any>;
  onResponseError?: (error: any) => any;
}

// Enhanced request configuration
export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  metadata?: {
    startTime: number;
    endpoint: string;
    requestId: string;
    retryAttempt?: number;
  };
}

// Response data interface
export interface ResponseData {
  data: any;
  status: number;
  statusText: string;
  headers: Headers;
  metadata?: {
    duration: number;
    requestId: string;
    cached?: boolean;
  };
}

/**
 * API Interceptor Manager
 * Handles request and response interceptors for consistent API behavior
 */
class ApiInterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    
    // Return unsubscribe function
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    
    // Return unsubscribe function
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Process request through all interceptors
   */
  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = { ...config };

    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onRequest) {
        try {
          processedConfig = await interceptor.onRequest(processedConfig);
        } catch (error) {
          logger.error('Request interceptor failed', error);
          if (interceptor.onRequestError) {
            await interceptor.onRequestError(error);
          }
          throw error;
        }
      }
    }

    return processedConfig;
  }

  /**
   * Process response through all interceptors
   */
  async processResponse(response: Response, data: any, requestConfig: RequestConfig): Promise<any> {
    let processedData = data;

    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onResponse) {
        try {
          processedData = await interceptor.onResponse(response, processedData);
        } catch (error) {
          logger.error('Response interceptor failed', error);
          if (interceptor.onResponseError) {
            await interceptor.onResponseError(error);
          }
          throw error;
        }
      }
    }

    return processedData;
  }

  /**
   * Process error through response interceptors
   */
  async processError(error: any, requestConfig?: RequestConfig): Promise<void> {
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onResponseError) {
        try {
          await interceptor.onResponseError(error);
        } catch (interceptorError) {
          logger.error('Response error interceptor failed', interceptorError);
        }
      }
    }
  }
}

// Create singleton instance
export const apiInterceptorManager = new ApiInterceptorManager();

/**
 * Default request interceptors
 */

// Request ID and timing interceptor
export const requestIdInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    return {
      ...config,
      metadata: {
        ...config.metadata,
        requestId,
        startTime,
        endpoint: config.url,
      }
    };
  }
};

// Request logging interceptor
export const requestLoggingInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    logger.debug('API Request intercepted', {
      method: config.method,
      url: config.url,
      requestId: config.metadata?.requestId,
      hasAuth: !!config.headers.Authorization,
      hasBody: !!config.body
    });
    
    return config;
  },
  onRequestError: (error) => {
    logger.error('Request interceptor error', error);
  }
};

// Authentication header interceptor
export const authHeaderInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    // This will be handled by useApiRequest hook, but can be extended here
    // for additional auth logic like token refresh
    return config;
  }
};

/**
 * Default response interceptors
 */

// Response timing interceptor
export const responseTimingInterceptor: ResponseInterceptor = {
  onResponse: (response, data) => {
    const endTime = Date.now();
    // The duration calculation would need access to request metadata
    // This is handled in the main API request logic
    
    return data;
  }
};

// Response logging interceptor
export const responseLoggingInterceptor: ResponseInterceptor = {
  onResponse: (response, data) => {
    logger.debug('API Response intercepted', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      hasData: !!data
    });
    
    return data;
  },
  onResponseError: (error) => {
    const processedError = handleApiError(error);
    
    logger.debug('API Error intercepted', {
      code: processedError.code,
      severity: processedError.severity,
      recoverable: processedError.recoverable,
      message: processedError.message
    });
  }
};

// Data transformation interceptor
export const dataTransformInterceptor: ResponseInterceptor = {
  onResponse: (response, data) => {
    // Handle common API response patterns
    if (data && typeof data === 'object') {
      // Transform timestamps to Date objects if needed
      const transformedData = transformTimestamps(data);
      
      // Normalize response structure if needed
      return normalizeResponseData(transformedData);
    }
    
    return data;
  }
};

// Error standardization interceptor
export const errorStandardizationInterceptor: ResponseInterceptor = {
  onResponseError: (error) => {
    // Ensure all errors are processed through our error handler
    return handleApiError(error);
  }
};

/**
 * Helper functions
 */

// Transform ISO date strings to Date objects
function transformTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformTimestamps(item));
  }

  const transformed: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && isISODateString(value)) {
      transformed[key] = new Date(value);
    } else if (typeof value === 'object' && value !== null) {
      transformed[key] = transformTimestamps(value);
    } else {
      transformed[key] = value;
    }
  }

  return transformed;
}

// Check if string is ISO date format
function isISODateString(str: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoDateRegex.test(str);
}

// Normalize API response data structure
function normalizeResponseData(data: any): any {
  // Handle different API response patterns
  if (data && typeof data === 'object') {
    // If response has a 'data' wrapper, extract it
    if ('data' in data && Object.keys(data).length === 1) {
      return data.data;
    }
    
    // Handle pagination responses
    if ('items' in data && 'total' in data) {
      return {
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page || 1,
          limit: data.limit || data.items.length,
          hasMore: data.hasMore || false
        }
      };
    }
  }

  return data;
}

/**
 * Initialize default interceptors
 */
export function initializeDefaultInterceptors(): () => void {
  const unsubscribers = [
    apiInterceptorManager.addRequestInterceptor(requestIdInterceptor),
    apiInterceptorManager.addRequestInterceptor(requestLoggingInterceptor),
    apiInterceptorManager.addRequestInterceptor(authHeaderInterceptor),
    apiInterceptorManager.addResponseInterceptor(responseTimingInterceptor),
    apiInterceptorManager.addResponseInterceptor(responseLoggingInterceptor),
    apiInterceptorManager.addResponseInterceptor(dataTransformInterceptor),
    apiInterceptorManager.addResponseInterceptor(errorStandardizationInterceptor),
  ];

  logger.debug('Default API interceptors initialized');

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    logger.debug('Default API interceptors cleaned up');
  };
}

// Export types
export type { RequestConfig, ResponseData };
