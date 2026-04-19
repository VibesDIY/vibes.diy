import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Create test file helper
// const createTestFile = () => new File(['test content'], 'test-image.png', { type: 'image/png' });

// Mock call-ai to avoid actual AI calls
// vi.mock('call-ai', () => ({
//   imgVibes: vi.fn().mockResolvedValue({
//     created: Date.now(),
//     data: [{ b64_json: 'mock-base64-image' }],
//   }),
// }));

// Mock Fireproof database
// vi.mock('use-fireproof',  (actual) => {
//   const mockDb = {
//     get: vi.fn().mockImplementation((id: string) => {
//       const baseDoc = {
//         _id: id,
//         _rev: 'test-rev',
//         type: 'image',
//         created: Date.now(),
//         prompt: `Test prompt for ${id}`,
//         currentVersion: 0,
//         versions: [{ id: 'v1', created: Date.now(), promptKey: 'p1' }],
//         prompts: { p1: { text: `Test prompt for ${id}`, created: Date.now() } },
//         _files: { v1: createTestFile() },
//       };

//       if (id === 'doc-with-multiple') {
//         return Promise.resolve({
//           ...baseDoc,
//           currentVersion: 2,
//           versions: [
//             { id: 'v1', created: Date.now() - 2000, promptKey: 'p1' },
//             { id: 'v2', created: Date.now() - 1000, promptKey: 'p1' },
//             { id: 'v3', created: Date.now(), promptKey: 'p1' },
//           ],
//           _files: {
//             v1: createTestFile(),
//             v2: createTestFile(),
//             v3: createTestFile(),
//           },
//         });
//       }

//       return Promise.resolve(baseDoc);
//     }),
//     put: vi.fn().mockImplementation((doc) => {
//       return Promise.resolve({ id: doc._id, rev: 'new-rev' });
//     }),
//     remove: vi.fn(),
//     query: vi.fn(),
//   };

//   return {
//     ...actual,
//     useFireproof: vi.fn().mockReturnValue({ database: mockDb }),
//     ImgFile: vi.fn().mockImplementation((props) => {
//       return React.createElement('div', {
//         'data-testid': 'mock-img-file',
//         alt: props.alt || 'test image',
//         ...props,
//       });
//     }),
//   };
// });

// Import after mocks
import { ImgVibes } from "@vibes.diy/base";

// TODO: test was shipped broken in d4a5e26a — all Fireproof/call-ai mocks are
// commented out, so the real component renders the "Generating image..."
// placeholder instead of the test fixture. Re-enable after restoring mocks.
describe.skip("ImgVibes ID Switching Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle switching between different document IDs", async () => {
    const { rerender } = render(<ImgVibes _id="doc-1" data-testid="img-vibes-1" />);

    // Wait for initial render
    await waitFor(
      () => {
        expect(screen.getByTestId("img-vibes-1")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Switch to different document ID
    rerender(<ImgVibes _id="doc-2" data-testid="img-vibes-2" />);

    // Wait for rerender
    await waitFor(
      () => {
        expect(screen.getByTestId("img-vibes-2")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Basic functionality test - component renders and switches
    expect(screen.getByTestId("img-vibes-2")).toBeInTheDocument();
  });

  it("should handle document with multiple versions", async () => {
    render(<ImgVibes _id="doc-with-multiple" data-testid="img-vibes-multiple" />);

    await waitFor(
      () => {
        expect(screen.getByTestId("img-vibes-multiple")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Component should render successfully with multiple versions
    expect(screen.getByTestId("img-vibes-multiple")).toBeInTheDocument();
  });

  it("should render when switching from prompt to ID", async () => {
    const { rerender } = render(<ImgVibes prompt="Test prompt" data-testid="img-vibes-prompt" />);

    // Wait for initial prompt render
    await waitFor(
      () => {
        expect(screen.getByTestId("img-vibes-prompt")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Switch to using an ID
    rerender(<ImgVibes _id="doc-1" data-testid="img-vibes-id" />);

    await waitFor(
      () => {
        expect(screen.getByTestId("img-vibes-id")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Both renders should work
    expect(screen.getByTestId("img-vibes-id")).toBeInTheDocument();
  });
});
