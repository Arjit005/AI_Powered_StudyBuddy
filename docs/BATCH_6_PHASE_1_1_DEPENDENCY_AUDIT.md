# BATCH 6 — PHASE 1.1: DEPENDENCY AUDIT

**Date:** 2026-11-17  
**Repository:** `Internship_project_study_buddy`  
**Purpose:** Audit of newly installed test devDependencies, dependency tree resolution, and vulnerability analysis.

---

## 1. Exact Installed Package Versions (`npm ls`)

```
study-buddy@0.0.0 C:\Users\Dell\Downloads\Internship_project_study_buddy
+-- @testing-library/dom@10.4.2
+-- @testing-library/react@16.3.3
| `-- @testing-library/dom@10.4.2 deduped
+-- happy-dom@21.0.4
`-- vitest@5.1.0
  `-- happy-dom@21.0.4 deduped
```

### Application Core Preservation Verification:
```
study-buddy@0.0.0 C:\Users\Dell\Downloads\Internship_project_study_buddy
+-- @tailwindcss/vite@4.1.18
| `-- vite@7.3.1 deduped
+-- @testing-library/react@16.3.3
| +-- react-dom@19.2.3 deduped
| `-- react@19.2.3 deduped
+-- @vitejs/plugin-react@5.1.2
| `-- vite@7.3.1 deduped
+-- @xyflow/react@12.12.1
| +-- react-dom@19.2.3 deduped
| +-- react@19.2.3 deduped
| `-- zustand@4.5.7
|   +-- react@19.2.3 deduped
|   `-- use-sync-external-store@1.7.0
|     `-- react@19.2.3 deduped
+-- firebase@13.3.0
| `-- @firebase/crashlytics@0.1.1
|   +-- react-router-dom@7.12.0 deduped
|   `-- react@19.2.3 deduped
+-- lucide-react@0.562.0
| `-- react@19.2.3 deduped
+-- react-dom@19.2.3
| `-- react@19.2.3 deduped
+-- react-router-dom@7.12.0
| +-- react-dom@19.2.3 deduped
| +-- react-router@7.12.0
| | +-- react-dom@19.2.3 deduped
| | `-- react@19.2.3 deduped
| `-- react@19.2.3 deduped
+-- react@19.2.3
+-- vite@7.3.1
`-- vitest@5.1.0
  +-- @vitest/mocker@5.1.0
  | `-- vite@7.3.1 deduped
  `-- vite@7.3.1 deduped
```
**Conclusion:** No downgrades, no conflicts. All React, Vite, and Router dependencies resolved identically with deduplication.

---

## 2. Vulnerability Audit Analysis (`npm audit`)

### Newly Introduced Vulnerabilities:
- **0 newly introduced vulnerabilities.**
- The four installed testing packages (`vitest@5.1.0`, `happy-dom@21.0.4`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`) introduced **zero** new security advisories.

### Pre-Existing Vulnerabilities in Baseline Repository:
The baseline repository before this phase already contained 21 vulnerabilities in transitive dependencies of Firebase, React Router, Vite, and PostCSS:
1. `firebase` / `@firebase/firestore` / `@grpc/grpc-js` (High)
2. `react-router` / `react-router-dom` (GHSA-49rj-9fvp-4h2h, GHSA-8646-j5j9-6r62, etc. - High)
3. `vite` (GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r - High)
4. `postcss` (GHSA-qx2v-qp2m-jg93 - High)
5. `zod` (GHSA-mrhx-c7xc-m3w5 - High)
6. `brace-expansion`, `js-yaml`, `flatted`, `browserslist` (High)

Per the strict requirements:
> *"Check `npm audit` for newly introduced vulnerabilities. Do not automatically run `npm audit fix`. Report any pre-existing or newly introduced vulnerabilities separately."*

No automatic `npm audit fix` was run, preserving exact baseline stability.
