import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as React from 'react';

// Set up global mocks or test configuration here
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Setup global mock for call-ai module
vi.mock('call-ai', async () => {
  return await import('./mocks/call-ai.mock.ts');
});

// Mock react-dom's createPortal to render children directly in the component
// This is crucial for testing components that use portals (like modals)
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...(actual as object),
    createPortal: (children: React.ReactNode) => children,
  };
});

// Setup any global mocks that need to be available for all tests
