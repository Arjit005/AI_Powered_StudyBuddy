from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base, engine

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    sources = relationship("Source", back_populates="user", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String, default="New Study Session")
    long_term_summary = Column(Text, nullable=True)  # Hybrid Memory: Tier-2 Long-Term Episodic Memory
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="conversations")
    messages = relationship("ChatHistory", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatHistory.id.asc()")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, index=True)
    role = Column(String)  # "user" or "ai"
    content = Column(Text)
    citations_json = Column(Text, nullable=True)  # JSON-serialized citation list
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chat_history")
    conversation = relationship("Conversation", back_populates="messages")
    source_links = relationship("MessageSourceLink", back_populates="message", cascade="all, delete-orphan")

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    topic = Column(String)
    questions = Column(Text)  # JSON string of questions
    score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="quizzes")

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    activity_type = Column(String)  # "quiz", "timer_focus", "ai_chat", "canvas_diagram"
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="study_sessions")

class SavedStudyMaterial(Base):
    __tablename__ = "saved_study_materials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    material_type = Column(String, index=True)  # "summary", "quiz", "flashcards", "canvas_diagram", "note"
    title = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    content_json = Column(Text, nullable=False)  # Full JSON payload or markdown
    tags = Column(String, default="")  # Comma-separated tags
    is_favorite = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="saved_materials")


# ============================================================================
# NEW PHASE 1 & PHASE 7 MODELS (Source-Grounded RAG & Feedback)
# ============================================================================
class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    source_type = Column(String, default="text")  # "pdf" | "url" | "text" | "note" | "web"
    origin = Column(String, default="upload")     # "upload" | "web_discovered"
    url = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    raw_text = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    key_topics = Column(Text, nullable=True)      # JSON list of strings
    starred = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="sources")
    chunks = relationship("SourceChunk", back_populates="source", cascade="all, delete-orphan")


class SourceChunk(Base):
    __tablename__ = "source_chunks"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)       # JSON-serialized float array
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source = relationship("Source", back_populates="chunks")
    message_links = relationship("MessageSourceLink", back_populates="chunk", cascade="all, delete-orphan")


class MessageSourceLink(Base):
    __tablename__ = "message_source_links"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("chat_history.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id = Column(Integer, ForeignKey("source_chunks.id", ondelete="CASCADE"), nullable=False, index=True)
    ordinal = Column(Integer, nullable=False)     # 1, 2, 3... corresponding to [n]

    message = relationship("ChatHistory", back_populates="source_links")
    chunk = relationship("SourceChunk", back_populates="message_links")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    page = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)      # 1 to 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="feedback_items")


def run_migrations():
    """Safely apply schema migrations."""
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            try:
                res = conn.execute(text("PRAGMA table_info(chat_history)")).fetchall()
                col_names = [r[1] for r in res]
                if "conversation_id" not in col_names:
                    conn.execute(text("ALTER TABLE chat_history ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)"))
                    conn.commit()
                if "citations_json" not in col_names:
                    conn.execute(text("ALTER TABLE chat_history ADD COLUMN citations_json TEXT"))
                    conn.commit()
            except Exception as e:
                print(f"Migration note: {e}")
