# PulseWatch

A website and API monitoring platform with automatic incident detection and public
status pages — a focused reimplementation of what Uptime Kuma and Better Stack do.

PulseWatch probes your endpoints on a schedule, records latency and status codes,
decides when a blip becomes a real outage, and publishes a shareable status page
per project.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
shadcn/ui · Prisma 7 · PostgreSQL (Neon) · Auth.js v5 · Zod · React Hook Form ·
Recharts · Vitest · GitHub Actions · Vercel

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [How a check runs](#how-a-check-runs)
- [Security](#security)
- [Local setup](#local-setup)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scheduling with cron-job.org](#scheduling-with-cron-joborg)
- [Free-tier limits](#free-tier-limits)
- [Project layout](#project-layout)

---

## Features

**Accounts** — email/password (bcrypt hashes) or GitHub OAuth. Sessions are JWTs
`maxAge` 30 days. Sign-in and sign-up are rate limited per IP.

**Projects** — a project groups related monitors and owns exactly one status page.
Capped at 10 per account.

**Monitors** — each project holds up to 20. A monitor stores its URL, HTTP method
(`GET`/`HEAD`/`POST`), expected status codes, request timeout (1–30 s) and a fixed
check interval (1, 5, 10, 30 or 60 minutes). Monitors can be paused and resumed.

**Flap protection** — a single failed request never pages anyone. A monitor goes
`DOWN` only after `failureThreshold` consecutive failures and returns to `UP` only
after `recoveryThreshold` consecutive successes. Both thresholds are per monitor.

**Incidents** — opened and resolved automatically by the check engine. The owner
can post updates (`INVESTIGATING` → `IDENTIFIED` → `MONITORING` → `RESOLVED`) to
narrate what is happening without waiting for a probe to change state.

**Analytics** — uptime for 24 h / 7 d / 30 d / 90 d, a 90-day uptime bar per
monitor, an hourly response-time chart for the last 24 h, and a keyset-paginated
raw check log.

**Status pages** — publish a server-rendered page at `/status/<slug>` with an
overall banner, per-component 90-day uptime bars, active incidents and recent
history. `isPublic` can be turned off to take a page offline without deleting it.

---

## Architecture

### Feature-based modules

Everything for a domain lives together, so a change to "incidents" is a change to
one folder:

```
src/modules/<domain>/
  service.ts     Prisma access. Never reads the session — takes `userId`.
  queries.ts     Page-facing reads that resolve the current user themselves.
  actions.ts     "use server" entry points. Validate, authorize, revalidate.
  schema.ts      Zod schemas + pure mapping helpers.
  components/    Presentational components for that domain.
  constants.ts   Domain limits and defaults.
```

Routes under `src/app` are thin: they call a `queries.ts` helper, destructure, and
render. The `(app)` route group holds the authenticated shell (its layout calls
`requireUser()`); `(auth)` holds sign-in/sign-up; `/status/[slug]` deliberately sits
outside both because it must be reachable by anyone.

### Why a driver adapter

Prisma 7 requires a driver adapter, so the database is reached through
`@prisma/adapter-pg` and an explicit `pg` pool (`src/lib/db.ts`). That is not just
ceremony: it lets us set the pool size, cache the client on `globalThis` so dev
hot-reloads do not leak pools, and pin `timezone=UTC` on every session.

### Why the leases

Two cron invocations can overlap (a slow run meets the next tick). Instead of
trusting the scheduler, the engine claims work atomically:

```sql
UPDATE "monitors" SET "lockedUntil" = $lease
WHERE "id" IN (
  SELECT "id" FROM "monitors"
  WHERE "enabled" = true AND "nextCheckAt" <= $now
    AND ("lockedUntil" IS NULL OR "lockedUntil" <= $now)
  ORDER BY "nextCheckAt" LIMIT $batch
  FOR UPDATE SKIP LOCKED
)
RETURNING ...
```

`FOR UPDATE SKIP LOCKED` hands each invocation a disjoint set of rows, and the
durable `lockedUntil` column means a monitor abandoned by a dead process is retried
after the lease expires instead of being stuck forever.

### Why SQL aggregations

A monitor on a 1-minute interval writes ~43,200 rows a month. Averaging that in
Node would be slow and memory-hungry, and it would collapse the moment a project
has 20 monitors. Uptime, latency percentiles and per-day buckets are therefore
computed in Postgres with `$queryRaw` — `FILTER (WHERE ...)` for filtered counts,
`PERCENTILE_CONT(0.95) WITHIN GROUP` for p95, and `generate_series` to give charts
a gap-free x-axis.

### Why `DailyRollup`

Minute-level detail is only useful recently. A daily job collapses each finished
UTC day into one `daily_rollups` row per monitor (totals, latency min/avg/max,
downtime) and then deletes raw checks past the 90-day retention window. Long-range
charts read the small rollup table; recent charts and the check log read raw rows.

### Timestamps

Everything is stored and computed in UTC. Because Prisma maps `DateTime` to
`timestamp without time zone`, any implicit `timestamp ↔ timestamptz` conversion
would depend on the server's default zone — so the pool pins the session to UTC and
day buckets are derived from `startOfUtcDay`/`addUtcDays`.

---

## How a check runs

```
cron-job.org ──POST /api/cron/run-checks (Bearer CRON_SECRET)──▶ Vercel function
                                                                    │
   1. claim   lease up to 50 due monitors (FOR UPDATE SKIP LOCKED)  │
   2. probe   p-limit(10) concurrent SSRF-safe HTTP probes          │
   3. commit  one transaction per monitor:                          │
              insert check_result · update status/counters ·        │
              open or resolve the incident                         ◀─┘
```

The network probe happens **outside** the transaction, so a pooled connection is
never held open while waiting on a slow third-party site. One monitor throwing is
caught, its lease is released, and the rest of the batch continues.

A second job, `POST /api/cron/rollup`, runs daily to build `daily_rollups` and prune
old raw checks.

---

## Security

**SSRF protection is mandatory** for every monitor URL (`src/lib/ssrf.ts`). A user
chooses what our server fetches, which makes this the highest-risk surface.

1. **Shape** — only `http`/`https`, no embedded credentials, and the port must be
   in a small allow-list.
2. **Resolution** — the hostname is resolved and *every* returned address must be
   globally routable. Loopback, private (`10/8`, `172.16/12`, `192.168/16`),
   link-local (`169.254/16` — the cloud metadata range), CGNAT, unique-local,
   multicast and IPv4-mapped IPv6 addresses are all rejected. A hostname that
   resolves to a mix of public and private addresses is refused (fail closed).
3. **Pinning** — the probe uses `node:http`/`node:https` (not `fetch`) because they
   expose a `lookup` hook. We resolve once, validate, then force the socket to that
   exact IP while keeping the hostname for the `Host` header and TLS SNI. This
   closes DNS rebinding.
4. **Redirects** — followed manually, at most 5 hops, each re-validated from
   scratch. Bodies are capped at 1 MB and every request has a hard timeout.

**Cron endpoints** fail closed. `CRON_SECRET` is compared with `timingSafeEqual`
over SHA-256 digests (constant time, never throws on a length mismatch), a missing
secret returns 500 rather than "no auth required", and a wrong secret returns an
identical 401.

**Authorization** is enforced in every `service.ts` (`where: { project: { userId } }`)
and again in every server action. A monitor id from another account returns `null`,
and the UI cannot tell "not found" from "not yours".

**Rate limiting** (`src/lib/rate-limit.ts`) covers sign-in, sign-up and the cron
endpoint. It is in-memory and therefore per-instance — an accepted free-tier
trade-off, documented rather than pretended away.

---

## Local setup

Requires **Node 24+** and **pnpm**.

```bash
pnpm install
cp .env.example .env     # then fill in the values below
pnpm db:migrate          # create the schema in your dev database
pnpm dev                 # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string (host contains `-pooler`) |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | no | Enables the GitHub sign-in button |
| `AUTH_GITHUB_SECRET` | no | |
| `CRON_SECRET` | yes | `openssl rand -hex 32`; must be ≥16 chars |
| `LOG_LEVEL` | no | `debug` (default off-prod) · `info` · `warn` · `error` |

Environment is validated at boot (`src/lib/env.ts`) — a missing or malformed
variable crashes immediately with a readable message instead of failing later
inside a request. CI sets `SKIP_ENV_VALIDATION=1` because a build has no secrets.

A local dev database can be any Postgres instance. Point `DATABASE_URL` at it and
run `pnpm db:migrate`.

---

## Database

Prisma schema: [`prisma/schema.prisma`](prisma/schema.prisma).
Migrations live in `prisma/migrations`.

| Command | Use |
| --- | --- |
| `pnpm db:migrate` | Create + apply a migration in development |
| `pnpm db:deploy` | Apply pending migrations (CI / production) |
| `pnpm db:generate` | Regenerate the client into `src/generated/prisma` |
| `pnpm db:studio` | Browse the data |

Indexes are chosen for the two hot queries: `(enabled, nextCheckAt)` for "which
monitors are due?" and `(monitorId, checkedAt DESC)` for "the last N checks".

---

## Testing

```bash
pnpm test:run        # single run
pnpm test            # watch mode
pnpm test:coverage
```

Unit tests cover the logic that is easiest to get subtly wrong and cheapest to
pin down: the SSRF rules (`ssrf.test.ts`), the incident state machine
(`state.test.ts`), the monitor and status-page schemas, and the formatting
helpers. There is no database in the test loop — services take a `userId` and are
exercised through those pure modules instead.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and a production build
on every push and pull request.

---

## Deployment

Free-tier path: **Neon** for Postgres, **Vercel** for hosting, **cron-job.org** for
scheduling.

### 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and copy the **pooled**
   connection string.
2. Apply the migrations from your machine, pointing at Neon:

   ```bash
   DATABASE_URL="<neon pooled url>" pnpm db:deploy
   ```

   Migrations use the *unpooled* connection by default; if the pooled URL gives you
   trouble with DDL, run the same command with the direct (non-pooler) host.

### 2. App (Vercel)

1. Import the GitHub repository into Vercel. The framework preset is detected;
   the build command comes from `package.json` (`prisma generate && next build`).
2. Add the environment variables from the table above to **Production** (and
   Preview, if you use it). Set `AUTH_SECRET` and `CRON_SECRET` to fresh random
   values — do not reuse your local ones.
3. Deploy, then confirm the app boots (env validation runs on first request).
4. In your GitHub OAuth app, add the production callback URL:
   `https://<your-app>.vercel.app/api/auth/callback/github`.

### 3. Scheduler (cron-job.org)

Vercel's Hobby plan does not run cron jobs frequently enough for 1-minute
monitors, so scheduling is delegated to cron-job.org. Create **two** jobs:

| | Run checks | Daily rollup |
| --- | --- | --- |
| URL | `https://<your-app>.vercel.app/api/cron/run-checks` | `https://<your-app>.vercel.app/api/cron/rollup` |
| Method | `POST` | `POST` |
| Schedule | every 1 minute | daily at 00:15 UTC |
| Header | `Authorization: Bearer <CRON_SECRET>` | `Authorization: Bearer <CRON_SECRET>` |

Both endpoints require the `Authorization` header; without it they return 401 and
nothing runs. Expect a `200` with a JSON summary:

```json
{ "ok": true, "claimed": 3, "succeeded": 3, "failed": 0,
  "incidentsOpened": 0, "incidentsResolved": 0, "errored": 0, "durationMs": 812 }
```

> **Note:** the free tiers are for demonstration. For real workloads you would
> move the cron jobs onto the platform (or a dedicated worker), raise the pool
> size, and replace the in-memory rate limiter with a shared store.

---

## Free-tier limits

| Limit | Value | Enforced in |
| --- | --- | --- |
| Projects per account | 10 | `projects` service + UI |
| Monitors per project | 20 | `monitors` service + UI |
| Monitor intervals | 1 / 5 / 10 / 30 / 60 min | Zod enum + `<Select>` |
| Raw check retention | 90 days | daily rollup job |
| Probes per cron run | 50 monitors, 10 concurrent | engine constants |
| Status page cache | 60 s (ISR) | `revalidate` on the route |

Limits are enforced in the service layer, not only in the UI — the buttons are a
convenience, the server is the boundary.

---

## Project layout

```
src/
  app/
    (app)/            authenticated shell: dashboard, projects, monitors, incidents, status pages
    (auth)/           sign-in, sign-up
    api/cron/         run-checks, rollup
    api/auth/         Auth.js handler
    status/[slug]/    public status page (unauthenticated)
  components/         cross-cutting UI (app header, empty state, charts, status badges)
  components/ui/      shadcn/ui primitives
  lib/                db, env, ssrf, cron-auth, rate-limit, logger, format, dates
  modules/            auth · projects · monitors · checks · incidents · status-pages
```

---

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
