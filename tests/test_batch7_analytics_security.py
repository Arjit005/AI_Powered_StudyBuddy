import base64
from datetime import timedelta

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import database
from backend.auth import create_access_token
from backend.ai_service import AIService
from backend.main import app
from backend.models import Base, ChatHistory, Conversation, SavedStudyMaterial, Source, StudySession, User


@pytest.fixture
def isolated_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[database.get_db] = override_get_db

    try:
        with TestClient(app) as client:
            yield client, TestingSessionLocal
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _create_user(db, username):
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password="not-used-in-this-test",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user):
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def _chart(client, headers, params=None):
    response = client.get("/api/analytics/dashboard", headers=headers, params=params)
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"chart"}
    assert isinstance(payload["chart"], str)
    assert base64.b64decode(payload["chart"]).startswith(b"\x89PNG\r\n\x1a\n")
    return payload["chart"]


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic not-a-bearer-token"},
        {"Authorization": "not-a-bearer-token"},
        {"Authorization": "Bearer not-a-valid-jwt"},
    ],
    ids=["missing", "wrong-scheme", "malformed", "invalid-token"],
)
def test_analytics_dashboard_rejects_missing_malformed_and_invalid_auth(
    isolated_client, headers
):
    client, _ = isolated_client

    response = client.get("/api/analytics/dashboard", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_analytics_dashboard_rejects_expired_auth(isolated_client):
    client, session_factory = isolated_client
    with session_factory() as db:
        user = _create_user(db, "expired_token_user")

    expired_token = create_access_token(
        {"sub": str(user.id), "email": user.email},
        expires_delta=timedelta(seconds=-1),
    )

    response = client.get(
        "/api/analytics/dashboard",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


def test_authenticated_analytics_are_isolated_and_anonymous_records_excluded(
    isolated_client,
):
    client, session_factory = isolated_client
    with session_factory() as db:
        user_a = _create_user(db, "analytics_user_a")
        user_b = _create_user(db, "analytics_user_b")
        db.add(
            StudySession(
                user_id=user_a.id,
                activity_type="user_a_focus",
                duration_seconds=120,
            )
        )
        db.commit()

    headers_a = _auth_headers(user_a)
    chart_a_before = _chart(client, headers_a)

    with session_factory() as db:
        db.add(
            StudySession(
                user_id=user_b.id,
                activity_type="user_b_focus",
                duration_seconds=240,
            )
        )
        db.commit()

    chart_a_after_user_b_activity = _chart(client, headers_a)
    assert chart_a_after_user_b_activity == chart_a_before

    with session_factory() as db:
        db.add(
            StudySession(
                user_id=None,
                activity_type="anonymous_activity",
                duration_seconds=360,
            )
        )
        db.commit()

    chart_a_after_anonymous_activity = _chart(client, headers_a)
    assert chart_a_after_anonymous_activity == chart_a_before

    headers_b = _auth_headers(user_b)
    chart_b_before = _chart(client, headers_b)
    assert chart_b_before != chart_a_before

    with session_factory() as db:
        db.add(
            StudySession(
                user_id=user_a.id,
                activity_type="additional_user_a_focus",
                duration_seconds=480,
            )
        )
        db.commit()

    chart_a_after_own_activity = _chart(client, headers_a)
    chart_b_after_user_a_activity = _chart(client, headers_b)
    assert chart_b_after_user_a_activity == chart_b_before

    manipulated_identity_chart = _chart(
        client,
        headers_a,
        params={"user_id": user_b.id},
    )
    assert manipulated_identity_chart == chart_a_after_own_activity


def test_anonymous_session_history_requires_authentication(isolated_client):
    client, session_factory = isolated_client
    with session_factory() as db:
        user = _create_user(db, "history_private_user")
        anonymous_session = StudySession(
            user_id=None,
            activity_type="anonymous_history_activity",
            duration_seconds=90,
        )
        db.add_all(
            [
                anonymous_session,
                StudySession(
                    user_id=user.id,
                    activity_type="private_history_activity",
                    duration_seconds=180,
                ),
            ]
        )
        db.commit()
        db.refresh(anonymous_session)
        anonymous_session_id = anonymous_session.id

    response = client.get("/api/sessions/history")
    assert response.status_code == 401

    response = client.get(
        "/api/sessions/history",
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["id"] != anonymous_session_id
    assert history[0]["activity_type"] == "private_history_activity"
    assert history[0]["duration_seconds"] == 180
    assert isinstance(history[0]["created_at"], str)


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("GET", "/api/sources", None),
        ("GET", "/api/conversations", None),
        ("POST", "/api/conversations", {"title": "Private session"}),
        ("POST", "/api/chat", {"message": "Explain recursion"}),
        ("POST", "/api/chat/stream", {"message": "Explain recursion"}),
        ("GET", "/api/chat", None),
        ("GET", "/api/sessions/history", None),
        ("GET", "/api/progress", None),
        ("GET", "/api/analytics/activity-heatmap", None),
        ("GET", "/api/library", None),
        (
            "POST",
            "/api/library",
            {
                "material_type": "note",
                "title": "Private note",
                "content_json": "{}",
            },
        ),
        (
            "POST",
            "/api/track-activity",
            {"activity_type": "timer_focus", "duration_seconds": 60},
        ),
    ],
)
def test_private_data_endpoints_reject_anonymous_requests(
    isolated_client, method, path, payload
):
    client, _ = isolated_client

    response = client.request(method, path, json=payload)

    assert response.status_code == 401


def test_authenticated_data_views_exclude_legacy_anonymous_records(isolated_client):
    client, session_factory = isolated_client
    with session_factory() as db:
        user = _create_user(db, "owned_data_user")
        db.add_all(
            [
                Source(title="Legacy guest source", raw_text="Guest-only text"),
                Conversation(title="Legacy guest conversation"),
                SavedStudyMaterial(
                    material_type="note",
                    title="Legacy guest note",
                    content_json="{}",
                ),
            ]
        )
        db.commit()

    headers = _auth_headers(user)
    assert client.get("/api/sources", headers=headers).json() == []
    assert client.get("/api/conversations", headers=headers).json() == []
    assert client.get("/api/library", headers=headers).json() == []
    assert client.get("/api/chat", headers=headers).json() == []


def test_stream_chat_builds_prompt_without_running_non_streaming_generation(
    isolated_client,
):
    client, session_factory = isolated_client
    with session_factory() as db:
        user = _create_user(db, "streaming_user")

    with patch.object(
        AIService, "build_hybrid_prompt", return_value="prepared tutor prompt"
    ) as build_prompt, patch.object(
        AIService,
        "generate_hybrid_response",
        side_effect=AssertionError("non-streaming generation must not run"),
    ) as generate_response, patch.object(
        AIService, "_generate_content_stream", return_value=iter([])
    ) as stream:
        response = client.post(
            "/api/chat/stream",
            json={"message": "Explain recursion"},
            headers=_auth_headers(user),
        )

    assert response.status_code == 200
    build_prompt.assert_called_once()
    stream.assert_called_once_with("prepared tutor prompt")
    generate_response.assert_not_called()
