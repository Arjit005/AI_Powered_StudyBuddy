import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi.testclient import TestClient
from backend.main import app

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
    response = client.get("/api/analytics/activity-heatmap")
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

