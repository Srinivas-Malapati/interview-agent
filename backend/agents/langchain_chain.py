from __future__ import annotations
import os, json, random
from typing import Dict
from collections import defaultdict

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# ----------------------------
# Config
# ----------------------------
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
MOCK_MODE = os.getenv("HIRESENSE_MOCK", "0") in ("1", "true", "True")

# ----------------------------
# Per-candidate chat histories
# ----------------------------
_HISTORY: Dict[str, ChatMessageHistory] = defaultdict(ChatMessageHistory)

def get_history(candidate: str) -> ChatMessageHistory:
    return _HISTORY[candidate]

def reset_history(candidate: str):
    _HISTORY[candidate] = ChatMessageHistory()

def add_pair_to_history(candidate: str, user_text: str, ai_text: str | None = None):
    h = get_history(candidate)
    if user_text:
        h.add_user_message(user_text)
    if ai_text:
        h.add_ai_message(ai_text)

# ----------------------------
# LLMs (bound to key if present)
# ----------------------------
def _maybe_llm(model="gpt-4o-mini", temperature=0.2):
    # In mock mode or no key → return None so we skip remote calls.
    if MOCK_MODE or not OPENAI_KEY:
        return None
    return ChatOpenAI(model=model, temperature=temperature, api_key=OPENAI_KEY)

llm_json = _maybe_llm(model="gpt-4o-mini", temperature=0)       # deterministic JSON
llm_chat = _maybe_llm(model="gpt-4o-mini", temperature=0.3)     # natural question style

# ----------------------------
# Prompts
# ----------------------------
SYSTEM_BASE = """You are HireSense, a senior interview agent for {role} ({seniority}) with a {tone} tone.
You adapt questions to the candidate's background and drive to concrete, metric-driven outcomes.
You always avoid redundancy and move the conversation forward.
"""

FIRST_Q_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_BASE + """
You are starting an interview. You have optional resume text and job description.
Produce exactly ONE concise opening question tailored to the candidate.
Keep it specific and grounded in resume/JD themes. Avoid pleasantries.
"""),
    ("human", """RESUME (optional):
----------------
{resume_text}

JOB DESCRIPTION (optional):
---------------------------
{jd_text}

Return only the question, no extra text."""),
])

FOLLOWUP_JSON_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_BASE + """
Continue the interview based on the conversation so far and the candidate's latest answer.
You must return a strict JSON object with two keys:
- "followup": a single next question (concise, non-redundant, drives to metrics/impact/tradeoffs).
- "feedback": a short coaching tip (1 sentence) to help the candidate improve their next answer.

Rules:
- Ask something NEW. Do not repeat prior questions.
- Prefer metrics (%/$/time saved/scale), decisions & trade-offs, validation/experiments, ownership, and lessons learned.
- Keep tone {tone}.
- JSON only, no markdown, no extra commentary.
"""),
    MessagesPlaceholder("history"),
    ("human", """Candidate's latest answer:
{candidate_response}

Return JSON ONLY like: {"followup":"...","feedback":"..."}"""),
])

# ----------------------------
# Fallback generators (local / no LLM)
# ----------------------------
OPENERS = [
    "Walk me through a recent project you led—what was the goal, and what specific impact did you deliver?",
    "Pick a project you’re proud of: what was broken, what did you change, and how did you measure success?",
    "What’s a system you designed end-to-end? Describe the key decisions and trade-offs you made.",
]

def _fallback_opening(role: str, seniority: str, tone: str, resume_text: str, jd_text: str) -> str:
    # Light personalization using keywords
    cue = ""
    if "react" in (resume_text + jd_text).lower(): cue = " (frontend perf/UX is interesting here)"
    if "fastapi" in (resume_text + jd_text).lower(): cue = " (curious about service boundaries & latency)"
    if "sql" in (resume_text + jd_text).lower(): cue = " (data model choices welcome)"
    return random.choice(OPENERS) + cue

def _fallback_followup_and_feedback(answer: str) -> Dict[str, str]:
    wants_metric = "metric" not in answer.lower() and "%" not in answer and "$" not in answer
    if wants_metric:
        return {
            "followup": "Thanks — can you quantify the outcome (e.g., % improvement, time saved, scale handled, or error rate change)?",
            "feedback": "Tie your actions to a concrete metric and be explicit about your personal role.",
        }
    return {
        "followup": "What trade-offs did you consider, and how did you validate the approach (experiments, load tests, user studies)?",
        "feedback": "Great; briefly mention alternatives you rejected and why.",
    }

# ----------------------------
# Public builders with safe fallbacks
# ----------------------------
def build_first_question(role: str, seniority: str, tone: str, resume_text: str, jd_text: str) -> str:
    # Mock / no key
    if llm_chat is None:
        return _fallback_opening(role, seniority, tone, resume_text, jd_text)

    try:
        chain = FIRST_Q_TEMPLATE | llm_chat
        out = chain.invoke({
            "role": role,
            "seniority": seniority,
            "tone": tone,
            "resume_text": resume_text or "",
            "jd_text": jd_text or "",
        })
        q = (out.content or "").strip()
        return q or _fallback_opening(role, seniority, tone, resume_text, jd_text)
    except Exception as e:
        # Quota / network / anything → graceful fallback
        return _fallback_opening(role, seniority, tone, resume_text, jd_text)

def build_followup_and_feedback(candidate: str, role: str, seniority: str, tone: str, candidate_response: str) -> Dict[str, str]:
    if llm_json is None:
        return _fallback_followup_and_feedback(candidate_response)

    try:
        prompt = FOLLOWUP_JSON_PROMPT
        runnable = prompt | llm_json

        def _get_history(_: dict) -> ChatMessageHistory:
            return get_history(candidate)

        runner = RunnableWithMessageHistory(
            runnable=runnable,
            get_session_history=_get_history,
            history_messages_key="history",
        )

        result = runner.invoke({
            "role": role,
            "seniority": seniority,
            "tone": tone,
            "candidate_response": candidate_response,
        })

        content = result.content
        data = json.loads(content)
        followup = str(data.get("followup") or "").strip()
        feedback = str(data.get("feedback") or "").strip()
        if not followup:
            raise ValueError("empty followup")
        return {"followup": followup, "feedback": feedback}
    except Exception:
        return _fallback_followup_and_feedback(candidate_response)
