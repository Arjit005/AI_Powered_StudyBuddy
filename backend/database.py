
import os
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENVIRONMENT", "development").lower()

if DATABASE_URL:
    # Render and Supabase often provide postgres:// instead of postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Production PostgreSQL with connection pool settings
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300
    )
elif ENV == "production":
    raise RuntimeError(
        "CRITICAL STARTUP FAILURE: DATABASE_URL is not set in production environment. "
        "Silent fallback to SQLite is strictly forbidden in production to prevent data loss."
    )
else:
    # Isolated Local Development & Testing SQLite
    SQLALCHEMY_DATABASE_URL = "sqlite:///./study_buddy.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

    # Ensure SQLite enforces foreign keys and cascade deletions
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
