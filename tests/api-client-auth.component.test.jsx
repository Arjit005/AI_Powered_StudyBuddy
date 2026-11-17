import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../src/pages/LoginPage.jsx';
import App from '../src/App.jsx';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('API client migrated authentication callers', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        window.history.replaceState({}, '', '/');
    });

    it('sends login as a public JSON request and persists the returned session', async () => {
        localStorage.setItem('auth_token', 'previous-session-token');
        fetch.mockResolvedValue(jsonResponse({
            access_token: 'login-token',
            user: { id: 21, username: 'student', email: 'student@example.com' },
        }));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(LoginPage)
        ));

        fireEvent.change(screen.getByPlaceholderText('Enter your email or username'), {
            target: { value: 'student@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
            target: { value: 'correct horse battery staple' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            expect(localStorage.getItem('auth_token')).toBe('login-token');
        });
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toBe('/api/auth/login');
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            email: 'student@example.com',
            password: 'correct horse battery staple',
        });
        expect(localStorage.getItem('isAuthenticated')).toBe('true');
        expect(JSON.parse(localStorage.getItem('user'))).toEqual({
            id: 21,
            username: 'student',
            email: 'student@example.com',
        });
    });

    it('retains the login lockout response for HTTP 429', async () => {
        fetch.mockResolvedValue(jsonResponse({ detail: 'Too many attempts' }, 429));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(LoginPage)
        ));

        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        expect(await screen.findByText('Too many attempts')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Sign In/i }).disabled).toBe(true);
    });

    it('rejects malformed login profiles before persisting any authentication state', async () => {
        fetch.mockResolvedValue(jsonResponse({
            access_token: 'login-token',
            user: { id: 21, username: 'student' },
        }));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(LoginPage)
        ));

        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        expect(await screen.findByText('Incomplete user profile received. Please try again.')).toBeTruthy();
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
    });

    it('rolls back a partially written login session when storage rejects a write', async () => {
        const originalSetItem = window.localStorage.setItem;
        Object.defineProperty(window.localStorage, 'setItem', {
            value: (key, value) => {
                if (key === 'user') throw new Error('Storage exception details');
                return originalSetItem.call(window.localStorage, key, value);
            },
            configurable: true,
            writable: true,
        });
        fetch.mockResolvedValue(jsonResponse({
            access_token: 'login-token',
            user: { id: 21, username: 'student', email: 'student@example.com' },
        }));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(LoginPage)
        ));

        try {
            fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

            expect(await screen.findByText(/Unable to save login session/i)).toBeTruthy();
            expect(localStorage.getItem('auth_token')).toBeNull();
            expect(localStorage.getItem('user')).toBeNull();
            expect(localStorage.getItem('isAuthenticated')).toBeNull();
        } finally {
            Object.defineProperty(window.localStorage, 'setItem', {
                value: originalSetItem,
                configurable: true,
                writable: true,
            });
        }
    });

    it('verifies a protected session with required bearer auth', async () => {
        const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
        localStorage.setItem('auth_token', token);
        window.history.replaceState({}, '', '/chat');
        fetch.mockImplementation((url) => {
            if (url === '/api/auth/me') {
                return Promise.resolve(jsonResponse({ id: 8, username: 'student' }));
            }
            if (url === '/api/conversations' || url === '/api/chat') {
                return Promise.resolve(jsonResponse([]));
            }
            throw new Error(`Unexpected API path: ${url}`);
        });

        render(React.createElement(App));

        expect(await screen.findByText('AI Study Companion')).toBeTruthy();
        const verificationCall = fetch.mock.calls.find(([url]) => url === '/api/auth/me');
        expect(verificationCall[1].headers.get('Authorization')).toBe(`Bearer ${token}`);
    });

    it('clears only the rejected session when protected verification returns 401', async () => {
        const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify({ id: 8 }));
        window.history.replaceState({}, '', '/chat');
        fetch.mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401));

        render(React.createElement(App));

        expect(await screen.findByText('Welcome Back')).toBeTruthy();
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
    });

    it('keeps the protected route retry screen for network failures', async () => {
        const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
        localStorage.setItem('auth_token', token);
        window.history.replaceState({}, '', '/chat');
        fetch.mockRejectedValue(new Error('private network detail'));

        render(React.createElement(App));

        expect(await screen.findByText('Connection Interrupted')).toBeTruthy();
        expect(screen.getByText(/check your connection and try again/i)).toBeTruthy();
        expect(localStorage.getItem('auth_token')).toBe(token);
    });
});
