import { vi } from 'vitest';

// Vitest will automatically use mocks from __mocks__ directory

// Set up any additional global mocks needed for tests
// Mock for react-markdown that will be used across tests
vi.mock('react-markdown', () => {
  // Create a mock implementation that works with @testing-library/react
  return {
    default: vi.fn(({ children }) => {
      // Just return the children as a string, which React can render
      return children;
    }),
  };
});

// Mock the scrollIntoView method commonly used in tests
window.HTMLElement.prototype.scrollIntoView = vi.fn();
