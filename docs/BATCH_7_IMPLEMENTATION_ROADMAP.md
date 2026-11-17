# Batch 7 — Implementation Roadmap

**Planning basis:** Phase 0 source audit at `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2`.
**Status:** Phase 1 analytics authorization and Phase 2 API-client centralization are complete. Phase 3 auth hardening and Phase 4 security remediation are partially complete; Phases 5–6 have not started.

## Phase 2 — Centralized API client

**Status:** Complete. See [BATCH_7_PHASE_2_API_CLIENT_IMPLEMENTATION_REPORT.md](./BATCH_7_PHASE_2_API_CLIENT_IMPLEMENTATION_REPORT.md). The preflight/design documents remain the historical audit and design record.

**Goal:** Replace duplicated fetch/header/error behavior without changing endpoint semantics.

**Files expected to change**

- `src/config/api.js` — complete endpoint constants/base-path policy or become the shared client module, following the existing project structure.
- New `src/config/apiClient.js` (or equivalent shared client module).
- All direct-call sites in `src/App.jsx`, `src/components/ChatInterface.jsx`, `src/components/FeedbackWidget.jsx`, and `src/pages/{CanvasStudio,Flashcards,Library,LoginPage,Maps,Progress,Quiz,SignupPage,Sources,Summarize,Timer,Voice}.jsx`.
- New focused tests, preferably `tests/api-client.test.*` under the repository’s established Vitest component-test inclusion rules; adjust `vitest.config.js` only if a separate unit-test glob is needed.

**Dependencies**

- Phase 0 accepted.
- Agree the API client contract: relative `/api` base, token source, JSON/FormData support, typed error shape, 401/403 behavior, optional `AbortSignal`, and timeout policy.
- No new runtime package is assumed necessary; browser `fetch` is already available.

**Risks**

- Breaking multipart uploads by forcing JSON content type.
- Changing behavior for streaming/SSE response bodies or non-JSON responses.
- Accidental duplicate body consumption, auto-retrying non-idempotent requests, or redirect loops after 401.
- A central client can accidentally attach bearer tokens to external URLs unless it restricts destinations to the same API origin.

**Required tests**

- Method, URL/query, JSON header/body, FormData header handling, Bearer inclusion/omission.
- Non-JSON error bodies, 401/403 vs other errors, timeout and explicit caller cancellation.
- Streaming response passthrough and no automatic retry for POST.
- Focused caller regressions for Chat, Sources upload, and Feedback.

**Acceptance criteria**

- No application API call bypasses the common client except an explicitly documented streaming/exception case.
- Endpoint inventory and code agree; API calls use same-origin paths.
- Existing request payloads, response parsing, and user-visible behavior remain equivalent except approved global auth/error behavior.
- Focused tests pass with no new lint/type/build errors.

**Rollback**

- Revert the Phase 2 client/call-site patch as one unit; retain the inventory and tests. Do not leave callers partially migrated to two conflicting token/error policies.

## Phase 3 — Authentication and LoginPage hardening

**Status:** In progress. The shared Login/Signup response validation and storage rollback for F-04 are complete; broader auth-policy acceptance criteria remain open. See [BATCH_7_PHASE_3_AUTH_HARDENING_REPORT.md](./BATCH_7_PHASE_3_AUTH_HARDENING_REPORT.md).

**Goal:** Make login/signup/session behavior consistent and define backend enforcement for enterprise authorization.

**Files expected to change**

- `src/pages/LoginPage.jsx`, `src/pages/SignupPage.jsx`, `src/App.jsx`, `src/components/Header.jsx`, `src/firebase.js`.
- `backend/auth.py`, `backend/main.py`, `backend/security.py`.
- `tests/signup-page.component.test.jsx`; new LoginPage component tests; focused auth/API integration tests in `tests/test_batch1_security.py` or a new `tests/test_auth_api.py`.
- Potentially `vite.config.js` / deployment CORS configuration documentation if the selected session approach changes origins/cookies.

**Dependencies**

- Phase 2 client contract.
- Product decision on which API operations are public, optional, and authenticated (including whether null-owned user content is intentionally shared).
- Explicit session-storage architecture decision: keep Bearer-in-localStorage for this batch with compensating controls, or move to HttpOnly Secure SameSite cookies and add CSRF protection. Do not implement cookie auth without deciding CORS/CSRF/deployment origins.

**Risks**

- Changing anonymous behavior can break existing public chat/source workflows.
- Cookie migration can fail across current local/Render origins if SameSite, Secure, credentials, and CORS are not aligned.
- Tightening optional auth globally could create compatibility changes; each endpoint needs an explicit policy.
- JWT revocation/rotation may require a new server-side session/version strategy; avoid a partial logout implementation that only appears to revoke tokens.

**Required tests**

- Login and signup share strict auth response validation and atomic storage; failures at every write leave the same unauthenticated state.
- Password and Google success/failure, malformed responses, 401/429, and storage unavailable.
- Backend signature, expiration, malformed subject, unknown user, required-vs-optional auth, password login/register validation, Google audience/email verification.
- Logout/session expiry behavior and cross-tab synchronization.
- API tests asserting authenticated ownership and anonymous policy for each protected data category.

**Acceptance criteria**

- One session helper and one response contract serve password and Google auth across signup/login.
- No frontend boolean/local profile flag can authorize API access.
- Server policies are explicit; private data operations reject missing/invalid auth; intended anonymous functionality is documented and tested.
- Token lifetime, logout semantics, and expiration UX are explicit and tested.

**Rollback**

- Roll back frontend and backend auth behavior together if contract/deployment changes are incompatible. Keep a documented migration/compatibility window if cookies or token format change; do not silently fall back to insecure development credentials in production.

## Phase 4 — Frontend security remediation

**Status:** In progress. F-01 was remediated in Phase 1 and the Mermaid mount fallback (F-03) is now fixed; F-02 remains policy-dependent and unchanged. See [BATCH_7_PHASE_4_SECURITY_REMEDIATION_REPORT.md](./BATCH_7_PHASE_4_SECURITY_REMEDIATION_REPORT.md).

**Goal:** Close remaining fail-closed rendering gaps; review CORS and data boundaries.

**Files expected to change**

- `src/components/MermaidViewer.jsx` — remove `innerHTML` fallback paths.
- `backend/mcp_service.py` / `backend/main.py` only if review shows unauthenticated MCP access needs policy changes; preserve already scoped null-owned memory behavior.
- `backend/security.py` / `backend/main.py` / deployment configuration if CORS origins are narrowed.
- `tests/mermaid-viewer-security.component.test.jsx` and any focused tests added for approved CORS or MCP policy changes.

**Dependencies**

- Phase 2 anonymous/authenticated policy decision.
- Inventory production frontend/API origins before narrowing CORS.

**Risks**

- Removing the render fallback may change behavior in XML parser edge cases; the correct failure mode should be a visible safe error, not unsafe markup insertion.
- Restrictive CORS can break legitimate deployed environments if origin inventory is incomplete.

**Required tests**

- Unauthorized cross-user object reads/writes for conversations, sources, library, chat history, and analytics.
- Mermaid parser/import failure test proves there is no HTML sink execution/insertion.
- Browser/API CORS tests for allowed and rejected origins; CSRF tests if cookie-based auth was selected.
- Confirm JSX text remains safely escaped for API/AI output.

**Acceptance criteria**

- Analytics dashboard access and per-user isolation remain covered by `tests/test_batch7_analytics_security.py`.
- All private-resource lookups and mutations use an owner predicate or return a non-disclosing 404/401.
- SVG render failure is fail-closed; sanitizer regression suite still passes.
- CORS allows only documented origins and required methods/headers.

**Rollback**

- Revert only the specific route/query or rendering change if compatibility regresses, while preserving the regression test and preventing release of a known exposure. CORS changes should be rolled back only with a documented origin allowlist and compensating deployment control.

## Phase 5 — Reliability and code quality

**Status:** Not started.

**Goal:** Apply consistent network lifecycle handling and error states after the client/auth contracts settle.

**Files expected to change**

- Shared client and its call sites: `src/config/api.js`, new `src/config/apiClient.js`, `src/App.jsx`, `src/components/{ChatInterface,FeedbackWidget}.jsx`, and affected page files from the Phase 2 inventory.
- `src/pages/LoginPage.jsx`, `src/pages/SignupPage.jsx`, `src/pages/Progress.jsx`, `src/pages/Maps.jsx`, `src/pages/Sources.jsx`, `src/pages/Library.jsx`, `src/pages/CanvasStudio.jsx`, `src/pages/Flashcards.jsx`, `src/pages/Quiz.jsx`, `src/pages/Summarize.jsx`, `src/pages/Timer.jsx`, `src/pages/Voice.jsx`.
- Relevant existing component tests and API-client tests.

**Dependencies**

- Phases 2–4 complete so callers use one transport/error/auth contract.

**Risks**

- Over-aggressive timeout values can abort slow AI generation or uploads.
- Cancellation may suppress valid UI completion or be confused with real errors.
- Replacing user-facing messages globally can regress accessibility/local UX.

**Required tests**

- Timeout/cancellation coverage for uploads, AI generation, stream fallback, and analytics batches.
- No unhandled rejections on unmount or superseded requests.
- 401/403 consistently clear/refresh session as defined in Phase 2; 5xx/network errors remain recoverable and do not clear a valid token.
- Request counts and idempotent retry rules verified.

**Acceptance criteria**

- Every request path has a bounded/reasoned lifecycle policy; operations with intentionally longer limits are explicit.
- No silent success-shaped fallback masks auth or server errors.
- Console logs do not include bearer tokens, request bodies containing credentials, or raw user material.
- Lint and type/build checks pass.

**Rollback**

- Revert only lifecycle/error changes causing regressions, retaining the shared client, security checks, and test coverage. Do not remove timeouts from all requests as a blanket rollback; scope adjustments to slow operations.

## Phase 6 — Full regression and release verification

**Status:** Not started.

**Goal:** Validate the integrated change set, record evidence, and prepare a release checkpoint.

**Files expected to change**

- Test suites/configuration as needed: `vitest.config.js`, `pytest.ini`, `package.json` only if adding test scripts, and tests from prior phases.
- CI workflow file (new, because no `.github/workflows/` file was present at audit time), if CI execution is approved.
- Release evidence in `docs/BATCH_7_*` and any deployment checklist directly updated for the approved release.

**Dependencies**

- Phases 2–5 complete, reviewed, and tests green.
- CI secrets/origin configuration and deployment environment documented. No real credentials should be placed in source.

**Risks**

- Test suites may touch the configured SQLite database; isolate fixtures and ensure no production or developer database is modified.
- Browser-dependent OAuth/SpeechRecognition tests may require mocks or a separate manual browser checklist.
- A broad build/test run can reveal pre-existing warnings unrelated to Batch 7; separate baseline issues from regressions.

**Required tests and checks**

- `npm run test:components`.
- Node native test suites: `node --test tests/test_batch4_frontend_logic.test.mjs tests/test_batch5_frontend_coverage.test.mjs tests/test_batch6_chat_reliability.test.mjs`.
- `pytest -q` with an isolated test database.
- `npm run lint` and `npm run build`.
- Authenticated/anonymous API integration suite, cross-tenant security suite, CORS/security-header checks, and production smoke tests.
- Inspect final `git diff`, changed-file list, and working tree; verify only approved files changed.

**Acceptance criteria**

- All relevant tests/checks pass; test counts and environment are recorded with exact commands.
- Security findings F-01/F-02/F-03 have regression coverage and explicit dispositions.
- No secrets, schema changes, or unapproved generated artifacts are present.
- Release notes and rollback steps match the deployed auth/CORS/session policy.

**Rollback**

- Release from a known-good commit/tag; revert the complete Batch 7 release commit(s) if production verification fails. Database rollback is not anticipated unless a separately approved schema change is added later; any such migration requires its own backup/forward-and-backward plan.

## Execution status

The original Phase 0 approval gate was satisfied by the later user authorization for the master execution. Phase 2 is complete, and Phases 3–4 are in progress as recorded above. This roadmap is a status record and does not authorize deployment or changes to the agreed authentication architecture.
