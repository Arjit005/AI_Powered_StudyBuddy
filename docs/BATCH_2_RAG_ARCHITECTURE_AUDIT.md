# BATCH 2 — RAG ARCHITECTURE & VECTOR RETRIEVAL AUDIT
**Project:** AI Study Buddy v2.0  
**Repository:** `Arjit005/AI_Powered_StudyBuddy`  
**Starting Commit:** `7b14b785cca2bf574df4752a85c899d185ba07c9`  
**Date:** November 15, 2026  
**Auditor:** Principal AI Infrastructure & Full-Stack Architect  

---

## 1. Executive Summary

This architecture audit comprehensively reviews the AI Study Buddy RAG (Retrieval-Augmented Generation) pipeline, identifying document ingestion paths, chunking strategies, embedding generation, vector upsert, retrieval mechanisms, Pinecone serverless index configuration, metadata structures, and tenant isolation policies.

### Core Audit Finding
The existing system at commit `7b14b78` contains a critical architectural discrepancy:
1. **Pinecone Index Configuration:** Serverless index `study-buddy-kb` initialized with **1536 dimensions** and **Cosine similarity**.
2. **Embedding Generator:** `RAGService._compute_semantic_embedding(text, dim=1536)` generates vectors using deterministic multi-seed SHA-256 hash projections. While structurally valid (1536-dim float vectors normalized to unit length), it possesses **zero semantic discernment** (e.g., query "What causes global warming and greenhouse gases?" achieves **0.00** similarity against "Rising carbon dioxide emissions from burning fossil fuels trap solar heat...", but achieves **0.49** against a lexical distractor talking about "financial warming up of banking sectors").
3. **Retrieval Disconnect:** In `RAGService.retrieve`, query vectors are computed via `_compute_fallback_embedding(query, dim=64)` and matched purely against local SQLite chunks. Remote Pinecone vector search was never executed during retrieval!
4. **Deletion Asymmetry:** Deleting a source via `DELETE /api/sources/{source_id}` deletes records from SQL (`Source` and cascading `SourceChunk`), but **leaves orphaned vectors in Pinecone**.

---

## 2. Component-by-Component Architecture Mapping

### 2.1 Ingestion & Parsing Pipeline
- **File / Class:** `backend/rag_service.py` -> `RAGService.ingest_source`
- **Supported Formats:**
  - **PDF:** Extracted via `fitz` (PyMuPDF) with fallback to `pdfplumber`.
  - **URL / Web:** Extracted via `trafilatura` with fallback to `requests + BeautifulSoup / regex`.
  - **Raw Text / Markdown:** Decoded via UTF-8.
- **Entity Creation:**
  - Creates `Source(user_id, title, source_type, origin, url, domain, raw_text, summary, key_topics)`.
  - Calls `AIService._generate_content_safe` for summary and study questions.
  - Passes source to `chunk_and_embed_source`.

### 2.2 Chunking Strategy
- **File / Class:** `backend/rag_service.py` -> `RAGService.chunk_and_embed_source`
- **Algorithm:** Word-based sliding window:
  - `chunk_size = 350` words (~450 tokens)
  - `overlap = 50` words (~15% overlap)
  - Fallback chunk if empty: `raw_text[:1500]`
- **Relational Persistence:**
  - `SourceChunk(source_id, chunk_index, text, embedding, token_count)`
  - Currently saves `embedding_1536[:64]` into local SQL database to conserve SQLite storage bloat.

### 2.3 Embedding Generation Analysis
- **Current Method:** `_compute_semantic_embedding(text, dim=1536)`
- **Mathematical Mechanism:**
  - Extracts alphanumeric words via regex `\w+`.
  - Computes `int(hashlib.sha256(w.encode('utf-8')).hexdigest(), 16)`.
  - Sets 3 pseudo-random indices `h % dim`, `(h >> 16) % dim`, `(h >> 32) % dim` with signs $+1.0, +0.5, +0.25$.
  - Normalizes via Euclidean $L_2$ norm.
- **Evaluation:** Pure lexical hash projection. Two semantically identical sentences with zero shared words have exact zero dot product.

### 2.4 Vector Storage & Pinecone Configuration
- **Live Pinecone Index:** `study-buddy-kb`
  - **Dimension:** 1536
  - **Metric:** Cosine
  - **Status:** Ready
  - **Current Vector Count:** 0
- **Vector ID Format:** `src_{source.id}_chunk_{idx}`
- **Metadata Payload:**
  ```json
  {
    "source_id": 12,
    "chunk_index": 0,
    "title": "Introduction to Biology",
    "text": "First 1000 characters of chunk text...",
    "user_id": "42"
  }
  ```
- **Namespace Strategy:** `namespace=f"user_{source.user_id}"` if user authenticated, else `"global"`.

### 2.5 Retrieval & Search Execution
- **Current Method:** `RAGService.retrieve(db, user_id, query, top_k=6, source_ids=None)`
- **Discrepancy:**
  - Computes `query_emb` via `_compute_fallback_embedding(query, dim=64)`.
  - Scans local `db.query(SourceChunk)` table, parses JSON embeddings, computes cosine similarity + `0.05 * keyword_overlap`.
  - Remote Pinecone vector search was not invoked.

### 2.6 Deletion & Update Operations
- `DELETE /api/sources/{source_id}` in `backend/main.py`:
  - Deletes `models.Source` from PostgreSQL / SQLite.
  - Database foreign keys cascade delete `source_chunks`.
  - **Defect:** No Pinecone deletion was issued. Orphaned vectors remained permanently in Pinecone.

---

## 3. Neural Embedding Model Selection & Verification

The target Pinecone index requires **1536 dimensions**.

### Candidate Model Evaluation:
1. **Google Gemini `models/gemini-embedding-001` (Active in account):**
   - **Supported Methods:** `embedContent`, `asyncBatchEmbedContent`, `countTokens`.
   - **Dimensionality:** Default 3072, but supports MRL (Matryoshka Representation Learning) via `output_dimensionality=1536`.
   - **Empirical Test:** Tested and verified live in the workspace environment.
   - **Cost & Availability:** Covered under existing Google Gemini API key. Zero extra third-party subscription needed.
   - **Semantic Discernment Test:**
     - Query: *"What causes global warming and greenhouse gases?"*
     - Semantic Synonym Passage: **0.763** similarity
     - Lexical Distractor Passage: **0.680** similarity
     - Irrelevant Passage: **0.656** similarity
   - Clear semantic margin over lexical distractor (+0.083), whereas hash projection scored 0.00 vs 0.488.

2. **OpenAI `text-embedding-3-small`:**
   - 1536 dimensions native. Requires separate OpenAI API key and credit balance (not provided in active environment).

3. **Local SentenceTransformers (`all-MiniLM-L6-v2` / `bge-small-en-v1.5`):**
   - Output 384 dimensions; would require recreating or re-indexing Pinecone with 384 dimensions and adding heavy PyTorch/ONNX runtime dependencies to production Docker container.

### Decision:
Implement **`EmbeddingService`** with primary provider **`GeminiEmbeddingProvider`** using `models/gemini-embedding-001` (configured with `output_dimensionality=1536` and $L_2$ normalization).
Include a resilient retry mechanism (exponential backoff with jitter), rate-limit handling, query vs document task types, and an explicit fail-fast policy (never silently substitute hash vectors).

---

## 4. Remediation Blueprint for Batch 2

1. **`backend/embedding_service.py`:**
   - Abstract `EmbeddingProvider` class.
   - Concrete `GeminiEmbeddingProvider` utilizing `models/gemini-embedding-001` with `output_dimensionality=1536`.
   - Exponential backoff retry handler (3 attempts, handling rate limits & network timeouts).
   - Strict dimension check: raises `ValueError` if dimension $\neq 1536$.
   - $L_2$ unit normalization on all vectors.

2. **`backend/rag_service.py` Upgrades:**
   - Integrate `EmbeddingService` for all chunk embeddings and query embeddings.
   - Unified Document & Query embedding pipeline.
   - Implement **True Hybrid Retrieval**:
     - Query Pinecone index using query embedding vector in tenant namespace `user_{user_id}` (or `global`).
     - Retrieve top candidates, fetch full chunk text and metadata from DB / Pinecone.
     - Fallback gracefully to local SQLite/PostgreSQL cosine similarity if Pinecone network call fails.
   - Implement Pinecone Vector Cleanup on Source Deletion:
     - `delete_source_vectors(source_id, user_id, chunk_count)` removes all chunk vector IDs `src_{source_id}_chunk_{idx}` from Pinecone.

3. **Safe Migration Script:**
   - Script to identify all existing `SourceChunk` records across databases, re-embed using neural model, and upsert to Pinecone. (Audited count currently: 0 sources in SQLite and Postgres, so migration is clean).

4. **Evaluation & Verification Suite:**
   - Comprehensive test suite for semantic retrieval, tenant isolation, deletion synchronization, and benchmark metrics (MRR, Recall@k).
