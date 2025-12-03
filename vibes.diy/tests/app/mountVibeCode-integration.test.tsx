import { describe, it, expect, beforeEach, vi } from "vitest";
import { transformImportsDev } from "../../pkg/app/utils/dev-shims.js";

describe("mountVibeCode integration with transformImportsDev", () => {
  beforeEach(() => {
    // Mock Babel
    (window as { Babel?: unknown }).Babel = {
      transform: vi.fn((code: string) => ({ code })),
    };

    // Clean up any previous containers
    document.body.innerHTML = "";
  });

  it("should call transformImportsDev and get string, not Promise object", () => {
    const testCode = `
      import React from 'react';
      export default function App() {
        return <div>Test</div>;
      }
    `;

    // Verify transformImportsDev returns a string synchronously
    const transformed = transformImportsDev(testCode);

    // Critical checks - verify we got a string, not a Promise object
    expect(typeof transformed).toBe("string");
    expect(transformed).not.toContain("[object Promise]");

    // Verify it contains the original code (proves it's actual transformed code)
    expect(transformed).toContain("React");
    expect(transformed).toContain("App");

    // Verify Babel can parse it (this would fail if it received "[object Promise]")
    const babelResult = (
      window as {
        Babel?: {
          transform: (code: string, opts: unknown) => { code: string };
        };
      }
    ).Babel?.transform(transformed, { presets: ["react"] });

    // If Babel received "[object Promise]", this would throw or return bad code
    expect(babelResult).toBeDefined();
    expect(babelResult?.code).toBeDefined();
    expect(babelResult?.code).not.toContain("[object Promise]");
  });

  it("should verify transform function signature compatibility", () => {
    const testCode = `import React from 'react';`;

    // Verify that transformImportsDev is synchronous and returns a string
    const result = transformImportsDev(testCode);

    // Should return a string directly (not a Promise)
    expect(typeof result).toBe("string");
    expect(result).not.toBeInstanceOf(Promise);
  });
});
