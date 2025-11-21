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

// Test component that uses our enhanced useFireproof
function TestComponent({ dbName = 'test-db' }: { dbName?: string }) {
  const { syncEnabled } = useFireproof(dbName);
  return <div data-testid="sync-status">{syncEnabled ? 'connected' : 'disconnected'}</div>;
}

// Wrapper component that provides VibeContext
function TestWrapper({
  children,
  syncEnabled = false,
}: {
  children: React.ReactNode;
  syncEnabled?: boolean;
}) {
  return (
    <VibeContextProvider
      metadata={{ titleId: 'test-title', installId: 'test-install' }}
      syncEnabled={syncEnabled}
    >
      {children}
    </VibeContextProvider>
  );
}

describe('useFireproof body class management', () => {
  beforeEach(() => {
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

    render(
      <TestWrapper syncEnabled={true}>
        <TestComponent />
      </TestWrapper>
    );

    // Body should have the class when sync is enabled
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);
  });

  it('should remove vibes-connect-true class from body when sync is disabled', () => {
    // Mock sync as disabled (no attach state)
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: undefined,
      useLiveQuery: vi.fn(),
    });

    render(
      <TestWrapper syncEnabled={false}>
        <TestComponent />
      </TestWrapper>
    );

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

    const { unmount } = render(
      <TestWrapper syncEnabled={true}>
        <TestComponent />
      </TestWrapper>
    );

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

    const { unmount: unmount1 } = render(
      <TestWrapper syncEnabled={true}>
        <TestComponent dbName="db1" />
      </TestWrapper>
    );
    const { unmount: unmount2 } = render(
      <TestWrapper syncEnabled={true}>
        <TestComponent dbName="db2" />
      </TestWrapper>
    );

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

    // Multiple components using the same database name
    const { unmount: unmount1 } = render(
      <TestWrapper syncEnabled={true}>
        <TestComponent dbName="same-db" />
      </TestWrapper>
    );
    const { unmount: unmount2 } = render(
      <TestWrapper syncEnabled={true}>
        <TestComponent dbName="same-db" />
      </TestWrapper>
    );

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
