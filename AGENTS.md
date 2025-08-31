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

## Testing Requirements

- Run `npm run test:coverage` after adding new features—maintain 80% coverage minimum.
- For new components, create corresponding test files in the same directory.
- Use existing test patterns from `src/components/**/*.test.tsx`.
- Never commit code that breaks `npm run test:run`.

## Performance Constraints

- Bundle size must stay under 400KB—check with `npm run ci:bundle-analysis`.
- New imports must be code-split appropriately (see `vite.config.ts` manual chunks).
- Images must be optimized and lazy-loaded.
- API calls must use React Query patterns from hooks in `src/hooks/`.

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
