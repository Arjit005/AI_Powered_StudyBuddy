# Batch 7 — Phase 2 API Client Test Strategy

**Status:** Test plan only. No API client or tests were implemented by this audit.

## 1. Existing test infrastructure

- Vitest component suites run with `npm run test:components`; the config uses `happy-dom`, `tests/setupTests.js`, and includes only `tests/**/*.component.test.{jsx,js,tsx,ts}`.
- Current component suites cover Chat, Mermaid security, Signup, Voice, and smoke behavior. No API-client contract suite exists.
- Node native `.test.mjs` suites are run separately with `node --test`; there is no package script for them.
- Backend pytest suites use FastAPI `TestClient` and isolated fixtures in relevant tests. They validate backend contract/security, not the browser fetch wrapper itself.
- `fetch`, `Response`, `Headers`, `FormData`, `ReadableStream`, `TextEncoder`/`TextDecoder`, and `AbortController` can be mocked/used without adding a package, subject to the installed `happy-dom` support. If a browser API is missing, mock it at the test boundary rather than adding dependencies by default.

## 2. Proposed test layers

### A. API-client unit/contract tests (mocked fetch)

Create `tests/api-client.component.test.js` so the existing Vitest include pattern runs it. Use a fresh `vi.fn()` fetch mock per test and restore global state after each case.

| Area | Cases and assertions |
|---|---|
| URL safety/base path | Relative `/api/...` preserves the URL; invalid path and absolute external URL are rejected or handled without attaching the application bearer. No token is sent to another origin. |
| Auth modes | `none` never reads/attaches token; `optional` attaches Bearer when available and omits it when absent; `required` fails explicitly without a token and attaches a valid token when present. `isAuthenticated`/user profile flags do not substitute for the token. |
| Storage failure | Mock `localStorage.getItem` throwing; verify a typed surfaced storage failure rather than a silent anonymous request for a required call. Optional-call behavior must be explicitly decided and tested. |
| JSON serialization | Object body serializes once; method and content type are correct; already serialized/string payload and `undefined` behavior are not double-serialized or malformed. Preserve endpoint payload keys. |
| FormData | Pass the same FormData object; do not set `Content-Type` or overwrite its browser-generated boundary; retain file and text/url fields. |
| Status-only/JSON responses | Status-only caller can inspect success without forced body parsing. JSON mode preserves response shape. A malformed/empty success body produces an explicit parse error rather than an empty success default. |
| HTTP errors | Test 400/401/403/404/429/5xx, JSON `detail`, non-JSON/empty error bodies, status/statusText fallback, and exactly-once body consumption. Ensure no automatic redirect, logout, token refresh, or retry. |
| Network errors | Rejected fetch becomes a typed network error with no credential/body logging; caller can retain its page-specific recovery behavior. |
| Cancellation | Pass caller signal through; abort before and during fetch; distinguish caller abort from network failure; no generic error alert/retry for expected cancellation. |
| Timeout | With fake timers, verify configured timeout aborts, is classified separately from caller abort, and timer/listener cleanup runs after success/failure. Test no timeout by default until the policy is approved. |
| Blob/raw response | Blob mode returns a Blob and preserves relevant headers; raw/response mode returns an unconsumed Response. No default JSON parser runs for either. |
| No retries | Assert one fetch call for non-idempotent POST on network/5xx failure. |

### B. Streaming adapter/component tests (mocked fetch + stream)

- Use a `ReadableStream`/reader mock that emits multiple chunks before close. Assert UI receives incremental tokens before the stream completes; verify the client does not call `response.json()` or `response.text()` first.
- Split `data:` lines, JSON events, and UTF-8 characters across chunk boundaries; verify decoder buffering and line carry-over.
- Test initial `conversation_id` and citations metadata, token accumulation, `[DONE]`, server `error`, invalid JSON event, empty EOF, truncated EOF, and explicit abort.
- Assert an accepted stream that disconnects does not trigger a duplicate `/api/chat` POST.
- Add a regression for the current backend `chunk` event and citations behavior only after a response-contract decision. Baseline behavior should be recorded before changing it.

### C. Caller migration tests

For each migration batch, retain existing component regressions and add narrowly scoped tests:

- Pilot: Feedback success/error/abort/duplicate-submit; Timer success/non-OK/network failure and optional token.
- Progress: independent `Promise.allSettled` partial success, required dashboard 401, response shape and reset.
- Sources: upload FormData headers/body; list, guide, delete and reindex errors.
- Library: URL encoding, optimistic favorite rollback, delete invalidation and detail state.
- Generated tools: expected `summary`, `questions`, `flashcards`, map Base64, and canvas payload envelopes.
- Auth: Google Firebase token body; login/register response handling; `/auth/me` 401/403 versus recoverable network error; Signup persistence rollback.
- Chat/Voice: conversation mutation/history compatibility, stream and sync fallback, Voice AbortController lifecycle.

### D. Backend integration tests

Use FastAPI `TestClient` and isolated SQLite database fixtures for server policy and contracts:

- Verify `/api/auth/me` and `/api/analytics/dashboard` required authentication (including invalid/expired token cases tied to an existing test user).
- Verify optional endpoints' authenticated owner and anonymous/null-owner behavior without changing their policy during client migration.
- Verify `/api/sources` accepts multipart upload and returns the established JSON metadata contract.
- Verify JSON payload/response shapes for progress, library, generation, and chat endpoints where existing tests do not already cover them.
- Verify stream response `Content-Type`, event sequence, `conversation_id`, tokens, errors, `[DONE]`, and disconnection behavior. Avoid production/developer databases.
- Backend integration tests cannot prove the frontend client does not buffer; that must be tested with the mocked `ReadableStream`.

## 3. Regression command plan

Run focused tests synchronously after each batch:

```text
npm run test:components
node --test tests/test_batch4_frontend_logic.test.mjs tests/test_batch5_frontend_coverage.test.mjs tests/test_batch6_chat_reliability.test.mjs
```

The existing npm script already invokes `vitest run`.

For backend integration batches:

```text
python -m pytest -q <focused test files>
python -m pytest -q
```

Set `DATABASE_URL` to a unique temporary SQLite database for test processes whose application import runs schema initialization. New route tests should use their own isolated fixtures and must not rely on production/developer data.

At final release verification, also run the repository's existing lint/build commands (`npm run lint`, `npm run build`) and inspect changed files. Do not add a dependency or alter package manifests for Phase 2 without separate approval.

## 4. Acceptance criteria

- Tests prove request options and response modes rather than only asserting call counts.
- The `FormData` test fails if the client sets a manual multipart boundary.
- The stream test demonstrates incremental delivery before EOF and detects any buffering parser.
- 401/403 produce typed errors but do not auto-redirect, clear tokens globally, refresh, or retry.
- Optional auth, public requests, and required-auth endpoints are distinguished and verified against backend dependencies.
- Cancellation, timeout, network, and HTTP failures are distinguishable.
- Existing endpoint envelopes and caller-visible behavior remain compatible across each migration batch.
- All temporary test databases are isolated and removed; no live data is used.

## 5. Out-of-scope test changes

Do not use the client migration to silently change:

- Backend optional/required route policy.
- The Phase 1 dashboard authorization requirement.
- JWT format, token storage, expiry, logout/revocation, or refresh behavior.
- Chat SSE event payload semantics (`chunk`, citations, or token event fields).
- File upload limits, storage format, or local Blob export behavior.
- Retry semantics for POST requests.
