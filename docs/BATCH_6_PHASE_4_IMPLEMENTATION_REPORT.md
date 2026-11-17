# BATCH 6 — PHASE 4 IMPLEMENTATION REPORT: VOICE SESSION RELIABILITY

**Date:** 2026-11-17  
**Repository:** `Internship_project_study_buddy`  
**Primary Target:** `src/pages/Voice.jsx`  
**Author:** Antigravity Agent  
**Status:** Remediated & Fully Verified  

---

## 1. Executive Summary

During Batch 6 Phase 4, lifecycle race conditions and session boundary vulnerabilities within `src/pages/Voice.jsx` were investigated and remediated. The legacy implementation initialized a single, shared `SpeechRecognition` instance at component mount and attempted session isolation by mutating `recognition._session = thisSession` directly on the native browser object.

This design caused severe lifecycle hazards:
- In-flight buffered results from Session 1 leaked into Session 2 because mutating `recognition._session` immediately made old events appear valid under `recognition._session === recognitionSessionRef.current`.
- Asynchronous `onend` and `onerror` events from cancelled or stopping sessions flipped the active UI state to inactive (`isListening = false`) during newer sessions.
- Calling `.start()` on an existing native recognition instance before its asynchronous shutdown finished caused Chromium/WebKit `InvalidStateError` exceptions.
- Unmounting the component left dangling event handlers attached to native browser audio objects.

All issues have been resolved by adopting a robust, per-session instantiation model with explicit event handler detachment and immutable closure-scoped session attributions.

---

## 2. Root Cause & Session Isolation Strategy

### 2.1 Root Cause
1. **Mutable Instance Property Contamination:** Mutating property flags (`_session`) on a persistent native DOM instance violates immutable event attribution. Because event dispatch in `SpeechRecognition` is asynchronous across separate audio threads, events dispatched before an increment can be evaluated after the mutation.
2. **Native Re-entrance Incompatibility:** Browser Web Speech API engines (`webkitSpeechRecognition`) are stateful machines. Re-invoking `.start()` while the previous session is transitioning to `ended` causes uncatchable or fatal state collisions.

### 2.2 New Architecture & Lifecycle Strategy
1. **Per-Session Recognition Lifecycle:**
   - Every time the user initiates speech capture (`toggleListening`), a dedicated `SpeechRecognition` instance is constructed.
   - A monotonic `activeSessionIdRef.current` is incremented.
   - The session ID is bound immutably into the closure of the event handlers: `const thisSessionId = ++activeSessionIdRef.current`.
2. **Explicit Teardown via `cleanupActiveRecognition()`:**
   - When stopping, unmounting, or starting a new session, all callbacks on the prior recognition instance (`onresult`, `onend`, `onerror`, `onstart`) are stripped to `null`.
   - The native instance is halted via `rec.abort()` (or `rec.stop()`).
   - The reference `recognitionRef.current` is cleared to prevent dangling handles.
3. **Session Attribution Verification:**
   - Handlers verify:
     ```javascript
     if (!isMountedRef.current || thisSessionId !== activeSessionIdRef.current) return;
     ```
   - Events from older sessions are safely and deterministically discarded.
4. **Benign Error Handling:**
   - Intentional aborts triggered during rapid clicks or session switches fire `error: 'aborted'`. The handler suppresses UI error alerts for benign aborts while restoring clean state.
5. **Ask AI Consultation Isolation:**
   - When `handleAskAi` is triggered, active recognition is immediately torn down, `activeSessionIdRef.current` is incremented, and `cleanupActiveRecognition()` disarms any pending trailing speech events.

---

## 3. Old vs. New Lifecycle Behavior Comparison

| Scenario | Legacy Behavior | Remediated Behavior |
|---|---|---|
| **Instance Allocation** | One instance created once in `useEffect` on mount | Fresh instance created per listening run |
| **Session Identification** | Mutable property `recognition._session` written to native object | Immutable generation ID enclosed in callback closure (`thisSessionId`) |
| **Stale Event Delivery** | Mutating `_session` caused pending Session 1 events to match new `_session` | All callbacks from prior sessions are discarded immediately |
| **Delayed `onend` from Session 1** | Falsely set `setIsListening(false)` on active Session 2 | Ignored; only Session 2's `onend` can alter Session 2's listening state |
| **Delayed `onerror` from Session 1** | Displayed error banner and stopped Session 2 | Ignored; cannot contaminate Session 2 |
| **Rapid Start/Stop Sequence** | Threw `InvalidStateError` because instance had not finished stopping | Prior instance detached and aborted; fresh instance starts cleanly |
| **Component Unmount** | Listeners remained attached to browser engine | All handlers nullified, abort called, and state updates guarded by `isMountedRef` |

---

## 4. Scope Verification
- **Modified Production Files:** Strictly `src/pages/Voice.jsx`.
- **Untouched Files:** `src/components/ChatInterface.jsx`, `src/pages/SignupPage.jsx`, `src/components/MermaidViewer.jsx`, and backend code remain untouched.
- **Dependencies & Build:** Zero package modifications; clean Vite build.
