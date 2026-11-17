import json
from types import SimpleNamespace

from backend.models import SourceChunk
from backend.rag_service import RAGService


class IterableChunkQuery:
    def __init__(self, chunks):
        self.chunks = chunks
        self.batch_size = None

    def join(self, *_args, **_kwargs):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def yield_per(self, batch_size):
        self.batch_size = batch_size
        return iter(self.chunks)

    def all(self):
        raise AssertionError("The fallback must not eagerly load all chunks.")


class EmptyChunkQuery(IterableChunkQuery):
    def all(self):
        return []


class FakeDatabase:
    def __init__(self, query):
        self.query_result = query
        self.added = []

    def query(self, *_args, **_kwargs):
        return self.query_result

    def add(self, item):
        self.added.append(item)

    def commit(self):
        pass


def test_local_fallback_streams_candidates_and_returns_bounded_top_k(monkeypatch):
    query_vector = [1.0, 0.0] + [0.0] * 1534
    relevant = SourceChunk(
        id=1,
        text="topic relevant material",
        embedding=json.dumps(query_vector),
    )
    irrelevant = SourceChunk(
        id=2,
        text="unrelated material",
        embedding=json.dumps([0.0, 1.0] + [0.0] * 1534),
    )
    chunk_query = IterableChunkQuery([irrelevant, relevant])
    db = FakeDatabase(chunk_query)

    monkeypatch.delenv("PINECONE_API", raising=False)
    monkeypatch.delenv("PINECONE_API_KEY", raising=False)
    monkeypatch.setattr(
        "backend.rag_service.EmbeddingService.embed_text",
        lambda *_args, **_kwargs: query_vector,
    )

    results = RAGService.retrieve(db, user_id=7, query="topic relevant", top_k=1)

    assert chunk_query.batch_size == 256
    assert len(results) == 1
    assert results[0][0].id == relevant.id


def test_local_chunks_persist_full_embedding_dimension(monkeypatch):
    vector = [0.25] * 1536
    db = FakeDatabase(EmptyChunkQuery([]))
    source = SimpleNamespace(
        id=4,
        user_id=7,
        title="Study notes",
        raw_text="study material " * 400,
    )
    monkeypatch.setattr(
        "backend.rag_service.EmbeddingService.embed_batch",
        lambda texts, **_kwargs: [vector for _ in texts],
    )
    monkeypatch.setattr(RAGService, "_upsert_to_pinecone", lambda **_kwargs: True)

    RAGService.chunk_and_embed_source(db, source)

    assert db.added
    assert len(json.loads(db.added[0].embedding)) == 1536
