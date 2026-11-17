# Batch 7 — Phase 2 API Client Preflight Audit

**Repository:** `Arjit005/AI_Powered_StudyBuddy`  
**Audit date:** 2026-11-17  
**Branch / HEAD:** `main` / `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2`  
**Mode:** Read-only source review. No source, backend, package, schema, or existing documentation files were changed.

## 1. Baseline and integrity

The starting Git state was:

```text
## main...origin/main
 M backend/analytics.py
 M backend/main.py
?? docs/BATCH_7_API_USAGE_INVENTORY.md
?? docs/BATCH_7_IMPLEMENTATION_ROADMAP.md
?? docs/BATCH_7_PHASE_0_ARCHITECTURE_AUDIT.md
?? docs/BATCH_7_PHASE_1_1_SECURITY_REVIEW.md
?? docs/BATCH_7_PHASE_1_ANALYTICS_SECURITY_REPORT.md
?? docs/BATCH_7_SECURITY_FINDINGS.md
?? tests/test_batch7_analytics_security.py
```

- Current branch is `main`; HEAD is the expected `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2`.
- No staged changes or deleted files were reported.
- The two modified backend files and all untracked files above predate this audit and were preserved. `backend/analytics.py` and `backend/main.py` are the Phase 1 analytics authorization/isolation changes.
- The four Phase 0 deliverables were present. The roadmap includes its later Phase 1/Phase 2 renumbering. None were edited in this audit.
- Four new Phase 2 documents are the only additions from this audit.

## 2. Current frontend API architecture

### Transport, URLs, and configuration

- **42 direct `fetch()` call sites in 15 frontend source files** were confirmed by rescanning `src/`.
- All API `fetch()` URLs are relative `/api/...` paths, including dynamic IDs and query strings. The library listing uses `URLSearchParams`; chat, library, and source calls also interpolate IDs/query values.
- A repository-wide JavaScript search also finds `fetch` text in generated `dist/assets` bundles. Those are built copies of source code and are excluded from the source call-site count; no generated assets were inspected as migration targets or modified.
- `vite.config.js` proxies `/api` to `http://127.0.0.1:8000` for dev and preview. Production calls remain relative to the frontend origin.
- `src/config/api.js` contains a partial `API_ENDPOINTS` constants object and is imported only by `src/pages/Timer.jsx`. It is not a base-URL or request-client abstraction.
- No Axios, `XMLHttpRequest`, `EventSource`, `WebSocket`, or `sendBeacon` transport was found in `src/`. There is no request-specific timeout (`AbortSignal.timeout` or equivalent).

### Request and response behavior

- JSON calls manually set `Content-Type: application/json` and use `JSON.stringify`.
- The one source upload uses `FormData` and does not manually set the multipart `Content-Type`; the browser supplies the boundary.
- Most successful JSON calls parse their own response with `response.json()`. Some mutation calls only check `response.ok` and ignore the response body. Error parsing ranges from `detail` extraction to generic UI messages, console logging, or empty/default state.
- The map image is returned as Base64 inside JSON and validated before making a `data:image/png` URL. There are no API calls that consume a `Blob` or download a binary response.
- Local exports are generated in the browser as Blob/object URLs (Markdown in Chat and Summarize; SVG in Canvas and Mermaid). They are not API downloads.
- Errors are not normalized by a shared layer; callers independently handle non-OK responses and network exceptions. There is no global API-level 401/403 interceptor.

## 3. Verified call-site inventory

“Backend auth” describes the current dependency on the corresponding route, not what the UI intends. “Optional / anonymous-scoped” means the backend resolves a valid bearer to a user when present and otherwise applies its anonymous/null-owner behavior. An invalid token on an optional route can therefore be treated like anonymous access rather than a 401.

| # | File:line | Function / component | Endpoint | Method | Auth type (client; backend) | Request type | Response type and special handling |
|---:|---|---|---|---|---|---|---|
| 1 | `src/App.jsx:85` | `ProtectedRoute` auth-verification effect | `/api/auth/me` | GET | Bearer required; backend required | No body | JSON `{id, username, email}`. `AbortController` on effect cleanup. 401/403 invalidate local auth; other errors show retry UI. |
| 2 | `src/components/ChatInterface.jsx:71` | `fetchConversations` | `/api/conversations` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON conversation list. Generation guard; non-OK is not surfaced; network errors logged. |
| 3 | `src/components/ChatInterface.jsx:97` | `fetchChatHistory` | `/api/chat[?conversation_id=…]` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON chat-history list. Stale-response guard; non-OK/network failure falls back to default greeting. |
| 4 | `src/components/ChatInterface.jsx:163` | `handleNewChat` | `/api/conversations` | POST | Bearer optional; backend optional, user/null scoped | JSON `{title}` | JSON conversation object. Updates local conversation list; non-OK response is not explicitly surfaced. |
| 5 | `src/components/ChatInterface.jsx:192` | `handleDeleteSession` | `/api/conversations/{convId}` | DELETE | Bearer optional; backend optional, user/null scoped | No body | JSON status from backend is not parsed; UI updates only on `ok`. |
| 6 | `src/components/ChatInterface.jsx:247` | `clearCurrentChat` | `/api/chat[?conversation_id=…]` | DELETE | Bearer optional; backend optional, user/null scoped | No body | Status-only. Non-OK becomes a generic thrown error; then conversation list is refreshed. |
| 7 | `src/components/ChatInterface.jsx:309` | `sendMessage` streaming attempt | `/api/chat/stream` | POST | Bearer optional; backend optional, user/null scoped | JSON `{message, conversation_id}` | SSE/`ReadableStream`; incrementally decoded with `TextDecoder`. Handles `conversation_id`, `token`, `error`, and `[DONE]`; generation guard can cancel the reader, but the fetch has no `AbortSignal` or timeout. |
| 8 | `src/components/ChatInterface.jsx:459` | `sendMessage` synchronous fallback | `/api/chat` | POST | Bearer optional; backend optional, user/null scoped | JSON `{message, conversation_id}` | JSON `ChatResponse`; parses `detail` on errors. Used only when streaming was not accepted, avoiding a duplicate post after stream acceptance. |
| 9 | `src/components/FeedbackWidget.jsx:66` | `handleSubmit` | `/api/feedback` | POST | No bearer; backend optional | JSON `{page, rating, comment}` | Success body ignored; error JSON `detail` parsed. `AbortController` aborts when widget closes/unmounts; duplicate submit guarded by UI state. |
| 10 | `src/pages/CanvasStudio.jsx:72` | `fetchInitialCanvas` | `/api/canvas/generate` | POST | Bearer optional; backend optional | JSON topic/detail/diagram type | JSON object containing `canvas`; generation guard; per-page error state. |
| 11 | `src/pages/CanvasStudio.jsx:114` | `fetchMcpConfig` | `/api/mcp/config` | GET | Bearer may be attached; backend has no auth dependency | No body | JSON MCP client/config metadata; per-page error state. |
| 12 | `src/pages/CanvasStudio.jsx:142` | `handleGenerate` | `/api/canvas/generate` | POST | Bearer optional; backend optional | JSON topic/detail/diagram type | JSON object containing `canvas`; generation guard and per-page error handling. |
| 13 | `src/pages/CanvasStudio.jsx:287` | `handleSaveToLibrary` | `/api/library` | POST | Bearer optional; backend optional, user/null scoped | JSON saved material, with serialized canvas in `content_json` | JSON success/ID returned by backend; caller checks status and displays save state, does not depend on response payload. |
| 14 | `src/pages/Flashcards.jsx:70` | `generateFlashcards` | `/api/generate-flashcards` | POST | Bearer may be attached; backend has no auth dependency | JSON `{topic}` | JSON flashcards object/list; checks `data.flashcards`, filters/maps cards; generation guard. |
| 15 | `src/pages/Flashcards.jsx:199` | `handleSaveDeck` | `/api/library` | POST | Bearer optional; backend optional, user/null scoped | JSON saved material, serialized cards | Status-driven save state; response body not required. |
| 16 | `src/pages/Library.jsx:58` | `fetchLibrary` | `/api/library[?material_type=…&search=…]` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON material summaries. Uses `URLSearchParams`, validates returned array and item IDs, applies generation/favorite ordering guards. |
| 17 | `src/pages/Library.jsx:107` | `handleToggleFavorite` | `/api/library/{id}/favorite` | PUT | Bearer optional; backend optional, owner/null scoped | No body | JSON status/favorite value is not consumed; optimistic UI update and rollback on failure. |
| 18 | `src/pages/Library.jsx:127` | `handleDelete` | `/api/library/{id}` | DELETE | Bearer optional; backend optional, owner/null scoped | No body | Status-only; invalidates pending fetches and removes item on success. |
| 19 | `src/pages/Library.jsx:160` | `handleOpenItem` | `/api/library/{id}` | GET | Bearer optional; backend optional, owner/null scoped | No body | JSON full material. Generation guard and detail error state. |
| 20 | `src/pages/LoginPage.jsx:32` | `handleGoogleSignIn` | `/api/auth/google` | POST | No application bearer; public credential-exchange route | JSON Firebase ID token | JSON `AuthResponse` containing application token and user. Parses JSON with fallback; writes localStorage keys directly. |
| 21 | `src/pages/LoginPage.jsx:84` | `handleLogin` | `/api/auth/login` | POST | No bearer; public credential route | JSON username/email and password | JSON `AuthResponse`; parses `detail`, handles 429 lockout, checks only truthy token/user, writes localStorage sequentially. |
| 22 | `src/pages/Maps.jsx:45` | `generateDiagram` | `/api/generate-diagram` | POST | Bearer may be attached; backend has no auth dependency | JSON `{topic}` | JSON diagram response including `mermaid_code`; handled independently with `Promise.allSettled`. |
| 23 | `src/pages/Maps.jsx:50` | `generateDiagram` | `/api/generate-map` | POST | Bearer may be attached; backend has no auth dependency | JSON `{topic}` | JSON `{map_image}` containing Base64 PNG; validates Base64, size and PNG prefix, then uses a data URL. |
| 24 | `src/pages/Progress.jsx:27` | `fetchAnalytics` | `/api/progress` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON study hours/quizzes/streak. Part of `Promise.allSettled`; validates numeric values. |
| 25 | `src/pages/Progress.jsx:28` | `fetchAnalytics` | `/api/analytics/activity-heatmap` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON dense `days`/totals response; caller checks `days` array. |
| 26 | `src/pages/Progress.jsx:29` | `fetchAnalytics` | `/api/analytics/dashboard` | GET | Bearer conditionally attached; **backend required** since Phase 1 | No body | JSON `{chart}` Base64 PNG or null. Phase 1 report fixes this endpoint; the old Phase 0 inventory's “backend public” note is stale. |
| 27 | `src/pages/Progress.jsx:30` | `fetchAnalytics` | `/api/sessions/history` | GET | Bearer optional; backend optional, user/null scoped | No body | JSON session-history array; validates array/items. |
| 28 | `src/pages/Progress.jsx:153` | `resetStats` | `/api/progress` | DELETE | Bearer optional; backend optional, user/null scoped | No body | JSON status ignored; success resets UI and reloads analytics. |
| 29 | `src/pages/Quiz.jsx:34` | `generateQuiz` | `/api/generate-quiz` | POST | Bearer optional; backend optional | JSON `{topic}` | JSON quiz object with `questions`; validates nonempty questions and each item. |
| 30 | `src/pages/Quiz.jsx:133` | `handleSubmitQuiz` activity-log branch | `/api/track-activity` | POST | Bearer optional; backend optional, user/null scoped | JSON activity type and duration | JSON status is reduced to `res.ok`; fire-and-forget `.then/.catch`; no cancellation or retry. |
| 31 | `src/pages/Quiz.jsx:158` | `handleSaveQuiz` | `/api/library` | POST | Bearer optional; backend optional, user/null scoped | JSON saved quiz payload | JSON success/ID not used; UI status is based on `res.ok`. |
| 32 | `src/pages/SignupPage.jsx:101` | `handleGoogleSignIn` | `/api/auth/google` | POST | No application bearer; public credential-exchange route | JSON Firebase ID token | JSON `AuthResponse`; validates response and uses rollback-aware `persistSession`. |
| 33 | `src/pages/SignupPage.jsx:193` | `handleSignup` | `/api/auth/register` | POST | No bearer; public credential route | JSON username/email/password | JSON `AuthResponse`; parses error detail, validates payload and persists session with rollback. |
| 34 | `src/pages/Sources.jsx:38` | `fetchSources` | `/api/sources` | GET | Bearer optional; backend optional, owner/null scoped | No body | JSON source summaries; non-OK parses `detail`, network errors set UI error. |
| 35 | `src/pages/Sources.jsx:88` | `handleUploadSubmit` | `/api/sources` | POST | Bearer optional; backend optional, owner/null scoped | `FormData` (file and/or title/type/content/URL) | Multipart response is not parsed on success; clears input and refreshes source list. Does not override multipart `Content-Type`. |
| 36 | `src/pages/Sources.jsx:124` | `openSourceGuide` | `/api/sources/{source.id}/guide` | GET | Bearer optional; backend optional, owner/null scoped | No body | JSON generated guide; generation guard; parses error detail when available. |
| 37 | `src/pages/Sources.jsx:154` | `handleDelete` | `/api/sources/{id}` | DELETE | Bearer optional; backend optional, owner/null scoped | No body | JSON status ignored; local item removed on success; errors surfaced with alert. |
| 38 | `src/pages/Sources.jsx:178` | `handleReindex` | `/api/sources/{id}/reindex` | POST | Bearer optional; backend optional, owner/null scoped | No body | JSON status ignored; success/failure alerts. |
| 39 | `src/pages/Summarize.jsx:57` | `handleSummarize` | `/api/summarize` | POST | Bearer may be attached; backend has no auth dependency | JSON `{topic}` | JSON `{summary}`; parses `detail` with fallback, uses generation guard. |
| 40 | `src/pages/Summarize.jsx:163` | `handleSaveToLibrary` | `/api/library` | POST | Bearer optional; backend optional, user/null scoped | JSON saved summary | Status-driven save state; response payload not required. |
| 41 | `src/pages/Timer.jsx:47` | `StudyTimer` completion effect | `/api/track-activity` (`API_ENDPOINTS.TRACK_ACTIVITY`) | POST | Bearer optional; backend optional, user/null scoped | JSON activity type and duration | JSON status reduced to `res.ok`; promise chain updates status/logs errors. No request abort/timeout. |
| 42 | `src/pages/Voice.jsx:170` | `handleAskAi` | `/api/chat` | POST | Bearer optional; backend optional, user/null scoped | JSON `{message}` | JSON `ChatResponse`; parses error detail. An `AbortController` cancels a superseded/unmounted AI request. |

### Count reconciliation by file

| File | Fetch calls |
|---|---:|
| `src/App.jsx` | 1 |
| `src/components/ChatInterface.jsx` | 7 |
| `src/components/FeedbackWidget.jsx` | 1 |
| `src/pages/CanvasStudio.jsx` | 4 |
| `src/pages/Flashcards.jsx` | 2 |
| `src/pages/Library.jsx` | 4 |
| `src/pages/LoginPage.jsx` | 2 |
| `src/pages/Maps.jsx` | 2 |
| `src/pages/Progress.jsx` | 5 |
| `src/pages/Quiz.jsx` | 3 |
| `src/pages/SignupPage.jsx` | 2 |
| `src/pages/Sources.jsx` | 5 |
| `src/pages/Summarize.jsx` | 2 |
| `src/pages/Timer.jsx` | 1 |
| `src/pages/Voice.jsx` | 1 |
| **Total** | **42 / 15 files** |

## 4. Authentication, logout, and expiry

- Login and Signup support Google popup and password flows. `src/firebase.js` obtains a Firebase ID token, which is POSTed to `/api/auth/google`; the backend exchanges a verified provider token for its own bearer JWT.
- The frontend stores `auth_token`, `isAuthenticated`, and serialized `user` in localStorage. Login writes these sequentially without rollback; Signup validates the response and uses a rollback-aware helper.
- `Header.handleLogout` removes the three keys, dispatches `auth-change`, and navigates to `/login`; there is no server logout/revocation endpoint in the frontend flow.
- `ProtectedRoute` in `src/App.jsx` performs a local JWT shape/expiry check, then verifies with required-auth `/api/auth/me`. It clears stored auth after confirmed 401/403, but presents a retry state for network/other server failures. It does not impose a request deadline.
- The API callers usually read localStorage directly and attach a Bearer only if a token is present. Some reads are guarded with `try/catch` (`Maps`, `Timer`); many are not. A localStorage access exception may therefore abort a request path.
- No refresh-token endpoint or frontend refresh-token logic was found. Do not design automatic refresh into the client.
- Most backend routes use `get_current_user_optional`; invalid/expired tokens may become anonymous rather than 401 on these routes. The two observed required-auth routes used by this frontend are `/api/auth/me` and the Phase 1-protected analytics dashboard.

### Backend authorization classification for the 42 call sites

| Backend class | Frontend-used endpoints | Verified policy |
|---|---|---|
| Public credential-exchange | `POST /api/auth/register`, `/api/auth/login`, `/api/auth/google` | No application Bearer dependency; login/register accept credentials, Google accepts a Firebase ID token in JSON and verifies it server-side. |
| Required-auth | `GET /api/auth/me`, `GET /api/analytics/dashboard` | Existing required-user dependency; missing/invalid/expired/unresolved bearer yields 401. |
| Optional-auth, anonymous-scoped | Sources, conversations, chat/history/stream, study history/progress/heatmap/activity, quiz generation, feedback, canvas generation, library | `get_current_user_optional` is used. Reads/writes generally scope to the authenticated user or null-owned anonymous rows; library/source reads may include null-owned global rows for authenticated users. Exact object policies differ by operation. |
| No authentication dependency | `POST /api/summarize`, `/api/generate-flashcards`, `/api/generate-map`, `/api/generate-diagram`, `GET /api/mcp/config` | These routes do not declare an auth dependency. Some frontend callers still attach a token, but the route does not use it as an authorization control. |
| Anonymous-user scoped | Subset of optional endpoints above, especially chat, conversations, sources, library, progress/history | Backend branches on the resolved principal and queries/persists `user_id=None` for anonymous callers. This is endpoint behavior, not a frontend-only classification. |
| Administrative/privileged | None of the 42 frontend fetch calls is an administrative route. | Separate note: MCP invocation endpoints (`/api/mcp`, `/api/mcp/tools`, `/api/mcp/tools/call`) are not called by these fetch sites, have no auth dependency in `main.py`, and are rate-limited. Their registered tool capability policy should be reviewed separately; do not treat `/api/mcp/config` as an invocation. |

## 5. Streaming, file handling, and cancellation

### SSE

- The only frontend streaming API call is `ChatInterface.sendMessage` → `POST /api/chat/stream`.
- It sends JSON and reads `Response.body.getReader()` incrementally with `TextDecoder('utf-8')`; it splits newline-delimited SSE `data:` records, JSON-decodes each event, and does not buffer the complete response.
- Backend `chat_with_ai_stream` returns `StreamingResponse(..., media_type="text/event-stream")`; event data includes initial `conversation_id`/citations metadata, `token` events, `error` events, and `[DONE]`.
- The frontend uses `conversation_id` to associate the active conversation and `token` to update the visible response. It does not consume the streamed citations metadata.
- A verified event-shape edge case: when sources exist but none match, the backend emits a `chunk` field for its explanatory text. The frontend parser handles `token`/`error` but not `chunk`; that message can be lost. Keep this contract visible during migration; resolving it is a behavior change and should be separately approved/tested.
- If a stream is accepted and later breaks, the frontend marks it interrupted rather than automatically POSTing the same message to `/api/chat`, avoiding duplicate generation. Before acceptance, it can fall back to the synchronous endpoint.
- There is no AbortController passed to the streaming `fetch`. A stale-message path calls `reader.cancel()`, but there is no explicit request deadline or general unmount cancellation for this request.
- `Voice.handleAskAi` uses the non-streaming `/api/chat` endpoint and aborts superseded/unmounted requests.

### Uploads and downloads

- `Sources.handleUploadSubmit` is the only API upload; it sends `FormData` to `/api/sources`. The centralized client must pass the `FormData` through and must not set a multipart `Content-Type` header.
- No API `response.blob()`, binary response, or download endpoint call was found. `/api/generate-map` returns a Base64 image within JSON.
- Chat, Canvas, Mermaid, and Summarize create local Blob/object-URL downloads. Those features do not require a binary HTTP parser today; retain a raw/blob adapter for future or backend-supported downloads rather than forcing JSON parsing.

### Abort and timeout

- `AbortController` is used by `ProtectedRoute`, `FeedbackWidget`, and `Voice`.
- Chat's stream reader has a limited `reader.cancel()` stale-generation path, not a fetch signal.
- Other callers use generation counters to ignore stale responses; this does not stop the network request.
- No request timeout was found. `setTimeout` uses elsewhere are UI timers, delayed navigation, or object-URL cleanup, not network deadlines.

## 6. Confirmed concerns versus decisions

### Confirmed current behavior / compatibility risks

1. No common request/error/auth layer exists; response parsing and error UI differ by caller.
2. Token reads are duplicated; localStorage failures are inconsistently guarded.
3. Only route verification centralizes 401/403 behavior. Other requests keep page-specific handling.
4. Optional-auth backend routes may treat invalid/expired tokens as anonymous, which can change ownership semantics without an HTTP 401.
5. Requests generally lack timeouts and cancellation. Generation guards protect UI state but not network/server work.
6. SSE parsing is incremental, but the `chunk` no-source event shape and citations metadata are not consumed by the current parser.
7. Login and Signup differ in response validation and storage rollback.
8. The dashboard is now required-auth from Phase 1; the Phase 0 API inventory's statement that it is backend-public is historical and stale.
9. No evidence was found that frontend code deliberately logs bearer token values. Error objects are sometimes logged; the client should not log headers, bodies, or credentials.

### Design recommendations, not implementation findings

- Keep same-origin relative `/api` paths as the default. Do not add a configurable cross-origin base URL unless deployment needs are established; never attach a bearer token to an arbitrary external URL.
- Make auth mode explicit at each call site: `none`, `optional`, or `required`. This is a client policy declaration, not a replacement for backend enforcement.
- Do not add automatic token refresh or retries. There is no refresh contract, and retrying POSTs can duplicate chat generation, uploads, feedback, saves, or activity records.
- Do not automatically redirect/clear auth on every 401. Preserve the existing `/auth/me` policy and surface other endpoint errors to their caller until an explicit global auth policy is approved.
- Maintain distinct JSON, multipart, raw/stream, text, and Blob response paths.

## 7. Test architecture observed

- Vitest is run by `npm run test:components`; `vitest.config.js` includes only `tests/**/*.component.test.{jsx,js,tsx,ts}` and uses `happy-dom` plus `tests/setupTests.js`.
- Existing component suites cover Chat, Mermaid security, Signup, Voice, and smoke behavior. No API-client contract suite exists.
- Node native test files exist for prior batches, but `package.json` has no script for them; they are run separately with `node --test`.
- Backend integration/security tests use pytest and FastAPI `TestClient`. They can validate auth/response/server contracts but do not replace browser-side fetch-client tests.
- No additional dependency is needed for mocked-fetch API-client tests.

## 8. Preflight conclusion

The current 42-call baseline is verified. Phase 1 analytics authorization changes are present and preserved. The next safe step is a separate API-client design approval, then an adapter-and-test foundation followed by small feature batches. No implementation was started in this audit.
