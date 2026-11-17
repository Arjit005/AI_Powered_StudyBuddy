import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../src/pages/SignupPage';
import * as firebaseAuth from '../src/firebase';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

describe('SignupPage Real Component Regression Suite', () => {
    let originalFetch;
    let originalStorageSetItem;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        originalStorageSetItem = window.Storage.prototype.setItem;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        window.Storage.prototype.setItem = originalStorageSetItem;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    // Helper to fill the signup form with valid inputs fulfilling all 5 criteria
    const fillValidForm = () => {
        fireEvent.change(screen.getByPlaceholderText('e.g. arjit_dev'), { target: { value: 'alice_smith' } });
        fireEvent.change(screen.getByPlaceholderText('student@example.com'), { target: { value: 'alice@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Enter secure password'), { target: { value: 'StrongP@ss1' } });
        fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'StrongP@ss1' } });
    };

    // Scenario 1: Valid email signup persists a valid session
    it('Scenario 1: Valid email signup persists a valid session', async () => {
        localStorage.setItem('auth_token', 'previous-session-token');
        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    access_token: 'valid_jwt_token_123',
                    token_type: 'bearer',
                    user: { id: 42, username: 'alice_smith', email: 'alice@example.com' }
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        await waitFor(() => {
            expect(screen.getByText('Account Created!')).toBeDefined();
        });

        expect(localStorage.getItem('auth_token')).toBe('valid_jwt_token_123');
        expect(localStorage.getItem('isAuthenticated')).toBe('true');
        expect(JSON.parse(localStorage.getItem('user'))).toEqual({
            id: 42,
            username: 'alice_smith',
            email: 'alice@example.com'
        });
        expect(globalThis.fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
        expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({
            username: 'alice_smith',
            email: 'alice@example.com',
            password: 'StrongP@ss1',
        });
    });

    // Scenario 2: Valid Google signup persists a valid session
    it('Scenario 2: Valid Google signup persists a valid session', async () => {
        vi.spyOn(firebaseAuth, 'signInWithGoogle').mockResolvedValue({ idToken: 'google_id_token_xyz' });

        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/google') {
                return jsonResponse({
                    access_token: 'google_jwt_token_999',
                    token_type: 'bearer',
                    user: { id: 77, username: 'google_user', email: 'google@example.com' }
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: /Sign up with Google/i }));

        await waitFor(() => {
            expect(localStorage.getItem('auth_token')).toBe('google_jwt_token_999');
            expect(localStorage.getItem('isAuthenticated')).toBe('true');
            expect(JSON.parse(localStorage.getItem('user'))).toEqual({
                id: 77,
                username: 'google_user',
                email: 'google@example.com'
            });
        });
    });

    // Scenario 3: Missing or non-string access token is rejected
    it('Scenario 3: Missing or non-string access token is rejected', async () => {
        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    access_token: '', // empty token
                    user: { id: 1, username: 'user1', email: 'u1@example.com' }
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        expect(await screen.findByText(/Invalid authentication token received/i)).toBeDefined();
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
    });

    // Scenario 4: Malformed user objects are rejected
    it('Scenario 4: Malformed user objects are rejected', async () => {
        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    access_token: 'valid_token_abc',
                    user: 'string_not_an_object' // invalid primitive user
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        expect(await screen.findByText(/Invalid user profile received/i)).toBeDefined();
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
    });

    // Scenario 5: setItem() failure cannot produce a falsely authenticated state
    it('Scenario 5: setItem() failure cannot produce a falsely authenticated state', async () => {
        const originalSetItem = window.localStorage.setItem;
        Object.defineProperty(window.localStorage, 'setItem', {
            value: (key, val) => {
                if (key === 'user') {
                    throw new Error('QuotaExceededError: LocalStorage is full');
                }
                return originalSetItem.call(window.localStorage, key, val);
            },
            configurable: true,
            writable: true
        });

        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    access_token: 'valid_token_xyz',
                    user: { id: 5, username: 'alice', email: 'a@example.com' }
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        expect(await screen.findByText(/Unable to save login session/i)).toBeDefined();
        // Crucial invariant: isAuthenticated must NOT be true
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
        expect(localStorage.getItem('auth_token')).toBeNull();

        Object.defineProperty(window.localStorage, 'setItem', {
            value: originalSetItem,
            configurable: true,
            writable: true
        });
    });

    // Scenario 6: Partial storage failure triggers safe cleanup
    it('Scenario 6: Partial storage failure triggers safe cleanup and unauthenticated state', async () => {
        let setItemCallCount = 0;
        const originalSetItem = window.localStorage.setItem;
        Object.defineProperty(window.localStorage, 'setItem', {
            value: (key, val) => {
                setItemCallCount++;
                if (setItemCallCount === 2) {
                    // Fail on the second write (user)
                    throw new Error('Disk write error');
                }
                return originalSetItem.call(window.localStorage, key, val);
            },
            configurable: true,
            writable: true
        });

        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    access_token: 'token_part_1',
                    user: { id: 10, username: 'bob', email: 'b@example.com' }
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        expect(await screen.findByText(/Unable to save login session/i)).toBeDefined();
        // Rollback ensures any previously written keys are cleaned up
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();

        Object.defineProperty(window.localStorage, 'setItem', {
            value: originalSetItem,
            configurable: true,
            writable: true
        });
    });

    // Scenario 7: Google and email flows apply consistent response validation
    it('Scenario 7: Google flow applies identical validation and rejects malformed responses', async () => {
        vi.spyOn(firebaseAuth, 'signInWithGoogle').mockResolvedValue({ idToken: 'google_token' });

        // Google endpoint returns missing user
        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/google') {
                return jsonResponse({
                    access_token: 'valid_google_token'
                    // missing user object
                });
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: /Sign up with Google/i }));

        expect(await screen.findByText(/Invalid user profile received/i)).toBeDefined();
        expect(localStorage.getItem('isAuthenticated')).toBeNull();
        expect(localStorage.getItem('auth_token')).toBeNull();
    });

    // Scenario 8: Backend error structures produce appropriate readable messages
    it('Scenario 8: Backend error structures produce readable messages without [object Object]', async () => {
        globalThis.fetch = vi.fn(async (url) => {
            if (url === '/api/auth/register') {
                return jsonResponse({
                    detail: [
                        { loc: ['body', 'email'], msg: 'Invalid email domain provided' },
                        { loc: ['body', 'password'], msg: 'Password contains disallowed characters' }
                    ]
                }, 422);
            }
            return jsonResponse({});
        });

        render(
            <MemoryRouter>
                <SignupPage />
            </MemoryRouter>
        );

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        const errorMsg = await screen.findByText(/Invalid email domain provided, Password contains disallowed characters/i);
        expect(errorMsg).toBeDefined();
        expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    });
});
