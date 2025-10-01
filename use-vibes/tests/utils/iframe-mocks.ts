import { vi } from 'vitest';
import { act } from '@testing-library/react';

export interface MockIframe {
  src: string;
  contentWindow: {
    postMessage: ReturnType<typeof vi.fn>;
  };
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  onload: (() => void) | null;
}

export function createMockIframe(postMessage = vi.fn()): MockIframe {
  // Create a proper DOM iframe element and enhance it
  const actualIframe = document.createElement('iframe');

  const iframe: MockIframe = {
    src: '',
    contentWindow: { postMessage },
    addEventListener: vi.fn((event, handler) => {
      if (event === 'load') {
        iframe.onload = handler as () => void;
      }
    }),
    removeEventListener: vi.fn(),
    onload: null,
  };

  // Use property descriptors to properly mock read-only properties
  Object.defineProperty(actualIframe, 'contentWindow', {
    get: () => iframe.contentWindow,
    configurable: true,
  });

  // Mock src setter to immediately trigger load event (no network requests)
  Object.defineProperty(actualIframe, 'src', {
    set: (value: string) => {
      iframe.src = value;
      // Immediately fire load event to avoid network delays
      setTimeout(() => {
        if (iframe.onload) {
          iframe.onload();
        }
        // Also fire DOM event
        const loadEvent = new Event('load');
        actualIframe.dispatchEvent(loadEvent);
      }, 0);
    },
    get: () => iframe.src,
    configurable: true,
  });

  // Override methods with mocks
  actualIframe.addEventListener = iframe.addEventListener;
  actualIframe.removeEventListener = iframe.removeEventListener;

  // Mock document.createElement to return our enhanced iframe when 'iframe' is requested
  const originalCreateElement = document.createElement;
  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName.toLowerCase() === 'iframe') {
      return actualIframe as HTMLIFrameElement;
    }
    return originalCreateElement.call(document, tagName);
  });

  return iframe;
}

export function simulateIframeMessage(data: unknown, origin = 'https://test.vibesbox.dev') {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin,
      })
    );
  });
}

export function createMockMessageEvent(data: unknown, origin?: string): MessageEvent {
  return new MessageEvent('message', {
    data,
    origin,
    source: window,
    // Add required MessageEvent properties
    lastEventId: '',
    ports: [],
  });
}

// Helper to clean up mocks after tests
export function cleanupIframeMocks() {
  vi.restoreAllMocks();
}
