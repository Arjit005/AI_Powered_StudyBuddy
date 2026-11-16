# SECURITY REMEDIATION BASELINE & AUDIT VERIFICATION REPORT
**Specification Phase:** Phase 0 — Repository Baseline & Audit Verification  
**Generated Date:** 2026-11-16  
**Auditor / Roles:** Senior Staff Software Engineer, Application Security Engineer & QA Architect  
**Repository Branch:** `main`  
**Latest Baseline Commit:** `a34e327`  
**Test Suite Baseline:** 10 passed in 19.19s (`pytest -q`) | Frontend Production Build: Clean (3,889 modules transformed)

---

## 1. REPOSITORY ARCHITECTURE & DEPENDENCY BASELINE

| Component | Technology Stack | Key Runtime Dependencies |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide Icons, Mermaid.js | `react-router-dom`, `katex`, `cytoscape`, `mermaid` |
| **Backend API** | Python 3.14, FastAPI, Starlette | `pydantic`, `sqlalchemy`, `uvicorn`, `sqlite3` / `postgresql` |
| **Security & Auth** | JWT (`python-jose`), Passlib (`bcrypt`), Google OAuth2 Client | `requests`, `cryptography` (public x509 cert validation) |
| **AI & LLM Gateway** | Google GenAI SDK, LiteLLM (lazy-loaded), OpenRouter (REST streaming) | `google-generativeai`, `requests` |
| **Vector & RAG Store** | Pinecone Vector Client, SentenceTransformers / Gemini Embeddings | `pinecone-client`, `numpy` |
| **MCP Services** | JSON-RPC 2.0 Standard, Canvas Whiteboard Engine | `fastapi` |

---

## 2. AUDIT VERIFICATION & FINDINGS SUMMARY

A comprehensive AST-backed security and code-quality audit scan across 53 active files in the project produced **42 verified findings** (along with 10 legacy findings already addressed in previous batches).

### Total Audit Scope:
- **Total Findings Reviewed:** 52
- **Confirmed Active Findings:** 42
- **Previously Remediated / Verified Fixed:** 10
- **False Positives / Not Reproducible:** 0

### Severity Breakdown (Active Findings):
- **P0 / High Severity (Security & Critical Integrity):** 11 findings
- **P1 / Medium Severity (Reliability, Concurrency, State Overwrites):** 21 findings
- **P2 / Low Severity (Accessibility, Edge-case cleanup, Formatting):** 10 findings

---

## 3. CONFIRMED ACTIVE FINDINGS MATRIX

| ID | Module / File & Lines | Severity | Category | Confirmed Defect Summary |
|---|---|---|---|---|
| **SEC-01** | `backend/main.py:391-393` | **High (P0)** | Auth Security | Google OAuth token verification validates signature but does not verify audience against configured client ID. |
| **SEC-02** | `backend/main.py:811-813` | **High (P0)** | Data Isolation | Anonymous chat queries with `user_id = None` are not scoped, allowing cross-tenant leakage of private sources into anonymous RAG contexts. |
| **SEC-03** | `backend/rag_service.py:166-169` | **High (P0)** | SSRF | Destination peer IP check is skipped when socket object is absent in urllib3/requests connection pool. |
| **SEC-04** | `backend/rag_service.py:392-399` | **High (P0)** | Data Integrity | SQL chunks are committed before Pinecone vector upsert completes; swallowing upsert errors causes database-vector store divergence. |
| **SEC-05** | `backend/rag_service.py:392-396` | **High (P0)** | Atomicity | SQL commit within `chunk_and_embed_source` prevents rollback when subsequent embedding/vector indexing fails. |
| **SEC-06** | `backend/ai_service.py:368-372` | **High (P0)** | Data Privacy | Shared semantic cache across tenants risks leaking private student conversations or personalized context between users. |
| **SEC-07** | `backend/ai_service.py:680-683` | **High (P0)** | Prompt Injection | Memory compaction interpolates untrusted chat dialogue without strict delimiter protection or boundary markers. |
| **SEC-08** | `backend/security.py:95-100` | **High (P0)** | Security Bypass | Client IP extraction relies on exact string match of `TRUSTED_PROXIES` rather than CIDR / IP address normalization. |
| **SEC-09** | `src/components/MermaidViewer.jsx:45-48` | **High (P0)** | XSS / Injection | CSS `url()` sanitization can be bypassed with CSS hex/escape sequences inside SVG presentation attributes. |
| **SEC-10** | `src/components/ChatInterface.jsx:230-231` | **High (P0)** | Chat Reliability | Clearing conversation permanently marks ID as invalidated in ref; subsequent messages to cleared chat are discarded. |
| **SEC-11** | `src/pages/Progress.jsx:20-20` | **High (P0)** | Async Race | Concurrently triggered refresh while progress DELETE is in-flight increments generation, discarding successful reset state. |
| **BUG-12** | `src/pages/CanvasStudio.jsx:326-329` | **High (P0)** | Geometry Bug | SVG export helper lacks non-finite coordinate guards; `NaN`/`Infinity` produces broken SVG files. |
| **BUG-13** | `backend/ai_service.py:84-88` | **Medium (P1)** | Concurrency | Shared circuit-breaker counter mutations lack threading locks; concurrent requests corrupt state. |
| **BUG-14** | `backend/ai_service.py:483-486` | **Medium (P1)** | Streaming Recovery | If token streaming encounters an error after partial emission, caller gets incomplete stream without safe interrupted signal. |
| **BUG-15** | `backend/security.py:132-135` | **Medium (P1)** | DoS / Lockout | Lockout timer is extended on subsequent requests during lockout window, leading to indefinite user lockout. |
| **BUG-16** | `backend/security.py:147-150` | **Medium (P1)** | Auth Logic | Successful authentication does not clear lockout or reset failure counters. |
| **BUG-17** | `backend/embedding_service.py:71-72` | **Medium (P1)** | Validation | Unsupported `task_type` is silently dropped instead of validated or classified. |
| **BUG-18** | `backend/maps.py:78-81` | **Medium (P1)** | Robustness | Malformed concept map edge (non-dict or None source/target) raises Unhandled TypeError. |
| **BUG-19** | `backend/mcp_service.py:255-258` | **Medium (P1)** | Geometry | Diagram generator accepts zero or negative width/height dimensions. |
| **BUG-20** | `backend/mcp_service.py:260-263` | **Medium (P1)** | Validation | Diagram edges accept nonexistent node endpoints without graph topology validation. |
| **BUG-21** | `src/components/ChatInterface.jsx:491-500` | **Medium (P1)** | Async Error | Error catch appends error message even if request was superseded by conversation switch or clear. |
| **BUG-22** | `src/pages/LoginPage.jsx:82-83` | **Medium (P1)** | Auth UX | Email whitespace is not trimmed before detecting `@`, misrouting email input as username. |
| **BUG-23** | `src/pages/Flashcards.jsx:80-86` | **Medium (P1)** | Data Validation | Accepts invalid non-string cards and substitutes generic text silently. |
| **BUG-24** | `src/pages/CanvasStudio.jsx:53-56` | **Medium (P1)** | Memory / Unmount | Unmount does not invalidate generation counters; delayed fetches set state on unmounted components. |
| **BUG-25** | `src/pages/Progress.jsx:43-43` | **Medium (P1)** | Validation | `!isNaN` allows `Infinity` and `-Infinity`; metrics must use `Number.isFinite`. |
| **BUG-26** | `src/pages/Quiz.jsx:317-320` | **Medium (P1)** | Render Safety | `explanation` prop rendered as React child without type/string validation. |
| **BUG-27** | `src/pages/SignupPage.jsx:154-156` | **Medium (P1)** | Error Handling | Non-string FastAPI error response objects coerced to `[object Object]`. |
| **BUG-28** | `src/pages/Voice.jsx:34-34` | **Medium (P1)** | Async Race | Delayed speech callbacks overwrite current session transcript. |
| **BUG-29** | `src/pages/Voice.jsx:111-114` | **Medium (P1)** | Async State | AI pause does not increment recognition session ref, allowing late audio events to leak. |
| **BUG-30** | `src/components/Header.jsx:31-34` | **Medium (P1)** | Auth Sync | Stale/empty `localStorage.user` object renders logged-in UI without token verification. |
| **BUG-31** | `backend/main.py:1117-1119` | **Low (P2)** | Authorization | Conversation history delete filters by user but does not return 404/403 if ID belongs to another tenant. |
| **A11Y-32**| `src/components/FeedbackWidget.jsx:149-152` | **Low (P2)** | A11y | Star rating buttons lack `aria-label` and `aria-pressed` states. |
| **A11Y-33**| `src/components/Header.jsx:124-128` | **Low (P2)** | A11y | Dropdown buttons lack `aria-expanded` and `aria-haspopup`. |
| **BUG-34** | `src/components/Header.jsx:52-52` | **Low (P2)** | UX | Outside-click uses `mousedown` only, missing touch and Escape keyboard dismissal. |
| **UX-35**  | `src/components/Hero.jsx:168-168` | **Low (P2)** | Presentation | Demo notes card claims actual grounding on user notes; should be explicitly labeled sample. |
| **UX-36**  | `src/pages/CanvasStudio.jsx:38-39` | **Low (P2)** | UX | MCP config error state not rendered in UI, showing perpetual connecting spinner. |
| **UX-37**  | `src/pages/Quiz.jsx:352-352` | **Low (P2)** | UX | Activity logging failure silently renders same message as success without retry hint. |
| **UX-38**  | `src/pages/SignupPage.jsx:37-43` | **Low (P2)** | Code Style | Nested ternaries in error resolution conflict with clean code conventions. |
| **BUG-39** | `src/pages/Timer.jsx:29-32` | **Low (P2)** | Timer Logic | Rounding milliseconds to nearest second triggers 00:00 up to 500ms before actual elapsed deadline. |
| **UX-40**  | `src/pages/Summarize.jsx:112-113` | **Low (P2)** | Clipboard UX | `execCommand('copy')` return value ignored; clipboard failure shows success checkmark. |
| **UX-41**  | `src/pages/Summarize.jsx:180-184` | **Low (P2)** | Error UX | Save failures trigger browser `window.alert()` instead of inline error notifications. |
| **CLN-42** | `backend/embedding_service.py:4-4` | **Low (P2)** | Code Cleanliness | Unused import `Optional` retained. |

---

## 4. DEPENDENCY & RISK ANALYSIS

1. **OAuth Verification Dependency**: Changing audience verification requires verifying that `GOOGLE_CLIENT_ID` is present in backend environment or gracefully accepting authorized web client IDs while rejecting unrelated client IDs.
2. **SSRF Peer Validation**: Socket inspection on connection pooling must fall back safely to pre-connect DNS address resolution checks so connection reuse does not crash urllib3 adapters.
3. **Pinecone Vector Deletion Atomicity**: Relational DB transaction commit must be sequenced after vector deletion / upsert succeeds, or use a soft-delete tombstone status so failed vector operations can be retried.
4. **Chat Invalidation & Re-selection**: Refactoring `invalidatedConvsRef` in `ChatInterface.jsx` must preserve the guard preventing cross-conversation token leakage while allowing cleared sessions to receive new prompts.

---

## 5. ESTIMATED EXECUTION BATCHES

- **Batch 1 (Phase 1): Critical Security & Data Isolation**
  - Fix Google OAuth token audience validation (`backend/main.py`).
  - Fix Anonymous RAG source isolation (`backend/main.py`).
  - Fix SSRF peer IP validation & socket fallbacks (`backend/rag_service.py`).
  - Fix Vector deletion atomicity and SQL commit sequencing (`backend/rag_service.py`).
  - Fix IP rate-limit proxy subnet resolution & auth lockout reset (`backend/security.py`).
  - Fix Semantic cache partitioning / per-tenant isolation (`backend/ai_service.py`).
- **Batch 2 (Phase 2): AI Safety, Prompt Guardrails & SVG Sanitization**
  - Fix Unicode confusable & memory compaction injection delimiters (`backend/ai_service.py`).
  - Fix CSS escape / URL obfuscation in SVG sanitizer (`src/components/MermaidViewer.jsx`).
  - Fix Thread-safe circuit breaker mutations (`backend/ai_service.py`).
  - Fix Streaming interrupted recovery signal (`backend/ai_service.py`).
- **Batch 3 (Phase 3): Chat, Session & Async Lifecycle**
  - Fix conversation invalidation lifecycle on clear (`src/components/ChatInterface.jsx`).
  - Fix superseded error catches (`src/components/ChatInterface.jsx`).
  - Fix Voice recognition session ref increments and audio pause races (`src/pages/Voice.jsx`).
  - Fix Header token validation & Escape key / A11y attributes (`src/components/Header.jsx`).
- **Batch 4 (Phase 4): Frontend Data Consistency & UI Robustness**
  - Fix Canvas Studio SVG geometry NaN/Infinity guards & unmount cleanup (`src/pages/CanvasStudio.jsx`).
  - Fix Progress async race on delete & `Number.isFinite` validation (`src/pages/Progress.jsx`).
  - Fix Quiz explanation normalization & activity failure feedback (`src/pages/Quiz.jsx`).
  - Fix Flashcards field validation, LoginPage email trimming, and Signup error parsing.
  - Fix Timer 500ms rounding, Summarize clipboard fallback and inline notifications.
- **Batch 5 (Phase 5): Backend Validation, MCP & Regression Hardening**
  - Fix embedding service task types & clean imports (`backend/embedding_service.py`).
  - Fix Concept map malformed edge handling (`backend/maps.py`).
  - Fix MCP diagram bounds and node endpoint validation (`backend/mcp_service.py`).
  - Add comprehensive regression test suite in `tests/`.

---

## 6. PHASE 0 ACCEPTANCE CRITERIA
- [x] Complete repository structure and active files inspected.
- [x] Baseline test suite executed: 10/10 tests passing.
- [x] 42 active findings cataloged with exact line numbers and severity.
- [x] No application code modified during Phase 0.
- [x] Baseline report written to `docs/SECURITY_REMEDIATION_BASELINE.md`.
