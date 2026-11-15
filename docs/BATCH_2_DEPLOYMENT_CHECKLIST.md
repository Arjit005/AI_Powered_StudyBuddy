# BATCH 2 — DEPLOYMENT & OPERATION CHECKLIST
**Project:** AI Study Buddy v2.0  
**Target Environments:** Staging / Production (Render / Neon / Pinecone)  
**Date:** November 15, 2026  

---

## 1. Environment Variable Pre-Flight Checklist

Ensure the following variables are configured in production hosting environments (e.g. Render Dashboard):

| Variable Name | Required | Purpose | Verification Status |
|---|---|---|---|
| `GEMINI_API_KEY` | **YES** | Primary LLM generation and neural embeddings (`gemini-embedding-001`) | Verified Active |
| `PINECONE_API` | **YES** | Remote vector storage and hybrid retrieval | Verified Active (`study-buddy-kb`) |
| `DATABASE_URL` | **YES** | Neon PostgreSQL connection string (`postgresql://...`) | Verified Active |
| `ENVIRONMENT` | **YES** | Set to `production` to activate startup connection validation | Verified Active |
| `SECRET_KEY` | **YES** | JWT generation and cryptographic session signing | Configured |

---

## 2. Pre-Deployment Validation Steps

1. **Verify Pinecone Index:**
   ```bash
   python -c "from pinecone import Pinecone; import os; pc = Pinecone(api_key=os.getenv('PINECONE_API')); print(pc.describe_index('study-buddy-kb'))"
   ```
   *Expected Output: `dimension=1536, metric='cosine'`*

2. **Run Resumable Migration (if existing documents exist in production database):**
   ```bash
   python -m backend.migrate_rag_embeddings
   ```

3. **Verify Build:**
   ```bash
   npm run build
   ```
   *Expected Output: `✓ built in XXs` with 0 errors.*

---

## 3. Rollback Instructions

If vector retrieval degradation or remote rate-limiting occurs:
1. Revert to commit `7b14b78`:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```
2. The relational fallback in `backend/rag_service.py` ensures that even during temporary Pinecone or embedding outages, local database retrieval continues functioning without application crashes.
