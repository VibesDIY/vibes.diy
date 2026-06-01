import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const runtimeRouteSource = readFileSync(new URL("../../../pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx", import.meta.url), "utf8");
const previewAppSource = readFileSync(new URL("../../../pkg/app/components/ResultPreview/PreviewApp.tsx", import.meta.url), "utf8");

describe("runtime/preview iframe policy wiring", () => {
  it("runtime route uses shared iframe policy constants", () => {
    expect(runtimeRouteSource).toContain("RUNTIME_PREVIEW_IFRAME_ALLOW");
    expect(runtimeRouteSource).toContain("RUNTIME_PREVIEW_IFRAME_SANDBOX");
    expect(runtimeRouteSource).not.toContain('allow="camera; microphone"');
    expect(runtimeRouteSource).not.toContain(
      'sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"'
    );
  });

  it("preview app uses shared iframe policy constants", () => {
    expect(previewAppSource).toContain("RUNTIME_PREVIEW_IFRAME_ALLOW");
    expect(previewAppSource).toContain("RUNTIME_PREVIEW_IFRAME_SANDBOX");
    expect(previewAppSource).not.toContain('allow="camera; microphone"');
    expect(previewAppSource).not.toContain(
      'sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"'
    );
  });
});
