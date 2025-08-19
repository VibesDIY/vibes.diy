import { renderHook } from '@testing-library/react';
import { useSession } from '../app/hooks/useSession';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFireproof } from 'use-fireproof';

// Mock all required dependencies
vi.mock('../app/config/env', () => ({
  SETTINGS_DBNAME: 'test-chat-history',
}));

vi.mock('use-fireproof', () => {
  const mockSubmitUserMessage = vi.fn().mockResolvedValue({ ok: true });
  const mockUseFireproof = vi.fn().mockImplementation(() => ({
    useDocument: () => ({
      doc: { _id: 'test-id', type: 'user' },
      merge: vi.fn(),
      submit: mockSubmitUserMessage,
      save: vi.fn(),
    }),
    useLiveQuery: () => ({ docs: [] }),
    database: { get: vi.fn(), put: vi.fn() },
  }));

  return {
    useFireproof: mockUseFireproof,
    toCloud: vi.fn().mockReturnValue({}),
  };
});

vi.mock('../app/utils/databaseManager', () => ({
  getSessionDatabaseName: vi.fn().mockImplementation((id) => `session-${id || 'default'}`),
}));

// Tests focused on eager database initialization behavior
describe('useSession', () => {
  const mockUseFireproof = vi.mocked(useFireproof);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize database eagerly with provided sessionId', () => {
    renderHook(() => useSession('test-id'));
    expect(mockUseFireproof).toHaveBeenCalledWith('session-test-id');
  });

  it('should initialize database eagerly even when sessionId is not provided', () => {
    const { result } = renderHook(() => useSession(undefined));
    // Verify we have a session ID generated (in the session document)
    expect(result.current.session._id).toBeTruthy();
    // Verify the database is initialized eagerly on first render
    expect(mockUseFireproof).toHaveBeenCalledTimes(1);
    expect(mockUseFireproof).toHaveBeenCalledWith(expect.stringMatching(/^session-/));
  });

  /**
   * NEW BEHAVIOR: Eager database initialization for observable side effects
   *
   * This test ensures our new behavior: databases are created eagerly to make
   * storage side effects observable during testing and initialization.
   * This is the opposite of the previous lazy loading behavior.
   */
  it('should follow eager database initialization pattern for observable side effects', async () => {
    const { result } = renderHook(() => useSession(undefined));

    // Step 1: Database should be initialized immediately on first render
    expect(mockUseFireproof).toHaveBeenCalledTimes(1);

    // Step 2: Session document and functions should be available
    expect(result.current.session._id).toBeTruthy();
    expect(result.current.submitUserMessage).toBeTruthy();

    // Step 3: User actions should work normally with the already-initialized database
    await result.current.submitUserMessage();

    // The submitUserMessage should have been called once
    // (we can't easily test the mock submit function from inside the closure)
  });

  /**
   * This test verifies session ID transition behavior with eager initialization
   * When the sessionId changes, a new database should be initialized with the new name
   */
  it('should initialize new database when sessionId changes', () => {
    // Start with no session ID (first message scenario)
    const { rerender } = renderHook(({ id }: any) => useSession(id), {
      initialProps: { id: undefined },
    });

    // Get the initial call count
    const initialCallCount = mockUseFireproof.mock.calls.length;
    const initialCall = mockUseFireproof.mock.calls[0][0];
    expect(initialCall).toMatch(/^session-/);

    // Simulate URL update with new session ID (after first message response)
    rerender({ id: 'new-session-id' as any });

    // Verify new database is initialized with the new session ID
    // The call count should have increased
    expect(mockUseFireproof.mock.calls.length).toBeGreaterThan(initialCallCount);
    expect(mockUseFireproof).toHaveBeenCalledWith('session-new-session-id');
  });
});
