# Deployment Guide — work in production and locally

OutBox is already **fully env-configurable** — nothing is hardcoded to localhost. The
same code runs locally and in production; you only change the **environment variables**
and the **OAuth redirect URIs** in the Google and Slack consoles.

Every URL the app needs is read from env with a localhost fallback:

| Env var | What it controls | Local fallback |
|---------|------------------|----------------|
| `FRONTEND_URL` | Allowed CORS origin + Slack success redirect | `http://localhost:3000` |
| `BETTER_AUTH_URL` | better-auth trusted frontend origin | `http://localhost:3000` |
| `BACKEND_URL` | better-auth base URL + Slack OAuth redirect_uri base | `http://localhost:8080` |
| `NEXT_PUBLIC_BACKEND_URL` (client) | All API calls the browser makes | `http://localhost:8080` |

So: **set these to your real domain, add the same domains in the OAuth consoles,
and it works in production exactly like it does locally.**

---

## 1. Google OAuth (#1 required — Google login breaks if done wrong)

### A. Create/configure the OAuth Client (console.cloud.google.com)
1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Choose **Application type: Web application**.
3. Add **Authorized JavaScript origins** (your frontend origin):
   - Local: `http://localhost:3000`
   - Production: `https://<your-frontend-domain>` (e.g. `https://outbox.vercel.app`)
4. Add **Authorized redirect URIs** — the **backend** better-auth callback path is `/api/auth/callback/google`:
   - Local: `http://localhost:8080/api/auth/callback/google`
   - Production: `https://<your-backend-domain>/api/auth/callback/google`
     (e.g. `https://outbox-api.onrender.com/api/auth/callback/google`)
5. Save. Copy the **Client ID** and **Client Secret**.

> 💡 better-auth routes the Google callback through the **backend** (`BACKEND_URL`), not the
> frontend, so the redirect URI points at the Express server.

### B. Set env vars on the server
```
GOOGLE_CLIENT_ID=<from Google>
GOOGLE_CLIENT_SECRET=<from Google>
```

---

## 2. Slack OAuth (for rate-limit notifications)

### A. Create a Slack app (api.slack.com/apps)
1. **Create New App → From scratch** → name it, pick a workspace.
2. Go to **OAuth & Permissions → Redirect URLs → Add Redirect URL**:
   - Local: `http://localhost:8080/api/slack/callback`
   - Production: `https://<your-backend-domain>/api/slack/callback`
3. In **OAuth & Permissions → Scopes**, add the bot scope: **`incoming-webhook`**.
4. Go to **Incoming Webhooks** and **Activate Incoming Webhooks** (this is required for the
   app to post messages — it's where the webhook URL comes from).
5. **Install/Reinstall App to Workspace** and authorize.
6. From **OAuth & Permissions**, copy the **Client ID** and **Client Secret**.

> 💡 The redirect is built from `BACKEND_URL` + `/api/slack/callback`, and after success the
> user is sent back to `FRONTEND_URL/dashboard?slack=connected`. Both must match real domains.

### B. Set env vars on the server
```
SLACK_CLIENT_ID=<from Slack>
SLACK_CLIENT_SECRET=<from Slack>
```

---

## 3. Shared env vars (server)

```
PORT=8080
DATABASE_URL=<Postgres connection string>
REDIS_URL=<Redis/Upstash connection string, rediss:// for TLS>
BETTER_AUTH_SECRET=<long random string — keep the SAME across restarts>
BETTER_AUTH_URL=https://<your-frontend-domain>      # user-facing origin
FRONTEND_URL=https://<your-frontend-domain>
BACKEND_URL=https://<your-backend-domain>            # Express server origin
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
ELASTICSEARCH_URL=<optional>
ELASTICSEARCH_API_KEY=<optional>
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=...
SENDER_LIMITS={}
```

### Client env var (Vercel)
```
NEXT_PUBLIC_BACKEND_URL=https://<your-backend-domain>
```

---

## 4. Deploy the backend on Render

Because **the Express server also runs the BullMQ worker in the same process**, one web
service is enough.

1. **New → Web Service**, connect your repo, root directory: `server`, build:
   `npm install && npx prisma generate && npm run build`, start: `npm start`.
2. Set **all** the env vars from section 3 (use a real Postgres + Upstash — Neon/Upstash
   free tiers work well).
3. Render gives you `https://<backend>.onrender.com` → set `BACKEND_URL` to this.

> ⚠️ Render **free tier sleeps** after ~15 min idle. If it sleeps, delayed BullMQ jobs stop
> being processed until it wakes (Redis still holds them). Use `sleep: false` on a paid tier,
> or send keep-alive pings, for a reliable live demo.

---

## 5. Deploy the frontend on Vercel

1. **New Project → Import** your repo, framework: **Next.js**, root directory: `client`.
2. Add env var: `NEXT_PUBLIC_BACKEND_URL=https://<your-backend-domain>`.
3. Deploy → you get `https://<app>.vercel.app`.
4. Set `BETTER_AUTH_URL` and `FRONTEND_URL` on the server to `https://<app>.vercel.app`.

---

## 6. Local + production checklist (both work from the same codebase)

- [ ] Local: use the default `.env` values (localhost) — no code change needed.
- [ ] Production: set real `BACKEND_URL` / `FRONTEND_URL` / `BETTER_AUTH_URL` / `NEXT_PUBLIC_BACKEND_URL`.
- [ ] Google console: add **both** `http://localhost:8080/api/auth/callback/google` **and**
      `https://<backend>/api/auth/callback/google` as redirect URIs (keep them both so local
      still works).
- [ ] Slack console: add **both** `http://localhost:8080/api/slack/callback` **and**
      `https://<backend>/api/slack/callback` as redirect URLs.
- [ ] CORS: server reads `FRONTEND_URL` — set it to the real frontend origin in production.

---

## Quick reference: which URL goes where

| Piece | Local | Production |
|-------|-------|------------|
| Frontend origin | `http://localhost:3000` | `https://<app>.vercel.app` |
| Backend origin | `http://localhost:8080` | `https://<backend>.onrender.com` |
| Google redirect URI | `http://localhost:8080/api/auth/callback/google` | `https://<backend>.onrender.com/api/auth/callback/google` |
| Slack redirect URL | `http://localhost:8080/api/slack/callback` | `https://<backend>.onrender.com/api/slack/callback` |
