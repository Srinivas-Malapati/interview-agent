# Greenroom

> **AI-powered mock interviews with real-time coaching and shareable results.**

Practice job interviews with a voice-enabled AI that adapts to your resume, scores every answer, and gives instant feedback on body language and delivery — then export a PDF or share your score with a public link.

**Live:** [joingreenroom.vercel.app](https://joingreenroom.vercel.app) · **API:** [greenroom-api.fly.dev](https://greenroom-api.fly.dev)

---

## What it does

- **Resume- and JD-aware questions.** Upload your resume and paste a job description; the AI tailors every question to your background.
- **Adaptive follow-ups.** Each question is generated from your previous answer — no canned scripts.
- **Real-time body-language coaching.** Webcam-based engagement, warmth, composure, and energy scores via MediaPipe.
- **Voice in, voice out.** Whisper for STT, OpenAI TTS for the interviewer's voice. Talk like it's a real interview.
- **Per-answer scoring.** Structure, clarity, relevance, and impact — scored on every turn with a one-line rewrite suggestion.
- **PDF export.** Download a full interview report.
- **Shareable results.** Public link with your score (no transcript, no PII).
- **Past sessions + progress.** See score trends across sessions.

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | React · Vite · `@supabase/supabase-js` · `jspdf` · MediaPipe Tasks Vision |
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

## Run locally

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "OPENAI_API_KEY=sk-..." > .env
uvicorn app:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

Open <http://localhost:5173>. Supabase + Groq are optional locally — see [DEPLOY.md](DEPLOY.md) for the full env-var matrix and production setup.

## Key endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/upload_resume` | ✓ | Parse PDF/TXT resume into context |
| `POST` | `/start_interview` | ✓ | Create session, generate first question |
| `POST` | `/answer_stream` | ✓ | SSE: stream next question + score answer |
| `POST` | `/end_interview` | ✓ | Close session, compute overall score |
| `POST` | `/sessions/{id}/share` | ✓ | Mint a public share token |
| `GET` | `/public/results/{token}` | — | Sanitized public summary (no PII) |
| `GET` | `/health` | — | OpenAI + auth probe |

## Privacy

- **No raw audio is stored.** Whisper transcribes in-flight; only the text answer hits the DB.
- **Sessions are per-user.** Every row is scoped by Supabase `user_id`; no cross-user access.
- **Public share links** include only first name, role, scores, and body-language metrics — **no transcript, no email**.
- Sentry is initialized with `send_default_pii: false`.

## Project structure

```
.
├── backend/
│   ├── app.py                  # FastAPI app — all routes
│   ├── auth.py                 # Supabase JWT verification (HS256 + ES256)
│   ├── agents/                 # LLM routing, prompts, seed questions
│   └── db/                     # SQLAlchemy models + idempotent migrations
├── frontend/
│   └── src/
│       ├── App.jsx             # Setup → Precheck → Interview → Results
│       ├── components/         # ChatWindow, FeedbackPanel, PublicResults, …
│       ├── hooks/              # useAuth (Supabase session subscription)
│       ├── lib/supabase.js     # Client + authedFetch wrapper
│       └── utils/              # PDF export, MediaPipe body-language, speech metrics
├── .github/workflows/          # Fly auto-deploy
└── DEPLOY.md                   # Full deploy guide
```

## Author

**Srinivas Malapati** — [GitHub](https://github.com/Srinivas-Malapati)

## License

MIT
