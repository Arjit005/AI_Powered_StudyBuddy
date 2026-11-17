# Master Phase 5 Blocker Triage

**Audit date:** 2026-11-17
**Repository:** `Arjit005/AI_Powered_StudyBuddy`
**Mode:** Read-only triage followed by user-approved F-02 policy-test work only.

## Executive decision

**Do not begin unrestricted Phase 5 implementation yet.** The user has approved shared-public semantics for null-owned records and the existing invalid-token fallback. The follow-up tests now lock in that behavior, so F-02's policy decision is no longer open. The roadmap still says Phase 5 depends on Phases 2–4 settling; Phase 3 and Phase 4 remain partial.

The code has no demonstrated User-A-to-User-B private-record read in the reviewed F-02 routes. It deliberately persists some records with `user_id = NULL` and shares them among anonymous callers. That behavior is now an approved product policy, with visibility, mutation, reset, invalid-token, and public stateless-generation behavior covered by regression tests. No backend runtime authorization behavior was changed.

## 1. Verified completed work

| Work item | Current implementation and evidence |
|---|---|
| Batch 6 Voice reliability | Per-session SpeechRecognition lifecycle and stale-event guards remain in `src/pages/Voice.jsx`; component tests and the implementation/independent-review reports predate Batch 7. The later Voice change is API-client migration only. |
| Batch 7 Phase 1 analytics isolation | `/api/analytics/dashboard` uses `get_current_user_required`; `generate_study_chart` filters by the verified user's `StudySession.user_id`. `tests/test_batch7_analytics_security.py` covers missing/malformed/expired auth, both users' chart isolation, null-row exclusion, identity-parameter manipulation, and anonymous session history. The earlier expired-token proof gap was corrected by using a real test user. |
| Batch 7 Phase 2 API client | 42 calls across 15 consumer files use `apiRequest`; only `src/config/apiClient.js` contains a direct `fetch()`. JSON, FormData, stream, binary, cancellation, timeout, and error normalization have focused tests. No migration work should be repeated. |
| Batch 7 Phase 3 F-04 | `src/config/authSession.js` shares response validation and rollback-aware localStorage persistence between Login and Signup. Login password and Signup password/Google regression cases exist. |
| Batch 7 Phase 4 F-01/F-03 | Analytics isolation remains covered. Mermaid's `innerHTML` mount fallback is removed; `tests/mermaid-viewer-security.component.test.jsx` forces parser failure and checks fail-closed behavior. |

Historical reports record successful focused/full tests, including 55 backend tests. This triage inspected source and existing tests; it did not rerun those suites.

## 2. F-02 — exact policy decision and route impact

### Backend behavior

`backend/auth.py:get_current_user_optional` treats all of the following as `None`: no credentials, malformed/non-Bearer credentials, invalid or expired JWTs, malformed subjects, and a subject that does not resolve to a database user. It does not distinguish an intentionally anonymous request from a failed authenticated request. `get_current_user_required` converts an unresolved user to HTTP 401.

The existing ownership columns are nullable, including `Source.user_id`, `Conversation.user_id`, `ChatHistory.user_id`, `StudySession.user_id`, `SavedStudyMaterial.user_id`, and `Feedback.user_id`. For several models, `NULL` currently serves both as “anonymous-created” and as a shared/global row; there is no separate per-visitor identity in those filters.

### Affected persistent endpoints and frontend consumers

| Backend routes in `backend/main.py` | Current anonymous/null behavior | Frontend consumers |
|---|---|---|
| `POST/GET /api/sources`, `GET /api/sources/{id}`, `/guide`, `/reindex`, `DELETE /api/sources/{id}` (roughly lines 482–665) | Uploads without a resolved user are stored with `user_id=NULL`. Anonymous list/detail/guide/reindex/delete operate on null-owned rows. Authenticated list/detail/guide/reindex can include null-owned rows along with that user's rows; authenticated delete is restricted to that user's rows. | `src/pages/Sources.jsx`; chat retrieval is also affected by null-owned sources. |
| `GET/POST /api/conversations`, `PUT/DELETE /api/conversations/{id}`, `POST /api/chat`, `POST /api/chat/stream`, `GET/DELETE /api/chat` (roughly lines 672–1154) | Anonymous conversations and chat messages are persisted with `user_id=NULL`. Anonymous list/history and ID-based mutations select null-owned rows, so anonymous callers share that null-owned conversation/history pool. Authenticated conversation/history queries use the authenticated user's ID. Both chat paths retrieve null-owned sources for anonymous requests and own plus null-owned sources for authenticated users. | `src/components/ChatInterface.jsx`, `src/pages/Voice.jsx`. |
| `GET /api/sessions/history`, `POST /api/track-activity`, `GET/DELETE /api/progress`, `GET /api/analytics/activity-heatmap` (roughly lines 1165–1411) | Anonymous reads aggregate/list all null-owned activity. Anonymous `DELETE /api/progress` deletes all null-owned study-session rows, not activity belonging to one visitor. Authenticated requests are scoped to that user. The dashboard is the exception: it is required-auth and isolated by Phase 1. | `src/pages/Progress.jsx`, `src/pages/Timer.jsx`, `src/pages/Quiz.jsx`; chat and Canvas generation also create study-activity rows. |
| `GET/POST /api/library`, `GET /api/library/{id}`, `PUT /api/library/{id}/favorite`, `DELETE /api/library/{id}` (roughly lines 1537–1660) | Anonymous saves have `user_id=NULL` and are visible to anonymous callers. Authenticated list/detail include own plus null-owned materials. Anonymous users can favorite/delete null-owned items; authenticated favorite can also operate on null-owned items, while authenticated delete is scoped to the user's own row. | `src/pages/Library.jsx`, `src/pages/CanvasStudio.jsx`, `src/pages/Flashcards.jsx`, `src/pages/Quiz.jsx`, `src/pages/Summarize.jsx`. |
| `POST /api/feedback` (roughly line 1254) | Anonymous feedback is accepted and stored with `user_id=NULL`; no corresponding user-facing read route was found. This appears suitable for a public-feedback policy if intended. | `src/components/FeedbackWidget.jsx`. |
| `POST /api/canvas/generate` (roughly line 1462) | Canvas generation is optional-auth and records activity with the resolved user ID or `NULL`; the generated diagram itself is returned in the response. | `src/pages/CanvasStudio.jsx`. |

Stateless study-generation endpoints (for example summarization, map/diagram and flashcard/quiz generation) and public MCP configuration do not, by themselves, create the same persistent null-owned user content. They can remain public if that is the product intent. Authenticated routing in `src/App.jsx` is a UX control, not a substitute for backend policy; these API routes can be called directly.

### Approved policy (2026-11-17)

The user approved:

1. Null-owned records are shared among anonymous callers; preserve the existing route-specific read/mutation semantics, including anonymous progress reset.
2. Optional-auth routes continue treating absent, malformed, invalid, and expired credentials as anonymous. Required-auth routes retain their existing 401 behavior.
3. Public stateless summarization remains available without credentials.
4. Do not make unrelated optional-auth endpoints globally require authentication. Do not introduce per-visitor anonymous identity or schema changes.

The user's scope authorization was limited to F-02 backend-policy regression tests. Source review showed the existing endpoint behavior already matches the selected policy, so no backend runtime code change was necessary.

The new isolated tests in `tests/test_batch7_anonymous_access_policy.py` prove anonymous callers can share null-owned source, conversation/chat, library, and activity records; exercise the existing public mutations/reset; show user-owned rows remain excluded from anonymous queries/reset; verify invalid/expired credentials fall back to anonymous behavior only on optional routes; and preserve anonymous stateless summarization. They do not establish per-visitor anonymity, which is not the selected policy.

## 3. Phase 3 — completed work and residuals

### Completed

- Login password flow validates the shared response and persists the session using `authSession`.
- Signup password and Google flows use the same response validator and persistence helper.
- Tests cover Login password success, malformed profile rejection, HTTP 429 lockout, and a storage-write rollback. Signup tests cover password/Google success, malformed responses, storage rollback, and readable backend validation errors.
- `api-client.component.test.js` verifies 403 is normalized as an `ApiError`; `api-client-auth.component.test.jsx` verifies protected-route success, 401 cleanup, and recoverable network failure.

### Remaining tests and decisions

| Area | Verified behavior | Gap / limitation | Relevant files |
|---|---|---|---|
| Login Google | `LoginPage.jsx` has a Google login path using the shared helper. | No LoginPage Google success/failure regression test was found; Google success is covered for Signup. | `src/pages/LoginPage.jsx`, `tests/api-client-auth.component.test.jsx`, `tests/signup-page.component.test.jsx` |
| Logout | `Header.handleLogout` removes `isAuthenticated`, `auth_token`, and `user`, dispatches `auth-change`, and navigates to `/login`. | No logout regression test was found. There is no backend logout/revocation endpoint; deleting local storage does not invalidate a copied JWT. | `src/components/Header.jsx`, `src/App.jsx` |
| Session lifetime/revocation | Backend JWT expiry is seven days; `App.jsx` checks the local `exp` and verifies through `/api/auth/me`. | Local logout is client-only. The product must accept this stateless-token behavior or define a revocation/session architecture. Cookie auth is not required by this finding, but if selected it needs coordinated CSRF/CORS design. | `backend/auth.py`, `src/App.jsx`, `src/components/Header.jsx` |
| Expired token / 401 and 403 | Backend analytics tests prove an expired token is rejected by the required-auth dashboard. App integration tests prove `/api/auth/me` 401 clears local session. The client unit test proves a 403 becomes an HTTP `ApiError`. | No App-level 403 cleanup test, expired-token ProtectedRoute/UI test, or cross-tab `storage`/`auth-change` regression test was found. Optional routes silently downgrade invalid/expired credentials to anonymous, pending F-02 policy. | `src/App.jsx`, `src/config/apiClient.js`, `backend/auth.py`, `tests/api-client-auth.component.test.jsx`, `tests/api-client.component.test.js`, `tests/test_batch7_analytics_security.py` |
| Storage failure | Shared helper writes `auth_token` and `user` before `isAuthenticated` and attempts cleanup on failure. Tests prove rollback when the second write fails. | Tests do not exercise failure of each write position, cleanup failure, or browser reload/cross-tab persistence behavior. | `src/config/authSession.js`, `tests/api-client-auth.component.test.jsx`, `tests/signup-page.component.test.jsx` |

Therefore F-04 is complete, but Phase 3 is still partial until F-02 policy and the accepted logout/session-expiration behavior are explicit and the roadmap's auth acceptance criteria are either tested or consciously deferred.

## 4. Phase 4 — remaining security findings

| Finding / risk | Status | Evidence and disposition |
|---|---|---|
| F-01 analytics cross-user aggregation | **Remediated** | Required backend auth and database user filter; regression suite checks user A/B and null-owned rows. |
| F-03 Mermaid mount `innerHTML` fallback | **Remediated** | No `innerHTML` or `dangerouslySetInnerHTML` matches remain under `src/`; the component fails closed and its test forces parser failure. |
| F-04 Login/Signup session inconsistency | **Remediated** | Shared response validation and persistence helper with focused tests. |
| F-02 optional-auth/null-owned sharing | **Policy accepted; regression-tested** | The user approved shared-public null-owned behavior and current invalid-token fallback. The new isolated tests record the route behavior; no runtime behavior change was needed. |
| Bearer token in localStorage | **Confirmed design property; exploit not demonstrated** | Same-origin JavaScript can read `auth_token`; no general XSS path was confirmed in the inspected source. Accept with explicit risk treatment or approve a separate session-architecture change. |
| Logout/revocation | **Confirmed limitation; policy-dependent** | Logout removes browser keys only; an already copied token remains cryptographically valid until expiry (seven days) unless another server-side invalidation mechanism exists. |
| CORS | **Confirmed broad configuration; exploitability not established** | `backend/main.py` allows configured/local origins plus `https://.*\\.onrender\\.com`, credentials, and all headers. No CORS regression test was found. Narrowing requires a verified deployment-origin list. |
| CSRF | **No current cookie-CSRF finding confirmed** | The reviewed application sends Bearer headers from localStorage rather than ambient cookie authentication. Reassess if cookie auth is introduced. |
| General XSS/unsafe rendering | **No confirmed remaining sink in `src/` scan** | No `innerHTML` or `dangerouslySetInnerHTML` usage was found after Mermaid remediation. This does not substitute for a broader future security review. |

The remaining items are Phase 3 test/acceptance gaps, accepted token/logout risk, and CORS hardening—not a newly demonstrated critical/high exploit in this triage. F-02 is closed for the selected shared-public policy.

## 5. ESLint differential

### Current source/test scan

The safe scope `npm exec -- eslint src tests` avoids `.venv` and generated `dist/` while still applying the repository ESLint configuration. It exits non-zero with **276 errors and 9 warnings**:

| Rule | Count | Assessment |
|---|---:|---|
| `no-unused-vars` | 262 errors | Dominant category. The flat config uses `@eslint/js`, React Hooks, and React Refresh but no JSX-aware React usage rule/plugin. Consequently, imports referenced only as JSX tags (icons/components, and some `React` imports under the automatic JSX runtime) are reported as unused. Some other unused bindings may be genuine; do not blanket-disable the rule. |
| `react-hooks/set-state-in-effect` | 4 errors | Includes the new fail-closed mount update in `MermaidViewer` and existing findings in App/Header/Mermaid. |
| `no-empty` | 3 errors | Empty blocks in Quiz and Voice require source review; these are not configuration false positives. |
| `no-useless-escape` | 3 errors | Regex escape diagnostics in Signup and Voice; inspect intent before editing. |
| `react-hooks/refs` | 2 errors | Ref access during render in `CommandPalette`; source-level finding. |
| `no-control-regex` | 2 errors | Control-character sanitizer patterns in Mermaid; likely intentional, but the lint rule needs a justified source/config disposition rather than a blanket suppression. |
| `react-hooks/exhaustive-deps` | 9 warnings | Hook dependency/ref warnings in ChatInterface, CommandPalette, MermaidViewer, Flashcards, Library, Progress, and Timer. |

The root `npm run lint` still scans `eslint .`; the earlier run failed in the `.venv` traversal/formatter with `RangeError: Invalid string length`. Do not treat either lint command as passing.

### Corrected baseline comparison

The prior integrity audit's archived-tree count (295 errors/10 warnings) is superseded. The archive invocation did not preserve the ESLint file-pattern context reliably. The baseline was recomputed by linting each changed file's `a94ef7a` contents through `--stdin --stdin-filename <original repository path>` with the same current ESLint configuration, then combining those diagnostics with unchanged current files.

| Snapshot | Errors | Warnings | Total |
|---|---:|---:|---:|
| Adjusted `a94ef7a` baseline | 296 | 9 | 305 |
| Current `5596b17` | 276 | 9 | 285 |

Current code has **20 fewer errors and the same warning count** than the adjusted baseline. Signature-level comparisons produce changed diagnostic messages when adjacent code or line references move. Comparing per-file rule counts shows:

- The App state-update finding and the three Flashcards dependency warnings have matching counts at the baseline; their underlying lines were not newly added by the migration.
- Mermaid had one existing `set-state-in-effect` error at baseline and has two now. The added mount-failure `setSvgContent('')` at `src/components/MermaidViewer.jsx:198` accounts for one additional error; resolve or explicitly justify it without undoing fail-closed behavior.
- The other changes reduce diagnostics overall; they do not justify weakening rules.

Recommended lint work: configure JSX usage tracking in an approved way, then re-run and separate genuinely unused identifiers from JSX-only imports. Triage the one new Mermaid finding and existing source-level errors individually. Do not suppress rules globally.

## 6. Phase 5 prerequisites and classification

### Must be resolved before an unrestricted Phase 5 start

1. **Close or explicitly waive Phase 3/4 gates.** The roadmap says Phases 2–4 must be complete before Phase 5. Record an explicit exception if only a policy-independent reliability subset is authorized.
2. **Set the timeout boundary before applying timeouts.** The client supports optional per-request timeouts, but no default/per-operation budget is defined. Phase 5 must not invent one for AI streams or uploads.

### Can be completed during a narrowly scoped Phase 5

1. F-02's approved behavior is now covered in `tests/test_batch7_anonymous_access_policy.py`; no additional route change is required for this policy.
2. Complete Phase 3 tests for Login Google, logout, App-level 403, local expiry, cross-tab changes, and storage write/cleanup failure positions; assert that network failures do not erase a valid session.
3. Triage the new Mermaid lint error and existing lifecycle findings without weakening rules. Configure JSX-aware unused-variable tracking and re-evaluate true unused bindings.
4. Add timeout/cancellation tests for uploads, AI generation, stream disconnection, and unmount/superseded requests after per-operation budgets are approved.

### May be deferred to final release verification (but must be documented)

1. Verify and test the production CORS allowlist against actual deployment origins; do not narrow it before that inventory.
2. Record an explicit accepted-risk decision for localStorage Bearer storage and seven-day stateless-token logout semantics, or approve a separate cookie/revocation design.
3. Run full frontend, Node, backend-isolated-database, lint, and production-build checks; reconcile test counts in `docs/MASTER_EXECUTION_CHECKPOINT.md` and preserve exact command results.
4. Reconcile commit-body wording about SQL injection/global redirects with actual behavior and update checkpoint/current-state statements in an authorized documentation follow-up.

## 7. Recommended execution sequence

1. Retain the approved F-02 policy and its isolated regression tests; do not add a per-visitor identity or globally change optional auth.
2. Close Phase 3 session/logout/401/403 acceptance or obtain an explicit Phase 5 exception.
3. Triage ESLint configuration/source findings and add focused tests for the agreed reliability/timeout policy.
4. Re-run the complete regression and release verification; assess CORS and token-storage accepted risks.

## 8. Git integrity and stop condition

At audit start, `HEAD` was `5596b17a45bbf69b08d7911dfb4b99588c16e5fc` on `main`, tracking `origin/main`. A read-only `git ls-remote origin refs/heads/main` returned the same SHA. The only pre-existing worktree addition was `docs/MASTER_REPOSITORY_INTEGRITY_AUDIT.md`; all three commits were preserved.

### User-approved follow-up verification

The user authorized F-02 policy and regression tests only, selecting shared null-owned data and the existing invalid-token fallback. Added `tests/test_batch7_anonymous_access_policy.py`; no backend runtime code, dependency, schema, or migration was changed. The new tests passed (**6 passed**). The combined relevant security run (`tests/test_batch7_anonymous_access_policy.py`, `tests/test_batch1_security.py`, and `tests/test_batch7_analytics_security.py`) passed (**21 passed**).

Final branch/HEAD remain `main` / `5596b17a45bbf69b08d7911dfb4b99588c16e5fc`. The worktree additions are this report, `docs/MASTER_REPOSITORY_INTEGRITY_AUDIT.md`, and `tests/test_batch7_anonymous_access_policy.py`; the three commits remain untouched. No commit, push, pull, fetch, deployment, or branch/ref operation was performed. No Phase 5 work was started.
