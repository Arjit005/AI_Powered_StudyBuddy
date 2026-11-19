import os
from pathlib import Path

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, UniqueConstraint, Index, inspect, text
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


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"

    key = Column(String(256), primary_key=True)
    count = Column(Integer, nullable=False, default=0)
    expires_at = Column(Float, nullable=False, index=True)


class SecurityLockout(Base):
    __tablename__ = "security_lockouts"

    client_key = Column(String(64), primary_key=True)
    expires_at = Column(Float, nullable=False, index=True)


class SessionArtifact(Base):
    __tablename__ = "session_artifacts"

    id = Column(String(36), primary_key=True)  # UUID string
    session_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(32), nullable=False)   # 'mindmap' | 'canvas' | 'flashcards' | 'quiz' | 'summary' | 'chat_draft'
    payload = Column(Text, nullable=False)      # JSON string
    schema_version = Column(Integer, nullable=False, default=1)
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "user_id", "kind", name="uq_session_user_kind"),
        Index("ix_artifact_user_session", "user_id", "session_id"),
    )

    conversation = relationship("Conversation", backref="artifacts")
    user = relationship("User", backref="artifacts")


def run_migrations(target_engine=None):
    """Adopt an existing schema or apply versioned Alembic migrations."""
    from alembic import command
    from alembic.config import Config

    migration_engine = target_engine or engine
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    connection = migration_engine.connect()
    postgres_lock_acquired = False

    try:
        if migration_engine.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_lock(1476395001)"))
            connection.commit()
            postgres_lock_acquired = True

        table_names = set(inspect(connection).get_table_names())
        connection.rollback()
        is_unversioned_legacy_database = "alembic_version" not in table_names and bool(table_names)

        if is_unversioned_legacy_database:
            with connection.begin():
                inspector = inspect(connection)
                if "chat_history" in inspector.get_table_names():
                    columns = {column["name"] for column in inspector.get_columns("chat_history")}
                    if "conversation_id" not in columns:
                        connection.execute(text(
                            "ALTER TABLE chat_history ADD COLUMN conversation_id "
                            "INTEGER REFERENCES conversations(id)"
                        ))
                    if "citations_json" not in columns:
                        connection.execute(text(
                            "ALTER TABLE chat_history ADD COLUMN citations_json TEXT"
                        ))

            Base.metadata.create_all(bind=connection)
            connection.commit()

            inspector = inspect(connection)
            missing_columns = []
            for table in Base.metadata.sorted_tables:
                existing = {column["name"] for column in inspector.get_columns(table.name)}
                absent = {column.name for column in table.columns} - existing
                if absent:
                    missing_columns.append(f"{table.name}: {', '.join(sorted(absent))}")
            if missing_columns:
                raise RuntimeError(
                    "Legacy database schema is incomplete and could not be adopted: "
                    + "; ".join(missing_columns)
                )
            connection.rollback()

            config.attributes["connection"] = connection
            command.stamp(config, "head")
            connection.commit()
        else:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            connection.commit()

        # Development/Test only: If running in test or local dev mode, auto-create missing models
        env_mode = os.getenv("ENVIRONMENT", "production").lower()
        if env_mode in ["dev", "development", "test"]:
            Base.metadata.create_all(bind=connection)
            connection.commit()
    finally:
        if postgres_lock_acquired:
            if connection.in_transaction():
                connection.rollback()
            connection.execute(text("SELECT pg_advisory_unlock(1476395001)"))
            connection.commit()
        connection.close()
