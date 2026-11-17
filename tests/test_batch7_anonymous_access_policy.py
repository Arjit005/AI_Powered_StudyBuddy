import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import database
from backend.auth import create_access_token
from backend.main import app
from backend.models import (
    Base,
    ChatHistory,
    Conversation,
    SavedStudyMaterial,
    Source,
    StudySession,
    User,
)


@pytest.fixture
def private_data_app():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[database.get_db] = override_get_db

    try:
        yield TestClient, testing_session_local
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _create_user(db, username=None):
    unique_name = username or f"student_{uuid.uuid4().hex[:12]}"
    user = User(
        username=unique_name,
        email=f"{unique_name}@example.com",
        hashed_password="not-used-in-this-test",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user):
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "/api/sources", None),
        ("GET", "/api/sources", None),
        ("GET", "/api/sources/1", None),
        ("DELETE", "/api/sources/1", None),
        ("GET", "/api/conversations", None),
        ("POST", "/api/conversations", {"title": "Private session"}),
        ("PUT", "/api/conversations/1", {"title": "Changed session"}),
        ("DELETE", "/api/conversations/1", None),
        ("POST", "/api/chat", {"message": "Explain recursion"}),
        ("POST", "/api/chat/stream", {"message": "Explain recursion"}),
        ("GET", "/api/chat", None),
        ("DELETE", "/api/chat", None),
        ("GET", "/api/sessions/history", None),
        ("POST", "/api/track-activity", {"activity_type": "study", "duration_seconds": 30}),
        ("GET", "/api/progress", None),
        ("DELETE", "/api/progress", None),
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
            "/api/mcp/tools/call",
            {"name": "query_study_memory", "arguments": {}},
        ),
        ("GET", "/api/library/1", None),
        ("PUT", "/api/library/1/favorite", None),
        ("DELETE", "/api/library/1", None),
    ],
)
def test_private_data_endpoints_reject_anonymous_requests(
    private_data_app, method, path, payload
):
    test_client, _ = private_data_app
    with test_client(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 401


def test_authenticated_data_endpoints_only_return_the_owners_records(private_data_app):
    test_client, session_factory = private_data_app
    with session_factory() as db:
        owner = _create_user(db, "private_owner")
        other_user = _create_user(db, "other_owner")
        owner_source = Source(
            user_id=owner.id,
            title="Owner source",
            raw_text="Owner source contents",
        )
        other_source = Source(
            user_id=other_user.id,
            title="Other source",
            raw_text="Other source contents",
        )
        owner_conversation = Conversation(user_id=owner.id, title="Owner conversation")
        other_conversation = Conversation(user_id=other_user.id, title="Other conversation")
        db.add_all([owner_source, other_source, owner_conversation, other_conversation])
        db.commit()
        db.refresh(owner_source)
        db.refresh(other_source)
        db.refresh(owner_conversation)
        db.refresh(other_conversation)
        db.add_all(
            [
                ChatHistory(
                    user_id=owner.id,
                    conversation_id=owner_conversation.id,
                    role="user",
                    content="Owner message",
                ),
                ChatHistory(
                    user_id=other_user.id,
                    conversation_id=other_conversation.id,
                    role="user",
                    content="Other user's private message",
                ),
                SavedStudyMaterial(
                    user_id=owner.id,
                    material_type="note",
                    title="Owner note",
                    content_json="{}",
                ),
                SavedStudyMaterial(
                    user_id=other_user.id,
                    material_type="note",
                    title="Other note",
                    content_json="{}",
                ),
                StudySession(
                    user_id=owner.id,
                    activity_type="owner_activity",
                    duration_seconds=60,
                ),
                StudySession(
                    user_id=other_user.id,
                    activity_type="other_activity",
                    duration_seconds=120,
                ),
            ]
        )
        db.commit()
        other_source_id = other_source.id
        other_conversation_id = other_conversation.id

    with test_client(app) as client:
        headers = _auth_headers(owner)
        assert [item["title"] for item in client.get("/api/sources", headers=headers).json()] == [
            "Owner source"
        ]
        assert client.get(
            f"/api/sources/{other_source_id}", headers=headers
        ).status_code == 404
        assert [item["title"] for item in client.get("/api/conversations", headers=headers).json()] == [
            "Owner conversation"
        ]
        assert client.get(
            f"/api/chat?conversation_id={other_conversation_id}", headers=headers
        ).json() == []
        assert [item["title"] for item in client.get("/api/library", headers=headers).json()] == [
            "Owner note"
        ]
        assert [
            item["activity_type"]
            for item in client.get("/api/sessions/history", headers=headers).json()
        ] == ["owner_activity"]


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic not-a-bearer-token"},
        {"Authorization": "Bearer not-a-valid-jwt"},
    ],
)
def test_invalid_or_missing_bearers_do_not_fall_back_to_guest_data(
    private_data_app, headers
):
    test_client, _ = private_data_app
    with test_client(app) as client:
        response = client.get("/api/sources", headers=headers)

    assert response.status_code == 401


def test_expired_bearer_is_rejected(private_data_app):
    test_client, session_factory = private_data_app
    with session_factory() as db:
        user = _create_user(db, "expired_bearer")
    expired_token = create_access_token(
        {"sub": str(user.id), "email": user.email},
        expires_delta=timedelta(seconds=-1),
    )

    with test_client(app) as client:
        response = client.get(
            "/api/sources",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

    assert response.status_code == 401


def test_authenticated_mcp_memory_query_is_scoped_to_the_owner(
    private_data_app, monkeypatch
):
    test_client, session_factory = private_data_app
    with session_factory() as db:
        owner = _create_user(db, "mcp_memory_owner")
        other_user = _create_user(db, "mcp_memory_other")
        owner_conversation = Conversation(user_id=owner.id, title="Owner memory")
        other_conversation = Conversation(user_id=other_user.id, title="Other memory")
        db.add_all([owner_conversation, other_conversation])
        db.commit()
        db.refresh(owner_conversation)
        db.refresh(other_conversation)
        db.add_all(
            [
                ChatHistory(
                    user_id=owner.id,
                    conversation_id=owner_conversation.id,
                    role="user",
                    content="Owner-only memory",
                ),
                ChatHistory(
                    user_id=other_user.id,
                    conversation_id=other_conversation.id,
                    role="user",
                    content="Other user's memory",
                ),
            ]
        )
        db.commit()
        other_conversation_id = other_conversation.id

    monkeypatch.setattr("backend.mcp_service.SessionLocal", session_factory)
    with test_client(app) as client:
        response = client.post(
            "/api/mcp/tools/call",
            json={"name": "query_study_memory", "arguments": {}},
            headers=_auth_headers(owner),
        )
        assert response.status_code == 200
        messages = response.json()["data"]["active_conversations"]
        assert [item["title"] for item in messages] == ["Owner memory"]

        other_memory = client.post(
            "/api/mcp/tools/call",
            json={
                "name": "query_study_memory",
                "arguments": {"conversation_id": other_conversation_id},
            },
            headers=_auth_headers(owner),
        )
        assert other_memory.status_code == 200
        assert other_memory.json()["data"]["status"] == "not_found"

        rpc_response = client.post(
            "/api/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {"name": "query_study_memory", "arguments": {}},
            },
        )
        assert rpc_response.status_code == 200
        assert rpc_response.json()["error"]["code"] == -32001


def test_public_stateless_summarization_remains_available(private_data_app, monkeypatch):
    test_client, _ = private_data_app
    monkeypatch.setattr(
        "backend.main.ai_service.AIService.summarize_topic",
        lambda topic: "A test summary.",
    )

    with test_client(app) as client:
        response = client.post("/api/summarize", json={"topic": "biology"})

    assert response.status_code == 200
    assert response.json() == {"summary": "A test summary."}
