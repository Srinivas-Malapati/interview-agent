import io
import os
from pathlib import Path
from typing import Optional, List, Dict

# --- Load .env BEFORE importing anything that constructs ChatOpenAI ---
from dotenv import load_dotenv
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)
print("OPENAI_API_KEY loaded:", "OK" if os.getenv("OPENAI_API_KEY") else "NOT FOUND")

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# LangChain chain utilities
from agents.langchain_chain import (
    build_first_question,
    build_followup_and_feedback,
    add_pair_to_history,
    reset_history,
)

app = FastAPI(title="HireSense Interview API (LangChain)")

# Allow your Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# In-memory stores
# -----------------------------
RESUMES: Dict[str, str] = {}
JD_CACHE: Dict[str, Dict] = {}  # optional per-candidate JD config

# -----------------------------
# Helpers
# -----------------------------
def extract_text_from_upload(file: UploadFile) -> str:
    """Best-effort text extraction; never crash API if dependency or file is bad."""
    name = (file.filename or "").lower()
    data = file.file.read()
    if not data:
        return ""

    # text files
    if name.endswith((".txt", ".md")):
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    # pdf files
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader  # lazy import to avoid import-time errors
            reader = PdfReader(io.BytesIO(data))
            return "\n".join([(p.extract_text() or "") for p in reader.pages[:10]])
        except Exception as e:
            print("PDF parse error:", e)
            return ""

    # default: try decode
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
    description: Optional[str] = ""  # freeform JD text

class StartResponse(BaseModel):
    first_question: str

class AnswerResponse(BaseModel):
    followup: str
    feedback: str

# -----------------------------
# Routes
# -----------------------------

@app.post("/upload_resume", response_model=UploadAck)
@app.post("/upload_resume/", response_model=UploadAck)
async def upload_resume(candidate: str = Form(...), file: UploadFile = File(...)):
    try:
        text = extract_text_from_upload(file)
        RESUMES[candidate] = text or ""
        return {"ok": True}
    except Exception as e:
        print("Upload error:", e)
        raise HTTPException(status_code=400, detail="Could not parse resume")

@app.post("/start_interview", response_model=StartResponse)
@app.post("/start_interview/", response_model=StartResponse)
async def start_interview(payload: StartRequest):
    # cache role pack for this candidate (optional)
    JD_CACHE[payload.candidate] = {
        "role": payload.role,
        "seniority": payload.seniority,
        "tone": payload.tone,
        "focus": payload.focus or [],
        "description": payload.description or "",
    }

    # reset conversation history on start
    reset_history(payload.candidate)

    resume_text = RESUMES.get(payload.candidate, "")
    jd_text = JD_CACHE[payload.candidate]["description"]

    first_q = build_first_question(
        role=payload.role,
        seniority=payload.seniority,
        tone=payload.tone,
        resume_text=resume_text,
        jd_text=jd_text,
    )

    # seed history with the AI's first question (so the chain "remembers")
    add_pair_to_history(payload.candidate, user_text="", ai_text=first_q)

    return {"first_question": first_q}

@app.post("/answer", response_model=AnswerResponse)
@app.post("/answer/", response_model=AnswerResponse)
async def answer(candidate: str = Form(...), response: str = Form(...)):
    pack = JD_CACHE.get(candidate, default_role_pack())
    role = pack["role"]; seniority = pack["seniority"]; tone = pack["tone"]

    # add candidate reply to history
    add_pair_to_history(candidate, user_text=response, ai_text=None)

    out = build_followup_and_feedback(
        candidate=candidate,
        role=role,
        seniority=seniority,
        tone=tone,
        candidate_response=response,
    )

    # add AI follow-up to history
    add_pair_to_history(candidate, user_text="", ai_text=out.get("followup", ""))

    return AnswerResponse(**out)
