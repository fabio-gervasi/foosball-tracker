# AGENTS.md

## Environment Setup Rules

- Do **not** read from or write to any `.env` files—agents must not access application or CI/CD secrets directly.
- All required environment configuration (e.g. Supabase credentials) must be managed externally by authorized developers and/or CI/CD workflows.
- If environment variables are missing, log a message and notify the relevant maintainer—never attempt to fetch or modify secrets.

## Code Modification Guidelines

- Always run `npm run type-check` before committing TypeScript changes.
- Never add server secrets or `ADMIN_SECRET` to client-side code in `src/`.
- When modifying components, maintain the existing context pattern: `AuthContext` for auth, `AppDataContext` for app state.
- Always update type definitions in `src/types/index.ts` when adding new data structures.
- Never bypass Row Level Security—ensure all database queries respect user permissions.

## CI/CD Workflow Requirements

### Branch Naming Conventions

All branches must follow these naming patterns:
- `feature/{description}` - New features (e.g., `feature/user-authentication`)
- `bugfix/{description}` - Bug fixes (e.g., `bugfix/login-validation-error`)
- `hotfix/{description}` - Emergency fixes (e.g., `hotfix/security-patch`)
- `req-{number}-{number}-{description}` - REQ implementations (e.g., `req-5-2-branch-workflow-automation`)

### Pull Request Target Validation

| Source Branch Pattern | Valid Target | Invalid Target | Reason |
|----------------------|--------------|----------------|--------|
| `feature/*`, `bugfix/*`, `req-*-*-*` | `dev` only | `main` | Features need dev testing first |
| `hotfix/*` | `main` or `dev` | None | Emergency fixes can go direct |
| `dev` | `main` only | None | Production deployment path |

### Branch Protection Rules

**Main Branch Requirements:**
- ✅ `quality-gates` status check must pass
- ✅ At least 1 approving PR review required
- ✅ All conversations must be resolved
- ❌ Preview testing is skipped (REQ-5.2.6 optimization)

**Dev Branch Requirements:**
- ✅ `quality-gates` status check must pass
- ✅ `preview-testing` status check must pass
- ✅ At least 1 approving PR review required
- ✅ All conversations must be resolved

## Testing Requirements

- Run `npm run test:coverage` after adding new features—maintain 80% coverage minimum.
- For new components, create corresponding test files in the same directory.
- Use existing test patterns from `src/components/**/*.test.tsx`.
- Never commit code that breaks `npm run test:run`.

### Quality Gates (CI Pipeline Requirements)

All code changes must pass these automated quality checks:
- **ESLint Validation**: Code style and quality (0 errors, <10 warnings)
- **Prettier Formatting**: Consistent code formatting (must pass)
- **TypeScript Compilation**: Type safety validation (no errors)
- **Test Suite**: All 63+ tests must pass (100% pass rate)
- **Security Audit**: npm audit for vulnerabilities (no high/critical issues)
- **Build Verification**: Successful production build (must complete)

### Preview Testing (Dev Branch PRs)

When creating PRs targeting the `dev` branch, these additional tests run:
- **E2E Testing**: Basic functionality, user flows, navigation
- **Lighthouse Audit**: Performance score >85%, Core Web Vitals within thresholds
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, CSP validation
- **Analytics Testing**: Custom events and tracking validation

## Performance Constraints

- Bundle size must stay under 400KB—check with `npm run ci:bundle-analysis`.
- New imports must be code-split appropriately (see `vite.config.ts` manual chunks).
- Images must be optimized and lazy-loaded.
- API calls must use React Query patterns from hooks in `src/hooks/`.

### Performance Budget Requirements

**Bundle Size Limits:**
- JavaScript: 400KB maximum (script resource type)
- CSS: 50KB maximum (stylesheet resource type)
- Images: 200KB maximum per route
- Total bundle: 1MB maximum
- Dashboard route: 500KB JS, 1.2MB total (due to complexity)

**Core Web Vitals Thresholds:**
- First Contentful Paint (FCP): < 2.0 seconds (good: < 1.8s)
- Largest Contentful Paint (LCP): < 2.5 seconds (good: < 2.5s)
- Cumulative Layout Shift (CLS): < 0.1 (good: < 0.1)
- Time to Interactive (TTI): < 3.8 seconds (good: < 3.5s)
- Total Blocking Time (TBT): < 200ms (good: < 200ms)

**Lighthouse Score Requirements:**
- Performance: > 85%
- Accessibility: > 90%
- Best Practices: > 85%
- SEO: > 90%

**Network Performance:**
- Max response time: 3 seconds
- Max error rate: 5%
- Network throttling: 40ms RTT, 10Mbps throughput

### Performance Monitoring

- Performance regression detection with 10% threshold
- Bundle analysis on every build
- Lighthouse audits on preview deployments
- Core Web Vitals tracking across all routes

## Database and API Rules

- All user operations must include group context (`currentGroup` field).
- Match submissions require `winnerEmail` for server validation.
- For new API endpoints, follow the Hono patterns in `supabase/functions/`.
- Real-time subscriptions must clean up properly in useEffect cleanup.

## Deployment Safety

- Never deploy without running `npm run ci:quality-gates` locally first.
- Performance budget violations block deployment—fix before pushing.
- Monitor deployments with `npm run ci:health-check [URL]` after going live.
- Use `npm run rollback:manual` if issues occur in production.

### Deployment Workflow Requirements

**Development → Dev Branch:**
1. Create feature/bugfix branch with proper naming
2. Make changes and ensure all quality gates pass locally
3. Create PR targeting `dev` branch (not `main`)
4. Wait for CI quality gates and preview testing to pass
5. Get at least 1 approving review
6. Merge to dev branch

**Dev → Main Branch (Production):**
1. Create PR from `dev` to `main` branch
2. CI quality gates must pass (preview testing is skipped per REQ-5.2.6)
3. Get at least 1 approving review
4. All conversations must be resolved
5. Merge triggers production deployment

**Emergency Hotfix Process:**
1. Create `hotfix/*` branch from `main`
2. Make minimal necessary changes
3. Create PR targeting `main` (or `dev` for less critical fixes)
4. Use `[HOTFIX]` prefix in PR title
5. May require admin override for expedited deployment
6. Deploy immediately after merge with enhanced monitoring

### Automated Deployment Scripts

Available npm scripts for deployment management:
- `npm run ci:quality-gates` - Run all quality checks locally
- `npm run ci:preview-test [URL]` - Test preview deployment
- `npm run ci:health-check [URL]` - Check production deployment health
- `npm run rollback:manual` - Manual rollback to previous deployment
- `npm run rollback:auto` - Monitor and auto-rollback if unhealthy

## File Organization Rules

- React components belong in `src/components/[category]/`.
- Business logic goes in `src/hooks/`.
- Shared utilities in `src/utils/`.
- Type definitions in `src/types/index.ts`.
- Never create components directly in `src/` root.

## Common Pitfalls to Avoid

- Never use localStorage/sessionStorage—app runs in a sandbox environment.
- Do not create components without TypeScript interfaces.
- Do not add dependencies without checking bundle impact.
- Do not modify authentication flow without understanding Supabase RLS.
- Do not create database queries outside of established hook patterns.
