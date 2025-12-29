import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFireproof, VibeContextProvider } from '@vibes.diy/use-vibes-base';

// Mock the original useFireproof
const mockOriginalUseFireproof = vi.fn();

vi.mock('use-fireproof', () => ({
  useFireproof: () => mockOriginalUseFireproof(),
  fireproof: vi.fn(),
  ImgFile: vi.fn(),
  toCloud: vi.fn(),
  RedirectStrategy: class MockRedirectStrategy {
    mockMethod() {
      return 'mock';
    }
  },
}));

function InnerTestComponent({ dbName = 'test-db' }: { dbName?: string }) {
  const { attachState } = useFireproof(dbName);
  return <div data-testid="sync-status">{attachState.state}</div>;
}
// Test component that uses our enhanced useFireproof
function TestComponent({ dbName = 'test-db' }: { dbName?: string }) {
  return (
    <VibeContextProvider
      mountParams={{
        appSlug: 'appSlug',
        titleId: 'titleId',
        installId: 'installId',
        env: {
          FPCLOUD_URL: 'https://fpcloud.example.com',
          DASHBOARD_URL: 'https://dashboard.example.com',
          CLERK_PUBLISHABLE_KEY: 'pk_test_c2luY2VyZS1jaGVldGFoLTMwLmNsZXJrLmFjY291bnRzLmRldiQ',
          API_BASE_URL: 'https://api.example.com',
          CALLAI_API_KEY: 'test_callai_key',
          CALLAI_CHAT_URL: 'https://chat.example.com',
          CALLAI_IMG_URL: 'https://img.example.com',
          LOCAL_SERVE: undefined,
        },
      }}
    >
      <InnerTestComponent dbName={dbName} />
    </VibeContextProvider>
  );
}

describe.skip('useFireproof body class management', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Remove any existing classes from document.body
    document.body.classList.remove('vibes-connect-true');
    // Reset mocks
    mockOriginalUseFireproof.mockReset();
  });

  afterEach(() => {
    cleanup();
    document.body.classList.remove('vibes-connect-true');
  });

  it('should add vibes-connect-true class to body when sync is enabled', () => {
    // Mock sync as enabled (attached state)
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    // Set localStorage to indicate sync was previously enabled (global key)
    localStorage.setItem('fireproof-sync-enabled', 'true');

    render(<TestComponent />);

    // Body should have the class when sync is enabled
    expect(document.querySelector('.vibes-connect-true')).toEqual('xxx');
  });

  it('should remove vibes-connect-true class from body when sync is disabled', () => {
    // Mock sync as disabled (no attach state)
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: undefined,
      useLiveQuery: vi.fn(),
    });

    // Ensure localStorage doesn't indicate sync was enabled (global key)
    localStorage.removeItem('fireproof-sync-enabled');

    render(<TestComponent />);

    // Body should not have the class when sync is disabled
    expect(document.body.classList.contains('vibes-connect-true')).toBe(false);
  });

  it('should clean up body class on component unmount', () => {
    // Mock sync as enabled
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    // Set global sync preference
    localStorage.setItem('fireproof-sync-enabled', 'true');

    const { unmount } = render(<TestComponent />);

    // Class should be present
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);

    // Unmount component
    unmount();

    // Class should be removed on cleanup
    expect(document.body.classList.contains('vibes-connect-true')).toBe(false);
  });

  it('should handle multiple instances with proper aggregation', () => {
    // Mock sync as enabled for both instances
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    // Set global sync preference (shared across all databases)
    localStorage.setItem('fireproof-sync-enabled', 'true');

    const { unmount: unmount1 } = render(<TestComponent dbName="db1" />);
    const { unmount: unmount2 } = render(<TestComponent dbName="db2" />);

    // Class should be present when any instance has sync enabled
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);

    // Unmount first component - class should still be present (other instance still connected)
    unmount1();
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);

    // Unmount second component - now class should be removed (no instances left)
    unmount2();
    expect(document.body.classList.contains('vibes-connect-true')).toBe(false);
  });

  it('should handle multiple instances of same database properly', () => {
    // Mock sync as enabled
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    // Set global sync preference
    localStorage.setItem('fireproof-sync-enabled', 'true');

    // Multiple components using the same database name
    const { unmount: unmount1 } = render(<TestComponent dbName="same-db" />);
    const { unmount: unmount2 } = render(<TestComponent dbName="same-db" />);

    // Class should be present
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);

    // Unmount first component - class should still be present (other instance of same db still connected)
    unmount1();
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);

    // Unmount second component - now class should be removed
    unmount2();
    expect(document.body.classList.contains('vibes-connect-true')).toBe(false);
  });
});
