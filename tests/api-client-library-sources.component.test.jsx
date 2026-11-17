import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '../src/pages/Library.jsx';
import Sources from '../src/pages/Sources.jsx';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('API client migrated Library and Sources callers', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('confirm', vi.fn(() => true));
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('preserves Library query encoding, detail loading, and status-only mutations', async () => {
        localStorage.setItem('auth_token', 'library-token');
        const item = {
            id: 12,
            title: 'Saved summary',
            material_type: 'summary',
            topic: 'Quantum systems',
            content_json: 'preview',
            is_favorite: false,
        };
        fetch.mockImplementation((url, options) => {
            if (url.startsWith('/api/library?')) return Promise.resolve(jsonResponse([item]));
            if (url === '/api/library') return Promise.resolve(jsonResponse([item]));
            if (url === '/api/library/12' && options.method === 'GET') {
                return Promise.resolve(jsonResponse({ ...item, content_json: 'Full saved content' }));
            }
            if (url === '/api/library/12/favorite' || url === '/api/library/12') {
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            throw new Error(`Unexpected API path: ${url}`);
        });
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(Library)
        ));

        expect(await screen.findByText('Saved summary')).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText('Search saved materials...'), {
            target: { value: 'Quantum & systems' },
        });
        await waitFor(() => {
            expect(fetch.mock.calls.some(([url]) => url === '/api/library?search=Quantum+%26+systems')).toBe(true);
        });

        fireEvent.click(screen.getByText('Saved summary'));
        expect(await screen.findByText('Full saved content')).toBeTruthy();
        const detailCall = fetch.mock.calls.find(([url, options]) =>
            url === '/api/library/12' && options.method === 'GET');
        expect(detailCall[1].headers.get('Authorization')).toBe('Bearer library-token');

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        fireEvent.click(screen.getByTitle('Favorite'));
        await waitFor(() => {
            expect(fetch.mock.calls.some(([url]) => url === '/api/library/12/favorite')).toBe(true);
        });
        fireEvent.click(screen.getByTitle('Delete'));
        await waitFor(() => {
            expect(screen.queryByText('Saved summary')).toBeNull();
        });

        const favoriteCall = fetch.mock.calls.find(([url]) => url === '/api/library/12/favorite');
        const deleteCall = fetch.mock.calls.find(([url, options]) =>
            url === '/api/library/12' && options.method === 'DELETE');
        expect(favoriteCall[1].method).toBe('PUT');
        expect(deleteCall[1].method).toBe('DELETE');
        expect(favoriteCall[1].headers.get('Authorization')).toBe('Bearer library-token');
        expect(deleteCall[1].headers.get('Authorization')).toBe('Bearer library-token');
        expect(confirm).toHaveBeenCalledOnce();
    });

    it('preserves Sources guide, reindex, delete, and multipart upload behavior', async () => {
        localStorage.setItem('auth_token', 'sources-token');
        const source = {
            id: 7,
            title: 'Lecture notes',
            source_type: 'text',
            origin: 'user upload',
            summary: 'A source summary',
        };
        let listRequests = 0;
        fetch.mockImplementation((url, options) => {
            if (url === '/api/sources' && options.method === 'POST') {
                return Promise.resolve(new Response(null, { status: 201 }));
            }
            if (url === '/api/sources' && options.method === 'GET') {
                listRequests += 1;
                return Promise.resolve(jsonResponse(listRequests === 1 ? [source] : []));
            }
            if (url === '/api/sources/7/guide') {
                return Promise.resolve(jsonResponse({
                    summary: 'Guide summary',
                    key_topics: ['Concurrency'],
                    suggested_questions: ['What is a race condition?'],
                }));
            }
            if (url === '/api/sources/7/reindex' || url === '/api/sources/7') {
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            throw new Error(`Unexpected API path: ${url}`);
        });
        render(React.createElement(Sources));

        expect(await screen.findByText('Lecture notes')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Source Guide' }));
        expect(await screen.findByText('Guide summary')).toBeTruthy();
        expect(fetch.mock.calls.find(([url]) => url === '/api/sources/7/guide')[1].headers.get('Authorization'))
            .toBe('Bearer sources-token');
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        fireEvent.click(screen.getByTitle('Refresh & Re-index Material'));
        await waitFor(() => {
            expect(fetch.mock.calls.some(([url]) => url === '/api/sources/7/reindex')).toBe(true);
        });
        fireEvent.click(screen.getByTitle('Delete Source'));
        await waitFor(() => {
            expect(screen.queryByText('Lecture notes')).toBeNull();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Add Source' }));
        fireEvent.click(screen.getByRole('button', { name: /Paste Text \/ Notes/ }));
        fireEvent.change(screen.getByPlaceholderText('e.g., Quantum Computing Chapter 4'), {
            target: { value: 'Concurrency notes' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Paste comprehensive notes/), {
            target: { value: 'Concurrency and synchronization content' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Add Material & Create Study Guide/ }));

        await waitFor(() => {
            expect(fetch.mock.calls.some(([url, options]) =>
                url === '/api/sources' && options.method === 'POST')).toBe(true);
        });
        const uploadCall = fetch.mock.calls.find(([url, options]) =>
            url === '/api/sources' && options.method === 'POST');
        expect(uploadCall[1].headers.get('Authorization')).toBe('Bearer sources-token');
        expect(uploadCall[1].headers.get('Content-Type')).toBeNull();
        expect(uploadCall[1].body).toBeInstanceOf(FormData);
        expect(uploadCall[1].body.get('title')).toBe('Concurrency notes');
        expect(uploadCall[1].body.get('source_type')).toBe('text');
        expect(uploadCall[1].body.get('content')).toBe('Concurrency and synchronization content');

        const reindexCall = fetch.mock.calls.find(([url]) => url === '/api/sources/7/reindex');
        const deleteCall = fetch.mock.calls.find(([url]) => url === '/api/sources/7');
        expect(reindexCall[1].method).toBe('POST');
        expect(deleteCall[1].method).toBe('DELETE');
        expect(reindexCall[1].headers.get('Authorization')).toBe('Bearer sources-token');
        expect(deleteCall[1].headers.get('Authorization')).toBe('Bearer sources-token');
    });
});
