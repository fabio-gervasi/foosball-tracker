// Development logger utility
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  info: (message: string, data?: any) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, data);
    }
  },
  warn: (message: string, data?: any) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, data);
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
  authEvent: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[AUTH] ${message}`, data);
    }
  },
  sessionEvent: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[SESSION] ${message}`, data);
    }
  },
  apiEvent: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[API] ${message}`, data);
    }
  },
  apiRequest: (endpoint: string, method: string = 'GET', data?: any) => {
    if (isDev) {
      console.log(`[API REQUEST] ${method} ${endpoint}`, data);
    }
  },
  apiResponse: (endpoint: string, status: number, ok: boolean, data?: any) => {
    if (isDev) {
      const statusType = ok ? 'SUCCESS' : 'ERROR';
      console.log(`[API RESPONSE] ${statusType} ${status} ${endpoint}`, data);
    }
  }
};
