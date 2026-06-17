# Greenroom — Production deployment

Goal: a stranger types `greenroom.yourdomain.com`, signs in with Google, and
runs a real interview against your backend.

Estimated time: **~45 minutes** from a fresh laptop.
Recurring cost: **$0 - $15 / month** depending on traffic.

```
            ┌────────────────┐
 Browser ───┤   Vercel       ├──► Frontend (React build)
            └────────┬───────┘
                     │ HTTPS  (REST + SSE)
            ┌────────▼───────┐
            │   Fly.io       │ ◄── greenroom-api.fly.dev
            │   FastAPI      │
            └──┬────────┬────┘
               │        │
        Supabase     OpenAI
        Postgres     gpt-4o, Whisper, TTS
        + Auth (JWT)
```

---

## 1. Supabase — Postgres + Auth (10 min)

1. Sign up at <https://supabase.com>, create a project (free tier).
2. In **Project Settings → API**:
   - Copy **Project URL**       → `SUPABASE_URL`
   - Copy **anon public** key   → `SUPABASE_ANON_KEY` (used on the frontend)
   - Copy **JWT Secret**        → `SUPABASE_JWT_SECRET` (used on the backend)
3. In **Project Settings → Database → Connection string** copy the
   `Transaction` URL (looks like `postgresql://postgres.xxx:PASSWORD@aws-...supabase.com:5432/postgres`)
   → `DATABASE_URL`.
4. In **Authentication → Providers**, enable **Google** (or just **Email** for
   magic links if you don't want Google).

---

## 2. Fly.io — backend (15 min)

```bash
# Install the CLI once
brew install flyctl
fly auth login

cd backend
fly launch --name greenroom-api --region sjc --no-deploy   # accept all defaults; it picks up fly.toml
fly volumes create gr_data --region sjc --size 3           # for recordings (.webm files)

# All your secrets in one shot
fly secrets set \
  OPENAI_API_KEY=sk-proj-... \
  DATABASE_URL='postgresql://postgres.xxx:PASS@aws-...supabase.com:5432/postgres' \
  SUPABASE_JWT_SECRET='your-jwt-secret-here' \
  AUTH_REQUIRED=1 \
  GREENROOM_LLM_MODEL=gpt-4o

fly deploy
fly status         # confirm running
fly logs           # tail
```

Your backend is now at `https://greenroom-api.fly.dev`.

Smoke test:
```bash
curl https://greenroom-api.fly.dev/health
# → {"ok":true,"openai":true,"openai_message":"ok","tavus":false}
```

---

## 3. Vercel — frontend (10 min)

```bash
npm i -g vercel
vercel login

cd frontend
vercel link              # accept defaults; creates the project
vercel env add VITE_API_URL production
# paste: https://greenroom-api.fly.dev
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

Vercel will print your live URL (e.g. `https://greenroom-XXXX.vercel.app`).

---

## 4. Domain (10 min, optional)

1. Buy `greenroom.app` (or whatever) on Cloudflare Registrar or Namecheap.
2. In Vercel → Project → Domains → add `greenroom.yourdomain.com` → Vercel
   shows you the CNAME to set in your DNS provider.
3. In Fly.io → `fly certs create api.yourdomain.com` (if you want a custom
   API host). Then update `VITE_API_URL` in Vercel to match.

---

## 5. Operations

- **Update backend**:      `cd backend && fly deploy`
- **Update frontend**:     push to your git remote — Vercel auto-builds
- **Tail backend logs**:   `fly logs`
- **DB console**:          Supabase → SQL editor
- **Rotate OpenAI key**:   `fly secrets set OPENAI_API_KEY=sk-...`
- **Roll back**:           `fly releases` then `fly deploy --image <previous>`

---

## 6. What to monitor on day one

| Risk | Symptom | Action |
|------|---------|--------|
| OpenAI cost runaway | bill > $20/day | Add per-user rate limit, switch back to `gpt-4o-mini` |
| Disk fills with recordings | Fly volume > 80% | Move recordings to Cloudflare R2 / S3 |
| Cold-start latency | First request takes 10s | `min_machines_running = 1` already set in `fly.toml` |
| JWT verification fails | 401 on every API call | Re-check `SUPABASE_JWT_SECRET` matches Supabase → Settings → API |

---

## 7. Things explicitly **not** done yet (work for later)

- Rate limiting / per-user usage caps (use `slowapi`)
- Background recording → object storage migration (Cloudflare R2 is cheapest)
- Stripe billing (Pro tier for Tavus avatar + ElevenLabs voice)
- Sentry + PostHog for error tracking and product analytics
- Question bank seeded from real Glassdoor data
