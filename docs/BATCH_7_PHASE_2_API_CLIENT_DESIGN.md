# Batch 7 — Phase 2 Centralized API Client Design

**Status:** Proposal only. No API client has been implemented.  
**Basis:** Current Phase 2 preflight audit and verified 42-call inventory.

## 1. Design goals

- Preserve same-origin `/api/...` routing, backend contracts, and caller-visible behavior during incremental migration.
- Centralize request construction, token policy, cancellation/deadline plumbing, and normalized transport/HTTP errors.
- Keep response consumption explicit: JSON, text, Blob, raw `Response`, and streamed `ReadableStream` are not interchangeable.
- Never treat a client-side auth flag as server authorization.
- Avoid automatic refresh, redirects, retries, or content-type assumptions.
- Keep the implementation small and dependency-free using browser `fetch`, `Headers`, `FormData`, `AbortController`, `Response`, and streams.

## 2. Proposed module and interface

Keep the existing endpoint constants in `src/config/api.js` and add a single implementation module such as `src/config/apiClient.js`. The existing constants file is not a client and is currently used only by Timer.

Proposed public API:

```js
apiRequest(path, {
  method,
  auth: 'none' | 'optional' | 'required',
  json,
  formData,
  headers,
  responseType: 'json' | 'text' | 'blob' | 'response' | 'stream',
  signal,
  timeoutMs
})
```

The interface is a design sketch, not a final type or implementation. Rules:

1. Accept only same-origin relative `/api/...` paths for authenticated calls. Reject or strip auth for absolute/external URLs; do not leak the bearer to a third party.
2. `auth: 'none'` never reads or sends the app bearer. `optional` sends it only when available; `required` fails locally if unavailable, while the backend remains the authorization authority.
3. Read `auth_token` in one place. A storage exception must be surfaced as a typed storage/auth error, not silently converted to “no token”.
4. Use mutually exclusive `json` and `formData` body options. JSON is serialized once and gets `Content-Type: application/json`; `FormData` is passed through with no manually set multipart content type.
5. `responseType` must be explicit or operation-appropriate. JSON parsing is not applied to streams, binary responses, or status-only calls.
6. On HTTP errors, parse a JSON `detail` only when available, otherwise use status/statusText; consume a response body at most once.
7. Normalize failures into an `ApiError` with a discriminant such as `http`, `network`, `timeout`, `aborted`, or `storage`, with status and a safe message where applicable. Do not include bearer headers, request credentials, or raw user content in logs/errors.
8. `responseType: 'stream'` returns the successful native `Response`/body without reading or buffering it. `responseType: 'response'` supports callers that need headers or custom body consumption.

Keep a raw-response adapter if necessary during migration so a caller can retain `res.ok` handling temporarily. Avoid two permanently competing token/error implementations: adapters should be transitional and tested for behavioral equivalence.

## 3. Authentication and 401/403 policy

### Explicit per-request auth mode

The endpoint inventory classifies each backend route based on its actual dependency:

- `none`: public credential-exchange routes and routes with no authentication dependency.
- `optional`: current routes using `get_current_user_optional`; requests may be authenticated or anonymous, with route-specific null-owner behavior.
- `required`: `/api/auth/me` and `/api/analytics/dashboard`.

The client should make the intended mode visible at each migrated call. It must not infer “public” just because a current caller omitted a header, and it cannot make an optional backend route private.

### No global redirect or token refresh

- Keep the existing behavior for `/api/auth/me`: 401/403 confirms the route guard's stored token is invalid; clear local auth and require login.
- For other calls, return/throw a normalized status error and let the existing caller present its own state/message. Do not redirect or clear auth globally for every 401/403.
- A 403 may indicate authorization denial rather than expired authentication; do not treat it as equivalent to 401 without an approved policy.
- No refresh-token endpoint/contract exists. Do not add refresh.
- Do not retry requests automatically. This is particularly important for POST operations (chat, stream, uploads, feedback, saves, quiz/activity submissions).

### Token scope

The token source is `localStorage.auth_token`; `isAuthenticated` and serialized `user` remain UI state, not proof of API identity. The API client should send only the app bearer and should never log it. Google login/signup send a Firebase ID token in a public JSON body; they must not be treated as ordinary app-bearer requests.

## 4. Serialization and response adapters

| Body/response case | Proposed handling |
|---|---|
| JSON request | Accept a JS value under `json`, serialize once, set JSON content type. Do not stringify `undefined` or serialize an already serialized string twice. |
| Multipart upload | Accept `FormData` under `formData`, pass directly to fetch, remove/avoid any caller-supplied multipart content type so the browser generates the boundary. |
| JSON response | Parse only when expected; preserve existing payload shape. Normalize non-OK responses, including malformed/non-JSON error bodies. |
| Status-only mutation | Expose status and avoid mandatory success JSON parsing; preserve callers that receive a body but do not need it. |
| Text response | Add explicit text mode for future endpoints; do not use JSON fallback silently. |
| Binary download | Add explicit Blob mode, preserving response headers such as `Content-Disposition`. No current frontend API call downloads a Blob; current exports are local Blob/object-URL generation. |
| Base64 image in JSON | Keep JSON mode; the API client must not reinterpret Base64 as a binary response. Current map and analytics images use this contract. |
| Stream / SSE | Return raw successful Response immediately with its body; no `.json()`, `.text()`, or buffering. The component/parser remains responsible for incremental SSE event decoding. |

Do not silently substitute `[]`, `{}`, or empty success values on parse/network errors inside the shared client. Callers may retain intentional UI fallback behavior, but they must do so explicitly and tests must protect it.

## 5. Timeout, cancellation, and request lifecycle

- Accept a caller `AbortSignal` and pass cancellation through to `fetch`.
- If a timeout is configured, implement it by composing a timeout controller with the caller signal and always clear timers/listeners in `finally`.
- Distinguish timeout from caller cancellation and network failure. An explicit user cancellation should not show a generic failure alert.
- Do not apply a short global timeout to AI generation, file upload, or streaming. Require per-operation timeout/idle-timeout values after observing real service latency and file-size limits.
- For streams, use a long or explicitly chosen idle policy; do not interpret a generation duration cap as a request to buffer the stream. Abort must close the reader/fetch and mark the UI interrupted without automatic duplicate POST.
- Existing generation counters remain useful for UI ordering but do not replace AbortController cancellation.

## 6. SSE and stream contract preservation

Current Chat flow uses `POST /api/chat/stream`, parses `data:` records incrementally, uses `conversation_id`, appends `token` events, surfaces `error`, and stops at `[DONE]`. The backend may send a `chunk` event in the no-matching-source branch and initial `citations` metadata; the current frontend parser does not consume either field. Treat this as a pre-existing endpoint contract mismatch. Do not hide it inside a generic client refactor; decide and test whether to update the parser or normalize the server event contract in a separately scoped change.

The API client must:

- Resolve once response headers/status are available, returning the stream rather than waiting for EOF.
- Preserve `Content-Type` and status/headers so the caller can distinguish non-SSE error responses.
- Leave incremental `TextDecoder` handling, line/event buffering, UTF-8 boundaries, JSON payload parsing, conversation ID updates, and user-message state in the stream adapter/component.
- Avoid automatic retry/fallback after an accepted stream. Existing synchronous fallback applies only before stream acceptance.

## 7. Base URL and compatibility

Keep relative `/api` URLs as the default. In development and preview Vite provides the proxy; in production requests use the hosting origin. There is no verified need for a cross-origin `VITE_API_BASE_URL`.

If a later deployment requires a configurable origin, decide allowed origins first and enforce that bearer credentials are only attached to the trusted API origin. Do not pass full URLs supplied by untrusted API response data through an auth-injecting helper.

Compatibility requirements:

- Preserve methods, paths, query encoding, payload keys, response envelopes, and per-page user-facing messages.
- Preserve `Promise.allSettled` partial availability on Maps and Progress.
- Preserve `Sources` FormData fields and never set its multipart boundary manually.
- Preserve file exports that are currently generated client-side.
- Preserve the stream request body, SSE content type, incremental read behavior, and fallback/no-duplicate-send logic.
- Avoid semantic behavior changes to anonymous endpoints; explicit auth mode records existing behavior without changing server policy.

## 8. Outstanding approval decisions

1. Approve explicit auth mode labels for the current route inventory, especially endpoints whose frontend sends a token but backend has no auth dependency.
2. Decide whether invalid/expired credentials on optional-auth routes should continue to become anonymous or eventually be rejected; this is a backend policy decision, not a Phase 2 client-only change.
3. Choose a timeout policy and per-operation limits, including idle timeout vs total duration for SSE, generation, and uploads.
4. Confirm whether an API-error helper should throw typed errors everywhere or provide a temporary raw-Response compatibility adapter during migration.
5. Decide how much of the existing page-specific error wording should be retained versus normalized.
6. Decide how/when to fix the streamed `chunk`/citations handling mismatch; keep it outside the initial transport layer unless explicitly included.
7. Confirm supported browser versions before relying on newer signal-composition APIs.
8. Confirm whether production is same-origin only; no base URL configuration is recommended until deployment topology says otherwise.

## 9. Recommendation

Implement one small core client and its mocked-fetch contract tests first. Then migrate a low-risk pilot (Feedback submission and Timer activity reporting) while retaining their current public/optional auth behavior. Do not migrate all 42 calls at once; put multipart, auth/session, and Chat SSE into separate reviewed batches.
