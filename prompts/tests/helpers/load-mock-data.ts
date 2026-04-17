// Simplified mock helper - only mocks text files now
// JSON configs are imported directly as TypeScript modules

import { CoerceURI, URI } from "@adviser/cement";

/**
 * Creates a mock fetch implementation that serves only text documentation files.
 * JSON configs are now loaded directly as TypeScript imports, no mocking needed.
 */
export function createMockFetchFromPkgFiles(): (url: CoerceURI) => Promise<Response> {
  return (iurl: CoerceURI) => {
    const url = URI.from(iurl).toString();
    // Mock text files - serve actual text file contents (abbreviated for tests)
    if (url.includes("callai.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<callAI-docs>\n# CallAI Documentation\nReal callAI docs content from pkg/llms/callai.md\n</callAI-docs>"
          ),
      } as Response);
    }

    if (url.includes("fireproof.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<useFireproof-docs>\n# Fireproof Documentation\nReal Fireproof docs content from pkg/llms/fireproof.md\n</useFireproof-docs>"
          ),
      } as Response);
    }

    if (url.includes("img-vibes.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<imgVibes-docs>\n# Image Generation Documentation\nReal ImageGen docs content from pkg/llms/img-vibes.md\n</imgVibes-docs>"
          ),
      } as Response);
    }

    if (url.includes("web-audio.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<webAudio-docs>\n# Web Audio Documentation\nReal Web Audio docs content from pkg/llms/web-audio.md\n</webAudio-docs>"
          ),
      } as Response);
    }

    if (url.includes("d3.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve("<D3.js-docs>\n# D3.js Documentation\nReal D3 docs content from pkg/llms/d3.md\n</D3.js-docs>"),
      } as Response);
    }

    if (url.includes("three-js.md")) {
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
