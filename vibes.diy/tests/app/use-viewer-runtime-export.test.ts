import { describe, it, expect } from "vitest";
import { useViewer, type UseViewerResult } from "@vibes.diy/vibe-runtime";

// In the sandbox, the bare specifier `use-vibes` is aliased to
// `@vibes.diy/vibe-runtime` (see grouped-vibe-import-map.ts). Generated vibe
// code does `import { useViewer } from "use-vibes"`, so the runtime package
// must surface this export. If this assertion ever fails, vibes will crash
// at module-load with: SyntaxError: The requested module 'use-vibes' does not
// provide an export named 'useViewer'.
describe("useViewer is exported from @vibes.diy/vibe-runtime", () => {
  it("is callable from the runtime surface", () => {
    expect(typeof useViewer).toBe("function");
  });

  it("UseViewerResult type compiles against the runtime surface", () => {
    const _typeProbe: UseViewerResult | undefined = undefined;
    expect(_typeProbe).toBeUndefined();
  });
});
