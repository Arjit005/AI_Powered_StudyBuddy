import pytest
from backend.mcp_service import MCPService


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
