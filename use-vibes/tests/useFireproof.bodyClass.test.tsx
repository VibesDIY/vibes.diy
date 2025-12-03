import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFireproof } from '@vibes.diy/use-vibes-base';
import { VibeContextProvider, type VibeMetadata } from '../base/contexts/VibeContext.js';

// Mock the original useFireproof from use-fireproof so we can control attach state
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

// Mock Clerk's useAuth so sync can initialize without real Clerk setup
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

interface TestComponentProps {
  dbName?: string;
  metadata?: VibeMetadata;
}

// Component that provides VibeContext and uses the enhanced useFireproof hook
function TestComponent({ dbName = 'test-db', metadata }: TestComponentProps) {
  const vibeMetadata: VibeMetadata =
    metadata ?? ({ titleId: 'test-title', installId: 'test-install' } as VibeMetadata);

  return (
    <VibeContextProvider metadata={vibeMetadata}>
      <InnerTestComponent dbName={dbName} />
    </VibeContextProvider>
  );
}

function InnerTestComponent({ dbName }: { dbName: string }) {
  const { syncEnabled } = useFireproof(dbName);
  return <div data-testid="sync-status">{syncEnabled ? 'connected' : 'disconnected'}</div>;
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

  it('does not enable sync or add body class outside vibe-viewer context', () => {
    // Even if the underlying attach state is attached, lack of vibe metadata
    // (no VibeContextProvider) should keep sync disabled.
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    render(<InnerTestComponent dbName="test-db" />);

    expect(document.body.classList.contains('vibes-connect-true')).toBe(false);
  });

  it('should add vibes-connect-true class to body when sync is enabled', () => {
    // Mock sync as enabled (attached state)
    const mockAttach = { state: 'attached' };
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: mockAttach,
      useLiveQuery: vi.fn(),
    });

    render(<TestComponent />);

    // Body should have the class when sync is enabled in a viewer context
    expect(document.body.classList.contains('vibes-connect-true')).toBe(true);
  });

  it('should remove vibes-connect-true class from body when sync is disabled', () => {
    // Mock sync as disabled (no attach state)
    mockOriginalUseFireproof.mockReturnValue({
      database: { name: 'test-db' },
      attach: undefined,
      useLiveQuery: vi.fn(),
    });

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
