import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.mcp_service import MCPService


client = TestClient(app)


def test_mcp_invalid_jsonrpc_version():
    payload = {"jsonrpc": "1.0", "id": 1, "method": "initialize"}
    res = MCPService.handle_jsonrpc(payload)
    assert res["error"]["code"] == -32600
    assert "jsonrpc version must be '2.0'" in res["error"]["message"]


def test_mcp_missing_method():
    payload = {"jsonrpc": "2.0", "id": 1}
    res = MCPService.handle_jsonrpc(payload)
    assert res["error"]["code"] == -32600
    assert "method must be a non-empty string" in res["error"]["message"]


def test_mcp_notification_handling():
    # A JSON-RPC notification omits the 'id' field; per protocol spec, notifications receive NO response (None)
    notification = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "create_study_flashcards",
            "arguments": {"topic": "Algorithms", "count": 3}
        }
    }
    res = MCPService.handle_jsonrpc(notification)
    assert res is None


def test_mcp_create_flashcards_empty_topic():
    with pytest.raises(ValueError, match="topic' is required and cannot be empty"):
        MCPService.execute_tool("create_study_flashcards", {"topic": "   "})


def test_mcp_study_memory_requires_an_authenticated_user():
    with pytest.raises(PermissionError, match="Authentication is required"):
        MCPService.execute_tool("query_study_memory", {})


def test_mcp_internal_errors_do_not_expose_exception_details(monkeypatch):
    def fail(*_args, **_kwargs):
        raise RuntimeError("sensitive provider details")

    monkeypatch.setattr(MCPService, "execute_tool", fail)
    response = MCPService.handle_jsonrpc({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "generate_canvas_diagram", "arguments": {"topic": "systems"}},
    })

    assert response["error"]["code"] == -32603
    assert response["error"]["message"] == "Tool execution encountered an internal error. Please try again."
    assert "sensitive provider details" not in response["error"]["message"]


def test_mcp_http_study_memory_requires_authentication():
    response = client.post(
        "/api/mcp/tools/call",
        json={"name": "query_study_memory", "arguments": {}},
    )

    assert response.status_code == 401


def test_mcp_canvas_diagram_coordinate_and_edge_validation():
    # Test fallback & generation geometry sanitization
    diagram = MCPService._generate_fallback_canvas_graph("Distributed Systems")
    assert "nodes" in diagram
    assert "edges" in diagram

    node_ids = set(n["id"] for n in diagram["nodes"])
    # Verify every edge connects real nodes
    for edge in diagram["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids

    # Verify node dimensions and coordinates are positive and finite
    for n in diagram["nodes"]:
        assert n["width"] > 0
        assert n["height"] > 0
        assert -50000 <= n["x"] <= 50000
        assert -50000 <= n["y"] <= 50000
