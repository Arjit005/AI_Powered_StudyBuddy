
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from .database import Base

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String) # "user" or "ai"
    content = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String)
    questions = Column(Text) # JSON string of questions
    score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    activity_type = Column(String) # "quiz", "timer_focus", "chat"
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
