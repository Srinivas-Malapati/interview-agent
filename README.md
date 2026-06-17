# Greenroom

> **AI-powered mock interviews with real-time coaching and shareable results.**

Practice job interviews with a voice-enabled AI that adapts to your resume, scores every answer, and gives instant feedback on body language and delivery — then export a PDF or share your score with a public link.

**Live:** [joingreenroom.vercel.app](https://joingreenroom.vercel.app) · **API:** [greenroom-api.fly.dev](https://greenroom-api.fly.dev)

---

## What it does

- **Resume- and JD-aware questions.** Upload your resume and paste a job description; the AI tailors questions to your background.
- **Adaptive follow-ups.** Every question is generated from your previous answer — no canned scripts.
- **Real-time body-language coaching.** Webcam-based engagement, warmth, composure, and energy scores via MediaPipe.
- **Voice in, voice out.** Whisper STT + OpenAI TTS. Talk like it's a real interview.
- **Per-answer scoring.** Structure, clarity, relevance, and impact — scored on every turn with a one-line rewrite suggestion.
- **PDF export.** Download a full interview report.
- **Shareable results.** Public link with your score (no transcript, no PII).
- **Past sessions + progress.** See score trends across sessions.

## Roles supported

Software Engineer · AI Engineer · Data Scientist · Product Manager · Product Designer

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | React · Vite · Vanilla CSS + design tokens · `@supabase/supabase-js` · `jspdf` · MediaPipe Tasks Vision |
| **Backend** | FastAPI · LangChain · SQLAlchemy · Server-Sent Events for streaming |
| **LLM** | OpenAI `gpt-4o` (default) · Groq `llama-3.3-70b-versatile` (free fallback, env-switchable) |
| **Voice** | OpenAI Whisper (STT) · OpenAI TTS-1 (text-to-voice) |
| **Auth** | Supabase (Google OAuth + email magic link) · JWT verification (HS256 + ES256/JWKS) |
| **DB** | SQLite (local) · Supabase Postgres (prod) |
| **Hosting** | Fly.io (backend) · Vercel (frontend) |
| **Observability** | Sentry · UptimeRobot |
| **CI/CD** | GitHub Actions → Fly auto-deploy on push |

## Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  React / Vite   │ ─────▶ │ FastAPI / Fly.io │ ─────▶ │ Supabase Postgres│
│  Vercel         │        │ LangChain agent  │        └──────────────────┘
└─────────────────┘        └────────┬─────────┘                  ▲
        │                           │                            │
        │                           ▼                            │
        │                  ┌──────────────────┐                  │
        │                  │ OpenAI gpt-4o    │                  │
        │                  │ Whisper, TTS-1   │                  │
        │                  └──────────────────┘                  │
        │                                                        │
        └─── Supabase Auth (Google OAuth / magic link) ──────────┘
```

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Copy env vars
cat > .env <<EOF
OPENAI_API_KEY=sk-...
# Optional — Supabase auth in local dev
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_JWT_SECRET=...
# Optional — free LLM via Groq
GROQ_API_KEY=gsk_...
GREENROOM_LLM_MODEL=llama-3.3-70b-versatile
EOF

uvicorn app:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

cat > .env <<EOF
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
EOF

npm run dev
```

Open <http://localhost:5173>.

## Environment variables

### Backend (Fly secrets)

| Var | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | LLM + Whisper + TTS |
| `DATABASE_URL` | yes (prod) | Postgres connection (Supabase pooler) |
| `SUPABASE_JWT_SECRET` | yes (prod) | Verify HS256 tokens |
| `SUPABASE_JWKS_URL` | yes (prod) | Verify ES256 tokens |
| `ALLOWED_ORIGIN_REGEX` | yes (prod) | CORS — e.g. `https://(joingreenroom\.vercel\.app\|.*\.vercel\.app)` |
| `GROQ_API_KEY` | optional | Use Groq Llama 3.3 instead of OpenAI |
| `GREENROOM_LLM_MODEL` | optional | Override model — defaults to `gpt-4o` |
| `SENTRY_DSN` | optional | Error tracking |

### Frontend (Vercel env vars)

| Var | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | yes | Backend base URL |
| `VITE_SUPABASE_URL` | yes | Auth |
| `VITE_SUPABASE_ANON_KEY` | yes | Auth |
| `VITE_SENTRY_DSN` | optional | Error tracking |

## Deployment

### Backend → Fly.io

```bash
cd backend
fly launch  # first time only
fly deploy
```

CI auto-deploys on push to `main` via `.github/workflows/fly-deploy.yml` (needs `FLY_API_TOKEN` GitHub secret).

### Frontend → Vercel

```bash
cd frontend
vercel deploy --prod
```

Vercel auto-deploys on push if the project is linked.

## Key endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/upload_resume` | yes | Parse PDF/TXT resume into context |
| `POST` | `/start_interview` | yes | Create session, generate first question |
| `POST` | `/answer_stream` | yes | SSE: stream next question + score answer |
| `POST` | `/end_interview` | yes | Close session, compute overall score |
| `GET` | `/sessions/{candidate}` | yes | List past sessions |
| `POST` | `/sessions/{id}/share` | yes | Mint a public share token |
| `GET` | `/public/results/{token}` | **no** | Sanitized public summary (no PII) |
| `GET` | `/profile` | yes | Pre-fill form from last session |
| `GET` | `/health` | no | OpenAI + auth probe |

## Privacy

- **No raw audio is stored.** Whisper transcribes in-flight; only the text answer hits the DB.
- **Sessions are per-user.** Every row is scoped by Supabase `user_id`; no cross-user access.
- **Public share links** include only first name, role, scores, and body-language metrics — **no transcript, no email**.
- **Sentry** is configured with `send_default_pii: false`.

## Project structure

```
.
├── backend/
│   ├── app.py                  # FastAPI app — all routes
│   ├── auth.py                 # Supabase JWT verification (HS256 + ES256)
│   ├── agents/
│   │   ├── langchain_chain.py  # LLM routing (OpenAI ↔ Groq) + prompts
│   │   ├── question_bank.py    # Curated role-specific seed questions
│   │   └── avatar.py           # Optional Tavus integration
│   └── db/
│       ├── database.py         # Engine + idempotent migrations
│       ├── models.py           # Candidate, Session, Turn
│       └── crud.py             # All DB queries
├── frontend/
│   └── src/
│       ├── App.jsx             # Setup → Precheck → Interview → Results
│       ├── components/         # ChatWindow, FeedbackPanel, PublicResults, …
│       ├── hooks/useAuth.js    # Supabase session subscription
│       ├── lib/supabase.js     # Client + authedFetch wrapper
│       └── utils/
│           ├── pdfExport.js    # Client-side PDF generation
│           ├── bodyLanguage.js # MediaPipe Face + Pose analyzer
│           └── speechMetrics.js # WPM, fillers
├── .github/workflows/          # Fly auto-deploy
└── DEPLOY.md                   # Step-by-step deploy guide
```

## Author

**Srinivas Malapati** — [GitHub](https://github.com/Srinivas-Malapati)

## License

MIT
