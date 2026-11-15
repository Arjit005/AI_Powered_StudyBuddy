import os
import io
import json
import math
import hashlib
import re
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from backend.models import Source, SourceChunk, MessageSourceLink
from backend.ai_service import AIService

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
        else:
            # Assume text/note
            try:
                text = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                text = str(file_bytes)

        return text.strip()

    @staticmethod
    def extract_text_from_url(url: str) -> str:
        """
        Fetches and cleans webpage text using trafilatura or basic requests.
        """
        if trafilatura:
            try:
                downloaded = trafilatura.fetch_url(url)
                if downloaded:
                    extracted = trafilatura.extract(downloaded)
                    if extracted:
                        return extracted.strip()
            except Exception as e:
                print(f"Trafilatura extraction error: {e}")

        # Fallback via requests
        import requests
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            if resp.status_code == 200:
                # Basic strip HTML tags
                clean = re.sub(r'<[^>]+>', ' ', resp.text)
                return re.sub(r'\s+', ' ', clean).strip()
        except Exception as e:
            print(f"URL fetch error: {e}")

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

        created_chunks = []
        for idx, text in enumerate(chunks_data):
            # Compute deterministic local embedding (64-dim float vector via hashing)
            embedding = RAGService._compute_fallback_embedding(text)
            token_count = len(text.split())

            chunk = SourceChunk(
                source_id=source.id,
                chunk_index=idx,
                text=text,
                embedding=json.dumps(embedding),
                token_count=token_count
            )
            db.add(chunk)
            created_chunks.append(chunk)

        db.commit()
        print(f"RAG Service: Successfully chunked & embedded source '{source.title}' into {len(created_chunks)} chunks.")

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
        Retrieves top_k relevant source chunks using cosine similarity + keyword overlap tiebreaker.
        """
        query_emb = RAGService._compute_fallback_embedding(query)

        # Build query for chunks
        chunk_query = db.query(SourceChunk).join(Source, SourceChunk.source_id == Source.id)
        if user_id:
            chunk_query = chunk_query.filter((Source.user_id == user_id) | (Source.user_id.is_(None)))
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
                # Cosine similarity
                dot = sum(a * b for a, b in zip(query_emb, emb))

                # Keyword overlap boost
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
