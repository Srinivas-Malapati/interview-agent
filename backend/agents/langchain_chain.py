from __future__ import annotations
import os, json, random
from typing import Dict
from collections import defaultdict

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_core.messages import SystemMessage, HumanMessage
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


def hydrate_history_from_turns(candidate: str, turns: list) -> None:
    """Rebuild conversational memory from persisted Turn rows.
    Idempotent: only fills if the in-process history is empty for this candidate.
    Called when the server has been restarted mid-session.
    """
    h = get_history(candidate)
    if len(h.messages) > 0:
        return
    for t in turns:
        q = (t.question or "").strip()
        a = (t.answer or "").strip()
        f = (t.followup or "").strip()
        if q:
            h.add_ai_message(q)
        if a:
            h.add_user_message(a)
        if f:
            h.add_ai_message(f)

# ----------------------------
# LLMs (bound to key if present)
# ----------------------------
DEFAULT_MODEL = os.getenv("GREENROOM_LLM_MODEL", "gpt-4o")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")

def _is_groq(model: str) -> bool:
    """Detect whether a model name refers to a Groq-hosted model."""
    m = (model or "").lower()
    return "llama" in m or "mixtral" in m or m.startswith("groq")


def _maybe_llm(model=DEFAULT_MODEL, temperature=0.2):
    """Build a chat LLM client. Routes to Groq if the model name looks like a
    Groq model AND GROQ_API_KEY is set; otherwise falls back to OpenAI.

    To switch the whole app to free Groq Llama 3.3 70B:
        fly secrets set GREENROOM_LLM_MODEL=llama-3.3-70b-versatile GROQ_API_KEY=gsk_...
    """
    if MOCK_MODE:
        return None
    # Groq path (free tier: 30 req/min, ~14k req/day)
    if _is_groq(model) and GROQ_KEY:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(model=model, temperature=temperature, api_key=GROQ_KEY)
        except Exception as e:
            print(f"Groq init failed, falling back to OpenAI: {e}")
    # OpenAI path (default)
    if not OPENAI_KEY:
        return None
    return ChatOpenAI(model=model, temperature=temperature, api_key=OPENAI_KEY)


# gpt-4o is the default (best quality at low scale). Switch to Llama via env.
llm_json = _maybe_llm(model=DEFAULT_MODEL, temperature=0)
llm_chat = _maybe_llm(model=DEFAULT_MODEL, temperature=0.4)

# ----------------------------
# Prompts
# ----------------------------
SYSTEM_BASE = """You are Greenroom, a senior interview agent for {role} ({seniority}) with a {tone} tone.
You adapt questions to the candidate's background and drive to concrete, metric-driven outcomes.
You always avoid redundancy and move the conversation forward.
"""

FIRST_Q_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_BASE + """
You are starting a BRAND NEW interview session with someone you have NEVER met before.
Produce exactly ONE concise opening question tailored to the candidate.

REQUIRED:
- This is a FIRST-TIME MEETING. Do NOT use phrases like "good to see you", "welcome back",
  "great to see you again", or anything implying familiarity.
- Begin with a fresh introductory greeting that ADDRESSES THE CANDIDATE BY THEIR FIRST NAME:
  "{candidate_first_name}".
- Briefly introduce yourself as Greenroom, then ask ONE specific opening question grounded
  in their resume/JD.
- Sound natural, like a human interviewer meeting them for the first time.

Good examples:
"Hi {candidate_first_name} — I'm Greenroom, your interviewer today. Thanks for joining. To start, could you walk me through ..."
"Hello {candidate_first_name}, nice to meet you. I'm Greenroom — let's dive in. Tell me about ..."

Avoid: "Good to see you", "Welcome back", "It's been a while", "Great to have you back"
"""),
    ("human", """RESUME (optional):
----------------
{resume_text}

JOB DESCRIPTION (optional):
---------------------------
{jd_text}

Return only the greeting + question. No extra commentary."""),
])

FOLLOWUP_JSON_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_BASE + """
Continue the interview based on the conversation so far and the candidate's latest answer.
You must return a STRICT JSON object with these keys:
- "followup": a single next question (concise, non-redundant, drives to metrics/impact/tradeoffs).
- "feedback": one short coaching sentence (what to improve next time).
- "rewrite": a 2-3 sentence improved version of the candidate's last answer that demonstrates STAR + a concrete metric + ownership. Write it in first person ("I ...").
- "scores": object with integer 0-100 keys: "structure", "clarity", "relevance", "impact".

Rules:
- Ask something NEW. Do not repeat prior questions.
- Reference SPECIFIC details from the candidate's answer (project name, tech, metric) in your followup so it feels conversational.
- Keep tone {tone}.
- JSON only, no markdown, no extra commentary.
"""),
    MessagesPlaceholder("history"),
    ("human", """Candidate's latest answer:
{candidate_response}

Return JSON ONLY like:
{{"followup":"...","feedback":"...","rewrite":"...","scores":{{"structure":0,"clarity":0,"relevance":0,"impact":0}}}}"""),
])

# ----------------------------
# Fallback generators (local / no LLM)
# ----------------------------
OPENERS = [
    "Hi {name} — I'm Greenroom, your interviewer today. Thanks for joining. To kick things off, walk me through a recent project you led — what was the goal and what specific impact did you deliver?",
    "Hello {name}, nice to meet you. I'm Greenroom — let's dive in. Pick a project you're proud of: what was broken, what did you change, and how did you measure success?",
    "Hey {name}, welcome — I'm Greenroom. Let's start with a system you designed end-to-end. Walk me through the key decisions and trade-offs you made.",
]

def _first_name(full: str) -> str:
    if not full:
        return "there"
    return full.strip().split()[0]

def _fallback_opening(role: str, seniority: str, tone: str, resume_text: str, jd_text: str, candidate_name: str = "") -> str:
    name = _first_name(candidate_name)
    cue = ""
    if "react"   in (resume_text + jd_text).lower(): cue = " (frontend perf/UX is interesting here)"
    if "fastapi" in (resume_text + jd_text).lower(): cue = " (curious about service boundaries & latency)"
    if "sql"     in (resume_text + jd_text).lower(): cue = " (data model choices welcome)"
    return random.choice(OPENERS).format(name=name) + cue


def _heuristic_scores(answer: str) -> Dict[str, int]:
    a = (answer or "").strip()
    words = len(a.split())
    has_metric = any(c.isdigit() for c in a) and any(k in a.lower() for k in ["%", "$", "x", "ms", "sec", "k ", "m ", "billion", "million"])
    has_star = any(k in a.lower() for k in ["situation", "task", "action", "result", "impact", "outcome"])
    has_owner = any(k in a.lower() for k in ["i led", "i owned", "i designed", "i built", "my role", "i drove"])
    structure = 40 + (20 if has_star else 0) + (15 if 40 < words < 220 else 0) + (10 if words >= 60 else 0)
    clarity   = 50 + (20 if 30 < words < 200 else 0) + (10 if "." in a else 0)
    relevance = 55 + (15 if any(k in a.lower() for k in ["because", "so that", "in order to"]) else 0)
    impact    = 35 + (35 if has_metric else 0) + (15 if has_owner else 0)
    return {k: max(0, min(100, v)) for k, v in {"structure": structure, "clarity": clarity, "relevance": relevance, "impact": impact}.items()}

def _fallback_rewrite(answer: str) -> str:
    a = (answer or "").strip() or "I worked on a project."
    return (
        f"Situation: We had a clear problem to solve. Task: I owned the end-to-end fix. "
        f"Action: {a[:160]}. Result: I delivered a measurable improvement (e.g., ~30% latency drop / 2x throughput) "
        f"and documented the trade-offs we accepted."
    )

def _fallback_followup_and_feedback(answer: str) -> Dict[str, object]:
    wants_metric = "metric" not in answer.lower() and "%" not in answer and "$" not in answer
    if wants_metric:
        followup = "Thanks — can you quantify the outcome (e.g., % improvement, time saved, scale handled, or error rate change)?"
        feedback = "Tie your actions to a concrete metric and be explicit about your personal role."
    else:
        followup = "What trade-offs did you consider, and how did you validate the approach (experiments, load tests, user studies)?"
        feedback = "Great; briefly mention alternatives you rejected and why."
    return {
        "followup": followup,
        "feedback": feedback,
        "rewrite": _fallback_rewrite(answer),
        "scores": _heuristic_scores(answer),
    }

# ----------------------------
# Public builders with safe fallbacks
# ----------------------------
def build_first_question(role: str, seniority: str, tone: str, resume_text: str, jd_text: str, candidate_name: str = "") -> str:
    first_name = _first_name(candidate_name)

    if llm_chat is None:
        return _fallback_opening(role, seniority, tone, resume_text, jd_text, candidate_name)

    try:
        chain = FIRST_Q_TEMPLATE | llm_chat
        out = chain.invoke({
            "role": role,
            "seniority": seniority,
            "tone": tone,
            "resume_text": resume_text or "",
            "jd_text": jd_text or "",
            "candidate_first_name": first_name,
        })
        q = (out.content or "").strip()
        return q or _fallback_opening(role, seniority, tone, resume_text, jd_text, candidate_name)
    except Exception:
        return _fallback_opening(role, seniority, tone, resume_text, jd_text, candidate_name)


SCORE_ONLY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_BASE + """
Score the candidate's most recent answer and produce coaching artefacts.
You must return STRICT JSON with these keys ONLY (no followup):
- "feedback": one short coaching sentence (what to improve next time).
- "rewrite": a 2-3 sentence improved version of the candidate's last answer in first person (STAR + a concrete metric + ownership).
- "scores": object with integer 0-100 keys: "structure", "clarity", "relevance", "impact".

JSON only, no markdown, no extra commentary.
Keep tone {tone}.
"""),
    ("human", """Candidate's latest answer:
{candidate_response}

Return JSON ONLY like:
{{"feedback":"...","rewrite":"...","scores":{{"structure":0,"clarity":0,"relevance":0,"impact":0}}}}"""),
])


def _parse_strict_json(content: str) -> Dict:
    s = (content or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.lower().startswith("json"):
            s = s[4:].strip()
    if not s.startswith("{"):
        i, j = s.find("{"), s.rfind("}")
        if i != -1 and j > i:
            s = s[i:j+1]
    return json.loads(s)


def _difficulty_modifier(running_avg: float) -> str:
    """Adaptive prompt addendum based on how strong the candidate's recent
    answers have been. We don't expose the score to them — just steer the LLM."""
    if running_avg >= 80:
        return ("The candidate is performing strongly so far. Push harder: probe "
                "trade-offs, failure modes, scale limits, or ask them to justify "
                "their choice against a credible alternative.")
    if running_avg <= 50 and running_avg > 0:
        return ("The candidate is struggling to give crisp answers. Ask a more "
                "concrete, narrower question. Anchor in one sub-system or one "
                "metric and ask them to walk through it step by step.")
    return ("Maintain a normal interview cadence — probe for metrics, trade-offs, "
            "and personal ownership.")


async def stream_next_question(
    candidate: str, role: str, seniority: str, tone: str,
    candidate_response: str,
    *, seed_questions: list | None = None, running_avg: float = 0.0,
):
    """Async generator: yields text chunks of the next interview question
    in real time. Falls back to a single chunk of the rule-based question if
    the LLM is unavailable.

    Optional parameters:
      seed_questions  curated questions to use as STYLE references (not asked verbatim)
      running_avg     0..100 — adaptive difficulty modifier
    """
    if llm_chat is None:
        out = _fallback_followup_and_feedback(candidate_response)
        yield out["followup"]
        return

    history = get_history(candidate)
    seed_block = ""
    if seed_questions:
        bullets = "\n".join(f"  - {q}" for q in seed_questions)
        seed_block = (
            "\n\nFor stylistic reference, here are real interview questions for this role. "
            "Do NOT ask any of these verbatim — use them only to calibrate depth and topic:\n"
            f"{bullets}"
        )

    messages = [
        SystemMessage(content=(
            SYSTEM_BASE.format(role=role, seniority=seniority, tone=tone)
            + "\nAsk ONE next interview question that drives toward metrics, trade-offs, "
              "and ownership. Reference specifics from their answer to feel conversational. "
              "Return ONLY the question text — no preamble, no JSON."
            + "\n\n" + _difficulty_modifier(running_avg)
            + seed_block
        )),
        *history.messages,
        HumanMessage(content=f"Candidate's latest answer:\n{candidate_response}\n\nYour next question:"),
    ]
    try:
        async for chunk in llm_chat.astream(messages):
            text = getattr(chunk, "content", None) or ""
            if text:
                yield text
    except Exception as e:
        print("stream_next_question error:", e)
        yield _fallback_followup_and_feedback(candidate_response)["followup"]


def score_answer_only(role: str, seniority: str, tone: str, candidate_response: str) -> Dict[str, object]:
    """Non-streaming. Returns {feedback, rewrite, scores}."""
    if llm_json is None:
        out = _fallback_followup_and_feedback(candidate_response)
        return {"feedback": out["feedback"], "rewrite": out["rewrite"], "scores": out["scores"]}
    try:
        chain = SCORE_ONLY_PROMPT | llm_json
        result = chain.invoke({
            "role": role, "seniority": seniority, "tone": tone,
            "candidate_response": candidate_response,
        })
        data = _parse_strict_json(result.content)
        feedback = str(data.get("feedback") or "").strip()
        rewrite = str(data.get("rewrite") or "").strip()
        raw = data.get("scores") or {}
        scores = {
            k: max(0, min(100, int(raw.get(k, 0) or 0)))
            for k in ("structure", "clarity", "relevance", "impact")
        }
        if not rewrite:
            rewrite = _fallback_rewrite(candidate_response)
        if not any(scores.values()):
            scores = _heuristic_scores(candidate_response)
        return {"feedback": feedback, "rewrite": rewrite, "scores": scores}
    except Exception as e:
        print("score_answer_only error:", e)
        out = _fallback_followup_and_feedback(candidate_response)
        return {"feedback": out["feedback"], "rewrite": out["rewrite"], "scores": out["scores"]}


def build_followup_and_feedback(candidate: str, role: str, seniority: str, tone: str, candidate_response: str) -> Dict[str, object]:
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

        result = runner.invoke(
            {
                "role": role,
                "seniority": seniority,
                "tone": tone,
                "candidate_response": candidate_response,
            },
            config={"configurable": {"session_id": candidate}},
        )

        content = (result.content or "").strip()
        # Strip optional ```json fences that gpt-4o sometimes emits
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("json"):
                content = content[4:].strip()
        # Extract first {...} block if the model added extra text
        if not content.startswith("{"):
            i, j = content.find("{"), content.rfind("}")
            if i != -1 and j > i:
                content = content[i:j+1]
        data = json.loads(content)
        followup = str(data.get("followup") or "").strip()
        feedback = str(data.get("feedback") or "").strip()
        rewrite  = str(data.get("rewrite") or "").strip()
        raw_scores = data.get("scores") or {}
        scores = {
            k: max(0, min(100, int(raw_scores.get(k, 0) or 0)))
            for k in ("structure", "clarity", "relevance", "impact")
        }
        if not followup:
            raise ValueError("empty followup")
        if not rewrite:
            rewrite = _fallback_rewrite(candidate_response)
        if not any(scores.values()):
            scores = _heuristic_scores(candidate_response)
        return {
            "followup": followup,
            "feedback": feedback,
            "rewrite": rewrite,
            "scores": scores,
        }
    except Exception:
        return _fallback_followup_and_feedback(candidate_response)
