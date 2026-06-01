import { describe, expect, it } from "vitest";
import {
  inferCodeViewLanguage,
  isCodeViewFileCandidate,
  normalizeCodeViewPath,
  pickDefaultCodeViewFile,
  sortCodeViewFiles,
} from "~/vibes.diy/app/components/ResultPreview/code-view-files.js";

describe("code-view-files helpers", () => {
  it("normalizes file paths with a leading slash", () => {
    expect(normalizeCodeViewPath("App.jsx")).toBe("/App.jsx");
    expect(normalizeCodeViewPath("/App.jsx")).toBe("/App.jsx");
  });

  it("filters out generated internal files and keeps source files", () => {
    expect(isCodeViewFileCandidate("/App.jsx", "text/javascript")).toBe(true);
    expect(isCodeViewFileCandidate("/components/ListItem.tsx", "text/typescript")).toBe(true);
    expect(isCodeViewFileCandidate("/~~transformed~~/abc", "text/javascript")).toBe(false);
    expect(isCodeViewFileCandidate("/~~calculated~~/import-map.json", "application/importmap+json")).toBe(false);
    expect(isCodeViewFileCandidate("/logo.png", "image/png")).toBe(false);
  });

  it("infers monaco language from extension and mime", () => {
    expect(inferCodeViewLanguage("/main.tsx", "text/plain")).toBe("typescript");
    expect(inferCodeViewLanguage("/styles.scss", "text/plain")).toBe("scss");
    expect(inferCodeViewLanguage("/import-map", "application/importmap+json")).toBe("json");
    expect(inferCodeViewLanguage("/README.unknown", "application/octet-stream")).toBe("plaintext");
  });

  it("sorts entry point first then App.jsx then alphabetically", () => {
    const sorted = sortCodeViewFiles([
      { fileName: "/zeta.ts" },
      { fileName: "/App.jsx" },
      { fileName: "/components/Card.tsx" },
      { fileName: "/src/main.tsx", entryPoint: true },
    ]);
    expect(sorted.map((f) => f.fileName)).toEqual(["/src/main.tsx", "/App.jsx", "/components/Card.tsx", "/zeta.ts"]);
  });

  it("picks the default file using the same sorted precedence", () => {
    const withEntrypoint = pickDefaultCodeViewFile([
      { fileName: "/helper.js" },
      { fileName: "/App.jsx" },
      { fileName: "/index.tsx", entryPoint: true },
    ]);
    expect(withEntrypoint?.fileName).toBe("/index.tsx");

    const appFallback = pickDefaultCodeViewFile([{ fileName: "/helper.js" }, { fileName: "/App.jsx" }]);
    expect(appFallback?.fileName).toBe("/App.jsx");
  });
});
