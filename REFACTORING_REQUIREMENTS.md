# Foosball Tracker Refactoring Requirements Document

## Document Information
- **Created**: December 2024
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Estimated Timeline**: 3 weeks
- **Priority**: High

## Executive Summary

This document outlines the comprehensive refactoring requirements for the Foosball Tracker application. The current codebase suffers from architectural issues, excessive complexity, and maintainability challenges that need immediate attention.

**Key Metrics**:
- Main App.tsx component: 952 lines (Target: <200 lines)
- Console logging instances: 554 (Target: <50 production logs)
- Unused components identified: 4
- State variables in App.tsx: 13 (Target: <5)

## Current State Analysis

### Critical Issues Identified
1. **Monolithic App Component**: Single 952-line component handling multiple responsibilities
2. **Excessive Logging**: 554 console.log/error instances across 25 files
3. **Unused Code**: 4 components/utilities serving no purpose
4. **Prop Drilling**: 13+ state variables passed through multiple component layers
5. **Poor Separation of Concerns**: Authentication, data fetching, routing, and UI mixed together

## Requirements Specification

## PHASE 0: SECURITY & ENVIRONMENT SETUP (Week 1 - Priority 1)

### REQ-0.1: Security Hardening
**Priority**: Critical
**Estimated Effort**: 4 hours
**Dependencies**: None

#### Implementation Details

##### REQ-0.1.1: Environment Variables Migration
```bash
# File: .env.example
VITE_SUPABASE_PROJECT_ID=your_project_id_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

```typescript
// File: src/utils/supabase/info.tsx
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!projectId || !publicAnonKey) {
  throw new Error(
    'Missing required environment variables. Please check .env.example and configure your .env file.'
  );
}
```

**Acceptance Criteria**:
- [ ] .env.example file created with required variables
- [ ] src/utils/supabase/info.tsx throws error if env vars missing
- [ ] README.md updated with environment setup instructions
- [ ] No hardcoded credentials in client bundle
- [ ] Build fails fast with helpful error if env vars missing

##### REQ-0.1.2: Remove Sensitive Logging
**Files to Update**:
- src/utils/supabase/client.tsx (apiRequest function)
- src/App.tsx (auth state logging)

**Acceptance Criteria**:
- [ ] No token content, length, or expiry logged in production
- [ ] No session internals logged in production builds
- [ ] Debug logging only in development mode
- [ ] Error logging preserved for troubleshooting

##### REQ-0.1.3: Remove Client-Side Secrets
**Files to Remove/Update**:
- src/utils/server-constants.tsx (contains ADMIN_SECRET)

**Acceptance Criteria**:
- [ ] No secret values present in client bundles
- [ ] ADMIN_SECRET moved to server-only code
- [ ] Bundle analysis confirms no secrets leaked

### REQ-0.2: Critical Bug Fixes
**Priority**: Critical
**Estimated Effort**: 2 hours
**Dependencies**: None

#### Implementation Details

##### REQ-0.2.1: Fix Header Logo Display
```typescript
// File: src/App.tsx (header section)
<ImageWithFallback
  src={currentGroup?.icon || foosballIcon}
  alt={currentGroup?.name || "Foosball"} Logo
  className="w-9 h-9 md:w-11 md:h-11 object-cover rounded-full"
/>
```

**Acceptance Criteria**:
- [ ] Header shows group icon when currentGroup.icon exists
- [ ] Falls back to foosballIcon when no group icon
- [ ] No broken images or layout issues

##### REQ-0.2.2: Fix Server Import Error
```typescript
// File: src/supabase/functions/server/debug-routes.tsx
import { createClient } from 'npm:@supabase/supabase-js@2';
```

**Acceptance Criteria**:
- [ ] /debug/test-email-config endpoint starts without ReferenceError
- [ ] Server functions deploy successfully
- [ ] Debug routes work in development

## PHASE 1: CRITICAL REFACTORING (Week 1)

### REQ-1.1: App.tsx Component Decomposition
**Priority**: Critical
**Estimated Effort**: 16 hours
**Dependencies**: None

#### Acceptance Criteria
- [ ] App.tsx reduced to <200 lines
- [ ] Authentication logic extracted to separate context
- [ ] Data fetching logic extracted to custom hooks
- [ ] Routing logic extracted to separate component
- [ ] All existing functionality preserved
- [ ] No breaking changes to component interfaces

#### Implementation Details

##### REQ-1.1.1: Create Authentication Context
```typescript
// File: src/contexts/AuthContext.tsx
interface AuthContextType {
  isLoggedIn: boolean;
  currentUser: User | null;
  accessToken: string | null;
  login: (user: User, token: string) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

// Required functions to extract from App.tsx:
// - checkPasswordResetCallback
// - checkSession
// - handleLogin
// - handleLogout
// - Auth state change listener
```

**Acceptance Criteria**:
- [ ] AuthContext provides all authentication state
- [ ] Password reset logic handled within context
- [ ] Supabase auth state changes managed
- [ ] Session validation implemented
- [ ] Token refresh logic included

##### REQ-1.1.2: Create App Data Context
```typescript
// File: src/contexts/AppDataContext.tsx
interface AppDataContextType {
  users: User[];
  matches: Match[];
  currentGroup: Group | null;
  isLoadingData: boolean;
  error: string;
  refreshData: () => Promise<void>;
  updateUser: (user: User) => void;
  addMatch: (match: Match) => void;
}

// Required functions to extract from App.tsx:
// - loadAppData
// - loadCurrentGroup
// - handleMatchSubmit (data update portion)
// - handleProfileUpdate (data update portion)
```

**Acceptance Criteria**:
- [ ] All data fetching logic centralized
- [ ] Loading states managed
- [ ] Error handling implemented
- [ ] Data consistency maintained
- [ ] Optimistic updates supported

##### REQ-1.1.3: Create App Router Component
```typescript
// File: src/components/AppRouter.tsx
interface AppRouterProps {
  currentView: string;
  currentUser: User;
  // ... other minimal props
}

// Required functions to extract:
// - renderCurrentView
// - View switching logic
// - Navigation event handlers
```

**Acceptance Criteria**:
- [ ] All routing logic centralized
- [ ] View state management included
- [ ] Navigation events handled
- [ ] Player profile routing managed
- [ ] Match confirmation flows preserved

##### REQ-1.1.4: Create Loading Screen Component
```typescript
// File: src/components/LoadingScreen.tsx
interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  currentGroup?: Group;
}
```

**Acceptance Criteria**:
- [ ] Reusable loading component created
- [ ] Supports different loading states
- [ ] Group logo display logic included
- [ ] Responsive design maintained

### REQ-1.2: Console Logging Cleanup
**Priority**: High
**Estimated Effort**: 6 hours
**Dependencies**: None

#### Acceptance Criteria
- [ ] Logger utility created with environment-based logging
- [ ] All console.log replaced with logger.info
- [ ] Production logs limited to errors only
- [ ] Debug information available in development
- [ ] Log levels configurable

#### Implementation Details

##### REQ-1.2.1: Create Logger Utility
```typescript
// File: src/utils/logger.ts
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface Logger {
  error: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
}
```

**Acceptance Criteria**:
- [ ] Environment-based log level control
- [ ] Structured logging format
- [ ] Error logs always shown
- [ ] Development-only info/debug logs
- [ ] Performance impact minimized

##### REQ-1.2.2: Replace Console Statements
**Files to Update**: All 25 files with console statements

**Replacement Strategy**:
- `console.log` → `logger.info` or `logger.debug`
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`
- Remove redundant debug statements

**Acceptance Criteria**:
- [ ] Zero console.log statements in production
- [ ] Error logging preserved
- [ ] Debug information available in development
- [ ] No functionality lost

### REQ-1.3: Remove Unused Components
**Priority**: Medium
**Estimated Effort**: 2 hours
**Dependencies**: None

#### Files to Remove
1. `src/components/PasswordResetConfirm.tsx` - Empty stub component
2. `src/utils/auth-helpers.tsx` - Empty utility file
3. `src/utils/demo-data.tsx` - Empty utility file
4. `src/components/FoosballIcon.tsx` - Imported but unused

#### Acceptance Criteria
- [ ] All unused files deleted
- [ ] Import statements cleaned up
- [ ] No broken references
- [ ] Bundle size reduced
- [ ] Build process unaffected

## PHASE 2: ARCHITECTURE IMPROVEMENTS (Week 2)

### REQ-2.1: React Query Data Layer Implementation
**Priority**: High
**Estimated Effort**: 16 hours
**Dependencies**: REQ-1.1, REQ-1.2

#### REQ-2.1.1: Install and Configure React Query
```bash
npm install @tanstack/react-query
```

```typescript
// File: src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        if (error.status === 401 || error.status === 403) return false;
        return failureCount < 3;
      },
    },
  },
});

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Acceptance Criteria**:
- [ ] React Query properly configured
- [ ] Query client with appropriate defaults
- [ ] Provider wrapped around app
- [ ] Development tools available

#### REQ-2.1.2: Create Data Query Hooks
```typescript
// File: src/hooks/useQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/supabase/client';

export const useUserQuery = (accessToken: string) => {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => apiRequest('/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    enabled: !!accessToken,
  });
};

export const useCurrentGroupQuery = (accessToken: string) => {
  return useQuery({
    queryKey: ['group', 'current'],
    queryFn: () => apiRequest('/groups/current', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    enabled: !!accessToken,
  });
};

export const useUsersQuery = (accessToken: string) => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest('/users', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    enabled: !!accessToken,
  });
};

export const useMatchesQuery = (accessToken: string) => {
  return useQuery({
    queryKey: ['matches'],
    queryFn: () => apiRequest('/matches', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    enabled: !!accessToken,
  });
};
```

**Acceptance Criteria**:
- [ ] All data fetching replaced with React Query
- [ ] Proper cache invalidation on mutations
- [ ] Loading states managed by queries
- [ ] Error handling through query status
- [ ] Background refetching enabled

### REQ-2.2: Custom Hooks Implementation
**Priority**: High
**Estimated Effort**: 12 hours
**Dependencies**: REQ-1.1, REQ-1.2, REQ-2.1

#### REQ-2.1.1: Create useAuth Hook
```typescript
// File: src/hooks/useAuth.ts
interface UseAuthReturn {
  isLoggedIn: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
```

**Acceptance Criteria**:
- [ ] Authentication logic reusable across components
- [ ] Loading states managed
- [ ] Error handling included
- [ ] Session management automated
- [ ] TypeScript support complete

#### REQ-2.1.2: Create useAppData Hook
```typescript
// File: src/hooks/useAppData.ts
interface UseAppDataReturn {
  users: User[];
  matches: Match[];
  currentGroup: Group | null;
  refreshData: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
```

**Acceptance Criteria**:
- [ ] Data fetching logic centralized
- [ ] Loading states provided
- [ ] Error handling included
- [ ] Data caching implemented
- [ ] Automatic refresh on auth changes

### REQ-2.3: API Request Standardization
**Priority**: High
**Estimated Effort**: 8 hours
**Dependencies**: REQ-1.2

#### Implementation Details

##### REQ-2.2.1: Create useApiRequest Hook
```typescript
// File: src/hooks/useApiRequest.ts
interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

interface UseApiRequestReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (options?: ApiRequestOptions) => Promise<T>;
}
```

**Acceptance Criteria**:
- [ ] Consistent API request patterns
- [ ] Built-in loading states
- [ ] Error handling standardized
- [ ] Request deduplication
- [ ] Authentication header management

##### REQ-2.2.2: Centralized Error Handling
```typescript
// File: src/utils/errorHandler.ts
interface ErrorHandler {
  handleApiError: (error: Error) => string;
  handleAuthError: (error: Error) => void;
  handleValidationError: (errors: ValidationError[]) => Record<string, string>;
}
```

**Acceptance Criteria**:
- [ ] User-friendly error messages
- [ ] Consistent error handling patterns
- [ ] Automatic auth error handling
- [ ] Error logging integration
- [ ] Validation error formatting

### REQ-2.4: UX Improvements - Remove Browser Prompts
**Priority**: High
**Estimated Effort**: 8 hours
**Dependencies**: REQ-1.1

#### Implementation Details

##### REQ-2.4.1: Replace Password Reset Prompt
```typescript
// File: src/components/auth/PasswordResetForm.tsx
export function PasswordResetForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Component implementation with proper UI
}

// File: src/routes/PasswordReset.tsx
import { useSearchParams } from 'react-router-dom';

export function PasswordResetRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Handle password reset with proper UI instead of prompt()
}
```

**Acceptance Criteria**:
- [ ] /password-reset route implemented
- [ ] Password reset form component created
- [ ] checkPasswordResetCallback() navigates to route instead of prompt
- [ ] No browser prompt() calls remain
- [ ] Form validation and error handling

##### REQ-2.4.2: Replace Alert/Confirm Dialogs
**Files to Update**:
- src/components/Profile.tsx
- src/components/AdminPanel.tsx
- src/components/admin/*.tsx

```typescript
// Replace alert() with:
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Success</AlertDialogTitle>
      <AlertDialogDescription>{message}</AlertDialogDescription>
    </AlertDialogHeader>
  </AlertDialogContent>
</AlertDialog>
```

**Acceptance Criteria**:
- [ ] All alert() calls replaced with AlertDialog
- [ ] All confirm() calls replaced with confirmation dialogs
- [ ] Consistent UI across all user messages
- [ ] No native browser dialogs remain

### REQ-2.5: TypeScript Interface Implementation
**Priority**: Medium
**Estimated Effort**: 6 hours
**Dependencies**: None

#### Implementation Details

##### REQ-2.3.1: Core Type Definitions
```typescript
// File: src/types/index.ts
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  currentGroup?: string;
  rating?: number;
  avatar?: string;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  icon?: string;
  createdAt: string;
  adminIds: string[];
}

export interface Match {
  id: string;
  matchType: '1v1' | '2v2';
  player1?: PlayerReference;
  player2?: PlayerReference;
  team1?: Team;
  team2?: Team;
  score1: number;
  score2: number;
  groupId: string;
  createdAt: string;
}
```

**Acceptance Criteria**:
- [ ] All major entities typed
- [ ] Component props typed
- [ ] API responses typed
- [ ] No `any` types in component interfaces
- [ ] Generic types used appropriately

##### REQ-2.3.2: Component Prop Interfaces
```typescript
// File: src/types/componentProps.ts
export interface BaseComponentProps {
  currentUser: User;
  accessToken: string;
  group: Group;
}

export interface DataComponentProps extends BaseComponentProps {
  users: User[];
  matches: Match[];
  onDataChange?: () => void;
}
```

**Acceptance Criteria**:
- [ ] Shared prop interfaces defined
- [ ] Component-specific interfaces created
- [ ] Inheritance used appropriately
- [ ] Optional props clearly marked
- [ ] Event handler types defined

## PHASE 3: CODE QUALITY & ORGANIZATION (Week 3)

### REQ-3.1: Enhanced Component Cleanup
**Priority**: Medium
**Estimated Effort**: 6 hours
**Dependencies**: REQ-1.3

#### Additional Files to Remove
```bash
# Admin components (unused)
src/components/admin/AdminInstructions.tsx
src/components/admin/AdminSecretInfo.tsx
src/components/admin/PromotionForm.tsx
src/components/AdminCreator.tsx

# Login components (replaced by Login.tsx)
src/components/login/AuthForm.tsx
src/components/login/DemoSection.tsx
src/components/login/ServerStatus.tsx

# Styles (unused)
src/styles/globals.css
src/index.css

# Shadcn UI Components (unused)
src/components/ui/chart.tsx
src/components/ui/calendar.tsx
src/components/ui/drawer.tsx
src/components/ui/command.tsx
src/components/ui/sonner.tsx
src/components/ui/resizable.tsx
src/components/ui/carousel.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/hover-card.tsx
src/components/ui/context-menu.tsx
```

**Acceptance Criteria**:
- [ ] All unused admin components removed
- [ ] Login sub-components consolidated
- [ ] Unused UI components deleted
- [ ] No import references to deleted files
- [ ] Build succeeds after cleanup
- [ ] Bundle size measurably reduced

#### REQ-3.1.1: Dependency Pruning
```bash
# NPM packages to remove after component cleanup
npm uninstall recharts react-day-picker vaul cmdk sonner react-resizable-panels
npm uninstall embla-carousel-react input-otp

# Consider removing if unused:
npm uninstall class-variance-authority tailwind-merge clsx
```

**Acceptance Criteria**:
- [ ] Unused NPM packages removed
- [ ] package.json cleaned up
- [ ] No orphaned dependencies
- [ ] Bundle analysis shows size reduction
- [ ] All functionality preserved

### REQ-3.2: Shared Utilities Directory
**Priority**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: REQ-1.3

#### Implementation Details
```bash
# Create shared directory structure
mkdir src/shared

# Move duplicated utilities
mv src/utils/elo-system.tsx src/shared/
mv src/utils/server-constants.tsx src/shared/  # after removing secrets
mv src/utils/server-helpers.tsx src/shared/
```

```typescript
// File: src/shared/elo-system.tsx
// Add platform conditionals for browser vs Deno
const isServer = typeof Deno !== 'undefined';

export function calculateElo(/* params */) {
  // Unified ELO calculation logic
  // Handle environment differences
}
```

**Acceptance Criteria**:
- [ ] src/shared/ directory created
- [ ] Duplicated utilities consolidated
- [ ] Platform conditionals added where needed
- [ ] All imports updated to use shared utilities
- [ ] ELO calculations work on both client and server

### REQ-3.3: Component Organization
**Priority**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: REQ-1.1

#### New Directory Structure
```
src/components/
  auth/
    Login.tsx
    AuthForm.tsx
    ServerStatus.tsx
  dashboard/
    Dashboard.tsx
    Statistics.tsx
    MatchEntry.tsx
  admin/
    AdminPanel.tsx
    GroupManagement.tsx
    UserManagement.tsx
    MatchManagement.tsx
  common/
    Navigation.tsx
    LoadingScreen.tsx
    ErrorBoundary.tsx
  ui/
    [existing UI components]
```

**Acceptance Criteria**:
- [ ] Components logically grouped
- [ ] Import paths updated
- [ ] No broken references
- [ ] Build process unaffected
- [ ] File organization clear

### REQ-3.4: Error Boundary Implementation
**Priority**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: REQ-2.2.2

#### Implementation Details
```typescript
// File: src/components/common/ErrorBoundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends React.Component<Props, ErrorBoundaryState> {
  // Error boundary implementation with logging
}
```

**Acceptance Criteria**:
- [ ] Catches JavaScript errors
- [ ] Provides fallback UI
- [ ] Logs errors appropriately
- [ ] Allows error recovery
- [ ] Nested boundary support

### REQ-3.5: Build Configuration & Tooling
**Priority**: Medium
**Estimated Effort**: 6 hours
**Dependencies**: REQ-3.1

#### Implementation Details

##### REQ-3.5.1: ESLint and Prettier Setup
```bash
npm install --save-dev eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks
```

```json
// File: .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/prop-types": "off"
  }
}
```

**Acceptance Criteria**:
- [ ] ESLint configured with TypeScript rules
- [ ] Prettier configured for consistent formatting
- [ ] Pre-commit hooks optional but recommended
- [ ] No linting errors in main components
- [ ] Unused variables and imports flagged

##### REQ-3.5.2: Vite Config Cleanup
```typescript
// File: vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Remove version-pinned aliases not strictly required
    },
  },
});
```

**Acceptance Criteria**:
- [ ] Vite aliases simplified to essentials
- [ ] Build works with leaner configuration
- [ ] No unused aliases remain

##### REQ-3.5.3: Tailwind Config Cleanup
```javascript
// File: tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Remove unused paths like './pages/**/*', './app/**/*'
  ],
  // ... rest of config
}
```

**Acceptance Criteria**:
- [ ] Tailwind content paths pruned to only used directories
- [ ] Build performance improved
- [ ] No unused CSS generated

### REQ-3.6: Server Security Enhancements
**Priority**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: REQ-0.1

#### Implementation Details

##### REQ-3.6.1: CORS Configuration
```typescript
// File: src/supabase/functions/server/index.tsx
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

**Acceptance Criteria**:
- [ ] Production CORS restricts origins
- [ ] Development CORS allows localhost
- [ ] Only necessary methods and headers allowed

##### REQ-3.6.2: Request Validation
```bash
npm install zod
```

```typescript
// File: src/supabase/functions/server/validation.ts
import { z } from 'zod';

export const createMatchSchema = z.object({
  matchType: z.enum(['1v1', '2v2']),
  score1: z.number().min(0).max(10),
  score2: z.number().min(0).max(10),
  // ... other fields
});
```

**Acceptance Criteria**:
- [ ] Zod validation added to write endpoints
- [ ] Invalid payloads return clear 400 errors
- [ ] No server exceptions for common input errors
- [ ] Validation errors include helpful messages

### REQ-3.7: Testing Framework Setup
**Priority**: Low
**Estimated Effort**: 8 hours
**Dependencies**: REQ-2.1, REQ-2.2

#### Implementation Details

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

```typescript
// File: src/tests/auth.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AuthProvider, useAuth } from '../providers/AuthProvider';

describe('AuthProvider', () => {
  it('provides authentication state', () => {
    // Test auth provider functionality
  });
});
```

**Acceptance Criteria**:
- [ ] Vitest configured and running
- [ ] Auth provider tests written
- [ ] Query hooks tests written
- [ ] Router functionality tested
- [ ] 80%+ test coverage on critical paths

### REQ-3.8: Performance Optimization
**Priority**: Low
**Estimated Effort**: 6 hours
**Dependencies**: REQ-2.1

#### Implementation Areas
1. **Memoization**: Add React.memo to expensive components
2. **Callback Optimization**: Use useCallback for event handlers
3. **State Updates**: Optimize setState patterns
4. **Re-render Prevention**: Minimize unnecessary renders

**Acceptance Criteria**:
- [ ] Heavy components memoized
- [ ] Event handlers optimized
- [ ] State updates batched
- [ ] Performance monitoring added
- [ ] Bundle size optimized

## Implementation Timeline

### Week 1: Security & Critical Refactoring
**Day 1**: REQ-0.1, REQ-0.2 (Security hardening & critical fixes)
**Days 2-3**: REQ-1.1 (App.tsx decomposition)
**Day 4**: REQ-1.2 (Console logging cleanup)
**Day 5**: REQ-1.3 (Remove unused components)

### Week 2: Architecture & Data Layer
**Days 1-2**: REQ-2.1 (React Query implementation)
**Days 2-3**: REQ-2.2, REQ-2.3 (Custom hooks & API standardization)
**Days 4-5**: REQ-2.4, REQ-2.5 (UX improvements & TypeScript interfaces)

### Week 3: Quality & Organization
**Days 1-2**: REQ-3.1, REQ-3.2 (Enhanced cleanup & shared utilities)
**Day 3**: REQ-3.3, REQ-3.4 (Component organization & error boundaries)
**Days 4-5**: REQ-3.5, REQ-3.6 (Build tooling & server security)

### Week 4: Testing & Performance (Optional)
**Days 1-2**: REQ-3.7 (Testing framework)
**Days 3-4**: REQ-3.8 (Performance optimization)
**Day 5**: Final testing and documentation

## Testing Requirements

### Unit Testing
- [ ] All custom hooks tested
- [ ] Context providers tested
- [ ] Utility functions tested
- [ ] Component rendering tested

### Integration Testing
- [ ] Authentication flow tested
- [ ] Data fetching tested
- [ ] API integration tested
- [ ] Error scenarios tested

### Performance Testing
- [ ] Bundle size measured
- [ ] Render performance tested
- [ ] Memory usage monitored
- [ ] Network request optimization

## Success Metrics

### Security Metrics
- Environment variables: 100% required, no hardcoded fallbacks
- Sensitive logging: 0 token/session logs in production
- Client secrets: 0 secret values in client bundle
- CORS configuration: Restrictive origins in production

### Code Quality Metrics
- App.tsx lines: 952 → <200 (Target: 75% reduction)
- Console logs: 554 → <50 (Target: 90% reduction)
- TypeScript coverage: ~60% → >90%
- Component average size: <150 lines
- ESLint violations: <10 warnings, 0 errors

### Performance Metrics
- Bundle size reduction: Target 15-25% (after dependency pruning)
- First contentful paint: Maintain current performance
- Time to interactive: Improve by 10-15%
- Re-render count: Reduce by 30-40% (with React Query)
- Cache hit rate: >80% for data queries

### UX Metrics
- Browser prompts: 0 remaining (all replaced with UI components)
- Error messages: 100% user-friendly with dev details
- Deep linking: All routes support direct navigation

### Maintainability Metrics
- Cyclomatic complexity: Reduce by 40%
- Code duplication: <5%
- Test coverage: >80%
- Documentation coverage: 100% for public APIs

## Risk Assessment

### High Risk
- **Environment Variables**: Risk of breaking builds/deployments
  - *Mitigation*: Test in staging, provide clear documentation

- **Authentication Context**: Risk of breaking auth flow
  - *Mitigation*: Incremental rollout, comprehensive testing

- **React Query Migration**: Risk of data inconsistency
  - *Mitigation*: Parallel implementation, thorough cache invalidation testing

### Medium Risk
- **UX Prompt Replacement**: Risk of breaking user flows
  - *Mitigation*: Test all dialog interactions, maintain functionality parity

- **Dependency Pruning**: Risk of removing needed packages
  - *Mitigation*: Test in branch, bundle analysis before merging

- **API Standardization**: Risk of request failures
  - *Mitigation*: Parallel implementation, gradual migration

### Low Risk
- **Component Organization**: Risk of import issues
  - *Mitigation*: IDE refactoring tools, careful testing

- **Build Configuration**: Risk of breaking development workflow
  - *Mitigation*: Test locally, maintain existing scripts

## Dependencies

### External Dependencies
- React 18.3.1 (Context API, hooks)
- TypeScript 5.3.3 (type definitions)
- Supabase JS 2.39.0 (authentication)

### Internal Dependencies
- Existing component interfaces must be preserved
- Current authentication flow must remain functional
- Data fetching patterns must be maintained during transition

## Approval and Sign-off

- [ ] Technical Lead Review
- [ ] Architecture Review
- [ ] Security Review
- [ ] Performance Impact Assessment
- [ ] Timeline Approval

## Post-Implementation

### Monitoring
- [ ] Error rate monitoring
- [ ] Performance metrics tracking
- [ ] User experience monitoring
- [ ] Bundle size tracking

### Documentation Updates
- [ ] Component documentation
- [ ] API documentation
- [ ] Architecture documentation
- [ ] Development guidelines

### Team Training
- [ ] New patterns training
- [ ] Code review guidelines
- [ ] Testing procedures
- [ ] Debugging techniques

---

*This document serves as the authoritative guide for the Foosball Tracker refactoring initiative. All implementation should follow these specifications to ensure consistency and quality.*
