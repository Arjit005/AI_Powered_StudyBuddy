"""
Safe, idempotent, resumable migration script for RAG vector embeddings.
Re-embeds all existing Source chunks with genuine neural embeddings
and upserts them into Pinecone with tenant namespace isolation.
Tracks successful and failed records separately, ensuring failures are
observable and returning a non-zero exit code upon incomplete migrations.
"""
import sys
import os
import json
from dotenv import load_dotenv

load_dotenv("backend/.env")
load_dotenv(".env")

from backend.models import Source, SourceChunk
from backend.embedding_service import EmbeddingService
from backend.rag_service import RAGService
from backend.database import SessionLocal, engine


def migrate_embeddings() -> int:
    """
    Executes RAG embedding migration.
    Returns:
        int: 0 on complete success, 1 if any source failed.
    """
    print(f"Connecting to database via engine: {engine.dialect.name} (driver: {engine.dialect.driver})")
    db = SessionLocal()

    sources = db.query(Source).all()
    print(f"Found {len(sources)} sources to evaluate.")

    successful_sources = []
    failed_sources = []
    total_chunks_reembedded = 0

    try:
        for src in sources:
            try:
                chunks = db.query(SourceChunk).filter(SourceChunk.source_id == src.id).order_by(SourceChunk.chunk_index).all()
                if not chunks:
                    print(f"Source ID {src.id} has no chunks. Re-chunking...")
                    RAGService.chunk_and_embed_source(db, src)
                    created_count = db.query(SourceChunk).filter(SourceChunk.source_id == src.id).count()
                    total_chunks_reembedded += created_count
                    successful_sources.append(src.id)
                    continue

                texts = [c.text for c in chunks]
                print(f"Source {src.id} ('{src.title[:30]}'): Re-embedding {len(texts)} chunks...")
                embeddings = EmbeddingService.embed_batch(texts, task_type="retrieval_document")

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

                # 1. Upsert into Pinecone first; only commit local DB if remote upsert succeeds
                namespace = f"user_{src.user_id}" if src.user_id else "global"
                RAGService._upsert_to_pinecone(vectors_to_upsert, namespace=namespace)
                db.commit()
                total_chunks_reembedded += len(chunks)
                successful_sources.append(src.id)

            except Exception as src_err:
                db.rollback()
                print(f"FAILED migrating Source ID {src.id} ('{src.title}'): {src_err}")
                failed_sources.append({"source_id": src.id, "error": str(src_err)})

    finally:
        db.close()

    print("\n--- RAG Embedding Migration Summary ---")
    print(f"Total Sources Evaluated: {len(sources)}")
    print(f"Successfully Migrated:   {len(successful_sources)}")
    print(f"Failed Sources:          {len(failed_sources)}")
    print(f"Total Chunks Processed:  {total_chunks_reembedded}")

    if failed_sources:
        print("\nFailed Source Details:")
        for f in failed_sources:
            print(f"  - Source ID {f['source_id']}: {f['error']}")
        return 1

    print("Migration status: SUCCESSFUL.")
    return 0


if __name__ == "__main__":
    exit_code = migrate_embeddings()
    sys.exit(exit_code)
