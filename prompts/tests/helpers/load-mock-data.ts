/**
 * Creates a mock fetch implementation that serves text documentation files.
 * Accepts string, URL, or Request (matching the real fetch signature) since
 * loadAsset from @adviser/cement calls fetch with URL objects.
 */
export function createMockFetchFromPkgFiles(): typeof fetch {
  function getInputUrl(input: Parameters<typeof fetch>[0]): string {
    if (typeof input === "string") return input;
    if (typeof input === "object" && input !== null) {
      const requestUrl = Reflect.get(input, "url");
      if (typeof requestUrl === "string") return requestUrl;
      const href = Reflect.get(input, "href");
      if (typeof href === "string") return href;
    }
    return String(input);
  }

  async function mockFetch(input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> {
    const url = getInputUrl(input);

    const mockDocs: Record<string, string> = {
      "callai.txt": "<callAI-docs>\n# CallAI Documentation\nReal callAI docs content from pkg/llms/callai.txt\n</callAI-docs>",
      "fireproof.txt":
        "<useFireproof-docs>\n# Fireproof Documentation\nReal Fireproof docs content from pkg/llms/fireproof.txt\n</useFireproof-docs>",
      "image-gen.txt":
        "<imageGen-docs>\n# Image Generation Documentation\nReal ImageGen docs content from pkg/llms/image-gen.txt\n</imageGen-docs>",
      "web-audio.txt":
        "<webAudio-docs>\n# Web Audio Documentation\nReal Web Audio docs content from pkg/llms/web-audio.txt\n</webAudio-docs>",
      "d3.txt": "<D3.js-docs>\n# D3.js Documentation\nReal D3 docs content from pkg/llms/d3.md\n</D3.js-docs>",
      "d3.md": "<D3.js-docs>\n# D3.js Documentation\nReal D3 docs content from pkg/llms/d3.md\n</D3.js-docs>",
      "three-js.txt":
        "<Three.js-docs>\n# Three.js Documentation\nReal Three.js docs content from pkg/llms/three-js.md\n</Three.js-docs>",
      "three-js.md":
        "<Three.js-docs>\n# Three.js Documentation\nReal Three.js docs content from pkg/llms/three-js.md\n</Three.js-docs>",
    };

    for (const [pattern, content] of Object.entries(mockDocs)) {
      if (url.includes(pattern)) {
        return new Response(content, { status: 200 });
      }
    }

    // Default fallback for unmatched text files
    return new Response("<mock-docs>\n# Mock Documentation\nMock docs content\n</mock-docs>", { status: 200 });
  }

  return mockFetch;
}
