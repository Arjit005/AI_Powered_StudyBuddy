import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Voice from '../src/pages/Voice.jsx';

// Controllable Fake SpeechRecognition
class FakeSpeechRecognition {
    static instances = [];

    constructor() {
        this.continuous = false;
        this.interimResults = false;
        this.lang = '';
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this.isStarted = false;
        this.isStopped = false;
        this.isAborted = false;

        FakeSpeechRecognition.instances.push(this);
    }

    start() {
        this.isStarted = true;
        // Schedule onstart asynchronously to simulate real browser engine
        setTimeout(() => {
            if (this.onstart && !this.isStopped && !this.isAborted) {
                this.onstart();
            }
        }, 0);
    }

    stop() {
        this.isStopped = true;
    }

    abort() {
        this.isAborted = true;
    }

    // Helper to simulate speech result event
    emitResult(transcriptText) {
        if (this.onresult) {
            this.onresult({
                results: [
                    [{ transcript: transcriptText }]
                ]
            });
        }
    }

    // Helper to simulate error event
    emitError(errorType) {
        if (this.onerror) {
            this.onerror({ error: errorType });
        }
    }

    // Helper to simulate end event
    emitEnd() {
        if (this.onend) {
            this.onend();
        }
    }
}

describe('Voice Component Real Lifecycle & Session Isolation Suite (8 scenarios)', () => {
    beforeEach(() => {
        FakeSpeechRecognition.instances = [];
        window.SpeechRecognition = FakeSpeechRecognition;
        window.webkitSpeechRecognition = FakeSpeechRecognition;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;
    });

    // Scenario 1: Normal recognition updates the transcript
    it('Scenario 1: Normal recognition updates the transcript', async () => {
        render(<Voice />);

        const micButton = screen.getByTitle(/Click to start speaking/i);
        fireEvent.click(micButton);

        expect(FakeSpeechRecognition.instances.length).toBe(1);
        const rec = FakeSpeechRecognition.instances[0];

        await act(async () => {
            rec.emitResult('Hello world of voice');
        });

        const textarea = screen.getByPlaceholderText(/Your spoken words will transcribe here automatically/i);
        expect(textarea.value).toBe('Hello world of voice');
    });

    // Scenario 2: Starting a second session prevents results from the first session from updating the transcript
    it('Scenario 2: Starting a second session prevents results from first session from updating transcript', async () => {
        render(<Voice />);

        // Start Session 1
        const micButton = screen.getByTitle(/Click to start speaking/i);
        fireEvent.click(micButton);

        const session1 = FakeSpeechRecognition.instances[0];
        await act(async () => {
            session1.emitResult('Session 1 speech');
        });

        const textarea = screen.getByPlaceholderText(/Your spoken words will transcribe here automatically/i);
        expect(textarea.value).toBe('Session 1 speech');

        // Stop Session 1
        const stopButton = screen.getByTitle(/Click to pause mic/i);
        fireEvent.click(stopButton);

        // Start Session 2
        fireEvent.click(micButton);
        expect(FakeSpeechRecognition.instances.length).toBe(2);
        const session2 = FakeSpeechRecognition.instances[1];

        // Now session 1 late event arrives
        await act(async () => {
            session1.emitResult(' LATE OVERWRITE FROM SESSION 1');
        });

        // The transcript should have reset for session 2 and ignored session 1
        expect(textarea.value).toBe('');

        // Session 2 sends results
        await act(async () => {
            session2.emitResult('Session 2 fresh speech');
        });
        expect(textarea.value).toBe('Session 2 fresh speech');
    });

    // Scenario 3: A delayed onend from an old session cannot mark the new session inactive
    it('Scenario 3: A delayed onend from an old session cannot mark the new session inactive', async () => {
        render(<Voice />);

        const micButton = screen.getByTitle(/Click to start speaking/i);
        fireEvent.click(micButton);

        const session1 = FakeSpeechRecognition.instances[0];

        // Stop session 1 and start session 2
        fireEvent.click(screen.getByTitle(/Click to pause mic/i));
        fireEvent.click(micButton);

        expect(FakeSpeechRecognition.instances.length).toBe(2);

        // Session 1 belatedly fires onend
        await act(async () => {
            session1.emitEnd();
        });

        // Current session must still be listening
        expect(screen.getByText(/Listening \(Speak your question\)\.\.\./i)).toBeDefined();
        expect(screen.queryByTitle(/Click to pause mic/i)).not.toBeNull();
    });

    // Scenario 4: A delayed onerror cannot overwrite the new session's state
    it('Scenario 4: A delayed onerror cannot overwrite the new session state', async () => {
        render(<Voice />);

        const micButton = screen.getByTitle(/Click to start speaking/i);
        fireEvent.click(micButton);

        const session1 = FakeSpeechRecognition.instances[0];

        // Restart into session 2
        fireEvent.click(screen.getByTitle(/Click to pause mic/i));
        fireEvent.click(micButton);

        // Session 1 fires network error
        await act(async () => {
            session1.emitError('network');
        });

        // No error banner should be displayed from session 1, and session 2 stays active
        expect(screen.queryByText(/Speech recognition network error/i)).toBeNull();
        expect(screen.getByText(/Listening \(Speak your question\)\.\.\./i)).toBeDefined();
    });

    // Scenario 5: Rapid stop/start maintains correct active-session state
    it('Scenario 5: Rapid stop/start maintains correct active-session state', async () => {
        render(<Voice />);

        const micButton = screen.getByTitle(/Click to start speaking/i);

        // Rapid clicks: start -> stop -> start
        fireEvent.click(micButton); // Start 1
        fireEvent.click(screen.getByTitle(/Click to pause mic/i)); // Stop 1
        fireEvent.click(micButton); // Start 2

        expect(FakeSpeechRecognition.instances.length).toBe(2);
        const session2 = FakeSpeechRecognition.instances[1];

        await act(async () => {
            session2.emitResult('Rapid click success');
        });

        const textarea = screen.getByPlaceholderText(/Your spoken words will transcribe here automatically/i);
        expect(textarea.value).toBe('Rapid click success');
        expect(screen.getByText(/Listening \(Speak your question\)\.\.\./i)).toBeDefined();
    });

    // Scenario 6: handleAskAi cancellation prevents old recognition callbacks from affecting the next interaction
    it('Scenario 6: handleAskAi cancellation stops listening and isolates the session', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ response: 'Socratic AI feedback' })
        });
        globalThis.fetch = mockFetch;

        render(<Voice />);

        // Start listening and speak
        fireEvent.click(screen.getByTitle(/Click to start speaking/i));
        const session1 = FakeSpeechRecognition.instances[0];

        await act(async () => {
            session1.emitResult('What is polymorphism?');
        });

        // Trigger Ask AI
        const askButton = screen.getByText(/Ask AI Tutor & Listen/i);
        await act(async () => {
            fireEvent.click(askButton);
        });

        // Session 1 should be stopped/aborted
        expect(session1.isAborted || session1.isStopped).toBe(true);

        // Late event from session 1 arrives during or after fetch
        await act(async () => {
            session1.emitResult(' Extra trailing noise');
        });

        const textarea = screen.getByPlaceholderText(/Your spoken words will transcribe here automatically/i);
        expect(textarea.value).toBe('What is polymorphism?');

        // AI response received
        await waitFor(() => {
            expect(screen.getByText('Socratic AI feedback')).toBeDefined();
        });
    });

    // Scenario 7: Component unmount prevents stale callback state updates
    it('Scenario 7: Component unmount cleans up active recognition without error', async () => {
        const { unmount } = render(<Voice />);

        fireEvent.click(screen.getByTitle(/Click to start speaking/i));
        const session1 = FakeSpeechRecognition.instances[0];

        unmount();

        expect(session1.isAborted || session1.isStopped).toBe(true);

        // Emitting after unmount must not throw or cause warning
        expect(() => {
            session1.emitResult('Ghost utterance');
            session1.emitError('network');
            session1.emitEnd();
        }).not.toThrow();
    });

    // Scenario 8: Unsupported SpeechRecognition environments remain safely handled
    it('Scenario 8: Unsupported SpeechRecognition environments display compatibility notice', () => {
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;

        render(<Voice />);

        expect(screen.getByText(/Browser Audio Notice:/i)).toBeDefined();
        const micButton = screen.getByTitle(/Click to start speaking/i);
        expect(micButton.hasAttribute('disabled')).toBe(true);
    });
});
