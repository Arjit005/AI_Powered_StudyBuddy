# Batch 7 — Phase 0 Security Findings

**Baseline:** `a94ef7aec1bbffd46f676adfc19a0a049d3a0ad2`
**Method:** Static source review of the current checkout. No exploit execution or database-changing test runs were performed.
**Classification:** “Verified” means the risky code path is directly present; it does not imply a deployed incident or attacker access.

## Executive summary

One confirmed cross-tenant information exposure is present: the unauthenticated analytics dashboard aggregates all users’ study sessions. Authentication is also enforced inconsistently at the API boundary: most routes accept optional authentication, and some writes made without a valid token are persisted as null-owned data. Per-user scoping does exist for many core records, and the current tests include meaningful isolation checks; the audit did not find evidence that a caller can use those tested paths to read another user's private conversations or sources.

The main storage tradeoff is that application access JWTs are kept in `localStorage`, allowing same-origin script execution to read them. No source-confirmed XSS path was demonstrated in this review, but a remaining `innerHTML` fallback weakens the Mermaid rendering boundary. Broader CORS and missing revocation/refresh controls are hardening concerns rather than demonstrated attacks.

## Verified findings

### F-01 — Global analytics endpoint leaks cross-tenant activity aggregates

**Severity:** Medium (privacy / tenant-isolation defect)
**Status:** Verified from source; not runtime-exploited during this read-only audit.

- `backend/main.py` exposes `GET /api/analytics/dashboard` with no auth dependency.
- It calls `analytics.generate_study_chart(db)`.
- `backend/analytics.py` queries all `StudySession.activity_type` and `duration_seconds` rows with no `user_id` filter, then returns a base64 chart.
- The endpoint is called by `src/pages/Progress.jsx`; its Bearer header does not make the backend endpoint private.
- Result: any caller can obtain an aggregate chart derived from the entire study-session table. The chart does not contain explicit user identifiers, but it crosses tenant boundaries and exposes organization-wide activity aggregates.

**Required remediation:** Make the chart query and endpoint follow the same per-user policy as progress/heatmap/history, and add an integration test proving user A, user B, and anonymous users each receive only authorized data.

### F-02 — Authentication is optional on most data APIs; unauthenticated writes can become shared/null-owned

**Severity:** Medium, contingent on intended product policy
**Status:** Verified behavior; privacy impact depends on whether anonymous/shared content is an intentional feature.

- `backend/auth.py:get_current_user_optional` maps missing, invalid, expired, and unknown-user tokens to `None`; it does not distinguish anonymous requests from failed authentication.
- In `backend/main.py`, `/api/auth/me` is the observed required-auth route. Most sources, conversations, chat, analytics, library, feedback, and Canvas endpoints use optional auth or no auth.
- Examples: `POST /api/sources` and `POST /api/library` set `user_id=None` when there is no valid current user. Null-owned rows can then be listed to anonymous clients and are included alongside private rows for authenticated users. Anonymous conversations/chat are similarly stored under null ownership.
- Client-side `ProtectedRoute` does not enforce a server-side policy. A direct API caller can invoke these routes without using the UI.
- Existing code deliberately limits anonymous RAG retrieval to public/null-owned sources, and the current security tests verify that private sources are not included in anonymous chat. Thus this is **not evidence that private user rows are readable by anonymous callers**; it is evidence that the route policy permits anonymous access and shared persistence.

**Required remediation:** Explicitly label endpoints as public, authenticated, or optional; require authenticated users for private uploads, library writes, and user-specific operations if anonymous sharing is not a product requirement. Return 401 for invalid/expired credentials on routes that require auth rather than silently treating them as anonymous.

### F-03 — Mermaid mounting retains an unsafe HTML insertion fallback

**Severity:** Low-to-medium hardening risk
**Status:** Sink verified; exploitability not established.

- `src/components/MermaidViewer.jsx` sanitizes SVG and normally parses it as XML, then imports the parsed node.
- In the mount effect, parse failure falls back to `targetEl.innerHTML = svgContent` (line 188), and an exception also falls back to `innerHTML` (line 191).
- The string is intended to be sanitizer output, which lowers risk. However, the fallback turns parser failures into an HTML injection path and undermines the fail-closed design. The existing Mermaid security component suite tests malicious SVG elements/attributes and malformed XML, but does not appear to force either mount-time fallback.

**Required remediation:** Remove both HTML fallbacks; on parse/import failure clear the target and surface a safe rendering error. Add a regression test that forces the failure branch and asserts no HTML insertion occurs.

### F-04 — Login session writes can leave partial local state; LoginPage has weaker response checks

**Severity:** Low (reliability / auth-state consistency)
**Status:** Verified.

- `src/pages/LoginPage.jsx` writes `isAuthenticated`, then `auth_token`, then `user` without rollback. A storage exception can leave earlier keys behind.
- SignupPage validates token/user field types and attempts rollback; LoginPage only checks truthiness.
- Backend response models constrain normal server responses, which lowers the practical likelihood of malformed values, but login and signup still implement different client contracts.

**Required remediation:** Share response validation and session persistence between login and signup; test write failure at each storage key and malformed server responses. Treat the boolean flag as UI metadata, never as authorization evidence.

## Security properties observed (positive controls)

- `backend/auth.py` verifies signed JWTs through PyJWT and uses an explicit algorithm allowlist; expiry is included and defaults to seven days. `/api/auth/me` requires a resolved current user.
- Google token verification applies configured/project audience validation and checks `email_verified`; `tests/test_batch1_security.py` includes negative audience tests.
- Many core user-associated database queries filter by current user ID; anonymous RAG retrieval is restricted to null-owned sources. Existing tests include anonymous-source isolation and unauthorized chat clearing.
- React text is generally rendered as escaped JSX text. No `dangerouslySetInnerHTML` or generic Markdown HTML rendering was found. Mermaid sanitization strips scripts, event handlers, foreignObject, external URLs, and unsafe CSS under covered cases.
- No explicit logging of access tokens, passwords, Firebase ID tokens, or Authorization headers was found in the reviewed source. Firebase/auth exceptions are logged, so logging hygiene should continue to avoid serializing request/credential objects.

## Risks not confirmed as exploitable

### JWT exposure through localStorage and XSS

`auth_token` remains in `localStorage` across page reloads and is readable by JavaScript executing in the application origin. This makes any future/other same-origin XSS more damaging. This review found no demonstrated general XSS path; the Mermaid fallback in F-03 is a defense-in-depth concern, not proof of token theft.

### Token lifetime and logout/session revocation

The server issues stateless JWTs with a seven-day expiry. Logout only removes browser-side storage; copied tokens remain usable until expiry unless the signing key changes. No refresh, rotation, or revocation mechanism was found. This is a verified design property; no stolen token or active exploit was observed.

### CORS and CSRF

`backend/main.py` allows configured origins and a wildcard-style `https://.*\.onrender\.com` origin regex, credentials, all request headers, and standard API methods. This is broader than a strict enterprise allowlist. The application auth mechanism observed is an explicitly attached Bearer header in `localStorage`, not a cookie, so classic ambient-cookie CSRF is not established by this configuration alone. Reassess if cookie auth is introduced; then add explicit CSRF protection and narrow origins.

### Error/log detail

Login/Signup log Google SDK error objects; backend Google verification prints exception details, while `MCPService.handle_jsonrpc` includes tool exception text in JSON-RPC error responses. No credential value is explicitly interpolated in these messages in the checked code. Prefer sanitized structured logs and generic client-facing errors.

### Rate limiting scale

The limiter is process-local/in-memory. This is useful per worker but does not provide a shared limit across multiple processes or instances. This is an operational scaling limitation, not an auth bypass verified in this source review.

## Priority order for remediation

1. Fix and regression-test the cross-tenant analytics endpoint (F-01).
2. Decide the explicit anonymous/shared-data policy, then enforce it at API boundaries (F-02).
3. Remove Mermaid HTML fallback and test the failure branch (F-03).
4. Unify login/signup session validation and storage behavior (F-04).
5. For enterprise deployment, decide whether to retain localStorage Bearer tokens or move to secure HttpOnly cookies; if moving to cookies, design CSRF and CORS together, and add revocation/expiration behavior.
