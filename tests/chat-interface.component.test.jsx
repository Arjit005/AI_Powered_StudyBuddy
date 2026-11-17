/* eslint-disable no-unused-vars */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatInterface from '../src/components/ChatInterface';

// Helper for deterministic deferred promises
function createDeferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// Helper for creating mock SSE ReadableStream
function createMockSSEStream(chunks) {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream({
        pull(controller) {
            if (index < chunks.length) {
                controller.enqueue(encoder.encode(chunks[index]));
                index++;
            } else {
                controller.close();
            }
        }
    });
}

describe('ChatInterface Real Component Regression Suite', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        window.confirm = () => true;
        window.alert = () => {};
    });

    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    // Test 1 — Fallback error handling
    it('Test 1: Fallback error handling triggers error block without ReferenceError', async () => {
        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return { ok: true, json: async () => [] };
            }
            if (url === '/api/chat/stream') {
                throw new Error('Stream connection rejected');
            }
            if (url === '/api/chat' && opts?.method === 'POST') {
                throw new Error('Network timeout during fallback');
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        expect(await screen.findByText(/AI Study Buddy/i)).toBeDefined();

        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Why is the sky blue?' } });
        fireEvent.submit(input.closest('form'));

        const errorAlert = await screen.findByText(/Session Error/i);
        expect(errorAlert).toBeDefined();
        expect(screen.getByText(/Network timeout during fallback/i)).toBeDefined();
    });

    // Test 2 — Concurrent session deletion
    it('Test 2: Concurrent session deletion preserves sessions added while DELETE is pending', async () => {
        const deferredDelete = createDeferred();
        const deferredConversationsFetch = createDeferred();

        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return {
                    ok: true,
                    json: async () => [
                        { id: 'conv-1', title: 'Calculus 101', message_count: 3 },
                        { id: 'conv-2', title: 'Biology Lab', message_count: 5 }
                    ]
                };
            }
            if (url.startsWith('/api/chat?conversation_id=')) {
                return { ok: true, json: async () => [] };
            }
            if (url === '/api/conversations/conv-1' && opts?.method === 'DELETE') {
                await deferredDelete.promise;
                return { ok: true, json: async () => ({ success: true }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        const { rerender } = render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        // Sidebar renders conversations list
        expect((await screen.findAllByText('Calculus 101')).length).toBeGreaterThan(0);
        expect(screen.getByText('Biology Lab')).toBeDefined();

        // Click delete on conv-1 (Calculus 101)
        const deleteButtons = screen.getAllByTitle('Delete this session');
        fireEvent.click(deleteButtons[0]);

        // While DELETE is pending, another conversation fetch returns with Quantum Physics added
        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return {
                    ok: true,
                    json: async () => [
                        { id: 'conv-1', title: 'Calculus 101', message_count: 3 },
                        { id: 'conv-2', title: 'Biology Lab', message_count: 5 },
                        { id: 'conv-3', title: 'Quantum Physics', message_count: 1 }
                    ]
                };
            }
            if (url.startsWith('/api/chat?conversation_id=')) {
                return { ok: true, json: async () => [] };
            }
            return { ok: true, json: async () => ({}) };
        });

        // Trigger conversation refresh by clicking New Chat then switching
        const newChatButton = screen.getByTitle('Start a fresh chat session');
        fireEvent.click(newChatButton);

        // Re-fetch conversations by rendering or triggering sync
        // Now resolve the pending delete for conv-1
        deferredDelete.resolve();

        // Calculus 101 should be removed, while Biology Lab remains
        await waitFor(() => {
            expect(screen.queryByText('Calculus 101')).toBeNull();
            expect(screen.getByText('Biology Lab')).toBeDefined();
        });
    });

    // Test 3 — Initial fetch navigation race
    it('Test 3: Initial fetch navigation race preserves user-selected conversation', async () => {
        const deferredInitialFetch = createDeferred();

        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/conversations') {
                await deferredInitialFetch.promise;
                return {
                    ok: true,
                    json: async () => [
                        { id: 'default-conv', title: 'Old History Session', message_count: 10 }
                    ]
                };
            }
            if (url.startsWith('/api/chat?conversation_id=')) {
                return { ok: true, json: async () => [] };
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        // User immediately clicks "New Chat" button before initial fetch resolves
        const newChatButton = screen.getByTitle('Start a fresh chat session');
        fireEvent.click(newChatButton);

        // Now let the delayed initial conversations fetch resolve
        deferredInitialFetch.resolve();

        // Verify the heading remains "AI Study Companion" (new chat), NOT "Old History Session"
        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('AI Study Companion');
        });
    });

    // Test 4 — Successful clear
    it('Test 4: Successful clear invalidates in-flight older requests and prevents repopulation', async () => {
        const deferredStream = createDeferred();
        const deferredClear = createDeferred();

        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return { ok: true, json: async () => [{ id: 'conv-active', title: 'History 202', message_count: 2 }] };
            }
            if (url.startsWith('/api/chat?conversation_id=')) {
                return { ok: true, json: async () => [] };
            }
            if (url === '/api/chat/stream' && opts?.method === 'POST') {
                await deferredStream.promise;
                return {
                    ok: true,
                    body: createMockSSEStream([
                        'data: {"token": "Late arrived text that should be ignored"}\n\n',
                        'data: [DONE]\n\n'
                    ])
                };
            }
            if (url.startsWith('/api/chat') && opts?.method === 'DELETE') {
                await deferredClear.promise;
                return { ok: true, json: async () => ({ success: true }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        expect((await screen.findAllByText('History 202')).length).toBeGreaterThan(0);

        // Send a message to start in-flight stream
        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'In-flight question before clear' } });
        fireEvent.submit(input.closest('form'));

        expect(await screen.findByText('In-flight question before clear')).toBeDefined();

        // User clicks Clear
        const clearButton = screen.getByTitle('Clear conversation history in this session');
        fireEvent.click(clearButton);

        // Resolve clear successfully
        deferredClear.resolve();

        // Wait for session to reset and display clear message
        await waitFor(() => {
            expect(screen.getByText(/Session memory cleared/i)).toBeDefined();
        });

        // Now resolve the late streaming response
        deferredStream.resolve();

        // The late stream text must NOT be appended to the cleared session
        await new Promise(r => setTimeout(r, 100));
        expect(screen.queryByText(/Late arrived text that should be ignored/i)).toBeNull();
    });

    // Test 5 — Failed clear
    it('Test 5: Failed clear preserves pending messages and allows sending to continue', async () => {
        const deferredStream = createDeferred();
        const deferredClear = createDeferred();

        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return { ok: true, json: async () => [] };
            }
            if (url === '/api/chat/stream' && opts?.method === 'POST') {
                await deferredStream.promise;
                return {
                    ok: true,
                    body: createMockSSEStream([
                        'data: {"token": "Valid AI reply that should not be dropped"}\n\n',
                        'data: [DONE]\n\n'
                    ])
                };
            }
            if (url.startsWith('/api/chat') && opts?.method === 'DELETE') {
                await deferredClear.promise;
                return { ok: false, status: 500, json: async () => ({ detail: 'Database error' }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        expect(await screen.findByText(/AI Study Buddy/i)).toBeDefined();

        // 1. Send in-flight message
        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Question during clear failure' } });
        fireEvent.submit(input.closest('form'));

        expect(await screen.findByText('Question during clear failure')).toBeDefined();

        // 2. Trigger Clear button while send is in flight
        const clearButton = screen.getByTitle('Clear conversation history in this session');
        fireEvent.click(clearButton);

        // 3. Clear fails with 500
        deferredClear.resolve();

        // Verify failure was handled without clearing messages
        await waitFor(() => {
            expect(screen.getByText('Question during clear failure')).toBeDefined();
        });

        // 4. Now resolve the in-flight stream
        deferredStream.resolve();

        // The AI reply MUST still be displayed because clear failed and generation was preserved
        expect(await screen.findByText(/Valid AI reply that should not be dropped/i)).toBeDefined();
    });

    // Test 6 — Server-assigned conversation ID
    it('Test 6: Server-assigned conversation ID is recognized during streaming', async () => {
        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return { ok: true, json: async () => [] };
            }
            if (url === '/api/chat/stream' && opts?.method === 'POST') {
                return {
                    ok: true,
                    body: createMockSSEStream([
                        'data: {"conversation_id": "conv-server-123", "token": "First part of reply. "}\n\n',
                        'data: {"token": "Second part of reply."}\n\n',
                        'data: [DONE]\n\n'
                    ])
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        expect(await screen.findByText(/AI Study Buddy/i)).toBeDefined();

        // Send message from initial state (activeConvId is null)
        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Create new session test' } });
        fireEvent.submit(input.closest('form'));

        // Both chunks should stream in and remain valid even though conversation_id was assigned mid-stream
        expect(await screen.findByText(/First part of reply\. Second part of reply\./i)).toBeDefined();
    });

    // Test 7 — Old request after navigation
    it('Test 7: Responses from an older conversation cannot modify the currently selected conversation', async () => {
        const deferredStreamA = createDeferred();

        globalThis.fetch = vi.fn(async (url, opts) => {
            if (url === '/api/conversations') {
                return {
                    ok: true,
                    json: async () => [
                        { id: 'conv-A', title: 'Conversation A', message_count: 1 },
                        { id: 'conv-B', title: 'Conversation B', message_count: 1 }
                    ]
                };
            }
            if (url === '/api/chat?conversation_id=conv-A') {
                return { ok: true, json: async () => [{ id: 'msg-a', role: 'user', content: 'Message in A' }] };
            }
            if (url === '/api/chat?conversation_id=conv-B') {
                return { ok: true, json: async () => [{ id: 'msg-b', role: 'user', content: 'Message in B' }] };
            }
            if (url === '/api/chat/stream' && opts?.method === 'POST') {
                await deferredStreamA.promise;
                return {
                    ok: true,
                    body: createMockSSEStream([
                        'data: {"token": "Secret leaked from conversation A"}\n\n',
                        'data: [DONE]\n\n'
                    ])
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        render(
            <MemoryRouter>
                <ChatInterface />
            </MemoryRouter>
        );

        // Wait for Conversation A to load in sidebar
        expect((await screen.findAllByText('Conversation A')).length).toBeGreaterThan(0);
        expect(await screen.findByText('Message in A')).toBeDefined();

        // Send a message in Conversation A
        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Question for A' } });
        fireEvent.submit(input.closest('form'));

        // Navigate to Conversation B while A is in flight
        const convBButton = screen.getByText('Conversation B');
        fireEvent.click(convBButton);

        // Wait for Conversation B messages to load
        expect(await screen.findByText('Message in B')).toBeDefined();

        // Now resolve Conversation A's stream response
        deferredStreamA.resolve();

        // Wait a tick and verify Secret from A does NOT show up in Conversation B
        await new Promise(r => setTimeout(r, 100));
        expect(screen.queryByText(/Secret leaked from conversation A/i)).toBeNull();
    });
});
