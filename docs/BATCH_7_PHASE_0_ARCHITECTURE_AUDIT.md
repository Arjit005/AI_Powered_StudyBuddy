# Batch 7 — Phase 0 Architecture Audit

**Repository:** `Arjit005/AI_Powered_StudyBuddy`
**Audit date:** 2026-11-17
**Mode:** Read-only source review. No application code, dependencies, database schema, or Git history were changed.
**Purpose:** Record the current repository and authentication/API/test architecture before Batch 7 implementation.

## 1. Repository baseline

| Check | Observed value |
|---|---|
| Current branch | `main` |
| HEAD | `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2` |
| HEAD subject | `fix(batch-6): remediate chat reliability, signup auth, SVG security, and voice session races` |
| Working tree at audit start | Clean; `main...origin/main` |
| Baseline conclusion | The reported Batch 6 commit is the current HEAD; no later local commit or uncommitted application changes were present. |

`git status --short --branch`, `git branch --show-current`, and `git log -1` were inspected. The four requested audit documents are the only intended additions from this Phase 0 work; no application files are to be changed.

### Current source layout

- Frontend entry/config: `src/App.jsx`, `src/main.jsx`, `src/index.css`, `src/firebase.js`, `src/config/api.js`.
- Frontend pages: `CanvasStudio.jsx`, `Chat.jsx`, `Flashcards.jsx`, `Home.jsx`, `Library.jsx`, `LoginPage.jsx`, `Maps.jsx`, `Pricing.jsx`, `Progress.jsx`, `Quiz.jsx`, `SignupPage.jsx`, `Sources.jsx`, `Summarize.jsx`, `Timer.jsx`, `Voice.jsx` under `src/pages/`.
- Frontend components: `ChatInterface.jsx`, `CommandPalette.jsx`, `FeatureGrid.jsx`, `FeedbackWidget.jsx`, `Header.jsx`, `Hero.jsx`, `Layout.jsx`, `MermaidViewer.jsx`, `StructuredMessage.jsx` under `src/components/`; `FlipCard3D.jsx` and `SpotlightCard.jsx` under `src/components/ui/`.
- Backend: `ai_service.py`, `analytics.py`, `auth.py`, `database.py`, `embedding_service.py`, `guardrails.py`, `main.py`, `maps.py`, `mcp_server.py`, `mcp_service.py`, `migrate_rag_embeddings.py`, `models.py`, `rag_service.py`, `security.py`.
- Tests: Vitest component suites, Node native `.test.mjs` suites, and Pytest `test_*.py` suites under `tests/` and `tests/eval/`; detailed names are listed in Section 5.
- Configuration: `package.json`, `vite.config.js`, `vitest.config.js`, `pytest.ini`, `backend/requirements.txt`.
- CI workflow files: none found under `.github/workflows/`.

## 2. Authentication architecture

### Frontend flow

- `src/firebase.js` initializes Firebase from `VITE_FIREBASE_*` values and implements Google popup login. It returns a Firebase ID token to the page; the ID token is POSTed to `/api/auth/google`.
- `src/pages/LoginPage.jsx` provides Google and password login. It directly calls `fetch`, parses an error response with a fallback, and checks only that `access_token` and `user` are truthy. Both login paths write `isAuthenticated`, `auth_token`, and serialized `user` to `localStorage`, then navigate to `/`. Those writes are not atomic and the page does not validate field types/shape as SignupPage does.
- `src/pages/SignupPage.jsx` has Google and password signup, validates the response (`access_token` must be a non-empty string; `user` must be an object with an ID and username), and uses a rollback wrapper when local-storage writes fail. It also writes the same three keys, in a different order. It does not emit the `auth-change` event.
- `src/App.jsx` protects feature routes with `ProtectedRoute`. It checks the JWT's three-part shape and decoded numeric future `exp` locally, then verifies it with `/api/auth/me`. Only the server verifies the token signature. HTTP 401/403 from this check mark the token unauthorized and clear local state. Other HTTP failures and network errors display a retry view. The verification request is aborted on cleanup, not after a deadline.
- `src/components/Header.jsx` treats `auth_token` + the `isAuthenticated` string flag + a parseable user object as sufficient to show the profile; that is presentation state, not the authorization boundary. Logout removes the three local keys and navigates to `/login`; it does not call a server revocation endpoint. Logout dispatches `auth-change`; login/signup do not.

### Backend flow

- `backend/auth.py` signs HS256 access JWTs with `JWT_SECRET_KEY` (development-only fallback) and defaults to a seven-day expiry. Decode enforces the signature/expiry through PyJWT; the subject is converted to a user ID and the user is reloaded from the database.
- Missing, malformed, expired, or unknown-user Bearer credentials resolve to `None` in `get_current_user_optional`. `get_current_user_required` returns 401, and its only observed required use is `/api/auth/me`.
- Password registration/login and Google ID-token exchange in `backend/main.py` issue the same application JWT payload (`sub`, `email`). Password login and registration apply rate limiting; failed password attempts are tracked by client IP. Google login verifies audience/verified email before issuing the application token.
- The frontend stores the application bearer token in `localStorage`; authenticated requests manually set `Authorization: Bearer ...` when a token exists. No cookie-based application session, refresh endpoint, or server-side logout/revocation endpoint was found.

### Login/signup consistency findings

1. Login accepts a truthy token/user without the response-shape validation SignupPage applies.
2. Login writes the authentication flag first and has no rollback; Signup validates the response and attempts rollback.
3. Error parsing and failure messages differ, as do Google login/signup wording and handling.
4. Both flows use the same local-storage keys, but neither centralizes session establishment or dispatches the same auth-change notification.
5. Login's development quick-fill defaults to a fixed demo email/password when `import.meta.env.DEV`; it is UI-gated to development.

**Historical-report discrepancy:** `docs/BATCH_6_FINAL_CLOSURE_REPORT.md` describes SignupPage persistence for `auth_token`, `user`, `role`, `user_id`, and `user_email`. The current `SignupPage.jsx` source writes only `auth_token`, `user`, and `isAuthenticated`. The report also says Mermaid mounting replaced `innerHTML`; current `MermaidViewer.jsx` still has two `innerHTML` fallback assignments. This audit treats the checked-in source as authoritative.

## 3. API architecture summary

- There are 42 direct frontend `fetch(...)` call sites across 15 files. They use same-origin relative `/api/...` paths.
- `src/config/api.js` is only used by `src/pages/Timer.jsx`; it is a partial endpoint-constant list. The rest of the pages hard-code route strings or construct URLs locally.
- No Axios dependency or Axios usage was found. No other frontend HTTP transport (`XMLHttpRequest`, `EventSource`, `WebSocket`, or `sendBeacon`) was found.
- Bearer header creation is duplicated in feature pages/components. Most protected-page requests attach a token only if one is present; credentials are not required by the frontend wrapper or the optional backend dependency.
- Per-call HTTP error behavior differs: some callers parse `detail`, some display fixed messages, some silently fall back to empty/default state, and several do not inspect non-OK responses. There is no shared 401/403 handling or error normalization.
- No general request timeout was found. Request cancellation exists for route-auth verification, FeedbackWidget close/unmount, and Voice AI request lifecycle. Other components mostly use generation counters to ignore stale results, which do not cancel the underlying request.
- `vite.config.js` proxies `/api` to `http://127.0.0.1:8000` for dev/preview; production frontend requests remain relative to its serving origin. No `VITE_API_BASE_URL` or equivalent frontend API host was found.
- Details for every call site are in [BATCH_7_API_USAGE_INVENTORY.md](./BATCH_7_API_USAGE_INVENTORY.md).

## 4. Backend authorization and security summary

- The router has client-side protection for feature routes, but most data-bearing API routes use `get_current_user_optional`; only `/api/auth/me` uses the required dependency.
- Per-user filters are present on many conversation, chat, source, study-session, and library queries. Anonymous rows are commonly stored with `user_id=None` and are separately queryable; several reads intentionally include global/null-owned rows.
- A confirmed tenant-boundary defect exists in `GET /api/analytics/dashboard`: it invokes `analytics.generate_study_chart(db)`, whose query aggregates every `StudySession` without a user filter. The route has no required-auth dependency. Any unauthenticated caller can retrieve a chart derived from all users’ activity types and durations.
- `backend/main.py` allows fixed local origins plus configured `CORS_ORIGINS`, and a regex for every `https://*.onrender.com` origin, with credentials enabled and all headers allowed. The application bearer is not cookie-backed, so this alone does not establish a cookie-based CSRF bypass; it is broader than an enterprise allowlist should be.
- React renders most API-provided text through ordinary JSX text nodes. The Mermaid sanitizer rejects many SVG/script/URI/CSS vectors, but `MermaidViewer.jsx` falls back to `innerHTML` in two mounting error branches. No general raw-markdown HTML renderer or `dangerouslySetInnerHTML` use was found.
- No source evidence found that intentionally logs the application access token, password, Firebase ID token, or Authorization header. Login/Signup do log Firebase error objects, and backend token-verification failures print exception details; no explicit credential value interpolation was observed.
- More detailed confirmed findings and theoretical/intent-dependent risks are in [BATCH_7_SECURITY_FINDINGS.md](./BATCH_7_SECURITY_FINDINGS.md).

## 5. Testing architecture

- **Vitest:** `npm run test:components` invokes `vitest run`. `vitest.config.js` merges Vite configuration, uses `happy-dom`, loads `tests/setupTests.js`, and only includes `tests/**/*.component.test.{jsx,js,tsx,ts}`.
- **React component tests:** ChatInterface (7), MermaidViewer security (9), SignupPage (8), Voice (8), smoke (1). No LoginPage component suite and no API-client suite currently exist.
- **Node native tests:** `.test.mjs` files are run separately with Node's native test runner; `package.json` has no script for them. The component Vitest glob intentionally does not include them.
- **Pytest:** `pytest.ini` uses `tests/` and the configured Python path. Existing coverage includes auth/OAuth verification and lockout helper tests, anonymous RAG source isolation, session deletion isolation, security hardening, backend validation, MCP protocol, migration integrity, and production integrity.
- Current test files: `tests/chat-interface.component.test.jsx`, `tests/mermaid-viewer-security.component.test.jsx`, `tests/signup-page.component.test.jsx`, `tests/smoke.component.test.jsx`, `tests/voice-session.component.test.jsx`; `tests/test_batch4_frontend_logic.test.mjs`, `tests/test_batch5_frontend_coverage.test.mjs`, `tests/test_batch6_chat_reliability.test.mjs`; `tests/test_batch1_security.py`, `tests/test_batch2_ai_safety.py`, `tests/test_batch3_session_reliability.py`, `tests/test_batch5_backend_validation.py`, `tests/test_batch5_mcp_protocol.py`, `tests/test_batch5_migration_integrity.py`, `tests/test_batch5_security_hardening.py`, `tests/test_production_integrity.py`, `tests/eval/test_safety_eval.py`. `tests/setupTests.js` is the Vitest setup file.
- Prior Batch 6 reports record 33 component tests, 18 Node tests, and 48 backend tests passing at that checkpoint. These are historical report results; this Phase 0 audit did not execute tests or mutate the database.
- Key gaps: LoginPage's actual component/storage behavior; backend login/register/me end-to-end status/expiry cases; protected API route policies; cross-tenant analytics leakage; global 401/403 handling; request timeout/cancel behavior; and auth/API integration coverage.

## 6. Phase 0 disposition

The current source and repository baseline have been inspected. This phase produces architecture findings and an implementation roadmap only. Do not start Phase 1 until the user approves the roadmap.
