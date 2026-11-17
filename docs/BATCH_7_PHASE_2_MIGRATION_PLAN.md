# Batch 7 — Phase 2 API Client Migration Plan

**Status:** Proposed only. Implementation has not started.  
**Baseline:** 42 current direct fetch call sites in 15 frontend source files.

## 1. Migration principles

- Add the shared client and contract tests before migrating callers.
- Migrate one coherent group at a time; maintain passing callers on both the client and native `fetch` during transition.
- Keep payload and response contracts unchanged. Do not use centralization as an opportunity to change anonymous access, login, error UX, or server policy.
- Add explicit auth mode (`none`, `optional`, `required`) for each call based on the verified backend dependency.
- Keep raw stream/FormData/Blob behavior explicit. Never force JSON headers or parsing on every request.
- Do not auto-retry, refresh tokens, redirect on arbitrary 401/403, or silently return default success-shaped data.
- Review final endpoint inventory against the current source after each batch; update the API usage documentation only after implementation approval.

## 2. Inventory groups and risk

Counts are by direct fetch call site; library-save calls are counted under the page that owns the feature.

| Group | Files and calls | Complexity | Auth / special response | Primary break risks and regression tests |
|---|---|---:|---|---|
| Authentication | `src/App.jsx` (1), `src/pages/LoginPage.jsx` (2), `src/pages/SignupPage.jsx` (2) — **5** | Medium | `/auth/me` required Bearer; login/register/Google are public credential exchanges. JSON user/token shapes. | Accidental global redirect/clear; breaking Firebase ID-token payload or atomic Signup persistence. Test valid/invalid session verification, 401/403 vs network retry, JSON errors, Google/password paths, localStorage unavailable, and storage rollback. |
| Chat and streaming | `src/components/ChatInterface.jsx` (7), `src/pages/Voice.jsx` (1) — **8** | Very high | Optional auth and anonymous ownership. JSON history/mutations, synchronous JSON chat, incremental SSE. | Buffering or consuming stream twice; broken `conversation_id`, token/event boundaries, `[DONE]`, error events, duplicate fallback POST, or cancellation. Test mocked chunked streams plus backend SSE contract and Voice abort. |
| Analytics and progress | `src/pages/Progress.jsx` (5), `src/pages/Timer.jsx` (1) — **6** | Medium | Progress/history/heatmap optional, null-user scoped; dashboard required after Phase 1; activity tracking optional. JSON objects/lists/Base64 chart; Timer does not need body parsing. | Accidentally making dashboard anonymous or losing required Bearer; partial `Promise.allSettled` behavior; duplicate timer event. Test each response shape, 401 on dashboard, partial/network failures, reset behavior and fire-and-forget status. |
| Library and sources | `src/pages/Library.jsx` (4), `src/pages/Sources.jsx` (5) — **9** | High | Optional auth; owner/null-owned policies vary by read vs mutation. JSON plus one multipart upload. | Multipart header/boundary corruption; changing null-owned visibility; optimistic favorite rollback or stale detail behavior. Test upload with file and text/URL FormData, CRUD response/status, filtering/query encoding, and ownership integration. |
| Maps and Canvas | `src/pages/Maps.jsx` (2), `src/pages/CanvasStudio.jsx` (4) — **6** | High | Maps endpoints have no auth dependency though token may be sent; Canvas is optional. JSON, including Base64 PNG and canvas graph objects. | Promise-all partial results lost; Base64 validation/data URL regression; MCP config request incorrectly treated as privileged/authenticated. Test `Promise.allSettled`, both response shapes, partial errors and save-to-library. |
| Summarization, quiz, study tools | `src/pages/Summarize.jsx` (2), `src/pages/Quiz.jsx` (3), `src/pages/Flashcards.jsx` (2) — **7** | Medium | Summarize/flashcards routes have no auth dependency; quiz/track/library are optional. JSON generation, save mutations, status-only activity request. | Changed JSON shape, invisible non-OK errors, duplicate activity/save POST, over-eager parse of status-only calls. Test each generation envelope, save body, failure messages and activity guard. |
| Other API consumer | `src/components/FeedbackWidget.jsx` (1) — **1** | Low | No bearer sent by UI; backend optional. JSON mutation; abort on widget close. | Lost cancellation/session guard or error detail. Test submit success/failure, abort on close, duplicate submit guard. |
| **Total** | **15 files** |  |  | **42 direct fetch calls** |

## 3. Recommended sequence

### Batch A — Client foundation (no feature migration)

**Scope:** Add `src/config/apiClient.js` and focused tests, leaving every existing call site intact.

- Decide accepted relative paths, auth mode, JSON/FormData body rules, response modes, typed errors, and signal/timeout semantics.
- Verify public/optional/required modes do not leak bearer tokens off-origin.
- Test malformed error JSON, status/detail propagation, network errors, abort vs timeout, no retry, and raw Response passthrough.
- No user-visible behavior changes in this batch.

### Batch B — Low-risk pilot (Feedback and Timer, 2 calls)

- Migrate FeedbackWidget's JSON POST with caller signal and current error message behavior.
- Migrate Timer's fire-and-forget activity POST with optional auth and status-only semantics.
- Prove `auth:none`/`optional`, cancellation, safe localStorage handling, and result/error adaptation.
- Keep both calls' current anonymous backend policy.

### Batch C — Analytics/progress (5 remaining Progress calls)

- Migrate the four GETs and reset DELETE in `fetchAnalytics`/`resetStats`.
- Preserve independent `Promise.allSettled` results, per-resource parsing, and partial error state.
- Mark dashboard as required auth; do not treat its 401 like a harmless optional analytics omission without review.
- Add tests for response shapes, missing/expired token, 401/403, partial network failure, reset, and cancellation/race guards.

### Batch D — Library and Sources (9 calls)

1. Migrate Library JSON list/detail and mutations while preserving optimistic favorite semantics and `URLSearchParams`.
2. Migrate Sources list/guide/delete/reindex JSON/status calls.
3. Migrate Sources upload separately, verifying `FormData` is passed unchanged and no multipart `Content-Type` is supplied.
- Add ownership behavior tests at backend integration level if endpoint policy is changed; Phase 2 itself should not change that policy.

### Batch E — Study generation and saves (7 calls)

- Migrate Summarize, Quiz, and Flashcards calls.
- Preserve response envelopes, validation, status-only activity logging, and JSON library-save payloads.
- Keep no-auth backend generation endpoints distinct from optional-auth quiz/activity/library operations.
- Add per-feature success/error and payload regressions; ensure no retries for mutation POSTs.

### Batch F — Maps and Canvas (6 calls)

- Migrate Map diagram/image and Canvas generation/config/save.
- Keep the two map requests independent with `Promise.allSettled`; preserve Base64 image checking and canvas JSON shape.
- Keep `/api/mcp/config` public at the HTTP route boundary even if a conditional bearer was previously sent.
- Test partial results, invalid Base64, errors, and save-to-library behavior.

### Batch G — Auth flows (5 calls)

- Migrate `ProtectedRoute` verification, Login password/Google, and Signup password/Google after the client/error semantics are stable.
- Preserve public credential exchange, Firebase ID token body, current 401/403 handling for `/auth/me`, and Signup's rollback-aware persistence.
- Add no refresh or global redirects. Validate localStorage exceptions and network retry UI.

### Batch H — Chat and streaming (8 calls; last/highest risk)

- Migrate conversation list/history/create/delete/clear and the synchronous chat path first, retaining response/error semantics.
- Add `requestStream`/raw Response support and migrate `POST /api/chat/stream` only after stream tests pass.
- Keep incremental `ReadableStream` consumption in the component/stream adapter. Do not buffer or parse its body in the generic JSON path.
- Test chunk boundaries/UTF-8, metadata and conversation IDs, `[DONE]`, error events, EOF/disconnect, cancellation, and no duplicate synchronous POST after stream acceptance.
- Decide separately whether to fix the existing server `chunk` event/citations parser gap; do not silently bundle a response contract change.

## 4. Dependencies and gate conditions

- No new runtime or test dependency is needed for the proposed client or mocked-fetch tests.
- Phase 1 analytics security fix and required dashboard auth remain in place.
- The endpoint auth policy table and behavior for invalid tokens on optional routes must be reviewed before migrating all callers.
- Browser support and timeout values must be decided before relying on AbortSignal composition or enforcing a default deadline.
- Production API origin/deployment topology must be confirmed before adding a configurable API host.
- Multipart, local Blob exports, and stream response consumption require separate acceptance checks.

## 5. Rollback and completion controls

- Each migration batch should be independently revertible, including its tests. Do not revert the shared client and leave half-migrated callers.
- Keep a changed-file allowlist per batch and compare the final 42-call inventory to code after migration.
- Do not roll back Phase 1 backend authorization to accommodate a client omission; fix the dashboard caller's auth mode instead.
- Stop and separate any failure that requires backend schema, auth policy, endpoint contract, or dependency changes from the approved client-only scope.
- Completion for a batch requires its focused tests and relevant regression suite to pass; full frontend/backend regression belongs to the later release phase.

## 6. Recommended first implementation batch

After explicit approval, begin with **Batch A (client foundation and mocked-fetch contract tests)**, followed by **Batch B (FeedbackWidget and Timer pilot)**. This proves public/optional auth, JSON serialization, status-only calls, error normalization, and caller cancellation/fire-and-forget behavior with only two migrated calls. Keep all other 40 direct fetch sites untouched during the pilot.
