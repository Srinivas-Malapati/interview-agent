from sqlalchemy import Column, Integer, String, Text
from .database import Base

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    resume_text = Column(Text)

class InterviewTranscript(Base):
    __tablename__ = "transcripts"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer)
    question = Column(Text)
    answer = Column(Text)
    feedback = Column(Text)
