# Batch 7 — Phase 3 Authentication Hardening Report

## Status

**Partial completion:** confirmed Login/Signup inconsistency F-04 is remediated. Phase 3 is not complete because the broader backend auth-policy decision (F-02) and the remaining roadmap acceptance criteria have not been changed or verified in this scoped follow-up.

## Finding and remediation

The Phase 0 review confirmed that LoginPage accepted truthy token/user values and wrote three localStorage keys sequentially, while SignupPage had stricter response checks and rollback. The two flows could therefore accept different response shapes and leave partial login state after a storage failure.

Added `src/config/authSession.js` and routed both password and Google auth in LoginPage and SignupPage through the same helpers:

- `validateAuthPayload` requires a non-empty string access token and a user object containing a present ID, non-empty username, and non-empty email.
- `persistSession` writes the bearer and user profile before setting `isAuthenticated` last. On failure it attempts to clear all three keys and shows a generic persistence error. Cleanup failure is logged without exposing the underlying storage exception.
- The client-side boolean remains presentation metadata; `ProtectedRoute` and the backend still verify the bearer.

No token-storage architecture, JWT format/lifetime, backend auth policy, login endpoint, or OAuth exchange was changed.

## Files changed

- Added: `src/config/authSession.js`
- Updated: `src/pages/LoginPage.jsx`
- Updated: `src/pages/SignupPage.jsx`
- Updated: `tests/api-client-auth.component.test.jsx`
- Updated: `tests/signup-page.component.test.jsx`

## Verification

```text
npm run test:components -- tests/api-client-auth.component.test.jsx tests/signup-page.component.test.jsx
2 files passed; 15 tests passed
```

The tests cover successful login, public request headers/body, HTTP 429 lockout, malformed profile rejection, storage-write rollback, required Bearer verification for protected routes, 401 cleanup, recoverable network failure, and Signup success/validation/rollback regressions.

## Remaining risks and boundaries

- The access token remains in localStorage and can be read by same-origin script execution. Cookie auth, CSRF, revocation, refresh, and token rotation require a separate architecture decision and are not included.
- F-02 remains policy-dependent: optional-auth and anonymous/null-owned API behavior is preserved. This report does not tighten routes or alter shared-content visibility.
- No dependency, backend, database schema, or migration changes were made. No commit, push, or deployment occurred.
