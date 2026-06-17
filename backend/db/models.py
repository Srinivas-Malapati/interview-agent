from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from .database import Base


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    # user_id is the Supabase auth user id (the JWT 'sub' claim).
    # For local dev (no auth), this is set to 'local-dev'.
    user_id = Column(String, index=True, default="local-dev")
    name = Column(String, index=True)
    resume_text = Column(Text, default="")

    # Last-used interview config — for pre-filling the setup form
    last_role = Column(String, default="")
    last_seniority = Column(String, default="")
    last_tone = Column(String, default="")
    last_focus = Column(JSON, default=list)
    last_jd_text = Column(Text, default="")

    sessions = relationship("Session", back_populates="candidate", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    # Denormalized owner of this session for cheap filtering / RLS-style checks.
    user_id = Column(String, index=True, default="local-dev")
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    candidate_name = Column(String, index=True)
    role = Column(String, default="Software Engineer")
    seniority = Column(String, default="Mid")
    tone = Column(String, default="Professional")
    focus = Column(JSON, default=list)
    jd_text = Column(Text, default="")
    tavus_conversation_id = Column(String, default="")
    tavus_room_url = Column(String, default="")
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    body_language = Column(JSON, default=dict)
    overall_score = Column(Integer, default=0)
    recording_path = Column(String, default="")  # relative path under data/recordings/
    share_token = Column(String, index=True, unique=True, nullable=True)

    candidate = relationship("Candidate", back_populates="sessions")
    turns = relationship("Turn", back_populates="session", cascade="all, delete-orphan", order_by="Turn.idx")


class Turn(Base):
    __tablename__ = "turns"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), index=True)
    idx = Column(Integer, default=0)
    question = Column(Text, default="")
    answer = Column(Text, default="")
    followup = Column(Text, default="")
    feedback = Column(Text, default="")
    rewrite = Column(Text, default="")
    score_structure = Column(Integer, default=0)
    score_clarity = Column(Integer, default=0)
    score_relevance = Column(Integer, default=0)
    score_impact = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="turns")


class InterviewTranscript(Base):
    __tablename__ = "transcripts"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer)
    question = Column(Text)
    answer = Column(Text)
    feedback = Column(Text)
