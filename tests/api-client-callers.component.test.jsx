import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Progress from '../src/pages/Progress.jsx';

const progressData = { study_hours: 3.5, quizzes_taken: 4, streak_days: 2 };

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('API client migrated analytics callers', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('preserves independent analytics response handling and requires auth for the dashboard', async () => {
        localStorage.setItem('auth_token', 'analytics-token');
        fetch.mockImplementation((url) => {
            switch (new URL(url, window.location.origin).pathname) {
                case '/api/progress':
                    return Promise.resolve(jsonResponse(progressData));
                case '/api/analytics/activity-heatmap':
                    return Promise.resolve(jsonResponse({ days: [] }));
                case '/api/analytics/dashboard':
                    return Promise.resolve(jsonResponse({ chart: 'cG5n' }));
                case '/api/sessions/history':
                    return Promise.resolve(jsonResponse([{ id: 8, activity_type: 'quiz', duration_seconds: 90 }]));
                default:
                    throw new Error('Unexpected API path');
            }
        });

        render(React.createElement(Progress));

        expect(await screen.findByText('3.5')).toBeTruthy();
        expect(await screen.findByText('4')).toBeTruthy();
        await waitFor(() => {
            expect(document.querySelector('img[alt="Study Activity Analytics"]')).not.toBeNull();
        });
        expect(fetch).toHaveBeenCalledTimes(4);
        const dashboardCall = fetch.mock.calls.find(([url]) => url === '/api/analytics/dashboard');
        expect(dashboardCall[1].headers.get('Authorization')).toBe('Bearer analytics-token');
        expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
            '/api/analytics/activity-heatmap',
            '/api/analytics/dashboard',
            '/api/progress',
            '/api/sessions/history',
        ]);
    });

    it('retains partial analytics results and displays a warning when one request fails', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/analytics/activity-heatmap') {
                return Promise.reject(new Error('offline'));
            }
            if (url === '/api/progress') return Promise.resolve(jsonResponse(progressData));
            if (url === '/api/analytics/dashboard') return Promise.resolve(jsonResponse({ chart: null }));
            return Promise.resolve(jsonResponse([]));
        });

        render(React.createElement(Progress));

        expect(await screen.findByText('3.5')).toBeTruthy();
        expect(await screen.findByText(/Some analytics modules were temporarily unavailable/i)).toBeTruthy();
    });

    it('does not send an unauthenticated dashboard request while optional analytics remain available', async () => {
        fetch.mockImplementation((url) => {
            if (url === '/api/progress') return Promise.resolve(jsonResponse(progressData));
            if (url === '/api/analytics/activity-heatmap') return Promise.resolve(jsonResponse({ days: [] }));
            if (url === '/api/sessions/history') return Promise.resolve(jsonResponse([]));
            throw new Error(`Unexpected unauthenticated request: ${url}`);
        });

        render(React.createElement(Progress));

        expect(await screen.findByText('3.5')).toBeTruthy();
        expect(await screen.findByText(/Some analytics modules were temporarily unavailable/i)).toBeTruthy();
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls.some(([url]) => url === '/api/analytics/dashboard')).toBe(false);
    });

    it('resets progress via a status-only DELETE and reloads analytics on success', async () => {
        localStorage.setItem('auth_token', 'analytics-token');
        fetch.mockImplementation((url, options) => {
            if (url === '/api/progress' && options.method === 'DELETE') {
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            if (url === '/api/progress') return Promise.resolve(jsonResponse(progressData));
            if (url === '/api/analytics/activity-heatmap') return Promise.resolve(jsonResponse({ days: [] }));
            if (url === '/api/analytics/dashboard') return Promise.resolve(jsonResponse({ chart: null }));
            return Promise.resolve(jsonResponse([]));
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(React.createElement(Progress));
        expect(await screen.findByText('3.5')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Reset Data' }));

        await waitFor(() => {
            expect(fetch.mock.calls.some(([url, options]) => url === '/api/progress' && options.method === 'DELETE')).toBe(true);
            expect(fetch).toHaveBeenCalledTimes(9);
        });
        expect(fetch.mock.calls.find(([url, options]) => url === '/api/progress' && options.method === 'DELETE')[1]
            .headers.get('Authorization')).toBe('Bearer analytics-token');
    });
});
