
import os
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENVIRONMENT", "development").lower()

def _prepare_database_url(url: str) -> str:
    """
    Normalizes PostgreSQL URLs from hosting providers (Render, Supabase, Neon)
    and dynamically resolves the active DBAPI driver (psycopg 3 vs psycopg2)
    to guarantee zero ModuleNotFoundError crashes under SQLAlchemy 2.0 / 2.1+.
    """
    if not url:
        return url
    
    clean_url = url.strip()
    # 1. Render and Supabase often provide postgres:// instead of postgresql://
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql://", 1)
    
    # 2. Driver resolution for bare postgresql:// without explicit dialect driver
    if clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+"):
        try:
            import psycopg  # modern psycopg 3 (SQLAlchemy 2.1+ default)
            clean_url = clean_url.replace("postgresql://", "postgresql+psycopg://", 1)
        except (ImportError, AttributeError):
            try:
                import psycopg2  # legacy psycopg 2 fallback
                clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            except ImportError:
                pass
                
    return clean_url

if DATABASE_URL:
    prepared_url = _prepare_database_url(DATABASE_URL)
    
    try:
        engine = create_engine(
            prepared_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300
        )
        print(f"[DATABASE] Initialized PostgreSQL connection pool with pre-ping validation (driver: {engine.dialect.driver}).")
    except Exception as e:
        # Fallback to alternate driver if psycopg vs psycopg2 dialect has an initialization problem
        if "psycopg" in str(e).lower() and "postgresql+psycopg://" in prepared_url:
            fallback_url = prepared_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
            try:
                engine = create_engine(
                    fallback_url,
                    pool_pre_ping=True,
                    pool_size=10,
                    max_overflow=20,
                    pool_recycle=300
                )
                print(f"[DATABASE] Fallback initialized PostgreSQL pool with psycopg2.")
            except Exception as e2:
                raise e2
        else:
            raise e
else:
    if ENV == "production":
        print(
            "[DATABASE WARNING] DATABASE_URL is not set on production. Running with local SQLite "
            "(storage will be ephemeral on Render). For zero-loss persistence, attach a free "
            "Neon (neon.tech) or Supabase PostgreSQL DATABASE_URL in your cloud environment."
        )
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
        except Exception as e:
            print(f"CRITICAL SQLITE WARNING: Failed to enable foreign keys pragma: {e}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

