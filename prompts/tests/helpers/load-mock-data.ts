// Simplified mock helper - only mocks text files now
// JSON configs are imported directly as TypeScript modules

import { CoerceURI, URI } from "@adviser/cement";
import systemPromptTemplate from "../../pkg/system-prompt.md?raw";
import systemPromptInitialTemplate from "../../pkg/system-prompt-initial.md?raw";
import recoveryAddendumTemplate from "../../pkg/recovery-addendum.md?raw";
import recoveryStitchAddendumTemplate from "../../pkg/recovery-stitch-addendum.md?raw";

/**
 * Creates a mock fetch implementation that serves only text documentation files.
 * JSON configs are now loaded directly as TypeScript imports, no mocking needed.
 */
export function createMockFetchFromPkgFiles(): (url: CoerceURI) => Promise<Response> {
  return (iurl: CoerceURI) => {
    const url = URI.from(iurl).toString();
    // Serve the real system-prompt template so placeholder substitution works.
    if (url.includes("system-prompt-initial.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(systemPromptInitialTemplate),
      } as Response);
    }
    if (url.includes("system-prompt.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(systemPromptTemplate),
      } as Response);
    }
    if (url.includes("recovery-stitch-addendum.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(recoveryStitchAddendumTemplate),
      } as Response);
    }
    if (url.includes("recovery-addendum.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(recoveryAddendumTemplate),
      } as Response);
    }

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

    if (url.includes("image-gen.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "<imgGen-docs>\n# Image Generation Documentation\nReal ImgGen docs content from pkg/llms/image-gen.md\n</imgGen-docs>"
          ),
      } as Response);
    }

    if (url.includes("web-audio.md")) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            // Mirrors the real steering directive from pkg/llms/web-audio.md
            // so regression tests around #1598 see the steering language.
            "<webAudio-docs>\n# Web Audio Documentation\n" +
              "> Web Audio is a browser built-in. " +
              "Use `window.AudioContext` (with the `window.webkitAudioContext` fallback) directly.\n" +
              "</webAudio-docs>"
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
