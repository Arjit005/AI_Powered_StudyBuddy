import pytest
from unittest.mock import patch, MagicMock
from backend.migrate_rag_embeddings import migrate_embeddings


@patch("backend.migrate_rag_embeddings.SessionLocal")
@patch("backend.migrate_rag_embeddings.RAGService._upsert_to_pinecone")
@patch("backend.migrate_rag_embeddings.EmbeddingService.embed_batch")
def test_migration_all_success(mock_embed, mock_upsert, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db

    fake_source = MagicMock()
    fake_source.id = 101
    fake_source.title = "Operating Systems Principles"
    fake_source.user_id = 42

    fake_chunk = MagicMock()
    fake_chunk.source_id = 101
    fake_chunk.chunk_index = 0
    fake_chunk.text = "Processes and threads overview"

    mock_db.query.return_value.all.return_value = [fake_source]
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [fake_chunk]
    mock_embed.return_value = [[0.05] * 1536]

    exit_code = migrate_embeddings()
    assert exit_code == 0
    assert mock_upsert.call_count == 1
    assert mock_db.commit.call_count == 1


@patch("backend.migrate_rag_embeddings.SessionLocal")
@patch("backend.migrate_rag_embeddings.RAGService._upsert_to_pinecone")
@patch("backend.migrate_rag_embeddings.EmbeddingService.embed_batch")
def test_migration_partial_failure_returns_nonzero_code(mock_embed, mock_upsert, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db

    src1 = MagicMock(id=1, title="Physics 101", user_id=1)
    src2 = MagicMock(id=2, title="Corrupted Source", user_id=1)

    chunk1 = MagicMock(source_id=1, chunk_index=0, text="Intro to Newton")
    chunk2 = MagicMock(source_id=2, chunk_index=0, text="Corrupted text")

    mock_db.query.return_value.all.return_value = [src1, src2]

    # First source succeeds, second source raises during Pinecone upsert
    def filter_side_effect(*args, **kwargs):
        mock_filter = MagicMock()
        return mock_filter

    mock_db.query.return_value.filter.side_effect = filter_side_effect
    mock_embed.return_value = [[0.01] * 1536]
    mock_upsert.side_effect = [None, Exception("Pinecone 503 Service Unavailable")]

    exit_code = migrate_embeddings()
    assert exit_code == 1
    # DB rolled back on failed source
    assert mock_db.rollback.call_count >= 1
