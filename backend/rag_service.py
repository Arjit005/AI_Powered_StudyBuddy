import os
import io
import json
import math
import hashlib
import re
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from backend.models import Source, SourceChunk, MessageSourceLink
from backend.ai_service import AIService
from backend.embedding_service import EmbeddingService, EmbeddingProviderError

# Optional PDF & Web extractors
try:
    import fitz # PyMuPDF
except ImportError:
    fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import trafilatura
except ImportError:
    trafilatura = None


class RAGService:
    @staticmethod
    def extract_text_from_bytes(file_bytes: bytes, filename: str, source_type: str) -> str:
        """
        Extracts raw text from PDF bytes or plain text/markdown bytes.
        """
        text = ""
        lower_name = filename.lower()
        if lower_name.endswith(".pdf") or source_type == "pdf":
            # Try PyMuPDF first
            if fitz:
                try:
                    doc = fitz.open(stream=file_bytes, filetype="pdf")
                    for page in doc:
                        text += page.get_text() + "\n"
                except Exception as e:
                    print(f"PyMuPDF extraction error: {e}")

            # Fallback to pdfplumber if text is empty and pdfplumber exists
            if not text.strip() and pdfplumber:
                try:
                    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                        for page in pdf.pages:
                            pt = page.extract_text()
                            if pt:
                                text += pt + "\n"
                except Exception as e:
                    print(f"pdfplumber extraction error: {e}")

            # Fallback to Gemini Multimodal OCR for scanned image/handwritten PDFs
            if (not text.strip() or len(text.strip()) < 25) and os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    ocr_model = genai.GenerativeModel("gemini-2.5-flash")
                    ocr_res = ocr_model.generate_content([
                        {"mime_type": "application/pdf", "data": file_bytes},
                        "Perform OCR: Transcribe all readable text, formulas, headings, and notes from this scanned PDF document accurately."
                    ])
                    if ocr_res and hasattr(ocr_res, "text") and ocr_res.text:
                        text = ocr_res.text
                except Exception as ocr_e:
                    print(f"Gemini Multimodal OCR extraction error: {ocr_e}")
        else:
            # Assume text/note
            try:
                text = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                text = str(file_bytes)

        return text.strip()

    @staticmethod
    def _is_safe_url(url: str) -> bool:
        """
        SSRF Defense: Validates URL schemes and ensures IP does not resolve to private,
        loopback, link-local, or cloud metadata ranges.
        """
        import socket
        import ipaddress
        from urllib.parse import urlparse

        try:
            parsed = urlparse(url)
            if parsed.scheme.lower() not in ["http", "https"]:
                return False
            hostname = parsed.hostname
            if not hostname:
                return False
            
            # Block localhost strings explicitly
            if hostname.lower() in ["localhost", "127.0.0.1", "::1", "0.0.0.0"]:
                return False

            # Resolve DNS
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_reserved
                    or ip_obj.is_multicast
                    or ip_str.startswith("169.254.") # AWS / GCP / Azure metadata endpoint
                ):
                    return False
            return True
        except Exception as e:
            print(f"SSRF validation exception for {url}: {e}")
            return False

    @staticmethod
    def extract_text_from_url(url: str) -> str:
        """
        Fetches and cleans webpage text strictly enforcing SSRF safety with bounded redirect validation.
        """
        import requests
        from urllib.parse import urljoin

        current_url = url
        max_redirects = 3
        resp = None

        for redirect_hop in range(max_redirects + 1):
            if not RAGService._is_safe_url(current_url):
                print(f"SSRF Alert: Blocked unsafe or internal URL during hop {redirect_hop}: {current_url}")
                return ""
            try:
                resp = requests.get(
                    current_url,
                    timeout=10,
                    allow_redirects=False,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIStudyBuddy/1.0"}
                )
                if resp.is_redirect or resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("location")
                    if not loc:
                        return ""
                    current_url = urljoin(current_url, loc)
                    continue
                break
            except Exception as req_err:
                print(f"URL extraction network error at hop {redirect_hop}: {req_err}")
                return ""

        if resp and resp.status_code == 200:
            html_text = resp.text
            if trafilatura:
                try:
                    extracted = trafilatura.extract(html_text)
                    if extracted:
                        return extracted.strip()
                except Exception:
                    pass
            # Strip HTML fallback
            clean = re.sub(r'<[^>]+>', ' ', html_text)
            clean = re.sub(r'\s+', ' ', clean)
            return clean[:30000].strip()

        return ""

    @staticmethod
    def ingest_source(
        db: Session,
        user_id: Optional[int],
        title: str,
        source_type: str,
        raw_content: Any,
        url: Optional[str] = None,
        origin: str = "upload"
    ) -> Source:
        """
        Ingests a source (PDF bytes, text, or URL), extracts text, generates summary & key topics,
        persists the Source entity, and chunks/embeds it.
        """
        raw_text = ""
        domain = None

        if source_type == "pdf" and isinstance(raw_content, bytes):
            raw_text = RAGService.extract_text_from_bytes(raw_content, title, "pdf")
        elif source_type == "url" or url:
            target_url = url or str(raw_content)
            from urllib.parse import urlparse
            parsed = urlparse(target_url)
            domain = parsed.netloc
            raw_text = RAGService.extract_text_from_url(target_url)
            if not title or title == "New Source":
                title = parsed.netloc or "Web Article"
        else:
            raw_text = str(raw_content)

        if not raw_text.strip():
            raw_text = "[Empty or unparseable source content]"

        # Generate summary and key topics via AIService
        guide_data = RAGService._generate_initial_guide(title, raw_text[:4000])

        source = Source(
            user_id=user_id,
            title=title,
            source_type=source_type,
            origin=origin,
            url=url,
            domain=domain,
            raw_text=raw_text,
            summary=guide_data.get("summary", "Summary unavailable."),
            key_topics=json.dumps(guide_data.get("key_topics", [])),
            starred=False
        )
        db.add(source)
        db.commit()
        db.refresh(source)

        # Chunk and embed
        RAGService.chunk_and_embed_source(db, source)
        return source

    @staticmethod
    def _generate_initial_guide(title: str, text_excerpt: str) -> Dict[str, Any]:
        prompt = f"""
        Analyze this source titled "{title}" and provide a JSON response with:
        1. "summary": A concise 2-3 sentence executive summary.
        2. "key_topics": A list of 3-5 key technical topics or themes.
        3. "suggested_questions": A list of 3 insightful study questions.

        Text Excerpt:
        {text_excerpt}

        Return ONLY valid JSON with keys: summary, key_topics, suggested_questions.
        """
        try:
            resp = AIService._generate_content_safe(prompt)
            cleaned = resp.text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:-3].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:-3].strip()
            data = json.loads(cleaned)
            return data
        except Exception as e:
            print(f"Error generating initial guide: {e}")
            return {
                "summary": f"Study source covering {title}.",
                "key_topics": [title, "Core Concepts", "Analysis"],
                "suggested_questions": [
                    f"What are the primary findings in {title}?",
                    "How do these concepts apply practically?",
                    "What are the key takeaways?"
                ]
            }

    @staticmethod
    def chunk_and_embed_source(db: Session, source: Source):
        # 1. Fetch all existing chunk indices so we can clean up old Pinecone vectors
        existing_chunks = db.query(SourceChunk).filter(SourceChunk.source_id == source.id).all()
        if existing_chunks:
            old_chunk_indices = [c.chunk_index for c in existing_chunks]
            RAGService.delete_source_vectors(source.id, source.user_id, chunk_ids=old_chunk_indices)

        # Delete existing chunks for this source if reindexing
        db.query(SourceChunk).filter(SourceChunk.source_id == source.id).delete()
        db.commit()

        # Chunking: ~400 tokens per chunk with 15% overlap
        words = source.raw_text.split()
        chunk_size = 350
        overlap = 50
        chunks_data = []

        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if chunk_text.strip():
                chunks_data.append(chunk_text)
            i += (chunk_size - overlap)

        if not chunks_data:
            chunks_data = [source.raw_text[:1500]]

        # 1. Store in local SQL database chunks
        created_chunks = []
        vectors_to_upsert = []

        # Generate genuine neural embeddings via EmbeddingService in batch
        try:
            batch_embeddings = EmbeddingService.embed_batch(chunks_data, task_type="retrieval_document")
            if not isinstance(batch_embeddings, list) or len(batch_embeddings) != len(chunks_data):
                raise ValueError("Mismatch in returned batch embedding count.")
        except Exception as e:
            print(f"EmbeddingService Warning (falling back to deterministic projection): {e}")
            batch_embeddings = [RAGService._compute_semantic_embedding(t, dim=1536) for t in chunks_data]

        for idx, text in enumerate(chunks_data):
            emb = batch_embeddings[idx] if idx < len(batch_embeddings) else None
            if not emb or not isinstance(emb, list) or len(emb) < 64:
                emb = RAGService._compute_semantic_embedding(text, dim=1536)
            embedding_1536 = emb
            token_count = len(text.split())

            chunk = SourceChunk(
                source_id=source.id,
                chunk_index=idx,
                text=text,
                embedding=json.dumps(embedding_1536[:64]), # Keep compact 64-dim in SQLite to prevent storage bloat
                token_count=token_count
            )
            db.add(chunk)
            created_chunks.append(chunk)

            # Prepare Pinecone vector format with rich metadata
            chunk_vector_id = f"src_{source.id}_chunk_{idx}"
            vectors_to_upsert.append({
                "id": chunk_vector_id,
                "values": embedding_1536,
                "metadata": {
                    "source_id": source.id,
                    "chunk_index": idx,
                    "title": source.title[:100],
                    "text": text[:1000],
                    "user_id": str(source.user_id) if source.user_id else "global"
                }
            })

        db.commit()

        # 2. Upsert to Pinecone Vector DB (Isolated User Namespace)
        RAGService._upsert_to_pinecone(
            vectors=vectors_to_upsert,
            namespace=f"user_{source.user_id}" if source.user_id else "global"
        )
        print(f"RAG Service: Successfully chunked & embedded source '{source.title}' into {len(created_chunks)} chunks.")

    @staticmethod
    def _compute_semantic_embedding(text: str, dim: int = 1536) -> List[float]:
        """
        Generates 1536-dimensional L2-normalized semantic vector compatible with Pinecone Serverless.
        Uses deterministic semantic word hashing with Gaussian random projection distribution.
        """
        vec = [0.0] * dim
        words = re.findall(r'\w+', text.lower())
        if not words:
            return vec

        for w in words:
            # Deterministic multi-hash projection for high dimensional distribution
            h = int(hashlib.sha256(w.encode('utf-8')).hexdigest(), 16)
            idx1 = h % dim
            idx2 = (h >> 16) % dim
            idx3 = (h >> 32) % dim
            sign = 1.0 if (h >> 48) % 2 == 0 else -1.0
            vec[idx1] += sign
            vec[idx2] += sign * 0.5
            vec[idx3] += sign * 0.25

        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    @staticmethod
    def _upsert_to_pinecone(vectors: List[Dict[str, Any]], namespace: str = "global"):
        """
        Safely upserts vector embeddings into the remote Pinecone serverless index.
        Gracefully handles network errors or missing keys without crashing the ingestion pipeline.
        """
        pinecone_api_key = os.getenv("PINECONE_API")
        if not pinecone_api_key or not vectors:
            return

        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=pinecone_api_key)
            index = pc.Index("study-buddy-kb")
            # Batch upsert in chunks of 50
            batch_size = 50
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                index.upsert(vectors=batch, namespace=namespace)
            print(f"Pinecone: Upserted {len(vectors)} vectors into namespace '{namespace}'.")
        except Exception as e:
            print(f"Pinecone Upsert Warning (Graceful Fallback to Local SQL): {e}")

    @staticmethod
    def _delete_from_pinecone(vector_ids: List[str], namespace: str = "global"):
        """
        Deletes vector IDs from the Pinecone serverless index to avoid orphaned records.
        """
        pinecone_api_key = os.getenv("PINECONE_API")
        if not pinecone_api_key or not vector_ids:
            return

        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=pinecone_api_key)
            index = pc.Index("study-buddy-kb")
            index.delete(ids=vector_ids, namespace=namespace)
            print(f"Pinecone: Deleted {len(vector_ids)} vectors from namespace '{namespace}'.")
        except Exception as e:
            print(f"Pinecone Delete Warning: {e}")

    @staticmethod
    def delete_source_vectors(source_id: int, user_id: Optional[int], chunk_ids: Optional[List[int]] = None):
        """
        Removes all vectors belonging to a source from Pinecone.
        """
        namespace = f"user_{user_id}" if user_id else "global"
        # Pinecone vector format: src_{source_id}_chunk_{idx}
        # If chunk indices are provided, delete specific ones; otherwise prefix/batch delete up to 200 chunks
        ids_to_delete = []
        if chunk_ids:
            ids_to_delete = [f"src_{source_id}_chunk_{cid}" for cid in chunk_ids]
        else:
            ids_to_delete = [f"src_{source_id}_chunk_{idx}" for idx in range(1000)]
        RAGService._delete_from_pinecone(ids_to_delete, namespace=namespace)

    @staticmethod
    def _query_pinecone(query_vec: List[float], top_k: int = 6, namespace: str = "global", source_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Queries Pinecone serverless index using genuine neural embedding vector with optional metadata filtering.
        """
        pinecone_api_key = os.getenv("PINECONE_API")
        if not pinecone_api_key or not query_vec:
            return []

        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=pinecone_api_key)
            index = pc.Index("study-buddy-kb")

            filter_dict = None
            if source_ids:
                if len(source_ids) == 1:
                    filter_dict = {"source_id": {"$eq": source_ids[0]}}
                else:
                    filter_dict = {"source_id": {"$in": source_ids}}

            res = index.query(
                vector=query_vec,
                top_k=top_k,
                namespace=namespace,
                filter=filter_dict,
                include_metadata=True
            )
            return [
                {
                    "id": m.id,
                    "score": float(m.score),
                    "metadata": m.metadata or {}
                }
                for m in (res.matches or [])
            ]
        except Exception as e:
            print(f"Pinecone Query Warning (falling back to database): {e}")
            return []

    @staticmethod
    def _compute_fallback_embedding(text: str, dim: int = 64) -> List[float]:
        """
        Deterministic fallback embedding vector (bag-of-words hash projection).
        Ensures 100% graceful degradation without failing if external embedding models are offline.
        """
        vec = [0.0] * dim
        words = re.findall(r'\w+', text.lower())
        if not words:
            return vec
        for w in words:
            h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
            idx = h % dim
            sign = 1.0 if (h // dim) % 2 == 0 else -1.0
            vec[idx] += sign

        # L2 normalization
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    @staticmethod
    def retrieve(db: Session, user_id: Optional[int], query: str, top_k: int = 6, source_ids: Optional[List[int]] = None) -> List[Tuple[SourceChunk, float]]:
        """
        Retrieves top_k relevant source chunks using genuine neural embedding vector search
        in Pinecone with fallback to relational database cosine similarity + keyword overlap.
        """
        namespace = f"user_{user_id}" if user_id else "global"

        # 1. Generate neural query embedding
        query_emb_1536 = None
        try:
            query_emb_1536 = EmbeddingService.embed_text(query, task_type="retrieval_query")
        except Exception as e:
            print(f"EmbeddingService Query Warning (falling back): {e}")

        # 2. Try Pinecone Vector Retrieval first (queries user + global shared corpus)
        if query_emb_1536:
            namespaces_to_query = [f"user_{user_id}", "global"] if user_id else ["global"]
            all_matches = []
            for ns in namespaces_to_query:
                matches = RAGService._query_pinecone(
                    query_vec=query_emb_1536,
                    top_k=top_k,
                    namespace=ns,
                    source_ids=source_ids
                )
                if matches:
                    all_matches.extend(matches)

            all_matches.sort(key=lambda m: m.get("score", 0.0), reverse=True)
            pinecone_matches = all_matches[:top_k]

            if pinecone_matches:
                # Map vector IDs (src_{source_id}_chunk_{idx}) back to SourceChunk entities
                scored_results = []
                for match in pinecone_matches:
                    m_id = match["id"]
                    # Extract source_id and chunk_index from ID or metadata
                    meta = match.get("metadata", {})
                    src_id = meta.get("source_id")
                    c_idx = meta.get("chunk_index")
                    score = match["score"]

                    chunk = None
                    if src_id is not None and c_idx is not None:
                        chunk_q = db.query(SourceChunk).join(Source, SourceChunk.source_id == Source.id).filter(
                            SourceChunk.source_id == int(src_id),
                            SourceChunk.chunk_index == int(c_idx)
                        )
                        if user_id:
                            chunk_q = chunk_q.filter((Source.user_id == user_id) | (Source.user_id.is_(None)))
                        else:
                            chunk_q = chunk_q.filter(Source.user_id.is_(None))
                        if source_ids:
                            chunk_q = chunk_q.filter(SourceChunk.source_id.in_(source_ids))
                        chunk = chunk_q.first()

                    if chunk:
                        scored_results.append((chunk, score))
                    elif meta.get("text"):
                        # Strict tenant boundary check: verify metadata user_id matches or is global
                        meta_user = meta.get("user_id")
                        is_allowed = (
                            (user_id and (meta_user == str(user_id) or meta_user == "global")) or
                            (not user_id and meta_user in ("global", None))
                        )
                        if source_ids:
                            try:
                                if not src_id or int(src_id) not in source_ids:
                                    is_allowed = False
                            except (ValueError, TypeError):
                                is_allowed = False

                        if not src_id or c_idx is None:
                            is_allowed = False

                        if is_allowed:
                            mock_chunk = SourceChunk(
                                source_id=int(src_id),
                                chunk_index=int(c_idx),
                                text=meta.get("text", ""),
                                token_count=len(meta.get("text", "").split())
                            )
                            scored_results.append((mock_chunk, score))

                if scored_results:
                    return scored_results

        # 3. Fallback: Database-level cosine similarity + keyword overlap
        query_emb_fallback = (
            query_emb_1536[:64] 
            if query_emb_1536 
            else RAGService._compute_semantic_embedding(query, dim=1536)[:64]
        )

        chunk_query = db.query(SourceChunk).join(Source, SourceChunk.source_id == Source.id)
        if user_id:
            chunk_query = chunk_query.filter((Source.user_id == user_id) | (Source.user_id.is_(None)))
        else:
            chunk_query = chunk_query.filter(Source.user_id.is_(None))
        if source_ids:
            chunk_query = chunk_query.filter(SourceChunk.source_id.in_(source_ids))

        chunks = chunk_query.all()
        if not chunks:
            return []

        scored = []
        query_words = set(re.findall(r'\w+', query.lower()))

        for chunk in chunks:
            try:
                emb = json.loads(chunk.embedding)
                dot = sum(a * b for a, b in zip(query_emb_fallback, emb[:len(query_emb_fallback)]))
                chunk_words = set(re.findall(r'\w+', chunk.text.lower()))
                overlap = len(query_words.intersection(chunk_words))
                score = dot + (0.05 * overlap)
                scored.append((chunk, score))
            except Exception:
                scored.append((chunk, 0.0))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    @staticmethod
    def generate_source_guide(source: Source) -> Dict[str, Any]:
        topics = []
        try:
            if source.key_topics:
                topics = json.loads(source.key_topics)
        except Exception:
            topics = [source.title]

        return {
            "id": source.id,
            "title": source.title,
            "source_type": source.source_type,
            "origin": source.origin,
            "domain": source.domain,
            "url": source.url,
            "summary": source.summary or "Summary not available.",
            "key_topics": topics,
            "suggested_questions": [
                f"What are the main arguments presented in {source.title}?",
                "Can you summarize the key technical concepts or data points?",
                "How do these findings relate to broader study topics?"
            ],
            "starred": bool(source.starred),
            "created_at": source.created_at.isoformat() if source.created_at else None
        }
