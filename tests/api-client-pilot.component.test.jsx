import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeedbackWidget from '../src/components/FeedbackWidget.jsx';
import StudyTimer from '../src/pages/Timer.jsx';

describe('API client pilot callers', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('submits Feedback as unauthenticated JSON and preserves the success state', async () => {
        fetch.mockResolvedValue(new Response('{"accepted":true}', { status: 200 }));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(FeedbackWidget)
        ));

        fireEvent.click(screen.getByTitle('Send Feedback'));
        fireEvent.change(screen.getByPlaceholderText(/What went well/i), {
            target: { value: 'Helpful explanations' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));

        expect(await screen.findByText('Thank You!')).toBeTruthy();
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toBe('/api/feedback');
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            page: '/',
            rating: 5,
            comment: 'Helpful explanations',
        });
    });

    it('surfaces Feedback server detail and aborts an in-flight submission when closed', async () => {
        fetch.mockResolvedValueOnce(new Response('{"detail":"Feedback limit reached"}', { status: 429 }));
        render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(FeedbackWidget)
        ));

        fireEvent.click(screen.getByTitle('Send Feedback'));
        fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
        expect(await screen.findByText('Feedback limit reached')).toBeTruthy();

        fetch.mockImplementationOnce((_, options) => new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
        const requestSignal = fetch.mock.calls[1][1].signal;
        const closeButton = document.querySelector('.glass-panel > button');
        fireEvent.click(closeButton);

        expect(requestSignal.aborted).toBe(true);
        expect(screen.queryByText('Feedback limit reached')).toBeNull();
    });

    it('treats Feedback abort on unmount as cancellation rather than a submission error', async () => {
        fetch.mockImplementation((_, options) => new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = render(React.createElement(
            MemoryRouter,
            null,
            React.createElement(FeedbackWidget)
        ));

        fireEvent.click(screen.getByTitle('Send Feedback'));
        fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
        const requestSignal = fetch.mock.calls[0][1].signal;
        unmount();
        await act(async () => Promise.resolve());

        expect(requestSignal.aborted).toBe(true);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('records Timer completion with optional Bearer auth and preserves the success message', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(0));
        localStorage.setItem('auth_token', 'timer-token');
        fetch.mockResolvedValue(new Response(null, { status: 204 }));
        const { container } = render(React.createElement(StudyTimer));

        fireEvent.click(container.querySelector('.gap-5 button'));
        await act(async () => {
            vi.setSystemTime(new Date(25 * 60 * 1000));
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toBe('/api/track-activity');
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer timer-token');
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            activity_type: 'timer_focus',
            duration_seconds: 25 * 60,
        });
        expect(screen.getByText('Completed session recorded in analytics.')).toBeTruthy();
    });

    it('keeps Timer non-OK feedback distinct from a network failure', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(0));
        localStorage.setItem('auth_token', 'timer-token');
        fetch.mockResolvedValue(new Response('{"detail":"Unavailable"}', { status: 503 }));
        const { container } = render(React.createElement(StudyTimer));

        fireEvent.click(container.querySelector('.gap-5 button'));
        await act(async () => {
            vi.setSystemTime(new Date(25 * 60 * 1000));
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(screen.getByText('Could not record session in analytics.')).toBeTruthy();
    });
});
