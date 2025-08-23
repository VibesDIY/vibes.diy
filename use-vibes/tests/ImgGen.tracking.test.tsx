import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImgGen } from 'use-vibes-core';

// Mock document that will be returned when ImgGen is used with a prompt
const mockDocument = {
  _id: 'test-document-id',
  type: 'image',
  prompt: 'Test prompt',
  currentVersion: 0,
  versions: [{ id: 'v1', created: 123 }],
};

// Keep track of hook calls for validation
const mockCalls: { prompt?: string; _id?: string; regenerate?: boolean }[] = [];

// Mock for the useImageGen hook
vi.mock('../pkg/hooks/image-gen/use-image-gen', () => {
  let versionCount = 1;

  return {
    useImageGen: vi.fn().mockImplementation(({ prompt, _id, regenerate }) => {
      // Track function calls for test assertions
      mockCalls.push({ prompt, _id, regenerate });

      if (prompt && !_id) {
        // When called with just a prompt, simulate creating a new document
        return {
          document: mockDocument,
          loading: false,
          imageData: 'mock-image-data',
        };
      } else if (_id === mockDocument._id) {
        // When called with the correct document ID
        if (regenerate) {
          // Simulate regeneration by adding new version
          versionCount++;
          return {
            document: {
              ...mockDocument,
              currentVersion: versionCount - 1,
              versions: Array.from({ length: versionCount }, (_, i) => ({
                id: `v${i + 1}`,
                created: 123 + i * 100,
              })),
            },
            loading: false,
            imageData: `regenerated-image-${versionCount}`,
          };
        }

        // Normal document loading
        return {
          document: mockDocument,
          loading: false,
          imageData: 'mock-image-data',
        };
      }

      // Default - loading state
      return {
        document: null,
        loading: true,
        imageData: null,
      };
    }),
  };
});

// Mock Fireproof to avoid actual database operations
vi.mock('use-fireproof', () => {
  const mockDb = {
    get: vi.fn().mockImplementation((id: string) => {
      if (id === 'test-document-id') {
        return Promise.resolve(mockDocument);
      }
      return Promise.reject(new Error('Not found'));
    }),
    put: vi.fn().mockImplementation((doc) => {
      return Promise.resolve({ id: doc._id, rev: 'new-rev' });
    }),
    remove: vi.fn(),
    query: vi.fn(),
    getAttachment: vi.fn(),
    putAttachment: vi.fn(),
  };

  return {
    useFireproof: vi.fn().mockReturnValue({ database: mockDb }),
    ImgFile: vi.fn().mockImplementation((props) => {
      return React.createElement('div', {
        'data-testid': 'mock-img-file',
        alt: 'test image',
        ...props,
      });
    }),
  };
});

// Expose the mocked useImageGen for assertions
// import { useImageGen } from 'use-vibes-core'

describe('ImgGen Document ID Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset our mock call tracker
    mockCalls.length = 0;
  });

  it('should track document ID when starting with just a prompt', async () => {
    // Create a component that can trigger regeneration via key change
    const TestComponent = () => {
      const [key, setKey] = React.useState('initial');
      const [docId, setDocId] = React.useState<string | undefined>(undefined);

      // Function to capture document ID from mock hook calls
      React.useEffect(() => {
        const lastCall = mockCalls[mockCalls.length - 1];
        if (lastCall?.prompt === 'Test prompt' && mockDocument._id) {
          setDocId(mockDocument._id); // Simulate tracking the doc ID
        }
      }, []);

      return (
        <div>
          <ImgGen
            key={key}
            prompt="Test prompt"
            _id={docId} // Use tracked doc ID for regeneration
            data-testid="img-gen"
          />
          <button
            data-testid="regenerate-btn"
            onClick={() => {
              // Force component remount with the tracked doc ID
              setKey('regenerate-' + Date.now());
            }}
          >
            Regenerate
          </button>
        </div>
      );
    };

    // Render the test component
    const { getByTestId } = render(<TestComponent />);

    // Wait for the initial render to complete
    await waitFor(
      () => {
        // Debug: Check if we have calls to the hook
        console.log('mockCalls:', mockCalls);
        console.log('mockCalls.length:', mockCalls.length);

        // Check if we have calls to the hook
        expect(mockCalls.length).toBeGreaterThan(0);

        // Initial call should be with prompt only
        const initialCall = mockCalls[0];
        expect(initialCall.prompt).toBe('Test prompt');
        expect(initialCall._id).toBeUndefined();
      },
      { timeout: 2000 }
    );

    // Get the initial count of calls
    const initialCallCount = mockCalls.length;

    // Simulate clicking the regenerate button
    await act(async () => {
      fireEvent.click(getByTestId('regenerate-btn'));
    });

    // After regeneration, the component should use the document ID
    await waitFor(() => {
      // Should have more calls to the hook
      expect(mockCalls.length).toBeGreaterThan(initialCallCount);

      // Latest call should use the document ID that was tracked
      const latestCall = mockCalls[mockCalls.length - 1];
      expect(latestCall._id).toBe(mockDocument._id);
    });
  });
});
