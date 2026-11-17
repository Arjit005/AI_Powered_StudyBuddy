import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Flashcards from '../src/pages/Flashcards.jsx';
import Quiz from '../src/pages/Quiz.jsx';
import Summarize from '../src/pages/Summarize.jsx';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('API client migrated study tools', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('sends summary generation as a public JSON request and preserves its response', async () => {
        localStorage.setItem('auth_token', 'must-not-be-sent');
        fetch.mockResolvedValue(jsonResponse({ summary: 'A concise summary.' }));
        render(React.createElement(Summarize));

        fireEvent.change(screen.getByPlaceholderText(/Paste or type a topic/i), {
            target: { value: '  Photosynthesis  ' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Structured Summary/i }));

        expect(await screen.findByText('A concise summary.')).toBeTruthy();
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch.mock.calls[0][0]).toBe('/api/summarize');
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ topic: 'Photosynthesis' });
    });

    it('saves a summary with optional auth and the established library payload', async () => {
        localStorage.setItem('auth_token', 'study-token');
        fetch
            .mockResolvedValueOnce(jsonResponse({ summary: 'A concise summary.' }))
            .mockResolvedValueOnce(jsonResponse({ id: 21 }, 201));
        render(React.createElement(Summarize));

        fireEvent.change(screen.getByPlaceholderText(/Paste or type a topic/i), {
            target: { value: 'Photosynthesis' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Structured Summary/i }));
        expect(await screen.findByText('A concise summary.')).toBeTruthy();
        fireEvent.click(screen.getByTitle('Save to Personal Study Library'));

        await waitFor(() => {
            expect(screen.getByText('Saved!')).toBeTruthy();
        });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toBe('/api/library');
        expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer study-token');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
            material_type: 'summary',
            topic: 'Photosynthesis',
            content_json: 'A concise summary.',
        });
    });

    it('generates, tracks, and saves a quiz using the expected optional-auth contracts', async () => {
        localStorage.setItem('auth_token', 'quiz-token');
        fetch.mockImplementation((url) => {
            if (url === '/api/generate-quiz') {
                return Promise.resolve(jsonResponse({
                    questions: [{
                        question: 'What is two plus two?',
                        options: ['3', '4'],
                        correct_answer: '4',
                        explanation: 'Basic addition.',
                    }],
                }));
            }
            return Promise.resolve(new Response(null, { status: 201 }));
        });
        render(React.createElement(Quiz));

        fireEvent.change(screen.getByPlaceholderText(/e.g. Operating Systems Concurrency/i), {
            target: { value: 'Arithmetic' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Quiz/i }));
        expect(await screen.findByText('What is two plus two?')).toBeTruthy();
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer quiz-token');
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ topic: 'Arithmetic' });

        fireEvent.click(screen.getByRole('button', { name: '3' }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit & Calculate Score' }));
        expect(await screen.findByText('Activity logged to your study dashboard.')).toBeTruthy();
        expect(fetch.mock.calls[1][0]).toBe('/api/track-activity');
        expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer quiz-token');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
            activity_type: 'quiz',
            duration_seconds: expect.any(Number),
        });

        fireEvent.click(screen.getByTitle('Save Quiz & answers to Library'));
        await waitFor(() => {
            expect(screen.getByText('Saved')).toBeTruthy();
        });
        expect(fetch.mock.calls[2][0]).toBe('/api/library');
        expect(fetch.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer quiz-token');
        expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({
            material_type: 'quiz',
            topic: 'Arithmetic',
        });
    });

    it('generates flashcards publicly and saves the deck with optional auth', async () => {
        localStorage.setItem('auth_token', 'must-not-be-sent-to-generator');
        fetch
            .mockResolvedValueOnce(jsonResponse({ flashcards: [{ front: 'Question', back: 'Answer' }] }))
            .mockResolvedValueOnce(new Response(null, { status: 201 }));
        render(React.createElement(Flashcards));

        fireEvent.change(screen.getByPlaceholderText(/Enter deck topic/i), {
            target: { value: 'Biology' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
        expect(await screen.findByText('Question')).toBeTruthy();
        expect(fetch.mock.calls[0][0]).toBe('/api/generate-flashcards');
        expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBeNull();
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ topic: 'Biology' });

        fireEvent.click(screen.getByTitle('Save Deck to Personal Library'));
        await waitFor(() => {
            expect(screen.getByText('Saved')).toBeTruthy();
        });
        expect(fetch.mock.calls[1][0]).toBe('/api/library');
        expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer must-not-be-sent-to-generator');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
            material_type: 'flashcards',
            topic: 'Biology',
        });
    });
});
