import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CanvasStudio from '../src/pages/CanvasStudio.jsx';
import Maps from '../src/pages/Maps.jsx';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('API client migrated Maps and Canvas callers', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps Map generation independent when one public diagram request fails', async () => {
        localStorage.setItem('auth_token', 'must-not-be-sent');
        fetch.mockImplementation((url) => {
            if (url === '/api/generate-diagram') {
                return Promise.resolve(jsonResponse({ mermaid_code: 'graph TD; A-->B;' }));
            }
            if (url === '/api/generate-map') {
                return Promise.resolve(jsonResponse({ detail: 'Map service unavailable' }, 503));
            }
            throw new Error('Unexpected API path');
        });
        render(React.createElement(Maps));

        fireEvent.change(screen.getByPlaceholderText(/Enter system\/topic/i), {
            target: { value: 'Distributed systems' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

        expect(await screen.findByRole('button', { name: /Interactive Flowchart/i })).toBeTruthy();
        expect(fetch).toHaveBeenCalledTimes(2);
        for (const [, options] of fetch.mock.calls) {
            expect(options.headers.get('Authorization')).toBeNull();
            expect(JSON.parse(options.body)).toEqual({ topic: 'Distributed systems' });
        }
    }, 10000);

    it('renders a validated Base64 map response when diagram generation fails', async () => {
        const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        fetch.mockImplementation((url) => {
            if (url === '/api/generate-diagram') {
                return Promise.resolve(jsonResponse({ detail: 'Diagram unavailable' }, 503));
            }
            return Promise.resolve(jsonResponse({ map_image: png }));
        });
        render(React.createElement(Maps));

        fireEvent.change(screen.getByPlaceholderText(/Enter system\/topic/i), {
            target: { value: 'Cell biology' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

        const image = await screen.findByAltText('AI Concept Map');
        expect(image.getAttribute('src')).toBe(`data:image/png;base64,${png}`);
    });

    it('loads Canvas and public MCP config, then saves the canvas with optional auth', async () => {
        localStorage.setItem('auth_token', 'canvas-token');
        const canvas = {
            title: 'Test Canvas',
            nodes: [{ id: 'node-1', label: 'Service Node', category: 'service', x: 20, y: 30 }],
            edges: [],
        };
        fetch.mockImplementation((url) => {
            if (url === '/api/canvas/generate') {
                return Promise.resolve(jsonResponse({ canvas, execution_time_ms: 12 }));
            }
            if (url === '/api/mcp/config') {
                return Promise.resolve(jsonResponse({ endpoint: '/api/mcp', server_status: 'online' }));
            }
            if (url === '/api/library') return Promise.resolve(new Response(null, { status: 201 }));
            throw new Error('Unexpected API path');
        });
        render(React.createElement(CanvasStudio));

        expect(await screen.findByText('Service Node')).toBeTruthy();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(2);
        });
        const initialCanvasCall = fetch.mock.calls.find(([url]) => url === '/api/canvas/generate');
        const mcpCall = fetch.mock.calls.find(([url]) => url === '/api/mcp/config');
        expect(initialCanvasCall[1].headers.get('Authorization')).toBe('Bearer canvas-token');
        expect(mcpCall[1].headers.get('Authorization')).toBeNull();

        fireEvent.click(screen.getByTitle('Save to Study Library'));
        await waitFor(() => {
            expect(screen.getByText('Saved!')).toBeTruthy();
        });
        const saveCall = fetch.mock.calls.find(([url]) => url === '/api/library');
        expect(saveCall[1].headers.get('Authorization')).toBe('Bearer canvas-token');
        expect(JSON.parse(saveCall[1].body)).toMatchObject({
            material_type: 'canvas_diagram',
            title: 'Test Canvas',
            topic: 'Distributed Microservices with Event Sourcing',
        });
    });
});
