# OutBox — Email Job Scheduler

A production-grade email scheduling service + dashboard built as a full-stack assignment.

**Stack:** Next.js (App Router) + Express + TypeScript + BullMQ (Redis) + PostgreSQL (Prisma) + Elasticsearch + Ethereal (fake SMTP) + better-auth (Google OAuth).

## Repository layout

```
OutBox/
├── client/   # Next.js frontend (React, Tailwind, TanStack Query, shadcn/ui)
└── server/   # Express + Prisma + BullMQ backend
```

---

## Features implemented

### Backend
| Area | Description |
|------|-------------|
| **Scheduler** | Schedule emails via `POST /api/emails/schedule`; jobs run through **BullMQ delayed jobs** (no cron). Jobs are enqueued with a computed `delay` so they fire at the scheduled time. |
| **Persistence on restart** | BullMQ stores pending/delayed jobs in Redis, so future emails are still sent after a server restart. The worker skips any job whose DB row is already `SENT`/`FAILED`, preventing duplicates or restarting from scratch. |
| **Concurrency** | Worker concurrency is configurable via `WORKER_CONCURRENCY` env. Safe under parallel processing. |
| **Min delay between sends** | BullMQ worker `limiter` (`MAX 1 per MIN_DELAY_MS`) throttles individual sends (default 2s). |
| **Per-sender rate limiting** | Hourly limit per sender using atomic Redis counters keyed by `senderId + hourWindow`, so it is safe across multiple workers/instances. Limits from env: `MAX_EMAILS_PER_HOUR` (global default), `MAX_EMAILS_PER_HOUR_PER_SENDER` (per-sender), and `SENDER_LIMITS` (per-sender map keyed by email). When hit, jobs are **delayed to the next hour window** (never dropped or failed) while preserving order. |
| **Elasticsearch search** | Emails are indexed into an `email_jobs` index on schedule/send/fail and are searchable via `GET /api/emails/search?q=` (with a Postgres `ILIKE` fallback if ES is down). |
| **BullMQ dashboard** | Live queue visibility at `/admin/queues` (Bull Board). |
| **Slack notification** | Real OAuth connect flow (`/api/slack/connect` → `/callback` → `/status`); a live webhook message is sent to Slack the moment a sender's hourly limit is reached. If Slack isn't connected, notifications silently no-op (no crash); reconnect works via upsert. |
| **Ethereal SMTP** | Emails are sent via Ethereal fake SMTP; preview URLs are logged by the worker. |
| **Attachments (bonus)** | Optional file attachments per email — base64-encoded from the compose UI, validated (max 20 files / 10 MB total), stored as a JSON column, and decoded back to binary before being added to the `sendMail` call. |

### Frontend
| Area | Description |
|------|-------------|
| **Login** | Real Google OAuth (better-auth). After login, redirect to dashboard. Header shows the user's **name, email and avatar**, with a **Logout** option. |
| **Dashboard** | Main UI with top header, sidebar (Scheduled / Sent), and a "Compose" button. |
| **Compose** | Subject + rich-text body, **CSV/text lead upload** (parsed for email addresses, showing the count detected), optional **file attachments**, start time, delay-between-emails, and hourly limit. Schedules through the backend API. |
| **Scheduled emails** | Table of email / subject / scheduled time / status with loading + empty states. |
| **Sent emails** | Table of email / subject / sent time / status (sent/failed) with loading + empty states. |
| **Search** | Debounced, page-scoped search (scheduled page filters `PENDING`, sent page filters `SENT/FAILED`) pulling from Elasticsearch via the backend. |
| **Refresh** | Refreshes the current page's list with a spinning indicator. |

---

## Requirement checklist (mapped to the assignment)

| Requirement | Status | Where |
|---|---|---|
| Express + TypeScript backend | ✅ | `server/` |
| Next.js + Tailwind + TypeScript frontend | ✅ | `client/` |
| PostgreSQL + Prisma | ✅ | `server/prisma/schema.prisma` |
| Accept email send requests via API | ✅ | `POST /api/emails/schedule` |
| Schedule via BullMQ delayed jobs (no cron) | ✅ | `server/src/lib/queue.ts` |
| Send via Ethereal SMTP (multiple senders) | ✅ | per-sender Ethereal transport |
| Searchable via Elasticsearch | ✅ | `search.service.ts` + `elastic.ts` |
| Live BullMQ dashboard | ✅ | `/admin/queues` (Bull Board) |
| Survives restart, no duplication | ✅ | Redis-delayed jobs + DB idempotency check |
| Configurable worker concurrency | ✅ | `WORKER_CONCURRENCY` |
| Min delay between sends | ✅ | BullMQ limiter, default 2s |
| Per-sender hourly rate limit (env-configurable) | ✅ | `MAX_EMAILS_PER_HOUR_PER_SENDER`, `SENDER_LIMITS` |
| Rate-limit state safe across instances | ✅ | atomic Redis counters |
| On limit hit: reschedule (don't drop) | ✅ | `moveToDelayed(nextHourWindow)` |
| Slack notification on limit hit (live OAuth) | ✅ | `slack.routes.ts` + webhook |
| Google OAuth login, name/email/avatar/logout | ✅ | better-auth |
| Compose: subject, body, CSV upload, start time, delay, hourly limit | ✅ | `ComposeForm.tsx` |
| Scheduled + Sent tables with loading/empty states | ✅ | dashboard pages |
| Attachments (bonus, beyond spec) | ✅ | full-stack, base64 → JSON → nodemailer |

---

## Prerequisites

- Node.js 18+
- A running **Redis** instance (e.g. via Docker or a hosted service like Upstash)
- A running **PostgreSQL** database
- (Optional) A hosted **Elasticsearch** instance
- Ethereal Email (auto-created per sender; no account needed)

### Recommended: Redis + Postgres via Docker

```bash
docker run -d --name outbox-redis -p 6379:6379 redis:7
docker run -d --name outbox-postgres -e POSTGRES_USER=outbox -e POSTGRES_PASSWORD=outbox -e POSTGRES_DB=outbox -p 5432:5432 postgres:16
```

---

## Backend setup (`server/`)

```bash
cd server
npm install
```

Create `server/.env` (see [Environment variables](#environment-variables)):

```bash
cp .env.example .env   # or create manually
```

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Seed an Ethereal sender for the first user (this is what makes sending work):

```bash
npx tsx src/seed.ts
```

Run the server (this starts the Express API **and** the BullMQ worker in-process):

```bash
npm run dev        # tsx watch
# or
npm run build && npm start
```

- API: http://localhost:8080
- Bull board: http://localhost:8080/admin/queues

---

## Frontend setup (`client/`)

```bash
cd client
npm install
```

Create `client/.env`:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

Run:

```bash
npm run dev        # http://localhost:3000
```

---

## Environment variables

### Server (`server/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `8080`) |
| `FRONTEND_URL` | Frontend origin (CORS) |
| `BACKEND_URL` | Backend base URL, used for auth + Slack redirect |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis/Upstash connection string (supports `rediss://` TLS) |
| `BETTER_AUTH_SECRET` | Secret used by better-auth (also signs Slack OAuth state) |
| `BETTER_AUTH_URL` | Trusted frontend origin for auth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint (required for the search requirement; if unset the Postgres search fallback is used) |
| `ELASTICSEARCH_API_KEY` | ES API key, or `ELASTICSEARCH_USERNAME`/`ELASTICSEARCH_PASSWORD` |
| `WORKER_CONCURRENCY` | Max parallel jobs the worker processes (default `5`) |
| `MIN_DELAY_MS` | Minimum ms between individual sends, via the BullMQ limiter (default `2000`) |
| `MAX_EMAILS_PER_HOUR` | Global default hourly limit (default `200`) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Per-sender hourly limit (applies to every sender when set) |
| `SENDER_LIMITS` | Optional per-sender map keyed by email, e.g. `{"alice@x.com": 20}` (highest priority) |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth app credentials for the rate-limit webhook |

### Client (`client/.env`)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL |

---

## How scheduling works

1. `POST /api/emails/schedule` validates the payload, verifies the sender belongs to the user, creates an `EmailJob` row, and indexes it in Elasticsearch.
2. The job is added to the BullMQ `email-sending` queue with `delay = scheduledAt - now`, so BullMQ (backed by Redis) is responsible for holding it until the target time.
3. The `email.worker.ts` worker picks up due jobs, applies per-sender rate limiting, sends via the sender's Ethereal SMTP transport, then marks the row `SENT` (or `FAILED`) and updates the Elasticsearch index.

### Restart persistence
- Delayed/pending jobs live in Redis, so after a restart BullMQ resumes them at their original times.
- Idempotency: the worker re-reads the job from the DB and skips rows already `SENT`/`FAILED`, so a job is never sent twice or restarted.

### Rate limiting & concurrency
- **Concurrency:** `WORKER_CONCURRENCY` controls parallel job processing.
- **Min delay:** the BullMQ worker `limiter` (`max: 1, duration: MIN_DELAY_MS`) guarantees a minimum gap between sends.
- **Hourly limit (per sender):** atomic Redis `INCR` on `ratelimit:<senderId>:<hourWindow>` with a 1h TTL. Over the limit → the job is `moveToDelayed` to the next hour boundary (with jitter to avoid a thundering herd). Counters are in Redis, so limits are correct even with multiple worker instances.
- **Trade-offs:** Redis counters can drift only if keys are lost; TTL + atomic incr keep this safe for the expected workload. A DB-backed counter would be an alternative for stricter durability.

---

## API endpoints (summary)

| Method | Path | Description |
|--------|------|-------------|
| `*` | `/api/auth/*` | better-auth (Google OAuth, session, sign-out) |
| `POST` | `/api/emails/schedule` | Schedule an email |
| `GET` | `/api/emails/scheduled` | Current user's `PENDING` emails |
| `GET` | `/api/emails/sent` | Current user's `SENT`/`FAILED` emails |
| `GET` | `/api/emails/search?q=&status=` | Elasticsearch search (optional status filter) |
| `GET` | `/api/emails/:id` | Single email job |
| `GET` / `POST` | `/api/senders` | List / auto-create the user's sender |
| `GET` | `/api/slack/connect` | Start Slack OAuth |
| `GET` | `/api/slack/callback` | Slack OAuth callback |
| `GET` | `/api/slack/status` | Slack connection status |
| `GET` | `/api/health` | Health check |
| `GET` | `/admin/queues` | Bull Board live queue dashboard |

---

## Notes / trade-offs

- Senders are Ethereal test accounts created automatically for the logged-in user (`POST /api/senders`) so the "From" address is the user's own email without manual SMTP config.
- The demo uses Ethereal, so emails aren't actually delivered — preview URLs are printed in the worker logs.

---

## Architecture overview & key decisions

### Request flow
1. `POST /api/emails/schedule` → auth session check → zod validation → sender ownership check → create `EmailJob` row (Postgres) → index in Elasticsearch → add to BullMQ `email-sending` queue **with `delay = scheduledAt - now`**.
2. The `email.worker.ts` worker (started in-process with the Express API) picks up due jobs → applies per-sender hourly rate limiting → sends via Ethereal SMTP → marks the row `SENT`/`FAILED` → updates the Elasticsearch index.

### Why BullMQ delayed jobs instead of cron
The assignment forbids cron. BullMQ stores delayed jobs in **Redis**, so scheduled times are persisted outside the process. This worker + queue both use the `email-sending` queue name (`src/lib/queue.ts` + `src/workers/email.worker.ts`).

### How persistence across restarts works
- Delayed/pending jobs live in Redis; after a restart BullMQ **resumes them at their original scheduled times** (BullMQ re-schedules due delayed jobs every second).
- **Idempotency:** the worker re-reads the job from Postgres before sending and **skips rows already `SENT`/`FAILED`**. So an email is never sent twice, even if the same job is retried or the server restarts mid-send.

### Rate limiting & concurrency — and the mapping to the assignment
| Requirement | Implementation |
|---|---|
| Configurable worker concurrency | `WORKER_CONCURRENCY` passed to the BullMQ `Worker` (parallel-safe; jobs re-fetch their own DB row). |
| Min delay between sends | BullMQ worker `limiter` (`max: 1, duration: MIN_DELAY_MS`, default 2000 ms → "min 2s between sends"). |
| Emails per hour (global) | `MAX_EMAILS_PER_HOUR` via **Redis** counters. |
| Emails per hour (per-sender) | `MAX_EMAILS_PER_HOUR_PER_SENDER` global-per-sender + `SENDER_LIMITS` per-email map. |
| Safe across multiple workers/instances | Counters are atomic **Redis `INCR`** keyed `ratelimit:<senderId>:<hourWindow>` with a 1h TTL — not in-memory. |
| When limit is hit — do not drop | `job.moveToDelayed(toNextHourWindow + jitter)` reschedules into the **next hour window** instead of failing, preserving order. |
| Slack notification on limit hit | Live OAuth → a real webhook message is sent the moment a sender hits its hourly limit (verified in the demo). If not connected, it silently no-ops; reconnecting works via upsert without redeploy. |

### Search
Indexed into Elasticsearch (`email_jobs`) with `attachmentNames` also searchable. If ES is down/not configured, the API transparently falls back to a Postgres `ILIKE` query so search never breaks.

### Other decisions
- **Better Auth** for Google OAuth (session stored in Postgres) — handles the auth flow robustly without custom crypto.
- **Ethereal senders auto-created per user** — no manual SMTP setup; the "From" is the user's own email.
- **No cron anywhere** — verified; scheduling is exclusively BullMQ delayed jobs.
- **Backend returns full rows (with sender) from Postgres after an ES hit** — keeps the API shape consistent and lets the frontend render sender info.
