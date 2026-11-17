/* eslint-disable no-unused-vars */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatInterface from '../src/components/ChatInterface';

describe('ChatInterface Component Smoke Test', () => {
  it('renders without crashing and displays the default AI assistant greeting', async () => {
    // Basic mock for API calls on mount
    globalThis.fetch = async (url) => {
      if (url === '/api/conversations') {
        return {
          ok: true,
          json: async () => [],
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    render(
      <MemoryRouter>
        <ChatInterface />
      </MemoryRouter>
    );

    // Verify default AI greeting is visible
    expect(await screen.findByText(/AI Study Buddy/i)).toBeDefined();
  });
});
