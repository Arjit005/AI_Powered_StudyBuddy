# Batch 7 — Phase 4 Frontend Security Remediation Report

## Status

**Partial completion:** the confirmed Mermaid insertion fallback (F-03) is remediated. The previously completed analytics isolation finding (F-01) remains covered by the Phase 1 implementation/report. The policy-dependent optional-auth finding (F-02) is intentionally unchanged.

## F-03 — Mermaid mount fallback

`src/components/MermaidViewer.jsx` already sanitized Mermaid SVG before insertion, but its mount effect used `innerHTML` if XML parsing failed or threw. That fallback bypassed the established DOM-node insertion boundary and was not fail-closed.

The mount effect now:

- Clears the target before mounting.
- Parses the sanitized SVG and appends an imported XML node only when parsing succeeds.
- Leaves the target empty and renders a safe “Diagram could not be displayed safely” error when parsing fails.
- Clears `svgContent` after a mount failure so a failed SVG cannot be downloaded as if it were successfully rendered.

No other rendering or sanitization policy was changed.

## Regression test

Updated `tests/mermaid-viewer-security.component.test.jsx` with a forced mount-parser failure. It asserts the error is shown and the SVG's text is not mounted. The test suite also retains existing valid-SVG, sanitizer, and malformed-input cases.

```text
npm run test:components -- tests/mermaid-viewer-security.component.test.jsx
1 file passed; 10 tests passed
```

## Files changed

- Updated: `src/components/MermaidViewer.jsx`
- Updated: `tests/mermaid-viewer-security.component.test.jsx`

## Deferred finding and remaining risks

- F-02 describes optional-auth and anonymous/null-owned persistence. The project has intentional anonymous flows, and prior execution constraints prohibit globally requiring auth or breaking those features. No product-policy change was made; private-versus-shared ownership rules remain endpoint-specific.
- F-04 Login/Signup consistency is addressed separately in [BATCH_7_PHASE_3_AUTH_HARDENING_REPORT.md](./BATCH_7_PHASE_3_AUTH_HARDENING_REPORT.md).
- The localStorage bearer-token/XSS impact remains a defense-in-depth risk. This work does not introduce cookie auth or CSRF handling.
- This was a targeted remediation, not a new independent security review. No dependency, backend, database schema, or migration changes were made. No commit, push, or deployment occurred.
