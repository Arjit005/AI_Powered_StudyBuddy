import pytest
from unittest.mock import patch, MagicMock
from backend.embedding_service import EmbeddingService, EmbeddingProviderError
from backend.ai_service import AIService, AIServiceError
from backend.maps import generate_network_graph


# --- A. Embedding Service Tests ---

def test_embed_text_unsupported_task_type():
    with pytest.raises(ValueError, match="Unsupported embedding task type"):
        EmbeddingService.embed_text("test text", task_type="invalid_task")


def test_embed_batch_unsupported_task_type():
    with pytest.raises(ValueError, match="Unsupported embedding task type"):
        EmbeddingService.embed_batch(["test text"], task_type="invalid_task")


def test_embed_text_empty_input():
    with pytest.raises(ValueError, match="Cannot generate embedding for empty"):
        EmbeddingService.embed_text("   ", task_type="retrieval_document")


def test_embed_batch_empty_item():
    with pytest.raises(ValueError, match="Cannot embed empty or blank text"):
        EmbeddingService.embed_batch(["Valid text", "  ", "Another valid"], task_type="retrieval_document")


@patch("backend.embedding_service.genai.embed_content")
@patch.dict("os.environ", {"GEMINI_API_KEY": "fake_test_key"})
def test_embed_text_transient_retry_and_success(mock_embed):
    # Simulates one transient 429 quota error followed by success
    EmbeddingService._configured = True
    fake_vector = [0.1] * 1536
    mock_embed.side_effect = [
        Exception("429 Resource has been exhausted (quota)"),
        {"embedding": fake_vector}
    ]
    with patch("time.sleep", return_value=None):
        result = EmbeddingService.embed_text("Sample concept", task_type="retrieval_document")
        assert len(result) == 1536
        assert mock_embed.call_count == 2


@patch("backend.embedding_service.genai.embed_content")
@patch.dict("os.environ", {"GEMINI_API_KEY": "fake_test_key"})
def test_embed_text_permanent_failure_no_multiplier(mock_embed):
    EmbeddingService._configured = True
    # Non-transient error should fail immediately without retries
    mock_embed.side_effect = Exception("400 Bad Request: Invalid model")
    with pytest.raises(EmbeddingProviderError, match="Failed to generate neural embedding"):
        EmbeddingService.embed_text("Sample concept")
    assert mock_embed.call_count == 1


@patch("backend.embedding_service.genai.embed_content")
@patch.dict("os.environ", {"GEMINI_API_KEY": "fake_test_key"})
def test_embed_batch_fallback_no_nested_retry_multiplication(mock_embed):
    EmbeddingService._configured = True
    fake_vector = [0.2] * 1536

    # When batch SDK raises TypeError (unsupported batch parameter), it falls back to sequential items
    # Each sequential item must only attempt once (_retry_count=1) without nested retry loops
    def side_effect(*args, **kwargs):
        content = kwargs.get("content")
        if isinstance(content, list):
            raise TypeError("Expected string, got list")
        return {"embedding": fake_vector}

    mock_embed.side_effect = side_effect
    res = EmbeddingService.embed_batch(["chunk 1", "chunk 2"], task_type="retrieval_document")
    assert len(res) == 2
    assert len(res[0]) == 1536
    assert len(res[1]) == 1536


# --- B. AI Service Validation Tests ---

@patch("backend.ai_service.AIService._generate_content_safe")
def test_generate_quiz_duplicate_question_ids_rejected(mock_gen):
    # Returns 10 questions but with duplicate ID 1
    mock_response = MagicMock()
    mock_response.text = '{"questions": [' + ','.join([
        f'{{"id": {1 if i == 1 else i + 1}, "question": "Q{i}?", "options": ["A{i}", "B{i}", "C{i}", "D{i}"], "answer": "A{i}", "explanation": "Exp{i}"}}'
        for i in range(10)
    ]) + ']}'
    mock_gen.return_value = mock_response

    with pytest.raises(AIServiceError):
        AIService.generate_quiz("Operating Systems")


@patch("backend.ai_service.AIService._generate_content_safe")
def test_generate_quiz_string_question_id_rejected(mock_gen):
    mock_response = MagicMock()
    mock_response.text = '{"questions": [' + ','.join([
        f'{{"id": "str_{i+1}", "question": "Q{i}?", "options": ["A{i}", "B{i}", "C{i}", "D{i}"], "answer": "A{i}", "explanation": "Exp{i}"}}'
        for i in range(10)
    ]) + ']}'
    mock_gen.return_value = mock_response

    with pytest.raises(AIServiceError):
        AIService.generate_quiz("Databases")


# --- C. Maps Graph Validation Tests ---

def test_generate_network_graph_success():
    data = {
        "root": "Computer Architecture",
        "edges": [
            {"source": "Computer Architecture", "target": "CPU", "relationship": "contains"},
            {"source": "Computer Architecture", "target": "Memory", "relationship": "contains"}
        ]
    }
    result = generate_network_graph(data)
    assert isinstance(result, dict)
    assert result["success"] is True
    assert result["error"] is None
    assert len(result["map_image"]) > 100


def test_generate_network_graph_empty_input():
    result = generate_network_graph({})
    assert isinstance(result, dict)
    assert result["success"] is False
    assert result["map_image"] == ""
    assert "No valid concept nodes" in result["error"]


def test_generate_network_graph_malformed_input():
    result = generate_network_graph(None)
    assert isinstance(result, dict)
    assert result["success"] is False
    assert "Invalid edge_data" in result["error"]
