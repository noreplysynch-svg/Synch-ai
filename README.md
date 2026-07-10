# Synch AI

React/Vite frontend + Express/Postgres backend, structured as a single Railway service.

Supabase has been fully removed. Auth, conversation storage, and file uploads are
now handled by the Express server in `/server`, backed by Postgres. The OpenAI key
also moved server-side — the browser no longer talks to OpenAI directly.

## Structure

```
railway-project/
  client/          Vite/React frontend (unchanged UI, calls /api instead of Supabase)
  server/          Express API + serves the built client in production
    routes/        auth, conversations, upload, chat
    lib/           mailer (OTP/reset emails), oauth (Google/Microsoft)
    schema.sql     Postgres schema, applied automatically on boot
  railway.json     Railway build/start config
  .env.example     All environment variables you need to set
```

## Local development

```bash
# 1. Install server deps (root) and client deps
npm install
npm install --prefix client

# 2. Copy env vars and fill them in
cp .env.example .env

# 3. Run Postgres locally (or point DATABASE_URL at any Postgres instance)
#    e.g. docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres

# 4. Run backend and frontend in two terminals
npm run dev:server     # http://localhost:3000
npm run dev:client     # http://localhost:5173, proxies /api to :3000
```

The schema is created automatically the first time the server boots — no manual
migration step needed.

## Deploying to Railway

1. **Push this repo to GitHub** and create a new Railway project from it.
2. **Add a Postgres plugin** to the project (Railway → New → Database → Postgres).
   `DATABASE_URL` is injected into your service automatically — you don't set it
   yourself.
3. **Set environment variables** on the service (Railway → Variables). See
   `.env.example` for the full list. At minimum you need:
   - `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `OPENAI_API_KEY`
   - `APP_URL` — set this to your Railway-issued domain once you have one
     (e.g. `https://synch-ai-production.up.railway.app`), then redeploy so OAuth
     callback URLs and reset-password links point to the right place.
4. **Build & start commands** are already set in `railway.json`:
   - Build: `npm install && npm run build` (installs server deps, then installs
     and builds the client into `client/dist`)
   - Start: `npm start` (runs `server/index.js`, which serves the API and the
     built frontend from the same process/port)
5. **File uploads**: by default uploaded files are written to `server/uploads`
   on local disk, which is wiped on every redeploy. Attach a
   [Railway Volume](https://docs.railway.com/reference/volumes) mounted at the
   path you set for `UPLOAD_DIR` (e.g. `/data/uploads`) so uploads persist. For
   heavier use, swapping the upload route for S3-compatible storage (Cloudflare
   R2, Backblaze B2) is a small change confined to `server/routes/upload.js`.
6. **Email (OTP + password reset)**: set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`
   to any SMTP provider (Resend, Postmark, SendGrid, etc). If left unset, the
   server just logs the email content to the Railway logs instead of sending —
   fine for testing the flow, not for real users.
7. **OAuth (optional)**: Google and Microsoft sign-in only appear functional if
   you set their client ID/secret pairs. Redirect URIs to register with each
   provider:
   - Google: `https://<your-app-url>/api/auth/oauth/google/callback`
   - Microsoft: `https://<your-app-url>/api/auth/oauth/microsoft/callback`
   Leaving these blank doesn't break anything — clicking the button just
   redirects back with an "not configured" message.

## What changed from the Supabase version

| Concern | Before | Now |
|---|---|---|
| Auth (password, OTP, OAuth, reset) | Supabase Auth (browser) | Express routes + JWT httpOnly cookie, bcrypt, Postgres `users` table |
| Conversations | Supabase table, queried from browser | `/api/conversations` REST routes, Postgres `conversations` table |
| File uploads | Supabase Storage | `/api/upload`, local disk (attach a Railway Volume) |
| OpenAI chat + Whisper | Called directly from the browser (API key exposed client-side) | Proxied through `/api/chat/*` — key stays server-side only |

The frontend UI/components are otherwise untouched — only the data-fetching
layer (`client/src/api/client.js`) changed.
