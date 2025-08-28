import React, { useState } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Example component demonstrating the new standardized API request patterns
 * This component shows various usage patterns of useApiRequest hook
 */
export const ApiRequestExample: React.FC = () => {
  const [endpoint, setEndpoint] = useState('/users');
  const [requestBody, setRequestBody] = useState('{"name": "Test User"}');

  // Example 1: Basic API request with all features
  const {
    data,
    loading,
    error,
    isIdle,
    isLoading,
    isError,
    isSuccess,
    execute,
    reset,
    cancel,
    retry,
    clearError,
  } = useApiRequest<any>({
    retries: 3,
    timeout: 10000,
  });

  // Example 2: GET request with caching
  const getUsersRequest = useApiRequest<any[]>({
    method: 'GET',
    enableCache: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Example 3: POST request with optimistic updates
  const createUserRequest = useApiRequest<any>({
    method: 'POST',
    optimistic: true,
  });

  // Example 4: Request without authentication
  const publicRequest = useApiRequest<any>({
    skipAuth: true,
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let body;
      try {
        body = requestBody.trim() ? JSON.parse(requestBody) : undefined;
      } catch (parseError) {
        console.error('Invalid JSON in request body');
        return;
      }

      await execute(endpoint, {
        method: body ? 'POST' : 'GET',
        body,
      });
    } catch (error) {
      // Error is already handled by the hook
      console.error('Request failed:', error);
    }
  };

  // Handle specialized requests
  const handleGetUsers = async () => {
    try {
      await getUsersRequest.execute('/users');
    } catch (error) {
      console.error('Get users failed:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      await createUserRequest.execute('/users', {
        body: { name: 'New User', email: 'new@example.com' },
      });
    } catch (error) {
      console.error('Create user failed:', error);
    }
  };

  const handlePublicRequest = async () => {
    try {
      await publicRequest.execute('/public/status');
    } catch (error) {
      console.error('Public request failed:', error);
    }
  };

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <CardTitle>API Request Standardization Examples</CardTitle>
          <CardDescription>
            Demonstrates the new standardized API request patterns with centralized error handling
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Main API Request Example */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold'>Basic API Request</h3>

            <form onSubmit={handleSubmit} className='space-y-3'>
              <div>
                <label className='block text-sm font-medium mb-1'>Endpoint</label>
                <Input
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  placeholder='/users'
                />
              </div>

              <div>
                <label className='block text-sm font-medium mb-1'>Request Body (JSON)</label>
                <textarea
                  className='w-full p-2 border rounded-md'
                  rows={3}
                  value={requestBody}
                  onChange={e => setRequestBody(e.target.value)}
                  placeholder='{"name": "Test User"}'
                />
              </div>

              <div className='flex gap-2'>
                <Button type='submit' disabled={isLoading}>
                  {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Execute Request
                </Button>

                <Button type='button' variant='outline' onClick={retry} disabled={!error}>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Retry
                </Button>

                <Button type='button' variant='outline' onClick={cancel} disabled={!isLoading}>
                  <X className='mr-2 h-4 w-4' />
                  Cancel
                </Button>

                <Button type='button' variant='outline' onClick={reset}>
                  Reset
                </Button>
              </div>
            </form>

            {/* Request State Indicators */}
            <div className='flex gap-2'>
              <Badge variant={isIdle ? 'default' : 'secondary'}>
                {isIdle ? 'Idle' : 'Not Idle'}
              </Badge>
              <Badge variant={isLoading ? 'default' : 'secondary'}>
                {isLoading ? 'Loading' : 'Not Loading'}
              </Badge>
              <Badge variant={isSuccess ? 'default' : 'secondary'}>
                {isSuccess ? 'Success' : 'No Success'}
              </Badge>
              <Badge variant={isError ? 'destructive' : 'secondary'}>
                {isError ? 'Error' : 'No Error'}
              </Badge>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription className='flex justify-between items-center'>
                  <div>
                    <strong>{error.code}:</strong> {error.message}
                    {error.action && (
                      <div className='text-sm mt-1'>
                        <strong>Action:</strong> {error.action}
                      </div>
                    )}
                    <div className='text-sm mt-1'>
                      <strong>Severity:</strong> {error.severity} |<strong> Recoverable:</strong>{' '}
                      {error.recoverable ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <Button size='sm' variant='outline' onClick={clearError}>
                    <X className='h-3 w-3' />
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Display */}
            {isSuccess && data && (
              <Alert>
                <CheckCircle className='h-4 w-4' />
                <AlertDescription>
                  <strong>Request Successful!</strong>
                  <pre className='mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32'>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Specialized Request Examples */}
          <div className='border-t pt-4 space-y-4'>
            <h3 className='text-lg font-semibold'>Specialized Request Examples</h3>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {/* GET with Caching */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>GET with Caching</CardTitle>
                  <CardDescription className='text-sm'>Cached for 5 minutes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleGetUsers}
                    disabled={getUsersRequest.isLoading}
                    className='w-full'
                  >
                    {getUsersRequest.isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    Get Users
                  </Button>

                  {getUsersRequest.error && (
                    <Alert variant='destructive' className='mt-2'>
                      <AlertDescription className='text-xs'>
                        {getUsersRequest.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {getUsersRequest.isSuccess && (
                    <Badge className='mt-2' variant='default'>
                      {Array.isArray(getUsersRequest.data) ? getUsersRequest.data.length : 0} users
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* POST with Optimistic Updates */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>POST with Optimistic</CardTitle>
                  <CardDescription className='text-sm'>Updates UI immediately</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleCreateUser}
                    disabled={createUserRequest.isLoading}
                    className='w-full'
                  >
                    {createUserRequest.isLoading && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    Create User
                  </Button>

                  {createUserRequest.error && (
                    <Alert variant='destructive' className='mt-2'>
                      <AlertDescription className='text-xs'>
                        {createUserRequest.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {createUserRequest.isSuccess && (
                    <Badge className='mt-2' variant='default'>
                      User Created!
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Public Request */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Public Request</CardTitle>
                  <CardDescription className='text-sm'>No authentication required</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handlePublicRequest}
                    disabled={publicRequest.isLoading}
                    className='w-full'
                  >
                    {publicRequest.isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    Check Status
                  </Button>

                  {publicRequest.error && (
                    <Alert variant='destructive' className='mt-2'>
                      <AlertDescription className='text-xs'>
                        {publicRequest.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {publicRequest.isSuccess && (
                    <Badge className='mt-2' variant='default'>
                      Status OK
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Usage Guidelines */}
          <div className='border-t pt-4'>
            <h3 className='text-lg font-semibold mb-3'>Usage Guidelines</h3>
            <div className='text-sm space-y-2 text-gray-600'>
              <p>
                <strong>Automatic Features:</strong>
              </p>
              <ul className='list-disc list-inside space-y-1 ml-4'>
                <li>Authentication headers are automatically added</li>
                <li>Errors are processed through centralized error handler</li>
                <li>Request cancellation on component unmount</li>
                <li>Retry logic with exponential backoff</li>
                <li>Loading and error states managed automatically</li>
              </ul>

              <p className='pt-2'>
                <strong>Configuration Options:</strong>
              </p>
              <ul className='list-disc list-inside space-y-1 ml-4'>
                <li>
                  <code>retries</code>: Number of retry attempts (default: 3)
                </li>
                <li>
                  <code>timeout</code>: Request timeout in ms (default: 30000)
                </li>
                <li>
                  <code>skipAuth</code>: Skip automatic auth headers (default: false)
                </li>
                <li>
                  <code>enableCache</code>: Enable React Query caching (default: false)
                </li>
                <li>
                  <code>optimistic</code>: Enable optimistic updates (default: false)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiRequestExample;
