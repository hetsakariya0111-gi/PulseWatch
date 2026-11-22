# projects module

Organizing monitors into user-owned projects.

Convention for every module in this codebase:
- `schema.ts`      — Zod schemas for input validation (single source of truth for types)
- `service.ts`     — business logic + Prisma data access (no HTTP concerns)
- `actions.ts`     — Next.js Server Actions that call the service (auth checks live here)
- `queries.ts`     — read-only data fetchers for Server Components
- `components/`    — module-specific React components

Keep modules independent: import from `@/lib/*` and `@/components/ui/*`, but do not
import across modules except through a module's public `index.ts`.
