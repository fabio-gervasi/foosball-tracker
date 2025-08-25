import React from 'react';
import { Server, AlertCircle } from 'lucide-react';
import { LOGIN_MESSAGES } from '../../utils/login-constants';

interface ServerStatusProps {
  status: 'checking' | 'online' | 'offline';
  onRetry: () => void;
}

export function ServerStatus({ status, onRetry }: ServerStatusProps) {
  return (
    <div className="mb-4 p-3 rounded-lg flex items-center space-x-2 text-sm">
      {status === 'checking' && (
        <>
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">{LOGIN_MESSAGES.connecting}</span>
        </>
      )}
      {status === 'online' && (
        <>
          <Server className="w-4 h-4 text-green-600" />
          <span className="text-green-600">{LOGIN_MESSAGES.serverConnected}</span>
        </>
      )}
      {status === 'offline' && (
        <>
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600">{LOGIN_MESSAGES.serverFailed}</span>
          <button 
            onClick={onRetry}
            className="text-blue-600 hover:text-blue-800 ml-2"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}