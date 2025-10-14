import { describe, it, expect } from "vitest";
import { template } from "../src/apptemplate";

// These imports will fail initially - that's expected in TDD
// import { styles } from "../src/template/styles";
// import { scripts } from "../src/template/scripts";

describe("Template Modularization", () => {
  describe("Template Structure", () => {
    it("should export a valid HTML string", () => {
      expect(template).toMatch(/^<!DOCTYPE html>/);
      expect(template).toContain("</html>");
    });

    it("should preserve all required placeholders", () => {
      const placeholders = ["{{APP_CODE}}", "{{API_KEY}}", "{{IMPORT_MAP}}"];
      placeholders.forEach((placeholder) => {
        expect(template).toContain(placeholder);
      });
    });

    it("should contain essential HTML elements", () => {
      // Container for React app
      expect(template).toContain('<div id="container"></div>');

      // Style and script tags
      expect(template).toContain("<style>");
      expect(template).toContain("</style>");
      expect(template).toContain("<script>");

      // External dependencies
      expect(template).toContain("/babel.min.js");
      expect(template).toContain("@tailwindcss/browser");
    });
  });

  describe("Template Size", () => {
    it("should keep total template under 200KB", () => {
      const sizeInBytes = new Blob([template]).size;
      const sizeInKB = sizeInBytes / 1024;

      console.log(`Template size: ${sizeInKB.toFixed(2)} KB`);
      expect(sizeInKB).toBeLessThan(200);
    });
  });

  describe("Placeholder Integrity", () => {
    it("should not have malformed placeholders", () => {
      // Check for common typos like {{{APP_CODE}} or {{APP_CODE}
      expect(template).not.toMatch(/\{\{\{[^}]*\}\}/); // Triple braces
      expect(template).not.toMatch(/\{\{[^}]*\{/); // Missing closing
      expect(template).not.toMatch(/\}[^{]*\}\}/); // Missing opening
    });

    it("should have properly formatted import map placeholder", () => {
      // Import map should be JSON-ready
      expect(template).toContain("{{IMPORT_MAP}}");

      // Should be in a script tag with type importmap
      expect(template).toMatch(/<script type="importmap"[\s\S]*{{IMPORT_MAP}}[\s\S]*<\/script>/);
    });

    it("should have app code in babel script tag", () => {
      // APP_CODE should be in a babel-processed script tag
      expect(template).toMatch(/<script[^>]*type="text\/babel"[\s\S]*{{APP_CODE}}[\s\S]*<\/script>/);
    });
  });

  describe("CSS and JavaScript Integration", () => {
    it("should contain essential CSS classes", () => {
      // Test for basic styling
      expect(template).toContain("body {");
      expect(template).toContain("#container");
    });

    it("should contain VibeControl integration", () => {
      // Test for VibeControl import and mounting
      expect(template).toContain("mountVibesApp");
      expect(template).toContain("use-vibes");
      expect(template).toContain("DOMContentLoaded");
    });

    it("should set up React properly", () => {
      // React setup logic
      expect(template).toContain("ReactDOMClient");
      expect(template).toContain("createRoot");
      expect(template).toContain("getElementById('container')");
    });
  });
});

// These tests will be enabled once we create the modular files
describe.skip("Modular Components (Future)", () => {
  describe("Individual Modules", () => {
    it.skip("should have styles module with CSS", () => {
      // const { styles } = await import("../src/template/styles");
      // expect(styles).toContain("body {");
      // expect(styles).toContain(".position-element");
    });

    it.skip("should have scripts module with JavaScript", () => {
      // const { scripts } = await import("../src/template/scripts");
      // expect(scripts).toContain("DOMContentLoaded");
      // expect(scripts).toContain("position-element");
    });

    it.skip("should compose modules correctly", () => {
      // const { styles } = await import("../src/template/styles");
      // const { scripts } = await import("../src/template/scripts");
      //
      // expect(template).toContain(styles);
      // expect(template).toContain(scripts);
    });
  });
});
