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

### Frontend
| Area | Description |
|------|-------------|
| **Login** | Real Google OAuth (better-auth). After login, redirect to dashboard. Header shows the user's **name, email and avatar**, with a **Logout** option. |
| **Dashboard** | Main UI with top header, sidebar (Scheduled / Sent), and a "Compose" button. |
| **Compose** | Subject + rich-text body, **CSV/text lead upload** (parsed for email addresses), start time, delay-between-emails, and hourly limit. Schedules through the backend API. |
| **Scheduled emails** | Table of email / subject / scheduled time / status with loading + empty states. |
| **Sent emails** | Table of email / subject / sent time / status (sent/failed) with loading + empty states. |
| **Search** | Debounced, page-scoped search (scheduled page filters `PENDING`, sent page filters `SENT/FAILED`) pulling from Elasticsearch via the backend. |
| **Refresh** | Refreshes the current page's list with a spinning indicator. |

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
| `ELASTICSEARCH_URL` | Elasticsearch endpoint (leave unset to use the Postgres fallback) |
| `ELASTICSEARCH_API_KEY` | (optional) ES API key, or `ELASTICSEARCH_USERNAME`/`ELASTICSEARCH_PASSWORD` |
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
- Attachment upload is collected in the compose UI but not yet transmitted to the backend; sending attachments would require adding an `attachments` field to the `EmailJob` schema + a Prisma migration and extending the worker's `sendMail`.
- The demo uses Ethereal, so emails aren't actually delivered — preview URLs are printed in the worker logs.
