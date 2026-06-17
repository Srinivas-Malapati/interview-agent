import io
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

# --- Load .env BEFORE importing anything that constructs ChatOpenAI ---
from dotenv import load_dotenv
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)
print("OPENAI_API_KEY loaded:", "OK" if os.getenv("OPENAI_API_KEY") else "NOT FOUND")
print("TAVUS_API_KEY loaded :", "OK" if os.getenv("TAVUS_API_KEY")  else "NOT FOUND")

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import json as _json
import asyncio

# ─── Sentry (optional, env-gated) ───
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.getenv("SENTRY_ENV", "production"),
            traces_sample_rate=0.1,        # 10% of requests get a trace
            profiles_sample_rate=0.1,
            send_default_pii=False,
            integrations=[FastApiIntegration()],
        )
        print("Sentry: initialized")
    except Exception as e:
        print("Sentry: init failed:", e)

# ─── Rate limiting (per-IP) ───
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
    _HAS_SLOWAPI = True
except Exception:
    _HAS_SLOWAPI = False

from agents.langchain_chain import (
    build_first_question,
    build_followup_and_feedback,
    add_pair_to_history,
    reset_history,
    hydrate_history_from_turns,
    stream_next_question,
    score_answer_only,
)
from agents import avatar
from agents.question_bank import pick_seeds
from db.database import init_db, db_session
from db import crud
from auth import current_user
from fastapi import Depends

app = FastAPI(title="Greenroom Interview API")

# Rate limiting — disabled in dev unless explicitly enabled
if _HAS_SLOWAPI and os.getenv("RATE_LIMITING", "1") in ("1", "true", "True"):
    limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
else:
    limiter = None

# CORS — permissive locally; in prod, set ALLOWED_ORIGIN_REGEX
_origin_regex = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# -----------------------------
# DB-backed state helpers
# -----------------------------
def _uid(user: Dict) -> str:
    """Pull the user_id out of the auth claim dict. Defaults to 'local-dev'."""
    return (user or {}).get("sub") or "local-dev"


def _get_active_pack(db, candidate: str, user_id: str) -> Dict:
    """Build the role/seniority/tone/focus dict from the candidate's active
    session, falling back to defaults if no active session exists."""
    s = crud.get_active_session(db, candidate, user_id=user_id)
    if not s:
        return default_role_pack()
    return {
        "role": s.role or "Software Engineer",
        "seniority": s.seniority or "Mid",
        "tone": s.tone or "Professional",
        "focus": s.focus or [],
        "description": s.jd_text or "",
    }


def _ensure_history_hydrated(db, candidate: str, session_id: int):
    """If the in-process LangChain history was wiped (e.g. server restart),
    refill it from the DB so follow-ups stay context-aware."""
    turns = crud.get_turns_for_history(db, session_id)
    hydrate_history_from_turns(candidate, turns)


# -----------------------------
# Helpers
# -----------------------------
def extract_text_from_upload(file: UploadFile) -> str:
    name = (file.filename or "").lower()
    data = file.file.read()
    if not data:
        return ""
    if name.endswith((".txt", ".md")):
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return ""
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join([(p.extract_text() or "") for p in reader.pages[:10]])
        except Exception as e:
            print("PDF parse error:", e)
            return ""
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""

def default_role_pack():
    return {
        "role": "Software Engineer",
        "seniority": "Mid",
        "tone": "Professional",
        "focus": [],
        "description": "",
    }

# -----------------------------
# Models
# -----------------------------
class UploadAck(BaseModel):
    ok: bool = True

class StartRequest(BaseModel):
    candidate: str
    role: Optional[str] = "Software Engineer"
    seniority: Optional[str] = "Mid"
    focus: Optional[List[str]] = []
    tone: Optional[str] = "Professional"
    description: Optional[str] = ""

class StartResponse(BaseModel):
    first_question: str
    session_id: int

class AnswerResponse(BaseModel):
    followup: str
    feedback: str
    rewrite: str
    scores: Dict[str, int]

class AvatarStartRequest(BaseModel):
    candidate: str

class AvatarStartResponse(BaseModel):
    conversation_id: str
    room_url: str
    mocked: bool
    message: Optional[str] = None

class EndRequest(BaseModel):
    candidate: str
    body_language: Optional[Dict[str, Any]] = None

# -----------------------------
# Resume + interview lifecycle
# -----------------------------

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"   # alloy, echo, fable, onyx, nova, shimmer
    speed: Optional[float] = 1.0


@app.post("/tts")
async def tts(payload: TTSRequest):
    """OpenAI TTS — text → audio/mpeg bytes. Used when Tavus avatar is off."""
    from fastapi.responses import Response
    text = (payload.text or "").strip()
    if not text:
        return Response(content=b"", media_type="audio/mpeg", status_code=204)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return Response(content=b"", media_type="audio/mpeg", status_code=204)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        out = client.audio.speech.create(
            model="tts-1",
            voice=payload.voice or "alloy",
            input=text[:3000],
            speed=max(0.5, min(2.0, payload.speed or 1.0)),
            response_format="mp3",
        )
        audio_bytes = out.read() if hasattr(out, "read") else out.content
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print("TTS error:", e)
        return Response(content=b"", media_type="audio/mpeg", status_code=204)


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Run candidate audio through OpenAI Whisper. Falls back to empty if no key."""
    try:
        data = await file.read()
        if not data:
            return {"text": ""}
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return {"text": "", "error": "OPENAI_API_KEY not set"}
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        import tempfile
        suffix = ".webm" if "webm" in (file.content_type or "") else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            with open(tmp_path, "rb") as f:
                resp = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="text",
                )
            text = resp if isinstance(resp, str) else getattr(resp, "text", "")
            return {"text": (text or "").strip()}
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    except Exception as e:
        print("Transcribe error:", e)
        return {"text": "", "error": str(e)[:200]}


@app.post("/upload_resume", response_model=UploadAck)
@app.post("/upload_resume/", response_model=UploadAck)
async def upload_resume(
    candidate: str = Form(...),
    file: UploadFile = File(...),
    user: Dict = Depends(current_user),
):
    try:
        text = extract_text_from_upload(file)
        with db_session() as db:
            crud.get_or_create_candidate(db, candidate, text or "", user_id=_uid(user))
        return {"ok": True}
    except Exception as e:
        print("Upload error:", e)
        raise HTTPException(status_code=400, detail="Could not parse resume")


@app.post("/start_interview", response_model=StartResponse)
@app.post("/start_interview/", response_model=StartResponse)
async def start_interview(payload: StartRequest, user: Dict = Depends(current_user)):
    reset_history(payload.candidate)
    uid = _uid(user)

    with db_session() as db:
        c = crud.get_or_create_candidate(db, payload.candidate, "", user_id=uid)
        resume_text = c.resume_text or ""
        # Persist last-used config so we pre-fill on next session
        crud.save_candidate_profile(
            db, c,
            role=payload.role, seniority=payload.seniority, tone=payload.tone,
            focus=payload.focus or [], jd_text=payload.description or "",
        )
        s = crud.create_session(
            db, c,
            role=payload.role,
            seniority=payload.seniority,
            tone=payload.tone,
            focus=payload.focus or [],
            jd_text=payload.description or "",
        )
        session_id = s.id

    first_q = build_first_question(
        role=payload.role,
        seniority=payload.seniority,
        tone=payload.tone,
        resume_text=resume_text,
        jd_text=payload.description or "",
        candidate_name=payload.candidate,
    )

    add_pair_to_history(payload.candidate, user_text="", ai_text=first_q)
    # Seed first AI question as a Turn with empty answer so it shows up in
    # history-restore on restart and the next /answer call has the right
    # 'question' to attach to.
    with db_session() as db:
        crud.add_turn(
            db, session_id=session_id,
            question=first_q, answer="",
            followup="", feedback="", rewrite="",
            scores={"structure": 0, "clarity": 0, "relevance": 0, "impact": 0},
        )

    return StartResponse(first_question=first_q, session_id=session_id)


@app.post("/answer", response_model=AnswerResponse)
@app.post("/answer/", response_model=AnswerResponse)
async def answer(
    candidate: str = Form(...),
    response: str = Form(...),
    user: Dict = Depends(current_user),
):
    uid = _uid(user)
    with db_session() as db:
        sess = crud.get_active_session(db, candidate, user_id=uid)
        if not sess:
            raise HTTPException(404, "No active interview session for this candidate. Start one first.")
        pack = {
            "role": sess.role or "Software Engineer",
            "seniority": sess.seniority or "Mid",
            "tone": sess.tone or "Professional",
        }
        sid = sess.id
        last_question = crud.get_last_question(db, sid)
        # Refill history from DB if memory was cleared (server restart)
        _ensure_history_hydrated(db, candidate, sid)

    add_pair_to_history(candidate, user_text=response, ai_text=None)

    out = build_followup_and_feedback(
        candidate=candidate,
        role=pack["role"],
        seniority=pack["seniority"],
        tone=pack["tone"],
        candidate_response=response,
    )

    add_pair_to_history(candidate, user_text="", ai_text=out.get("followup", ""))

    with db_session() as db:
        crud.add_turn(
            db, session_id=sid,
            question=last_question,
            answer=response,
            followup=out.get("followup", ""),
            feedback=out.get("feedback", ""),
            rewrite=out.get("rewrite", ""),
            scores=out.get("scores", {}),
        )

    return AnswerResponse(
        followup=out.get("followup", ""),
        feedback=out.get("feedback", ""),
        rewrite=out.get("rewrite", ""),
        scores=out.get("scores", {}) or {"structure": 0, "clarity": 0, "relevance": 0, "impact": 0},
    )


def _rl(rate: str):
    """Optional rate-limit decorator. No-op when slowapi isn't installed/disabled."""
    if limiter:
        return limiter.limit(rate)
    return lambda f: f


@app.post("/answer_stream")
@_rl("30/minute")
async def answer_stream(
    request: Request,
    candidate: str = Form(...),
    response: str = Form(...),
    user: Dict = Depends(current_user),
):
    uid = _uid(user)
    """Server-Sent Events. Streams the AI's next question token-by-token while
    the model generates it, then sends a single final 'complete' event with
    feedback / rewrite / sub-scores.

    Event format (each separated by \\n\\n):
        data: {"chunk": "..."}
        data: {"chunk": "..."}
        ...
        data: {"complete": true, "followup": "...", "feedback": "...", "rewrite": "...", "scores": {...}}
    """
    # 1. Resolve active session + context (do all DB work BEFORE entering the
    # generator so we don't hold a DB transaction across the streaming wait)
    with db_session() as db:
        sess = crud.get_active_session(db, candidate, user_id=uid)
        if not sess:
            raise HTTPException(404, "No active interview session.")
        sid = sess.id
        pack = {
            "role": sess.role or "Software Engineer",
            "seniority": sess.seniority or "Mid",
            "tone": sess.tone or "Professional",
            "focus": sess.focus or [],
        }
        last_question = crud.get_last_question(db, sid)
        _ensure_history_hydrated(db, candidate, sid)
        # Adaptive: average of all prior sub-scores
        turns = crud.get_turns_for_history(db, sid)
        scored = [t for t in turns if (t.score_structure + t.score_clarity + t.score_relevance + t.score_impact) > 0]
        running_avg = (
            sum(
                (t.score_structure + t.score_clarity + t.score_relevance + t.score_impact) / 4
                for t in scored
            ) / len(scored)
            if scored else 0.0
        )

    seeds = pick_seeds(pack["role"], pack["seniority"], pack["focus"], k=3)

    # Add the user's answer to the in-memory history once
    add_pair_to_history(candidate, user_text=response, ai_text=None)

    async def event_stream():
        full_followup = ""
        # Phase 1 — stream tokens of the next question
        try:
            async for chunk in stream_next_question(
                candidate, pack["role"], pack["seniority"], pack["tone"], response,
                seed_questions=seeds, running_avg=running_avg,
            ):
                full_followup += chunk
                yield f"data: {_json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {_json.dumps({'error': str(e)[:200]})}\n\n"
            return

        # Phase 2 — non-streaming scoring/feedback/rewrite (runs after question lands)
        try:
            scoring = await asyncio.to_thread(
                score_answer_only,
                pack["role"], pack["seniority"], pack["tone"], response,
            )
        except Exception as e:
            scoring = {"feedback": "", "rewrite": "", "scores": {"structure": 0, "clarity": 0, "relevance": 0, "impact": 0}}

        # Phase 3 — persist + commit AI side of history
        add_pair_to_history(candidate, user_text="", ai_text=full_followup)
        try:
            with db_session() as db:
                crud.add_turn(
                    db, session_id=sid,
                    question=last_question,
                    answer=response,
                    followup=full_followup,
                    feedback=scoring.get("feedback", ""),
                    rewrite=scoring.get("rewrite", ""),
                    scores=scoring.get("scores", {}),
                )
        except Exception as e:
            print("stream: failed to persist turn:", e)

        # Phase 4 — final event
        yield f"data: {_json.dumps({'complete': True, 'followup': full_followup, **scoring})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disables nginx buffering when deployed
            "Connection": "keep-alive",
        },
    )


# -----------------------------
# Avatar (Tavus CVI)
# -----------------------------

@app.post("/avatar/start", response_model=AvatarStartResponse)
async def avatar_start(payload: AvatarStartRequest, user: Dict = Depends(current_user)):
    uid = _uid(user)
    with db_session() as db:
        pack = _get_active_pack(db, payload.candidate, uid)
        resume_text = crud.get_candidate_resume(db, payload.candidate, user_id=uid)
        sess = crud.get_active_session(db, payload.candidate, user_id=uid)
        sid = sess.id if sess else None

    info = avatar.start_conversation(
        role=pack.get("role", "Software Engineer"),
        seniority=pack.get("seniority", "Mid"),
        tone=pack.get("tone", "Professional"),
        jd_text=pack.get("description", ""),
        resume_text=resume_text,
        focus=pack.get("focus", []) or [],
        candidate_name=payload.candidate,
    )

    if sid and info.get("conversation_id"):
        with db_session() as db:
            crud.attach_tavus(db, sid, info["conversation_id"], info.get("room_url", ""))

    return AvatarStartResponse(
        conversation_id=info.get("conversation_id", ""),
        room_url=info.get("room_url", ""),
        mocked=bool(info.get("mocked", False)),
        message=info.get("message"),
    )


@app.post("/avatar/byo-llm")
async def avatar_byo_llm(request: Request):
    """
    Optional Tavus BYO-LLM webhook. Tavus posts the live transcript here when
    it needs a next utterance. We respond with text; Tavus does TTS + lip-sync.
    """
    body = await request.json()
    candidate = body.get("candidate") or body.get("conversation_name", "").replace("HireSense-", "") or "Candidate"
    last_user = ""
    messages = body.get("messages") or []
    for m in reversed(messages):
        if m.get("role") in ("user", "candidate"):
            last_user = m.get("content", "")
            break
    if not last_user:
        last_user = body.get("user_message", "")

    with db_session() as db:
        pack = _get_active_pack(db, candidate)
        sess = crud.get_active_session(db, candidate)
        sid = sess.id if sess else None
        last_question = crud.get_last_question(db, sid) if sid else ""
        if sid:
            _ensure_history_hydrated(db, candidate, sid)

    out = build_followup_and_feedback(
        candidate=candidate,
        role=pack["role"],
        seniority=pack["seniority"],
        tone=pack["tone"],
        candidate_response=last_user,
    )
    add_pair_to_history(candidate, user_text=last_user, ai_text=out.get("followup", ""))

    if sid:
        with db_session() as db:
            crud.add_turn(
                db,
                session_id=sid,
                question=last_question,
                answer=last_user,
                followup=out.get("followup", ""),
                feedback=out.get("feedback", ""),
                rewrite=out.get("rewrite", ""),
                scores=out.get("scores", {}),
            )

    return JSONResponse({"response": out.get("followup", "")})


# -----------------------------
# Session history & end
# -----------------------------

@app.post("/end_interview")
async def end_interview(payload: EndRequest, user: Dict = Depends(current_user)):
    uid = _uid(user)
    with db_session() as db:
        sess = crud.get_active_session(db, payload.candidate, user_id=uid)
        if not sess:
            return {"ok": False, "message": "no active session"}
        sid = sess.id
        convo_id = sess.tavus_conversation_id or ""
        s = crud.end_session(db, sid, payload.body_language or {})
        overall = s.overall_score if s else 0
    if convo_id:
        avatar.end_conversation(convo_id)
    # Clear in-process LangChain memory so the next session starts fresh
    reset_history(payload.candidate)
    return {"ok": True, "session_id": sid, "overall_score": overall}


def _serialize_session(s) -> Dict:
    return {
        "id": s.id,
        "candidate": s.candidate_name,
        "role": s.role,
        "seniority": s.seniority,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "overall_score": s.overall_score or 0,
        "body_language": s.body_language or {},
        "has_recording": bool(s.recording_path),
        "turns": [
            {
                "idx": t.idx,
                "question": t.question,
                "answer": t.answer,
                "followup": t.followup,
                "feedback": t.feedback,
                "rewrite": t.rewrite,
                "scores": {
                    "structure": t.score_structure,
                    "clarity": t.score_clarity,
                    "relevance": t.score_relevance,
                    "impact": t.score_impact,
                },
            }
            for t in s.turns
        ],
    }


@app.get("/sessions/{candidate}")
async def list_sessions(candidate: str, user: Dict = Depends(current_user)):
    with db_session() as db:
        rows = crud.list_sessions_for_candidate(db, candidate, user_id=_uid(user))
        return {"sessions": [_serialize_session(s) for s in rows]}


RECORDINGS_DIR = Path(__file__).resolve().parent / "data" / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/sessions/{session_id}/recording")
async def upload_recording(
    session_id: int,
    file: UploadFile = File(...),
    user: Dict = Depends(current_user),
):
    """Save the candidate's session recording. Accepts .webm from MediaRecorder."""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty upload")
    # Ownership check
    with db_session() as db:
        sess = crud.get_session(db, session_id)
        if not sess:
            raise HTTPException(404, "session not found")
        if sess.user_id and sess.user_id != _uid(user):
            raise HTTPException(403, "not your session")
    # Choose extension based on content type
    ct = (file.content_type or "").lower()
    ext = ".webm" if "webm" in ct else ".mp4" if "mp4" in ct else ".bin"
    fname = f"session_{session_id}{ext}"
    fpath = RECORDINGS_DIR / fname
    with open(fpath, "wb") as f:
        f.write(raw)
    with db_session() as db:
        s = crud.get_session(db, session_id)
        if s:
            s.recording_path = fname
    return {"ok": True, "bytes": len(raw), "filename": fname}


@app.get("/sessions/{session_id}/recording")
async def get_recording(session_id: int, user: Dict = Depends(current_user)):
    from fastapi.responses import FileResponse
    with db_session() as db:
        s = crud.get_session(db, session_id)
        if not s or not s.recording_path:
            raise HTTPException(404, "No recording for this session")
        if s.user_id and s.user_id != _uid(user):
            raise HTTPException(403, "not your session")
        fpath = RECORDINGS_DIR / s.recording_path
        if not fpath.exists():
            raise HTTPException(404, "Recording file missing on disk")
        media = "video/webm" if fpath.suffix == ".webm" else "video/mp4"
        return FileResponse(fpath, media_type=media, filename=fpath.name)


@app.delete("/sessions/{candidate}")
async def delete_sessions(
    candidate: str,
    keep: Optional[int] = None,
    user: Dict = Depends(current_user),
):
    with db_session() as db:
        n = crud.delete_sessions_for_candidate(
            db, candidate, user_id=_uid(user), keep_session_id=keep,
        )
    try:
        reset_history(candidate)
    except Exception:
        pass
    return {"ok": True, "deleted": n}


@app.get("/sessions/id/{session_id}")
async def get_session(session_id: int, user: Dict = Depends(current_user)):
    with db_session() as db:
        s = crud.get_session(db, session_id)
        if not s:
            raise HTTPException(404, "session not found")
        if s.user_id and s.user_id != _uid(user):
            raise HTTPException(403, "not your session")
        return _serialize_session(s)


# -----------------------------
# Shareable public results
# -----------------------------
# A user can mint a public share token for any of their own sessions. The
# token resolves a sanitized, no-PII summary at /public/results/{token} —
# first name only, no transcript, no email. Anyone with the link can view it.

def _serialize_public(s) -> Dict:
    """Sanitized version of a session for public sharing — no transcript, no email."""
    name = (s.candidate_name or "Candidate").strip()
    first = name.split()[0] if name else "Candidate"
    duration_min = 0
    if s.started_at and s.ended_at:
        duration_min = max(1, int((s.ended_at - s.started_at).total_seconds() / 60))
    turns = s.turns or []
    scored = [
        t for t in turns
        if (t.score_structure + t.score_clarity + t.score_relevance + t.score_impact) > 0
    ]
    avg_scores = {"structure": 0, "clarity": 0, "relevance": 0, "impact": 0}
    if scored:
        avg_scores = {
            "structure": int(sum(t.score_structure for t in scored) / len(scored)),
            "clarity":   int(sum(t.score_clarity   for t in scored) / len(scored)),
            "relevance": int(sum(t.score_relevance for t in scored) / len(scored)),
            "impact":    int(sum(t.score_impact    for t in scored) / len(scored)),
        }
    return {
        "first_name": first,
        "role": s.role or "Software Engineer",
        "seniority": s.seniority or "Mid",
        "duration_min": duration_min,
        "overall_score": s.overall_score or 0,
        "body_language": s.body_language or {},
        "scores": avg_scores,
        "questions_answered": sum(1 for t in turns if (t.answer or "").strip()),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }


@app.post("/sessions/{session_id}/share")
async def create_share_link(session_id: int, user: Dict = Depends(current_user)):
    """Owner-only. Mints (or returns existing) a share token for this session."""
    with db_session() as db:
        s = crud.get_session(db, session_id)
        if not s:
            raise HTTPException(404, "session not found")
        if s.user_id and s.user_id != _uid(user):
            raise HTTPException(403, "not your session")
        token = crud.mint_share_token(db, session_id)
        if not token:
            raise HTTPException(500, "could not mint share token")
        return {"token": token}


@app.get("/public/results/{token}")
async def public_results(token: str):
    """No auth. Sanitized session summary by share token."""
    with db_session() as db:
        s = crud.get_session_by_share_token(db, token)
        if not s:
            raise HTTPException(404, "results not found")
        return _serialize_public(s)


import time as _time

# Probe is cached for 5 minutes — long enough to be cheap, short enough to
# self-heal if a bad key was rotated. Previously cached forever and required
# a restart to recover.
_OPENAI_PROBE_CACHE: Dict[str, Any] = {"ts": 0.0, "valid": False, "msg": ""}
_PROBE_TTL_SECONDS = 300

def _probe_openai_once() -> Dict[str, Any]:
    now = _time.time()
    if (now - _OPENAI_PROBE_CACHE.get("ts", 0)) < _PROBE_TTL_SECONDS and _OPENAI_PROBE_CACHE.get("ts", 0) > 0:
        return _OPENAI_PROBE_CACHE
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        _OPENAI_PROBE_CACHE.update(ts=now, valid=False, msg="OPENAI_API_KEY not set")
        return _OPENAI_PROBE_CACHE
    try:
        from openai import OpenAI
        c = OpenAI(api_key=api_key)
        c.models.list()  # cheapest auth check
        _OPENAI_PROBE_CACHE.update(ts=now, valid=True, msg="ok")
    except Exception as e:
        _OPENAI_PROBE_CACHE.update(ts=now, valid=False, msg=str(e)[:160])
    return _OPENAI_PROBE_CACHE


@app.get("/profile")
async def get_profile(user: Dict = Depends(current_user)):
    """Return the user's saved profile so the frontend can pre-fill the setup form."""
    with db_session() as db:
        p = crud.get_user_profile(db, user_id=_uid(user))
        return p or {"name": "", "resume_text": "", "role": "", "seniority": "", "tone": "", "focus": [], "jd_text": ""}


@app.get("/health")
async def health():
    probe = _probe_openai_once()
    return {
        "ok": True,
        "openai": probe["valid"],
        "openai_message": probe["msg"],
        "tavus": avatar.is_configured(),
    }
