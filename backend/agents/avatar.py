"""
Tavus Conversational Video Interface (CVI) client.

Tavus CVI hosts the real-time avatar in a Daily.co room. We:
  1) Create a "conversation" via Tavus REST
  2) Tavus returns a daily.co room URL
  3) Frontend embeds that room in an iframe — the candidate sees the avatar,
     speaks, and the avatar responds.
  4) For LLM responses, we either let Tavus use its bundled LLM with a system
     prompt, or point it at our /avatar/byo-llm endpoint (BYO LLM mode).

This module is intentionally tolerant: if TAVUS_API_KEY is missing or any
network call fails, it returns a `mock_room_url` so the rest of the app keeps
working in dev.
"""
from __future__ import annotations
import os
from typing import Optional, Dict, Any
import httpx

TAVUS_BASE = "https://tavusapi.com"

def _api_key() -> Optional[str]:
    return os.getenv("TAVUS_API_KEY") or None

def _headers() -> Dict[str, str]:
    return {
        "x-api-key": _api_key() or "",
        "Content-Type": "application/json",
    }

def is_configured() -> bool:
    return bool(_api_key()) and bool(os.getenv("TAVUS_REPLICA_ID"))


def build_system_prompt(role: str, seniority: str, tone: str, jd_text: str, resume_text: str, focus: list[str]) -> str:
    focus_str = ", ".join(focus) if focus else "general"
    return f"""You are HireSense, a senior {role} interviewer ({seniority} level), tone: {tone}.
You drive a realistic interview: ask one question at a time, push for metrics, trade-offs, ownership and lessons.
Adapt to the candidate's background. Avoid repeating yourself. Keep each turn under 25 seconds of spoken time.
Focus areas: {focus_str}.

JOB DESCRIPTION:
{jd_text or '(none provided)'}

CANDIDATE RESUME (excerpt):
{(resume_text or '')[:1800]}

Begin with a brief warm greeting, then your first question.
"""


def start_conversation(
    *,
    role: str,
    seniority: str,
    tone: str,
    jd_text: str,
    resume_text: str,
    focus: list[str],
    candidate_name: str,
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Tavus CVI conversation. Returns {conversation_id, room_url, mocked}."""
    if not is_configured():
        # Mock so dev still works without keys.
        return {
            "conversation_id": "mock-conversation",
            "room_url": "",
            "mocked": True,
            "message": "TAVUS_API_KEY or TAVUS_REPLICA_ID not set — avatar disabled. Set them in backend/.env to enable.",
        }

    payload: Dict[str, Any] = {
        "replica_id": os.getenv("TAVUS_REPLICA_ID"),
        "conversation_name": f"HireSense-{candidate_name}",
        "conversational_context": build_system_prompt(role, seniority, tone, jd_text, resume_text, focus),
        "custom_greeting": f"Hi {candidate_name.split()[0] if candidate_name else 'there'}, welcome — thanks for making time today. Ready when you are.",
        "properties": {
            "max_call_duration": 1800,        # 30 min cap
            "participant_left_timeout": 30,
            "participant_absent_timeout": 120,
            "enable_recording": False,        # candidate may not consent; flip on if you record server-side
            "enable_closed_captions": True,
            "language": "english",
        },
    }
    persona_id = os.getenv("TAVUS_PERSONA_ID")
    if persona_id:
        payload["persona_id"] = persona_id
    if callback_url:
        payload["callback_url"] = callback_url

    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(f"{TAVUS_BASE}/v2/conversations", json=payload, headers=_headers())
            r.raise_for_status()
            data = r.json()
        return {
            "conversation_id": data.get("conversation_id", ""),
            "room_url": data.get("conversation_url", ""),
            "mocked": False,
        }
    except Exception as e:
        return {
            "conversation_id": "",
            "room_url": "",
            "mocked": True,
            "message": f"Tavus error: {e}",
        }


def end_conversation(conversation_id: str) -> bool:
    if not is_configured() or not conversation_id or conversation_id.startswith("mock"):
        return False
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                f"{TAVUS_BASE}/v2/conversations/{conversation_id}/end",
                headers=_headers(),
            )
            return r.status_code in (200, 204)
    except Exception:
        return False
