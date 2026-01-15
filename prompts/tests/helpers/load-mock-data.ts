// Simplified mock helper - only mocks text files now
// JSON configs are imported directly as TypeScript modules

/**
 * Creates a mock fetch implementation that serves only text documentation files.
 * JSON configs are now loaded directly as TypeScript imports, no mocking needed.
 */
export function createMockFetchFromPkgFiles(): (url: string) => Promise<Response> {
  return (url: string) => {
    // Mock text files - serve actual text file contents (abbreviated for tests)
    if (url.includes("callai.txt")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<callAI-docs>\n# CallAI Documentation\nReal callAI docs content from pkg/llms/callai.txt\n</callAI-docs>"
          ),
      } as Response);
    }

    if (url.includes("fireproof.txt")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<useFireproof-docs>\n# Fireproof Documentation\nReal Fireproof docs content from pkg/llms/fireproof.txt\n</useFireproof-docs>"
          ),
      } as Response);
    }

    if (url.includes("image-gen.txt")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<imageGen-docs>\n# Image Generation Documentation\nReal ImageGen docs content from pkg/llms/image-gen.txt\n</imageGen-docs>"
          ),
      } as Response);
    }

    if (url.includes("web-audio.txt")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<webAudio-docs>\n# Web Audio Documentation\nReal Web Audio docs content from pkg/llms/web-audio.txt\n</webAudio-docs>"
          ),
      } as Response);
    }

    if (url.includes("d3.txt") || url.includes("d3.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve("<D3.js-docs>\n# D3.js Documentation\nReal D3 docs content from pkg/llms/d3.md\n</D3.js-docs>"),
      } as Response);
    }

    if (url.includes("three-js.txt") || url.includes("three-js.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<Three.js-docs>\n# Three.js Documentation\nReal Three.js docs content from pkg/llms/three-js.md\n</Three.js-docs>"
          ),
      } as Response);
    }

    // Default response for other text files - fallback mock
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve("<mock-docs>\n# Mock Documentation\nMock docs content\n</mock-docs>"),
    } as Response);
  };
}
