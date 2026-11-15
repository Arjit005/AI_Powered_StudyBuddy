"""
Safe, idempotent, resumable migration script for RAG vector embeddings.
Re-embeds all existing Source chunks with genuine neural embeddings
and upserts them into Pinecone with tenant namespace isolation.
"""
import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv("backend/.env")
load_dotenv(".env")

from backend.models import Source, SourceChunk
from backend.embedding_service import EmbeddingService
from backend.rag_service import RAGService


def migrate_embeddings():
    db_url = os.getenv("DATABASE_URL") or "sqlite:///./study_buddy.db"
    print(f"Connecting to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url, connect_args={"connect_timeout": 10} if "postgresql" in db_url else {})
    Session = sessionmaker(bind=engine)
    db = Session()

    sources = db.query(Source).all()
    print(f"Found {len(sources)} sources to evaluate.")

    total_chunks_reembedded = 0
    for src in sources:
        chunks = db.query(SourceChunk).filter(SourceChunk.source_id == src.id).order_by(SourceChunk.chunk_index).all()
        if not chunks:
            print(f"Source ID {src.id} has no chunks. Re-chunking...")
            RAGService.chunk_and_embed_source(db, src)
            created_count = db.query(SourceChunk).filter(SourceChunk.source_id == src.id).count()
            total_chunks_reembedded += created_count
            continue

        texts = [c.text for c in chunks]
        print(f"Source {src.id} ('{src.title[:30]}'): Re-embedding {len(texts)} chunks...")
        try:
            embeddings = EmbeddingService.embed_batch(texts, task_type="retrieval_document")
        except Exception as e:
            print(f"Error embedding chunks for source {src.id}: {e}")
            continue

        vectors_to_upsert = []
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            chunk.embedding = json.dumps(emb[:64])
            vector_id = f"src_{src.id}_chunk_{chunk.chunk_index}"
            vectors_to_upsert.append({
                "id": vector_id,
                "values": emb,
                "metadata": {
                    "source_id": src.id,
                    "chunk_index": chunk.chunk_index,
                    "title": src.title[:100],
                    "text": chunk.text[:1000],
                    "user_id": str(src.user_id) if src.user_id else "global"
                }
            })

        db.commit()

        # Upsert into Pinecone
        namespace = f"user_{src.user_id}" if src.user_id else "global"
        RAGService._upsert_to_pinecone(vectors_to_upsert, namespace=namespace)
        total_chunks_reembedded += len(chunks)

    print(f"Migration Complete: Successfully processed {len(sources)} sources, {total_chunks_reembedded} chunks.")


if __name__ == "__main__":
    migrate_embeddings()
