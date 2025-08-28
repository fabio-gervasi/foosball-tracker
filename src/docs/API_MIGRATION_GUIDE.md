# API Request Standardization Migration Guide

## Overview

This guide helps migrate existing API calls to use the new standardized API request patterns with centralized error handling, introduced in REQ-2.3.

## Key Benefits

✅ **Consistent API patterns** across the application
✅ **Centralized error handling** with user-friendly messages
✅ **Automatic authentication** header management
✅ **Request cancellation** and retry logic
✅ **React Query integration** for caching and optimistic updates
✅ **Loading and error states** managed automatically

## Migration Patterns

### Pattern 1: Basic API Request Migration

**Before (old pattern):**

```typescript
import { apiRequest } from '../utils/supabase/client';

const MyComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/users', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      {data && <div>Data loaded!</div>}
    </div>
  );
};
```

**After (new pattern):**

```typescript
import { useApiRequest } from '../hooks';

const MyComponent = () => {
  const { data, loading, error, execute } = useApiRequest();

  const fetchData = () => execute('/users');

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && (
        <div>
          <strong>{error.code}:</strong> {error.message}
          {error.action && <div>Action: {error.action}</div>}
        </div>
      )}
      {data && <div>Data loaded!</div>}
    </div>
  );
};
```

### Pattern 2: POST Request with Error Handling

**Before:**

```typescript
const submitData = async formData => {
  setSubmitting(true);
  try {
    await apiRequest('/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    alert('Success!');
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    setSubmitting(false);
  }
};
```

**After:**

```typescript
const { loading: submitting, error, execute } = useApiRequest();

const submitData = async formData => {
  try {
    await execute('/users', {
      method: 'POST',
      body: formData,
    });
    // Success handled automatically
  } catch (error) {
    // Error already processed and available in `error` state
  }
};
```

### Pattern 3: React Query Migration

**Before (manual React Query):**

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const response = await apiRequest('/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },
  enabled: !!accessToken,
});
```

**After (use existing optimized hooks):**

```typescript
import { useUsersQuery } from '../hooks';

const { data, isLoading, error } = useUsersQuery(accessToken);
```

### Pattern 4: Mutation with Optimistic Updates

**Before:**

```typescript
const updateProfile = useMutation({
  mutationFn: async profileData => {
    return apiRequest('/user', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['user']);
  },
});
```

**After:**

```typescript
import { useUpdateProfileMutation } from '../hooks';

const updateProfile = useUpdateProfileMutation(accessToken);
// Optimistic updates and cache invalidation handled automatically
```

## Advanced Usage Patterns

### Custom Request Configuration

```typescript
const { execute } = useApiRequest({
  retries: 5,
  timeout: 60000,
  skipAuth: false, // Default: false (auto-inject auth headers)
});

// Execute with custom options
await execute('/users', {
  method: 'POST',
  body: userData,
  params: { include: 'profile' },
});
```

### Request Cancellation

```typescript
const { execute, cancel } = useApiRequest();

useEffect(() => {
  execute('/long-running-request');

  // Cancel on unmount
  return () => cancel();
}, []);
```

### Manual Retry

```typescript
const { error, retry } = useApiRequest();

return (
  <div>
    {error && (
      <div>
        <p>{error.message}</p>
        {error.recoverable && (
          <button onClick={retry}>Try Again</button>
        )}
      </div>
    )}
  </div>
);
```

### Error Severity Handling

```typescript
const { error } = useApiRequest();

const getErrorStyle = (severity) => {
  switch (severity) {
    case 'critical': return 'bg-red-600 text-white';
    case 'error': return 'bg-red-100 text-red-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'info': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

return (
  <div>
    {error && (
      <div className={getErrorStyle(error.severity)}>
        <strong>{error.code}:</strong> {error.message}
        {error.action && <p>Suggested action: {error.action}</p>}
      </div>
    )}
  </div>
);
```

## Migration Checklist

### For Each Component:

- [ ] Replace manual `apiRequest` calls with `useApiRequest` hook
- [ ] Remove manual loading state management
- [ ] Remove manual error state management
- [ ] Remove manual authentication header injection
- [ ] Update error display to use `UserFriendlyError` properties
- [ ] Add retry functionality for recoverable errors
- [ ] Test that all functionality is preserved

### For React Query Usage:

- [ ] Use existing optimized query hooks (`useUsersQuery`, `useMatchesQuery`, etc.)
- [ ] Use existing mutation hooks (`useSubmitMatchMutation`, `useUpdateProfileMutation`, etc.)
- [ ] Remove duplicate query definitions
- [ ] Verify optimistic updates are working

### For Error Handling:

- [ ] Replace `alert()` calls with proper UI components
- [ ] Use error severity levels for styling
- [ ] Implement suggested actions for recoverable errors
- [ ] Test error scenarios (network failures, auth errors, etc.)

## Common Pitfalls to Avoid

### ❌ Don't do this:

```typescript
// Manual auth header injection (redundant)
const { execute } = useApiRequest();
await execute('/users', {
  headers: { Authorization: `Bearer ${token}` }, // ❌ Redundant
});
```

### ✅ Do this instead:

```typescript
// Auth headers are automatic
const { execute } = useApiRequest();
await execute('/users'); // ✅ Auth headers added automatically
```

### ❌ Don't do this:

```typescript
// Manual error processing
try {
  await execute('/users');
} catch (error) {
  setError(error.message); // ❌ Loses error context
}
```

### ✅ Do this instead:

```typescript
// Use processed error from hook state
const { error, execute } = useApiRequest();
await execute('/users');
// Error automatically processed and available in `error` state ✅
```

## Testing Your Migration

### 1. Functional Testing

- [ ] All existing API calls work as before
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] Authentication works seamlessly
- [ ] Optimistic updates work (where applicable)

### 2. Error Scenario Testing

- [ ] Network failures show appropriate messages
- [ ] Authentication errors trigger proper handling
- [ ] Server errors display user-friendly messages
- [ ] Retry functionality works for recoverable errors
- [ ] Request cancellation works properly

### 3. Performance Testing

- [ ] No performance regressions
- [ ] Request deduplication works
- [ ] Caching behaves as expected
- [ ] Bundle size impact is minimal

## Support and Documentation

### Key Files:

- `src/hooks/useApiRequest.ts` - Main API request hook
- `src/utils/errorHandler.ts` - Centralized error handling
- `src/utils/apiInterceptors.ts` - Request/response interceptors
- `src/components/examples/ApiRequestExample.tsx` - Usage examples

### Getting Help:

- Check the example component for usage patterns
- Review existing query/mutation hooks for patterns
- Test with the development server running
- Use browser dev tools to inspect network requests and error states

---

_This migration guide ensures a smooth transition to the new standardized API request patterns while maintaining all existing functionality and improving error handling throughout the application._
