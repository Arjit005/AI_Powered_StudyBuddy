# Batch 7 — Frontend API Usage Inventory

**Repository baseline:** `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2` (`main`)
**Scope:** Direct frontend HTTP requests under `src/`. Inventory is based on the checked-in source, not historical reports.

## Transport and common behavior

- **42 direct `fetch` call sites / 15 source files.**
- All observed API URLs are same-origin relative `/api/...`; there is no central base-URL selection. `vite.config.js` proxies `/api` to `http://127.0.0.1:8000` during dev/preview.
- No Axios, `XMLHttpRequest`, `EventSource`, `WebSocket`, or `sendBeacon` use found.
- `src/config/api.js` defines a partial `API_ENDPOINTS` object; only `src/pages/Timer.jsx` imports it.
- Authorization is built in each call/page/component, usually by reading `localStorage.auth_token` and conditionally setting `Authorization: Bearer ...`. Login, signup, and feedback calls omit Authorization.
- No global request wrapper, common response/error parser, global 401/403 logout behavior, or general timeout exists.
- Callers vary in non-OK response handling. Some parse `detail`, some throw fixed messages, some show generic alerts, and some silently retain/clear defaults.
- Abort signals are used only by the protected-route `/auth/me` check, FeedbackWidget, and Voice AI request. Other generation counters suppress stale state updates but do not cancel the network request.

## Call-site inventory

| Source file and line(s) | Endpoint(s) | Method | Auth / notable behavior |
|---|---|---|---|
| `src/App.jsx:85` | `/api/auth/me` | GET | Explicit Bearer token; AbortController for effect cleanup; handles 401/403 as unauthorized, other failures as retryable network/server error. |
| `src/components/ChatInterface.jsx:71,97,163,192,247,309,459` | `/api/conversations`; `/api/chat?conversation_id={id}` or `/api/chat`; `/api/conversations/{id}`; `/api/chat/stream`; `/api/chat` | GET, GET, POST, DELETE, DELETE, POST, POST | Reads local token per request. `res.ok` checks are not uniform; history errors fall back to greeting; stream may fall back to synchronous chat; no request timeout/AbortSignal. |
| `src/components/FeedbackWidget.jsx:66` | `/api/feedback` | POST | JSON; no Bearer token; aborts on close/unmount; parses error detail when non-OK. |
| `src/pages/CanvasStudio.jsx:72,114,142,287` | `/api/canvas/generate`; `/api/mcp/config`; `/api/canvas/generate`; `/api/library` | POST, GET, POST, POST | Shared-in-file `getAuthHeaders`; checks `ok` but response/error behavior varies; requests are not aborted. |
| `src/pages/Flashcards.jsx:70,199` | `/api/generate-flashcards`; `/api/library` | POST, POST | Reads token and conditionally sends Bearer; checks `ok`; local errors/alerts. |
| `src/pages/LoginPage.jsx:32,84` | `/api/auth/google`; `/api/auth/login` | POST, POST | No application Bearer token. Parses JSON with fallback; checks `ok`; weak response-shape validation; sequential localStorage writes. |
| `src/pages/Library.jsx:58,107,127,160` | `/api/library[?material_type=…&search=…]`; `/api/library/{id}/favorite`; `/api/library/{id}`; `/api/library/{id}` | GET, PUT, DELETE, GET | In-file `getAuthHeaders`; status/error handling exists but varies. Generation counters prevent stale state, not network cancellation. |
| `src/pages/Maps.jsx:45,50` | `/api/generate-diagram`; `/api/generate-map` | POST, POST | Reads token and conditionally sends Bearer; `Promise.allSettled`; validates response shape/base64 but does not abort stale work. |
| `src/pages/Progress.jsx:27,28,29,30,153` | `/api/progress`; `/api/analytics/activity-heatmap`; `/api/analytics/dashboard`; `/api/sessions/history`; `/api/progress` | GET, GET, GET, GET, DELETE | Reads token for the four-request batch and reset; uses `Promise.allSettled`; dashboard request is authenticated by convention only (backend route itself is public). |
| `src/pages/SignupPage.jsx:101,193` | `/api/auth/google`; `/api/auth/register` | POST, POST | No application Bearer token; shared response validation and rollback storage helper; parses backend detail; no AbortSignal. |
| `src/pages/Quiz.jsx:34,133,158` | `/api/generate-quiz`; `/api/track-activity`; `/api/library` | POST, POST, POST | Reads token and conditionally sends Bearer; checks response status on generation/save; activity tracking uses separate handling. |
| `src/pages/Sources.jsx:38,88,124,154,178` | `/api/sources`; `/api/sources`; `/api/sources/{id}/guide`; `/api/sources/{id}`; `/api/sources/{id}/reindex` | GET, POST, GET, DELETE, POST | Reads token and conditionally sends Bearer. Upload uses FormData; response errors differ by operation; no request deadline or AbortSignal. |
| `src/pages/Summarize.jsx:57,163` | `/api/summarize`; `/api/library` | POST, POST | Reads token and conditionally sends Bearer; checks `ok`; no request cancellation/timeout. |
| `src/pages/Timer.jsx:47` | `TRACK_ACTIVITY_ENDPOINT` = `/api/track-activity` | POST | The sole `API_ENDPOINTS` consumer; reads token; fetch is fire-and-forget with `.then/.catch`; no AbortSignal/deadline. |
| `src/pages/Voice.jsx:170` | `/api/chat` | POST | Reads token; AbortController for active AI request lifecycle; checks `ok`; errors rendered in component state. |

### Count reconciliation

| File | Calls |
|---|---:|
| `src/App.jsx` | 1 |
| `src/components/ChatInterface.jsx` | 7 |
| `src/components/FeedbackWidget.jsx` | 1 |
| `src/pages/CanvasStudio.jsx` | 4 |
| `src/pages/Flashcards.jsx` | 2 |
| `src/pages/LoginPage.jsx` | 2 |
| `src/pages/Library.jsx` | 4 |
| `src/pages/Maps.jsx` | 2 |
| `src/pages/Progress.jsx` | 5 |
| `src/pages/SignupPage.jsx` | 2 |
| `src/pages/Quiz.jsx` | 3 |
| `src/pages/Sources.jsx` | 5 |
| `src/pages/Summarize.jsx` | 2 |
| `src/pages/Timer.jsx` | 1 |
| `src/pages/Voice.jsx` | 1 |
| **Total** | **42** |

## Backend correlation notes

- `backend/main.py` defines the corresponding routes. Most endpoints that access user-associated data accept `get_current_user_optional`, not `get_current_user_required`; the API can therefore be called directly without the frontend router.
- Database scoping is commonly based on `current_user.id`, with null-owned rows queried for anonymous users. The global analytics dashboard is an exception: it has no user dependency, and its backing query has no `user_id` predicate.
- The current API endpoint constants do not cover Canvas, Maps, Analytics dashboard, MCP, Quiz activity, Voice/Chat History, or all dynamic resource routes.

## Centralization targets for Phase 1

1. Replace local token/header construction with one typed request helper (including JSON and FormData support).
2. Preserve relative `/api` paths while centralizing environment/base-path selection.
3. Normalize status/error parsing and define explicit 401/403 behavior.
4. Support optional `signal` and bounded request timeouts; do not silently retry non-idempotent POSTs.
5. Add focused tests for methods, headers, FormData, error parsing, cancellation, and unauthorized handling.

## Phase 2 migration addendum

The inventory above records the pre-migration 42-`fetch` baseline at the repository commit noted in its header. After Batch 7 Phase 2 implementation, a fresh source scan found:

- **42 API operations migrated to `apiRequest` across the original 15 caller files.**
- **One direct `fetch()` remains**, inside `src/config/apiClient.js`, where the shared transport executes the request.
- The previous per-file operation counts and endpoint mapping remain unchanged; the post-migration implementation evidence and current call-site details are recorded in [BATCH_7_PHASE_2_API_CLIENT_IMPLEMENTATION_REPORT.md](./BATCH_7_PHASE_2_API_CLIENT_IMPLEMENTATION_REPORT.md).

The client now makes auth intent explicit (`none`, `optional`, or `required`), serializes JSON, passes FormData without a manually supplied multipart content type, supports status-only and raw stream responses, normalizes HTTP/network/cancellation/timeout errors, and does not add token refresh, redirects, or retries. `/api/auth/me` and `/api/analytics/dashboard` remain required-auth requests; anonymous-compatible endpoints retain optional auth or no-auth behavior as classified in the Phase 2 preflight.
