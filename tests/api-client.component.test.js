import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../src/config/apiClient.js';

describe('API client contract', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('VITE_API_BASE_URL', '');
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('sends public JSON without reading or attaching a stored bearer token', async () => {
        const getItem = vi.fn(() => {
            throw new Error('Public requests must not access the auth store.');
        });
        vi.stubGlobal('localStorage', { getItem });
        fetch.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

        await expect(apiRequest('/api/public', { auth: 'none' })).resolves.toEqual({ ok: true });

        expect(getItem).not.toHaveBeenCalled();
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
    });

    it('adds the bearer token for optional authentication when present', async () => {
        localStorage.setItem('auth_token', 'test-token');
        fetch.mockResolvedValue(new Response('{}', { status: 200 }));

        await apiRequest('/api/optional');

        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('omits optional authentication when no token is present', async () => {
        fetch.mockResolvedValue(new Response('{}', { status: 200 }));

        await apiRequest('/api/optional');

        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
    });

    it('rejects required authentication before making a request when the token is missing', async () => {
        await expect(apiRequest('/api/private', { auth: 'required' })).rejects.toMatchObject({
            name: 'ApiError',
            kind: 'auth',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('surfaces local storage failures instead of silently sending an anonymous request', async () => {
        const getItem = vi.fn(() => {
            throw new Error('secret token storage details');
        });
        vi.stubGlobal('localStorage', { getItem });

        await expect(apiRequest('/api/private', { auth: 'required' })).rejects.toMatchObject({
            name: 'ApiError',
            kind: 'storage',
        });
        expect(getItem).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('serializes JSON once and sets the content type', async () => {
        fetch.mockResolvedValue(new Response('{"saved":true}', { status: 200 }));

        await apiRequest('/api/items', { method: 'POST', json: { title: 'Review' } });

        expect(fetch.mock.calls[0][1].method).toBe('POST');
        expect(fetch.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
        expect(fetch.mock.calls[0][1].body).toBe('{"title":"Review"}');
    });

    it('returns null for an empty JSON response', async () => {
        fetch.mockResolvedValue(new Response(null, { status: 204 }));

        await expect(apiRequest('/api/items')).resolves.toBeNull();
    });

    it('reports malformed successful JSON explicitly', async () => {
        fetch.mockResolvedValue(new Response('{bad json', { status: 200 }));

        await expect(apiRequest('/api/items')).rejects.toMatchObject({
            name: 'ApiError',
            kind: 'parse',
        });
    });

    it('normalizes HTTP errors and uses safe JSON detail when available', async () => {
        fetch.mockResolvedValue(new Response('{"detail":"Request denied"}', { status: 403 }));

        await expect(apiRequest('/api/private')).rejects.toMatchObject({
            name: 'ApiError',
            kind: 'http',
            status: 403,
            message: 'Request denied',
        });
    });

    it('formats structured validation details without exposing object serialization', async () => {
        fetch.mockResolvedValue(new Response(JSON.stringify({
            detail: [
                { loc: ['body', 'email'], msg: 'Invalid email address' },
                { loc: ['body', 'password'], msg: 'Password is too short' },
            ],
        }), { status: 422 }));

        await expect(apiRequest('/api/auth/register')).rejects.toMatchObject({
            kind: 'http',
            status: 422,
            message: 'Invalid email address, Password is too short',
            hasDetail: true,
        });
    });

    it('does not expose malformed HTTP error bodies in normalized errors', async () => {
        fetch.mockResolvedValue(new Response('user password=secret', { status: 500 }));

        const request = apiRequest('/api/failure');
        await expect(request).rejects.toMatchObject({ kind: 'http', status: 500 });
        await expect(request).rejects.not.toThrow('secret');
    });

    it('normalizes network errors without exposing the original error text', async () => {
        fetch.mockRejectedValue(new Error('failed for bearer test-token'));

        await expect(apiRequest('/api/failure')).rejects.toMatchObject({
            kind: 'network',
            message: 'A network error interrupted the request.',
        });
    });

    it('distinguishes request timeout from caller cancellation', async () => {
        vi.useFakeTimers();
        fetch.mockImplementation((_, options) => new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }));

        const timedRequest = expect(apiRequest('/api/slow', { timeoutMs: 20 })).rejects.toMatchObject({
            kind: 'timeout',
        });
        await vi.advanceTimersByTimeAsync(20);
        await timedRequest;

        const controller = new AbortController();
        const cancelledRequest = expect(apiRequest('/api/slow', { signal: controller.signal })).rejects.toMatchObject({
            kind: 'aborted',
        });
        controller.abort();
        await cancelledRequest;
    });

    it('normalizes timeout cancellation after a streaming response has started', async () => {
        vi.useFakeTimers();
        let streamController;
        const body = new ReadableStream({
            start(controller) {
                streamController = controller;
            },
        });
        fetch.mockResolvedValue(new Response(body, { status: 200 }));

        const response = await apiRequest('/api/stream', {
            responseType: 'stream',
            timeoutMs: 20,
        });
        const reader = response.body.getReader();
        const nextChunk = expect(reader.read()).rejects.toMatchObject({ kind: 'timeout' });
        await vi.advanceTimersByTimeAsync(20);
        streamController.error(new DOMException('Aborted', 'AbortError'));

        await nextChunk;
    });

    it('passes FormData through without overriding the multipart boundary', async () => {
        const formData = new FormData();
        formData.append('title', 'Study notes');
        fetch.mockResolvedValue(new Response('{}', { status: 200 }));

        await apiRequest('/api/sources', {
            method: 'POST',
            formData,
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        expect(fetch.mock.calls[0][1].body).toBe(formData);
        expect(fetch.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
    });

    it('returns binary responses as Blob without JSON parsing', async () => {
        fetch.mockResolvedValue(new Response(new Blob(['image']), { status: 200 }));

        const result = await apiRequest('/api/export', { responseType: 'blob' });

        expect(result).toBeInstanceOf(Blob);
        await expect(result.text()).resolves.toBe('image');
    });

    it('returns a stream before EOF and propagates stream disconnection', async () => {
        let streamController;
        const body = new ReadableStream({
            start(controller) {
                streamController = controller;
                controller.enqueue(new TextEncoder().encode('data: first\n\n'));
            },
        });
        fetch.mockResolvedValue(new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        }));

        const response = await apiRequest('/api/chat/stream', { responseType: 'stream' });
        const reader = response.body.getReader();
        const firstChunk = await reader.read();
        expect(new TextDecoder().decode(firstChunk.value)).toContain('data: first');

        streamController.error(new Error('stream disconnected'));
        await expect(reader.read()).rejects.toThrow('stream disconnected');
    });

    it('uses the configured API origin without allowing arbitrary caller URLs', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
        fetch.mockResolvedValue(new Response('{}', { status: 200 }));

        await apiRequest('/api/data');

        expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/api/data');
        await expect(apiRequest('https://attacker.example/api/data')).rejects.toBeInstanceOf(ApiError);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
