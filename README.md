# OutBox — Email Job Scheduler

A **production-grade email scheduling service + dashboard** that accepts email send requests via an API, schedules them for a specific time using **BullMQ + Redis as a persistent job scheduler** (no cron), sends them through **Ethereal fake SMTP**, survives server restarts without losing jobs, and exposes a full **Next.js dashboard** to schedule, view, and search emails.
<img width="1912" height="871" alt="image" src="https://github.com/user-attachments/assets/db2e6787-9c9b-4be5-be01-902a09203a1a" />
<img width="1896" height="903" alt="Screenshot 2026-09-03 095937" src="https://github.com/user-attachments/assets/595cdfa5-5551-4378-859f-9e9a6be17b04" />



Built as an intern assignment for ReachInbox, mapped line-by-line to the requirements (see the [Requirement checklist](#requirement-checklist)).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) · React · TypeScript · Tailwind CSS · TanStack Query · shadcn/ui · TipTap editor |
| Backend | Express.js (TypeScript) · better-auth (Google OAuth) |
| Queue | BullMQ (backed by Redis / Upstash) |
| Database | PostgreSQL · Prisma ORM |
| Search | Elasticsearch (with Postgres `ILIKE` fallback) |
| Email (SMTP) | Ethereal (fake SMTP) |
| Notifications | Slack Incoming Webhooks (rate-limit alerts) |

---

## Repository layout

```
OutBox/
├── client/   # Next.js frontend (React, Tailwind, TanStack Query, shadcn/ui)
└── server/   # Express + Prisma + BullMQ backend
```

### Backend structure (`server/`)

```
server/
├── prisma/
│   ├── schema.prisma          # Data models (User, Session, Account, Sender, EmailJob, SlackIntegration, ...)
│   └── migrations/            # Versioned schema migrations
└── src/
    ├── index.ts               # Express bootstrap, CORS, route mounting, Bull Board
    ├── lib/
    │   ├── auth.ts            # better-auth config (Google OAuth, cross-site cookies)
    │   ├── db.ts              # Prisma client (pg adapter / connection pool)
    │   ├── redis.ts           # Redis connection for BullMQ + rate-limit counters
    │   ├── queue.ts           # BullMQ queue definition (email-sending)
    │   ├── elastic.ts         # Elasticsearch client
    │   ├── session.ts         # Session helpers for route guards
    │   └── url.ts             # URL/backend/frontend helpers
    ├── routes/
    │   ├── email.routes.ts    # POST /schedule, GET /scheduled, GET /sent, GET /:id
    │   ├── search.routes.ts   # GET /api/emails/search (Elasticsearch)
    │   ├── sender.routes.ts   # GET / POST /api/senders
    │   ├── oauth.routes.ts    # GET /api/oauth/google (first-party OAuth kickoff)
    │   └── slack.routes.ts    # connect / callback / status
    ├── controllers/
    │   ├── email.controller.ts
    │   └── slack.controller.ts
    ├── services/
    │   ├── email.service.ts   # Scheduling + send orchestration
    │   ├── search.service.ts  # Elasticsearch indexing + queries
    │   └── slack.service.ts   # Webhook send + connection state
    ├── workers/
    │   └── email.worker.ts    # BullMQ worker: rate-limit, send, idempotency
    ├── middleware/
    │   ├── auth.middleware.ts
    │   ├── require-auth.middleware.ts
    │   └── validate.middleware.ts
    ├── utils/
    │   ├── ethereal.ts        # Per-sender Ethereal transport
    │   ├── rateLimiter.ts     # Redis per-sender hourly counters
    │   └── slack.ts           # Slack webhook helper
    ├── validators/
    │   └── email.validator.ts # zod schemas + attachment size checks
    └── types/                 # Shared TypeScript types
```

### Frontend structure (`client/`)

```
client/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx            # Google + email login
│   ├── (protected)/
│   │   ├── layout.tsx                # Authenticated shell (Header + Sidebar)
│   │   └── dashboard/
│   │       ├── page.tsx              # redirects to /dashboard/scheduled
│   │       ├── scheduled/page.tsx    # Scheduled emails table
│   │       ├── sent/page.tsx         # Sent emails table
│   │       ├── compose/page.tsx      # Compose + schedule
│   │       └── emails/[id]/page.tsx  # Single email detail
│   ├── layout.tsx                    # Root layout (theme, query provider)
│   └── page.tsx                      # Landing / redirect
├── components/
│   ├── layout/  (Header, Sidebar)
│   ├── email/   (ComposeForm, EmailTable, SearchBar)
│   ├── providers/ (query-provider, theme-provider)
│   └── ui/      (shadcn/ui primitives)
├── features/
│   ├── auth/
│   │   ├── components/ (login-form, sign-out-button)
│   │   ├── hooks/      (use-session)
│   │   └── lib/        (auth-client, auth-server, require-auth, unauth, auth-routes)
│   └── emails/
│       ├── api/     (email.ts — fetch wrapper with credentials)
│       ├── hooks/   (useEmail.ts — TanStack Query hooks)
│       └── components/
├── hooks/            # Generic hooks (e.g. use-mobile)
├── lib/              # backend-url, types, utils
└── public/
```

---

## Architecture

```
                          ┌────────────────────────────────────────────────┐
                          │               FRONTEND (Next.js)              │
                          │  Google login · Dashboard · Compose           │
                          │  CSV parse · Attachments · Search · Slack     │
                          └──────────────────────┬─────────────────────────┘
                                                 │ REST (JSON) · cookies
                                                 ▼
                          ┌────────────────────────────────────────────────┐
                          │               BACKEND (Express)                │
                          │  better-auth  ──►  POST /api/emails/schedule   │
                          │  session        │                              │
                          │  guard          │ ① validate (zod)             │
                          │                 ▼                              │
                          │          create EmailJob row                   │
                          └──────────┬──────────────────┬──────────────────┘
                                     │                  │
                                persist row       index & search
                                     ▼                  ▼
                          ┌──────────────────┐  ┌──────────────────┐
                          │   PostgreSQL     │  │  Elasticsearch   │
                          │  (Prisma / jobs, │  │  (email_jobs)    │
                          │  senders, users) │  │  + Postgres      │
                          └──────────┬───────┘  │  fallback        │
                                     │          └──────────────────┘
                                     │ enqueue job (delay = scheduledAt − now)
                                     ▼
                          ┌────────────────────────────────────────────────┐
                          │        Redis  ◄─ BullMQ queue                   │
                          │        • persistent delayed jobs                 │
                          │        • rate-limit counters (per sender/hr)     │
                          └──────────────────────┬─────────────────────────┘
                                                 │ worker picks up due jobs
                                                 ▼
                          ┌────────────────────────────────────────────────┐
                          │            email.worker (BullMQ)               │
                          │  concurrency · min-delay limiter               │
                          │  idempotency · per-sender hourly rate limit    │
                          └───────────────────┬─────────────────┬──────────┘
                                              │ allowed         │ limit hit
                                              ▼                 ▼
                          ┌────────────────┐      ┌──────────────────────────┐
                          │  Ethereal SMTP │      │ moveToDelayed(next hour) │
                          │  (fake send)   │      │ + Slack webhook alert    │
                          └────────────────┘      └──────────────────────────┘
```

**Flow in one line:** `Frontend ──► Express ──► Postgres (persist) + Elasticsearch (index) ──► Redis/BullMQ (delayed job) ──► Worker ──► Ethereal (send) | Slack (rate-limit alert)`

---

## How it works

### 1. Google Login (better-auth)

1. User clicks **Login with Google** → the client does a first-party navigation to `/api/oauth/google`, which the Next.js app **proxies to the backend** (`rewrites` in `next.config.ts`). This keeps everything on the same origin as the UI.
2. better-auth stores the OAuth state in the database, redirects to Google, and after consent redirects back to `/api/auth/callback/google` — also proxied, and because the server's `baseURL` points at the **frontend origin**, this callback runs through the app (not directly at the backend origin).
3. A session is created in PostgreSQL and a **first-party `Secure` session cookie is set on the frontend origin** (the `Set-Cookie` passes back through the proxy).
4. The user is redirected to `/dashboard/scheduled`. The header/sidebar call same-origin `getSession()`, send the first-party cookie, and render the user's name, email, and avatar.

> **Why same-origin?** With a split Vercel frontend + Render backend, a cookie set on the backend domain becomes a **third-party** cookie to the frontend, and browsers with third-party cookies blocked (Chrome incognito / fresh profiles) drop it — so the avatar/name never appeared. Proxying `/api/*` through the app makes the session cookie **first-party**, so login state works in every browser.

### 2. Scheduling an email (request lifecycle)

When the user clicks **Send**, the client POSTs one job per recipient to `POST /api/emails/schedule`:

1. **Authenticate** — `auth.api.getSession()`; 401 if not logged in.
2. **Validate** — zod schema for `subject`, `body`, `recipientEmail`, `scheduledAt`; attachment size guard (max 20 files / 10 MB total).
3. **Ownership** — verify the chosen `senderId` belongs to the session user.
4. **Persist** — create an `EmailJob` row in PostgreSQL (status `PENDING`).
5. **Index** — push the job into Elasticsearch so it is immediately searchable.
6. **Enqueue** — add a BullMQ job to the `email-sending` queue with `delay = scheduledAt - now`. The DB row is deleted if enqueueing fails, so an accepted `PENDING` row can never become an orphan with no worker job.

### 3. Sending (worker lifecycle)

`email.worker.ts` consumes due jobs and, for each:

1. **Idempotency check** — re-reads the `EmailJob` from the DB and **skips rows already `SENT`/`FAILED`** so an email is never sent twice (even after a restart or a retried job).
2. **Rate limit check** — reads an atomic Redis counter, then either:
   - **Allowed** → send via the sender's Ethereal transport, mark `SENT`, update Elasticsearch.
   - **Blocked** → `moveToDelayed()` into the **next hour window** (never dropped or failed) and fire a **live Slack notification**.
3. **Success/failure** — marks the row `SENT`/`FAILED`, updates Elasticsearch, and logs the Ethereal preview URL.

### 4. Restart persistence

- Delayed/pending jobs live in **Redis**, so after a server restart BullMQ resumes them at their original scheduled times (BullMQ re-schedules due delayed jobs automatically).
- The worker's DB idempotency check guarantees no email is **re-sent or restarted from scratch**.
- A same email/job is therefore never sent more than once.

### 5. Rate limiting & concurrency

| Requirement | Implementation (where) |
|---|---|
| Configurable worker concurrency | `WORKER_CONCURRENCY` passed to the BullMQ `Worker` (`workers/email.worker.ts`) |
| Min delay between sends | BullMQ worker `limiter` — `max: 1, duration: MIN_DELAY_MS` (default **2000 ms → "min 2s between sends"**) |
| Emails per hour (global default) | `MAX_EMAILS_PER_HOUR` via **Redis** counters |
| Emails per hour (per-sender) | `MAX_EMAILS_PER_HOUR_PER_SENDER` global-per-sender + `SENDER_LIMITS` per-email map |
| Safe across multiple workers/instances | Atomic **Redis `INCR`** keyed `ratelimit:<senderId>:<hourWindow>` with a 1-hour TTL — never in-memory only (`utils/rateLimiter.ts`) |
| On limit hit — do not drop | `job.moveToDelayed(nextHourBoundary + jitter)` reschedules into the next hour window, preserving order, instead of failing |
| Slack notification on limit hit (live) | Real OAuth connect → a real webhook message is sent the moment a sender's hourly limit is reached (verified live in the demo). If Slack isn't connected it silently no-ops (no crash); reconnecting works via upsert without redeploy |

**Why Redis counters:** BullMQ's built-in limiter offers a fixed per-interval *token* approach, but an hourly cap keyed by `senderId + hourWindow` gives us a true "emails per hour" semantic with first-come ordering and rescheduling into the next window — all safe across multiple worker instances because the counter lives in Redis, not process memory.

---

## Requirement checklist (mapped to the assignment)

| Requirement | Status | Where |
|---|---|---|
| Express + TypeScript backend | ✅ | `server/` |
| Next.js + Tailwind + TypeScript frontend | ✅ | `client/` |
| PostgreSQL + Prisma | ✅ | `server/prisma/schema.prisma` |
| Accept email send requests via API | ✅ | `POST /api/emails/schedule` |
| Schedule via BullMQ delayed jobs (no cron) | ✅ | `server/src/lib/queue.ts` |
| Send via Ethereal SMTP (multiple senders) | ✅ | `utils/ethereal.ts` |
| Searchable via Elasticsearch | ✅ | `services/search.service.ts` + `lib/elastic.ts` |
| Live BullMQ dashboard | ✅ | `/admin/queues` (Bull Board) |
| Survives restart, no duplication | ✅ | Redis-delayed jobs + DB idempotency check |
| Configurable worker concurrency | ✅ | `WORKER_CONCURRENCY` |
| Min delay between sends | ✅ | BullMQ limiter, default 2s |
| Per-sender hourly rate limit (env-configurable) | ✅ | `MAX_EMAILS_PER_HOUR_PER_SENDER` + `SENDER_LIMITS` |
| Rate-limit state safe across instances | ✅ | atomic Redis counters |
| On limit hit: reschedule (don't drop) | ✅ | `moveToDelayed(nextHourWindow)` |
| Slack notification on limit hit (live OAuth) | ✅ | `routes/slack.routes.ts` + webhook |
| Google OAuth login, name/email/avatar/logout | ✅ | better-auth |
| Compose: subject, body, CSV upload, start time, delay, hourly limit | ✅ | `components/email/ComposeForm.tsx` |
| Scheduled + Sent tables with loading/empty states | ✅ | dashboard pages |
| Attachments (bonus, beyond spec) | ✅ | full-stack, base64 → JSON → nodemailer |

---

## Prerequisites

- Node.js 18+
- A running **Redis** instance (e.g. via Docker or a hosted service like Upstash)
- A running **PostgreSQL** database
- (Optional but recommended) A hosted **Elasticsearch** instance
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

### Optional: run worker as a separate process

The worker can be scaled independently. By default it runs in-process with the API; extend `index.ts`/a separate entry to start `emailWorker` in its own process when deploying a dedicated worker.

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
| `FRONTEND_URL` | **Frontend origin** (e.g. `https://out-box-eight.vercel.app`). Used as better-auth's `baseURL` so OAuth callbacks and the session cookie resolve on the app origin (same-origin proxy) — also the CORS/trusted origin |
| `BACKEND_URL` | Backend base URL, used for Slack redirect (and left trusted for the proxy) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis/Upstash connection string (supports `rediss://` TLS) |
| `BETTER_AUTH_SECRET` | Secret used by better-auth (also signs Slack OAuth state) |
| `BETTER_AUTH_URL` | Optional override of the auth `baseURL` (falls back to `FRONTEND_URL`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint (required for full search; if unset the Postgres fallback is used) |
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
| `API_PROXY_TARGET` | **Backend origin** the Next.js app proxies `/api/*` to **and** that the server-side `getSession()`/route guard fetch directly (server-to-server). Set this server-side env on Vercel, e.g. `https://outbox-6gtb.onrender.com`. Falls back to `NEXT_PUBLIC_BACKEND_URL`, then `http://localhost:8080` locally |

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

- Senders are Ethereal test accounts created automatically for the logged-in user (`POST /api/senders`), so the "From" address is the user's own email without manual SMTP config.
- The demo uses Ethereal, so emails aren't actually delivered — preview URLs are printed in the worker logs.
- **Search fallback:** if Elasticsearch is unreachable/unconfigured, the search endpoint transparently falls back to a Postgres `ILIKE` query so the feature never breaks.
- **Rate-limit durability:** Redis counters can drift only if keys are lost between restarts; the 1-hour TTL + atomic `INCR` keep this safe for the expected workload. A DB-backed counter would be an alternative where stricter durability is needed.
- **No cron anywhere** — scheduling is exclusively BullMQ delayed jobs, as required.

> **Note (Chrome "dangerous site" warning):** Chrome may show a "Deceptive site ahead / dangerous site" warning for the **shared `*.onrender.com` subdomain** used by the deployed backend. This is a Google Safe Browsing flag on the recycled/shared Render subdomain — it affects only Chrome and is **not** caused by this codebase (the app works normally in other browsers such as Edge, and the OAuth + scheduling flow functions correctly). It is cosmetic and self-resolving over time; attaching a **custom domain** to the Render service permanently clears it. Local development is unaffected.

---

## Deployment (Vercel frontend + Render backend)

To deploy, just set these env vars and redeploy both services:

- **Render**: `FRONTEND_URL=https://out-box-eight.vercel.app` (makes the session cookie first-party on the app origin).
- **Vercel**: `API_PROXY_TARGET=https://outbox-6gtb.onrender.com` (server-side env; `/api/*` is proxied to it).
- **Google Cloud console**: add the redirect URI `https://out-box-eight.vercel.app/api/auth/callback/google`.

Slack OAuth: add `https://<backend>/api/slack/callback` as a redirect URL in the Slack app.

**Live URLs:**
- App: `https://out-box-eight.vercel.app`
- Backend: `https://outbox-6gtb.onrender.com`
- **Bull Board dashboard:** `https://outbox-6gtb.onrender.com/admin/queues` — live view of the `email-sending` queue (Waiting / Active / Delayed / Completed / Failed). It lives on the **backend origin** (not proxied) and is a debug dashboard, so keep it private.
- Health check: `https://outbox-6gtb.onrender.com/api/health`

> ⚠️ **Render free tier sleeps** after ~15 min idle. If the app or dashboard seems down, hit any endpoint once (e.g. the frontend `/api/health`) to wake it, then reload.

---

## License

MIT
