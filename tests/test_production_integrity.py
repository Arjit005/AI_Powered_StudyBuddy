import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import uuid
import subprocess
from fastapi.testclient import TestClient
from backend.auth import create_access_token
from backend.database import SessionLocal
from backend.main import app
from backend.models import User

client = TestClient(app)

def test_health_check_endpoint():
    """Verify dedicated lightweight zero-cost health check responds correctly."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "degraded"]
    assert "database" in data
    assert "dialect" in data

def test_activity_heatmap_endpoint():
    """Verify real database-aggregated heatmap endpoint returns 112 days with zero mock formula."""
    db = SessionLocal()
    username = f"heatmap_{uuid.uuid4().hex[:12]}"
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password="not-used-in-this-test",
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token({"sub": str(user.id), "email": user.email})
        response = client.get(
            "/api/analytics/activity-heatmap",
            headers={"Authorization": f"Bearer {token}"},
        )
    finally:
        db.delete(user)
        db.commit()
        db.close()

    assert response.status_code == 200
    data = response.json()
    assert "days" in data
    assert len(data["days"]) == 112 # Exactly 16 weeks * 7 days
    assert "total_active_days" in data
    assert "total_study_minutes" in data
    # Verify structure of daily item
    day_0 = data["days"][0]
    assert "date" in day_0
    assert "count" in day_0
    assert "intensity" in day_0
    assert 0 <= day_0["intensity"] <= 4

def test_auth_status_headers():
    """Verify security status endpoint reports active protections."""
    response = client.get("/api/security/status")
    assert response.status_code == 200
    data = response.json()
    assert data["shield_active"] is True
    assert "rate_limiting" in data


def test_cors_allows_configured_local_origin_but_not_any_render_subdomain():
    local_response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert local_response.headers["access-control-allow-origin"] == "http://localhost:5173"

    untrusted_response = client.options(
        "/api/health",
        headers={
            "Origin": "https://untrusted.onrender.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in untrusted_response.headers


def test_semantic_embedding_dimension():
    """Verify RAG semantic embedding generates 1536 dimensions matching Pinecone index."""
    from backend.rag_service import RAGService
    emb = RAGService._compute_semantic_embedding("Database indexing and b-trees")
    assert len(emb) == 1536
    # Vector must be L2 normalized
    norm = sum(x * x for x in emb)
    assert 0.99 <= norm <= 1.01

def test_database_url_normalization_and_driver_resolution():
    """Verify PostgreSQL connection URLs from Render/Supabase are normalized and resolved to available DBAPI drivers."""
    from backend.database import _prepare_database_url
    raw_render_url = "postgres://study_user:secret_pass@ep-shiny-pond-12345.us-east-2.aws.neon.tech/neondb?sslmode=require"
    resolved_url = _prepare_database_url(raw_render_url)
    assert not resolved_url.startswith("postgres://")
    assert resolved_url.startswith("postgresql+psycopg://") or resolved_url.startswith("postgresql+psycopg2://")
    assert "sslmode=require" in resolved_url


def test_production_database_requires_persistent_database_url(tmp_path):
    env = os.environ.copy()
    env["ENVIRONMENT"] = "production"
    env.pop("DATABASE_URL", None)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env["PYTHONPATH"] = os.pathsep.join(
        [repo_root, env.get("PYTHONPATH", "")]
    ).rstrip(os.pathsep)

    result = subprocess.run(
        [sys.executable, "-c", "import backend.database"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "DATABASE_URL is required in production" in result.stderr

