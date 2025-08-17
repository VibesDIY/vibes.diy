import { vi, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Import our module setup which configures the use-fireproof mock
import './moduleSetup';

// Mock the prompts module to avoid network/file IO during tests
vi.mock('../app/prompts', () => ({
  makeBaseSystemPrompt: vi.fn().mockReturnValue('mocked system prompt'),
  // Minimal stubs used by hooks that depend on prompts
  resolveEffectiveModel: vi
    .fn()
    .mockImplementation(
      (settingsDoc?: { model?: string }, vibeDoc?: { selectedModel?: string }) =>
        vibeDoc?.selectedModel || settingsDoc?.model || 'anthropic/claude-sonnet-4'
    ),
  isValidModelId: vi.fn().mockImplementation((id: unknown) => typeof id === 'string'),
  RESPONSE_FORMAT: {
    dependencies: {
      format: '{dependencies: { "package-name": "version" }}',
      note: 'use-fireproof is already provided, do not include it',
    },
    structure: [
      'Brief explanation',
      'Component code with proper Fireproof integration',
      'Real-time updates',
      'Data persistence',
    ],
  },
}));

// Note: Mock for use-fireproof is in tests/__mocks__/use-fireproof.ts

// Mock React Router modules globally
vi.mock('@react-router/dev/vite', () => ({
  reactRouter: () => ({
    name: 'mocked-react-router',
  }),
}));

// Mock React Router modules
vi.mock('react-router', () => ({
  Links: () => React.createElement('div', { 'data-testid': 'links' }, 'Links'),
  Meta: () => React.createElement('div', { 'data-testid': 'meta' }, 'Meta'),
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }, 'Outlet Content'),
  Scripts: () => React.createElement('div', { 'data-testid': 'scripts' }, 'Scripts'),
  ScrollRestoration: () =>
    React.createElement('div', { 'data-testid': 'scroll-restoration' }, 'Scroll Restoration'),
  isRouteErrorResponse: vi.fn().mockReturnValue(false),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
  Link: ({ children, to, ...props }: any) =>
    React.createElement('a', { href: to, ...props }, children),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) =>
    React.createElement('a', { href: to, ...props }, children),
  NavLink: ({ children, to, ...props }: any) =>
    React.createElement('a', { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }, 'Outlet Content'),
  MemoryRouter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'memory-router' }, children),
}));

// Mock console.debug to avoid cluttering test output
const originalConsoleDebug = console.debug;
console.debug = vi.fn();

// Restore console.debug after tests
afterAll(() => {
  console.debug = originalConsoleDebug;
});

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    // Mock constructor
  }
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock HTMLCanvasElement for tests that use canvas
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn().mockImplementation((contextType: string) => {
    if (contextType === '2d') {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 1,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        createImageData: vi.fn().mockImplementation((width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        })),
        getImageData: vi.fn(),
        putImageData: vi.fn(),
        canvas: {
          width: 300,
          height: 150,
        },
      };
    }
    return null;
  }),
});

// Mock TextEncoder if needed
if (typeof TextEncoder === 'undefined') {
  // @ts-ignore - We're mocking TextEncoder for the test environment
  global.TextEncoder = class TextEncoder {
    encoding = 'utf-8';
    encode(text: string): Uint8Array {
      const encoded = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        encoded[i] = text.charCodeAt(i);
      }
      return encoded;
    }
    encodeInto(text: string, dest: Uint8Array): { read: number; written: number } {
      const encoded = this.encode(text);
      dest.set(encoded);
      return { read: text.length, written: encoded.length };
    }
  };
}
