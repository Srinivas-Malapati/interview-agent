import secrets
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session as OrmSession

from . import models


def get_or_create_candidate(
    db: OrmSession, name: str, resume_text: str = "", user_id: str = "local-dev",
) -> models.Candidate:
    """A candidate is uniquely identified by (user_id, name). One auth user can
    practice as multiple display names if they want, but no other user can see
    or modify their rows."""
    c = (
        db.query(models.Candidate)
        .filter(models.Candidate.user_id == user_id, models.Candidate.name == name)
        .one_or_none()
    )
    if c is None:
        c = models.Candidate(user_id=user_id, name=name, resume_text=resume_text)
        db.add(c)
        db.flush()
    elif resume_text and resume_text != c.resume_text:
        c.resume_text = resume_text
    return c


def create_session(
    db: OrmSession,
    candidate: models.Candidate,
    role: str,
    seniority: str,
    tone: str,
    focus: List[str],
    jd_text: str,
) -> models.Session:
    s = models.Session(
        candidate_id=candidate.id,
        user_id=candidate.user_id,
        candidate_name=candidate.name,
        role=role,
        seniority=seniority,
        tone=tone,
        focus=focus or [],
        jd_text=jd_text or "",
    )
    db.add(s)
    db.flush()
    return s


def attach_tavus(db: OrmSession, session_id: int, conversation_id: str, room_url: str):
    s = db.query(models.Session).get(session_id)
    if not s:
        return
    s.tavus_conversation_id = conversation_id
    s.tavus_room_url = room_url


def add_turn(
    db: OrmSession,
    session_id: int,
    question: str,
    answer: str,
    followup: str,
    feedback: str,
    rewrite: str,
    scores: Dict[str, int],
) -> models.Turn:
    idx = db.query(models.Turn).filter(models.Turn.session_id == session_id).count()
    t = models.Turn(
        session_id=session_id,
        idx=idx,
        question=question or "",
        answer=answer or "",
        followup=followup or "",
        feedback=feedback or "",
        rewrite=rewrite or "",
        score_structure=int(scores.get("structure", 0)),
        score_clarity=int(scores.get("clarity", 0)),
        score_relevance=int(scores.get("relevance", 0)),
        score_impact=int(scores.get("impact", 0)),
    )
    db.add(t)
    db.flush()
    return t


def end_session(db: OrmSession, session_id: int, body_language: Optional[Dict] = None):
    s = db.query(models.Session).get(session_id)
    if not s:
        return None
    s.ended_at = datetime.utcnow()
    if body_language:
        s.body_language = body_language
    turns = s.turns
    if turns:
        avg = sum(
            (t.score_structure + t.score_clarity + t.score_relevance + t.score_impact) / 4
            for t in turns
        ) / len(turns)
        s.overall_score = int(round(avg))
    return s


def list_sessions_for_candidate(
    db: OrmSession, candidate_name: str, user_id: str = "local-dev",
) -> List[models.Session]:
    return (
        db.query(models.Session)
        .filter(models.Session.user_id == user_id)
        .filter(models.Session.candidate_name == candidate_name)
        .order_by(models.Session.started_at.asc())
        .all()
    )


def get_session(db: OrmSession, session_id: int) -> Optional[models.Session]:
    return db.query(models.Session).get(session_id)


def get_active_session(
    db: OrmSession, candidate_name: str, user_id: str = "local-dev",
) -> Optional[models.Session]:
    return (
        db.query(models.Session)
        .filter(models.Session.user_id == user_id)
        .filter(models.Session.candidate_name == candidate_name)
        .filter(models.Session.ended_at.is_(None))
        .order_by(models.Session.started_at.desc())
        .first()
    )


def get_candidate_resume(
    db: OrmSession, candidate_name: str, user_id: str = "local-dev",
) -> str:
    c = (
        db.query(models.Candidate)
        .filter(models.Candidate.user_id == user_id, models.Candidate.name == candidate_name)
        .one_or_none()
    )
    return (c.resume_text or "") if c else ""


def get_user_profile(db: OrmSession, user_id: str = "local-dev") -> Optional[Dict]:
    """Latest profile config across this user's candidates (the most-recently
    used name, resume, and interview config). None if no candidate yet."""
    c = (
        db.query(models.Candidate)
        .filter(models.Candidate.user_id == user_id)
        .order_by(models.Candidate.id.desc())
        .first()
    )
    if not c:
        return None
    return {
        "name": c.name or "",
        "resume_text": c.resume_text or "",
        "role": c.last_role or "",
        "seniority": c.last_seniority or "",
        "tone": c.last_tone or "",
        "focus": c.last_focus or [],
        "jd_text": c.last_jd_text or "",
    }


def save_candidate_profile(
    db: OrmSession,
    candidate: models.Candidate,
    role: str, seniority: str, tone: str,
    focus: List[str], jd_text: str,
):
    """Cache the last-used interview config so we can pre-fill next time."""
    candidate.last_role = role or ""
    candidate.last_seniority = seniority or ""
    candidate.last_tone = tone or ""
    candidate.last_focus = focus or []
    candidate.last_jd_text = jd_text or ""


def get_last_question(db: OrmSession, session_id: int) -> str:
    last = (
        db.query(models.Turn)
        .filter(models.Turn.session_id == session_id)
        .order_by(models.Turn.idx.desc())
        .first()
    )
    return (last.followup or last.question) if last else ""


def get_turns_for_history(db: OrmSession, session_id: int) -> List[models.Turn]:
    return (
        db.query(models.Turn)
        .filter(models.Turn.session_id == session_id)
        .order_by(models.Turn.idx.asc())
        .all()
    )


def mint_share_token(db: OrmSession, session_id: int) -> Optional[str]:
    """Return the session's share_token, creating one if it doesn't exist yet."""
    s = db.query(models.Session).get(session_id)
    if not s:
        return None
    if not s.share_token:
        s.share_token = secrets.token_urlsafe(12)
        db.flush()
    return s.share_token


def get_session_by_share_token(db: OrmSession, token: str) -> Optional[models.Session]:
    if not token:
        return None
    return (
        db.query(models.Session)
        .filter(models.Session.share_token == token)
        .one_or_none()
    )


def delete_sessions_for_candidate(
    db: OrmSession, candidate_name: str, user_id: str = "local-dev",
    keep_session_id: Optional[int] = None,
) -> int:
    """Delete THIS user's sessions matching the candidate name tolerantly:
       - case-insensitive
       - first-name fallback
       Sessions belonging to other user_ids are never touched.
       Optionally preserve one session id (e.g. the one currently being viewed).
    """
    if not candidate_name:
        return 0
    target = candidate_name.strip().lower()
    first = target.split()[0] if target else ""
    rows = db.query(models.Session).filter(models.Session.user_id == user_id).all()
    n = 0
    for s in rows:
        if keep_session_id is not None and s.id == keep_session_id:
            continue
        stored = (s.candidate_name or "").strip().lower()
        if not stored:
            continue
        stored_first = stored.split()[0] if stored else ""
        if stored == target or stored_first == first:
            db.delete(s)
            n += 1
    return n
