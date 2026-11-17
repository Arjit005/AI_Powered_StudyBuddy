# BATCH 6 — PHASE 4 PREFLIGHT AUDIT: VOICE SESSION RELIABILITY

**Date:** 2026-11-17  
**Repository:** `Internship_project_study_buddy`  
**Primary Target:** `src/pages/Voice.jsx`  
**Author:** Antigravity Agent  
**Status:** Preflight Inspection Completed  

---

## 1. Executive Summary

A comprehensive preflight audit of the `Voice` component ([src/pages/Voice.jsx](file:///c:/Users/Dell/Downloads/Internship_project_study_buddy/src/pages/Voice.jsx)) was performed to identify lifecycle race conditions, stale callback vulnerabilities, and session isolation deficiencies in the browser `SpeechRecognition` implementation.

The current code attempts session tracking by mutating a property on a single, long-lived `SpeechRecognition` instance created once during component mount:
```javascript
// Current implementation in Voice.jsx
recognition._session = thisSession;
if (recognition._session !== recognitionSessionRef.current) return;
```

This strategy is fragile and introduces multiple critical defects and race hazards across browser recognition lifecycles.

---

## 2. Identified Vulnerabilities & Lifecycle Defects

### 2.1 Single Shared Native Instance Mutation (`recognition._session`)
- **Defect:** A single `SpeechRecognition` instance is allocated inside the `useEffect` on mount (`recognitionRef.current = new SpeechRecognition()`). When `toggleListening` is triggered, `recognition._session` is mutated on this shared native DOM object.
- **Race Hazard:** If Session 1 is stopping (`recognition.stop()` is asynchronous and sends buffered events), and Session 2 starts immediately, mutating `recognition._session = session2` causes any in-flight buffered events from Session 1 to match `recognition._session === recognitionSessionRef.current` (because `recognition._session` was overwritten in-place). Stale speech from Session 1 is therefore processed as if it originated from Session 2.

### 2.2 Reusing a Native `SpeechRecognition` Instance After `stop()` / `abort()`
- **Defect:** In Chromium and WebKit implementations, calling `start()` on a `SpeechRecognition` instance that has not yet transitioned to the `ended` state throws `InvalidStateError: Failed to execute 'start' on 'SpeechRecognition': recognition has already started.`
- **Consequence:** Rapidly clicking the mic button (`toggleListening` -> stop -> start) or triggering `handleAskAi` while recognition is stopping causes `recognitionRef.current.start()` to throw synchronously in the catch block (`Microphone capture could not be started`), breaking the user experience.

### 2.3 Stale `onend` and `onerror` Overwrite Newer Active Sessions
- **Defect:** When a user stops Session 1 and immediately starts Session 2, Session 1's native engine eventually fires `onend`. If the session check relies on mutable properties on the same instance, or if `recognitionSessionRef` is checked without instance-bound generation scoping:
  ```javascript
  recognition.onend = () => {
      if (isMountedRef.current && recognition._session === recognitionSessionRef.current) {
          setIsListening(false);
      }
  };
  ```
  If Session 2 has started on the same instance, Session 1's asynchronous `onend` event fires, finds `recognition._session === recognitionSessionRef.current`, and executes `setIsListening(false)`. This falsely flips Session 2's UI state to inactive while the microphone may still be running.
- **Error Overwrite:** Similarly, if Session 1 is aborted with an error (e.g. `aborted` or `network`), the deferred `onerror` handler will set an error message and set `isListening = false` on Session 2.

### 2.4 Lack of `onstart` Synchronization
- **Defect:** The component sets `setIsListening(true)` eagerly inside `toggleListening()` before the browser has actually granted microphone access or started capturing audio. If `onstart` fails or is delayed, the UI displays a pulsating "Listening" state when the hardware mic is inactive. Conversely, an `onstart` event from a cancelled or aborted prior session could set `setIsListening(true)` erroneously.

### 2.5 `handleAskAi` Race Hazards
- **Defect:** When `handleAskAi` is called:
  ```javascript
  if (isListening) {
      recognitionSessionRef.current += 1;
      recognitionRef.current?.stop();
      setIsListening(false);
  }
  ```
  While `recognitionSessionRef.current` is incremented, any trailing interim speech chunks buffered in native threads before `stop()` completes may still leak into the transcript if not strictly bound to an immutable session record.

### 2.6 Unmount Cleanup Deficiencies
- **Defect:** On unmount, the effect cleanup calls `recognitionRef.current.stop()`, but does not nullify event handlers (`onresult`, `onend`, `onerror`, `onstart`). While `isMountedRef.current` is set to `false`, lingering event listeners remain attached to the browser native recognition object, causing memory leaks and unnecessary callback executions in background threads.

---

## 3. Remediation Strategy: Per-Session Recognition Architecture

To achieve absolute session isolation and eliminate cross-session contamination:

1. **Per-Session Instance Generation:**
   - Rather than reusing a single native `SpeechRecognition` instance across the entire component lifetime, create a dedicated `SpeechRecognition` instance for each recording session.
   - Every session is assigned a monotonic `sessionId = ++sessionGenRef.current`.
   - The session ID is enclosed immutably inside the event listener closures (`const thisSessionId = sessionId`).
2. **Explicit Teardown of Previous Instances:**
   - When stopping, pausing, or starting a new session, the previous `SpeechRecognition` instance has its handlers detached (`recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.onstart = null;`) and `abort()` / `stop()` called.
3. **Strict Callback Attribution:**
   - Callbacks verify `thisSessionId === activeSessionIdRef.current && isMountedRef.current`. Stale events are discarded immediately with no-ops.
4. **Error & End State Protection:**
   - An `onend` or `onerror` from session $N-1$ cannot flip `isListening` to false if session $N$ is active.
   - Ignore benign `aborted` errors triggered by intentional stops/starts.
5. **Component Unmount Safety:**
   - Complete unmount handler strips all listeners, halts active recognition, aborts pending AI fetch requests (`AbortController`), and cancels active speech synthesis.
