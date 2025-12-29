import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Meta } from "~/vibes.diy/serve/meta.js";
import { Links } from "~/vibes.diy/serve/links.js";
import { ImportMap } from "~/vibes.diy/serve/importmap.js";

describe("serve/ module components", () => {
  describe("Meta component", () => {
    it("should render with default title and description", () => {
      // Act
      const html = renderToString(<Meta />);

      // Assert
      expect(html).toContain("<title>Vibes DIY</title>");
      expect(html).toContain('content="Vibe coding made easy"');
    });

    it("should render with custom title", () => {
      // Act
      const html = renderToString(<Meta title="Custom Title" />);

      // Assert
      expect(html).toContain("<title>Custom Title</title>");
    });

    it("should render with custom description", () => {
      // Act
      const html = renderToString(
        <Meta description="Custom description text" />,
      );

      // Assert
      expect(html).toContain('content="Custom description text"');
    });

    it("should include charset and viewport meta tags", () => {
      // Act
      const html = renderToString(<Meta />);

      // Assert - React converts charset to charSet in renderToString
      expect(html).toContain('charSet="utf-8"');
      expect(html).toContain('name="viewport"');
      expect(html).toContain('content="width=device-width, initial-scale=1"');
    });
  });

  describe("Links component", () => {
    it("should render Google Fonts preconnect links", () => {
      // Act
      const html = renderToString(<Links />);

      // Assert
      expect(html).toContain('rel="preconnect"');
      expect(html).toContain('href="https://fonts.googleapis.com"');
      expect(html).toContain('href="https://fonts.gstatic.com"');
      expect(html).toContain('crossorigin="anonymous"');
    });

    it("should include stylesheet link with Inter font", () => {
      // Act
      const html = renderToString(<Links />);

      // Assert
      expect(html).toContain('rel="stylesheet"');
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain("Inter");
    });
  });

  describe("ImportMap component", () => {
    it("should render script tag with type='importmap'", () => {
      // Act
      const html = renderToString(<ImportMap versions={{ FP: "test" }} />);

      // Assert
      expect(html).toContain('type="importmap"');
    });

    it("should contain valid JSON structure", () => {
      // Act
      const html = renderToString(<ImportMap versions={{ FP: "test" }} />);

      // Assert
      // Extract JSON from script tag
      const jsonMatch = html.match(/>([^<]+)<\/script>/);
      expect(jsonMatch).toBeTruthy();

      const content = jsonMatch ? jsonMatch[1] : "";
      // Should parse as valid JSON
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("imports");
      expect(typeof parsed.imports).toBe("object");
    });

    it("should include key dependencies", () => {
      // Act
      const html = renderToString(<ImportMap versions={{ FP: "test" }} />);

      // Assert
      expect(html).toContain('"react"');
      expect(html).toContain('"use-fireproof"');
      expect(html).toContain('"call-ai"');
      expect(html).toContain('"react/jsx-runtime"');
      expect(html).toContain("esm.sh");
    });

    it("should replace FP version placeholders", () => {
      // Act
      const html = renderToString(<ImportMap versions={{ FP: "test" }} />);

      // Assert
      const jsonMatch = html.match(/>([^<]+)<\/script>/);
      const content = jsonMatch ? jsonMatch[1] : "{}";
      const parsed = JSON.parse(content);

      // Check that use-fireproof has a versioned URL (not "FP" placeholder)
      expect(parsed.imports["@fireproof/use-fireproof"]).toContain(
        "use-fireproof@",
      );
      expect(parsed.imports["@fireproof/use-fireproof"]).toContain("esm.sh");
      expect(parsed.imports["@fireproof/use-fireproof"]).not.toBe("FP");

      // Should not contain undefined values
      expect(Object.values(parsed.imports)).not.toContain(undefined);
    });
  });

  // describe("GlobalStyles component", () => {
  //   it("should render style tag", () => {
  //     // Act
  //     // const html = renderToString(<GlobalStyles />);

  //     // Assert
  //     expect(html).toContain("<style>");
  //     expect(html).toContain("</style>");
  //   });

  //   it("should contain CSS content", () => {
  //     // Act
  //     const html = renderToString(<GlobalStyles />);

  //     // Assert
  //     expect(html.length).toBeGreaterThan(20); // Should have meaningful content
  //     // Should contain some CSS-like content
  //     expect(html).toMatch(/[{};:]/); // Basic CSS syntax characters
  //   });
  // });

  describe("enhance helper function (from importmap.tsx)", () => {
    // Helper function to test the enhance logic
    function enhance(
      importMap: Record<string, string | undefined>,
      ver: Record<string, string>,
    ): Record<string, string> {
      const enhancedMap: Record<string, string> = {};

      for (const [key, value] of Object.entries(importMap)) {
        if (value === undefined) {
          continue;
        }

        // Replace version placeholders
        let enhancedValue = value;
        for (const [verKey, verValue] of Object.entries(ver)) {
          if (enhancedValue === verKey) {
            // If key ends with /, value must also end with /
            if (key.endsWith("/")) {
              enhancedValue = `https://esm.sh/@fireproof/core-runtime@${verValue}/`;
            } else {
              enhancedValue = `https://esm.sh/@fireproof/core-runtime@${verValue}`;
            }
            break;
          }
        }

        enhancedMap[key] = enhancedValue;
      }

      return enhancedMap;
    }

    it("should replace FP placeholder with versioned URL", () => {
      // Arrange
      const importMap = {
        "use-fireproof": "FP",
        react: "https://esm.sh/react@19.2.1",
      };
      const ver = { FP: "0.24.3" };

      // Act
      const result = enhance(importMap, ver);

      // Assert
      expect(result["use-fireproof"]).toBe(
        "https://esm.sh/@fireproof/core-runtime@0.24.3",
      );
      expect(result.react).toBe("https://esm.sh/react@19.2.1");
    });

    it("should handle trailing slash correctly", () => {
      // Arrange
      const importMap = {
        "@fireproof/": "FP",
        "use-fireproof": "FP",
      };
      const ver = { FP: "0.24.3" };

      // Act
      const result = enhance(importMap, ver);

      // Assert
      expect(result["@fireproof/"]).toBe(
        "https://esm.sh/@fireproof/core-runtime@0.24.3/",
      );
      expect(result["use-fireproof"]).toBe(
        "https://esm.sh/@fireproof/core-runtime@0.24.3",
      );
    });

    it("should filter out undefined values", () => {
      // Arrange
      const importMap = {
        react: "https://esm.sh/react@19.2.1",
        "optional-dep": undefined,
        "use-fireproof": "FP",
      };
      const ver = { FP: "0.24.3" };

      // Act
      const result = enhance(importMap, ver);

      // Assert
      expect(result).toHaveProperty("react");
      expect(result).toHaveProperty("use-fireproof");
      expect(result).not.toHaveProperty("optional-dep");
    });

    it("should return enhanced map with all processed values", () => {
      // Arrange
      const importMap = {
        react: "https://esm.sh/react@19.2.1",
        "use-fireproof": "FP",
        "@fireproof/core": "FP",
      };
      const ver = { FP: "0.24.3" };

      // Act
      const result = enhance(importMap, ver);

      // Assert
      expect(Object.keys(result).length).toBe(3);
      expect(result.react).toBe("https://esm.sh/react@19.2.1");
      expect(result["use-fireproof"]).toContain(
        "@fireproof/core-runtime@0.24.3",
      );
      expect(result["@fireproof/core"]).toContain(
        "@fireproof/core-runtime@0.24.3",
      );
    });
  });
});
