# BATCH 6 — PHASE 1.1: TEST INFRASTRUCTURE AUDIT

**Date:** 2026-11-17  
**Repository:** `Internship_project_study_buddy`  
**Purpose:** Read-only inspection of test infrastructure and dependencies to determine the smallest compatible setup for actual React component regression testing of `ChatInterface.jsx`.

---

## 1. Inventory of Current Environment & Dependencies

### Runtime & Build Versions
- **Node.js**: `v25.2.1`
- **Vite**: `7.3.1` (Vite v7)
- **Vite React Plugin**: `@vitejs/plugin-react@5.1.2`
- **React**: `19.2.3`
- **React DOM**: `19.2.3`
- **React Router DOM**: `7.12.0`
- **ESBuild**: `0.27.2` (installed internally via Vite)

### Test Dependencies Currently Installed in `package.json`
- **None**:
  - `vitest`: Not installed (empty)
  - `jsdom`: Not installed (empty)
  - `happy-dom`: Not installed (empty)
  - `@testing-library/react`: Not installed (empty)
  - `@testing-library/dom`: Not installed (empty)
- **Existing Test Runner**: `node --test` (Node.js built-in native test runner) executing standard ECMAScript modules (`.mjs`).

### `package.json` Scripts
```json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
}
```
*Note:* No `"test"` script exists in `package.json`. Tests in Batches 4, 5, and 6 Phase 1 have been run via `node --test tests/<filename>.test.mjs`.

---

## 2. Component Structure & Dependencies of `ChatInterface.jsx`

`src/components/ChatInterface.jsx` imports:
1. `React, { useState, useRef, useEffect } from 'react'`
2. `useLocation` from `react-router-dom`
3. Icons from `lucide-react`: `Send, Bot, User, Trash2, Shield, Copy, Check, Download, Sparkles, Clock, RefreshCw, Plus, MessageSquare, PanelLeft, ChevronRight, Brain, Cpu, Layers`
4. `./StructuredMessage` (which imports sub-components like MermaidViewer, KaTeX, etc.)
5. Browser APIs:
   - `window.localStorage` (`getItem('auth_token')`)
   - `window.confirm(...)`
   - `window.alert(...)`
   - `window.history.replaceState(...)`
   - `fetch('/api/...')`
   - `ReadableStream` / `TextDecoder` (SSE stream reading)
   - `document.title`

### Implications for Component Testing:
To render `ChatInterface.jsx` directly, the testing runtime must provide:
1. **JSX compilation / ES module resolution**: Transpiling React 19 JSX and resolving path imports.
2. **DOM Environment**: A document, window, DOM elements, event dispatcher, and `localStorage`.
3. **Router Context**: A wrapper such as `<MemoryRouter>` to satisfy `useLocation()`.
4. **Mockable Network Fetch / Stream**: Standard `fetch` interception to return deferred promises and mock streams.

---

## 3. Comparison of Approaches for Real Component Testing

### Option A: Standard Vitest + happy-dom + React Testing Library (Recommended Industry Standard)
- **Packages Needed**: `vitest`, `happy-dom`, `@testing-library/react` (and `@testing-library/dom`).
- **Pros**:
  - Native Vite integration (shares `vite.config.js` and React 19 JSX transforms automatically).
  - Clean component rendering with `render(<MemoryRouter><ChatInterface /></MemoryRouter>)`.
  - Zero custom loaders needed.
- **Cons / Risks**:
  - Requires adding new devDependencies to `package.json`.
  - React 19 peer-dependency compatibility with Testing Library: `@testing-library/react@16+` supports React 19.
  - Requires user approval per strict project constraints ("No unrelated dependency upgrades", "Do not install or upgrade dependencies before evaluating compatibility").

### Option B: Node.js Native Runner + Custom JSX Loader + Minimal DOM Emulator
- **Approach**: Can a minimal DOM or Node loader be used without packages?
- **Analysis**:
  - Node 25 has native ES modules, but Node *does not have a native JSX parser*. Running `node --test` directly against `.jsx` produces `SyntaxError: Unexpected token '<'`.
  - Node has no native `window`, `document`, or `HTMLElement` for React DOM rendering.
  - Therefore, pure Node.js cannot mount a React 19 component without at least a JSX transform (e.g. via esbuild/vite) and a DOM implementation (jsdom or happy-dom).

### Option C: Vite Node / Vite In-Process Execution with Minimal DOM (`happy-dom`)
- **Packages**: `vitest@3` + `happy-dom`.
- **Footprint**: Smallest footprint because Vite is already installed (`v7.3.1`). Vitest uses the existing Vite configuration and esbuild pipeline directly.

---

## 4. Minimum Compatible Setup Recommendation

To execute actual component tests for `ChatInterface.jsx` while respecting the strict constraint:

> **Recommended Minimum Setup:**
> 1. `vitest` (compatible with Vite 7)
> 2. `happy-dom` (fast, lightweight DOM implementation, smaller and faster than jsdom)
> 3. `@testing-library/react` (v16+, officially supporting React 19)

### Feasibility Check with Project Constraints:
- Under **Strict Constraints**: *"Do not install or upgrade dependencies before evaluating compatibility. Otherwise propose the minimum necessary dependencies and configuration for approval."*
- Therefore, we present this complete infrastructure audit and the exact proposed configuration for your explicit review and authorization before any installation.

---

## 5. Next Steps Pending Approval
Upon receiving approval to install the minimal test tooling (`vitest`, `happy-dom`, `@testing-library/react`):
1. Install only the 3 minimal test devDependencies.
2. Add a `vitest.config.js` (or configure test in `vite.config.js`) with `environment: 'happy-dom'`.
3. Author `tests/test_batch6_chat_component.test.jsx` rendering `<ChatInterface />` inside `<MemoryRouter>`, mocking `/api/chat` and `/api/conversations` with deferred promises to exercise the 7 scenarios directly on the real component.
