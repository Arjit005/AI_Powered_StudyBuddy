import pytest
from fastapi.testclient import TestClient

from backend.ai_service import AIService, AIServiceError, AIServiceUnavailable
from backend.main import app
from backend.mcp_service import MCPService
from backend.rag_service import RAGService


def test_hybrid_chat_does_not_invent_response_when_providers_fail(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise AIServiceUnavailable("provider details must remain internal")

    monkeypatch.setattr(AIService, "_generate_content_safe", unavailable)
    with pytest.raises(AIServiceUnavailable):
        AIService.generate_hybrid_response("Explain photosynthesis")


def test_public_summary_reports_provider_outage_without_fabricated_content(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise AIServiceUnavailable("provider details must remain internal")

    monkeypatch.setattr(AIService, "summarize_topic", unavailable)
    with TestClient(app) as client:
        response = client.post("/api/summarize", json={"topic": "photosynthesis"})

    assert response.status_code == 503
    assert response.json() == {
        "detail": "AI services are temporarily unavailable. Please try again shortly."
    }
    assert response.headers["retry-after"] == "30"
    assert "provider details" not in response.text


def test_invalid_ai_output_uses_gateway_error_not_success_shaped_data(monkeypatch):
    monkeypatch.setattr(
        AIService,
        "_generate_content_safe",
        lambda *_args, **_kwargs: type("Response", (), {"text": "not valid JSON"})(),
    )

    with pytest.raises(AIServiceError):
        AIService.generate_flashcards("biology")


def test_canvas_endpoint_reports_provider_outage(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise AIServiceUnavailable("provider details must remain internal")

    monkeypatch.setattr(AIService, "_generate_content_safe", unavailable)
    with TestClient(app) as client:
        response = client.post("/api/canvas/generate", json={"topic": "photosynthesis"})

    assert response.status_code == 503
    assert response.json() == {
        "detail": "AI services are temporarily unavailable. Please try again shortly."
    }
    assert "provider details" not in response.text


def test_mcp_canvas_outage_is_an_error_without_provider_details(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise AIServiceUnavailable("provider details must remain internal")

    monkeypatch.setattr(AIService, "_generate_content_safe", unavailable)
    response = MCPService.handle_jsonrpc({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "generate_canvas_diagram",
            "arguments": {"topic": "photosynthesis"},
        },
    })

    assert response["error"]["code"] == -32002
    assert response["error"]["message"] == AIServiceUnavailable.user_message
    assert "provider details" not in response["error"]["message"]


def test_source_guide_outage_does_not_invent_metadata(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise AIServiceUnavailable("provider details must remain internal")

    monkeypatch.setattr(AIService, "_generate_content_safe", unavailable)

    guide = RAGService._generate_initial_guide("biology", "source content")

    assert guide == {
        "summary": "AI-generated guide unavailable; source content was saved.",
        "key_topics": [],
        "suggested_questions": [],
    }
