import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateCodeHeadless,
  formatValidationErrors,
  type ValidationError,
} from "../../pkg/app/utils/validateCodeHeadless.js";
import type { Monaco } from "@monaco-editor/react";

describe("validateCodeHeadless", () => {
  let mockMonaco: Monaco;
  let mockModel: any;
  let mockMarkers: any[];

  beforeEach(() => {
    // Reset markers for each test
    mockMarkers = [];

    // Mock Monaco model
    mockModel = {
      dispose: vi.fn(),
      uri: { toString: () => "inmemory://validate.jsx" },
      getLineCount: vi.fn(() => 10),
      getLanguageId: vi.fn(() => "javascript"),
    };

    // Mock Monaco API
    mockMonaco = {
      editor: {
        createModel: vi.fn(() => mockModel),
        getModelMarkers: vi.fn(() => mockMarkers),
      },
      Uri: {
        parse: vi.fn((uri: string) => ({ toString: () => uri })),
      },
      MarkerSeverity: {
        Error: 8,
        Warning: 4,
        Info: 2,
        Hint: 1,
      },
    } as any;
  });

  describe("valid code", () => {
    it("should return empty array for valid JavaScript code", async () => {
      const validCode = `
        function greet(name) {
          return "Hello, " + name;
        }
      `;

      const errors = await validateCodeHeadless(validCode, mockMonaco);

      expect(errors).toEqual([]);
      expect(mockMonaco.editor.createModel).toHaveBeenCalledWith(
        validCode,
        "javascript",
        expect.anything(),
      );
      expect(mockModel.dispose).toHaveBeenCalled();
    });

    it("should return empty array for valid JSX code", async () => {
      const validJSX = `
        export default function App() {
          return <div>Hello World</div>;
        }
      `;

      const errors = await validateCodeHeadless(validJSX, mockMonaco);

      expect(errors).toEqual([]);
      expect(mockModel.dispose).toHaveBeenCalled();
    });

    it("should return empty array for valid React component with hooks", async () => {
      const validReactCode = `
        import { useState } from 'react';

        export default function Counter() {
          const [count, setCount] = useState(0);
          return (
            <button onClick={() => setCount(count + 1)}>
              Count: {count}
            </button>
          );
        }
      `;

      const errors = await validateCodeHeadless(validReactCode, mockMonaco);

      expect(errors).toEqual([]);
    });
  });

  describe("code with syntax errors", () => {
    it("should detect missing closing brace", async () => {
      mockMarkers = [
        {
          startLineNumber: 3,
          startColumn: 1,
          endLineNumber: 3,
          endColumn: 1,
          message: "'}' expected.",
          severity: 8,
        },
      ];

      const invalidCode = `
        function broken() {
          return "missing brace";
      `;

      const errors = await validateCodeHeadless(invalidCode, mockMonaco);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        line: 3,
        column: 1,
        endLine: 3,
        endColumn: 1,
        message: "'}' expected.",
        severity: 8,
      });
    });

    it("should detect multiple syntax errors", async () => {
      mockMarkers = [
        {
          startLineNumber: 2,
          startColumn: 15,
          endLineNumber: 2,
          endColumn: 16,
          message: "';' expected.",
          severity: 8,
        },
        {
          startLineNumber: 3,
          startColumn: 1,
          endLineNumber: 3,
          endColumn: 1,
          message: "'}' expected.",
          severity: 8,
        },
      ];

      const multipleErrorsCode = `
        const x = 5
        function test() {
      `;

      const errors = await validateCodeHeadless(multipleErrorsCode, mockMonaco);

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe("';' expected.");
      expect(errors[1].message).toBe("'}' expected.");
    });

    it("should detect JSX syntax errors", async () => {
      mockMarkers = [
        {
          startLineNumber: 2,
          startColumn: 18,
          endLineNumber: 2,
          endColumn: 19,
          message: "'>' expected.",
          severity: 8,
        },
      ];

      const invalidJSX = `
        return <div Hello World</div>;
      `;

      const errors = await validateCodeHeadless(invalidJSX, mockMonaco);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("'>' expected.");
      expect(errors[0].line).toBe(2);
    });

    it("should detect unclosed JSX tags", async () => {
      mockMarkers = [
        {
          startLineNumber: 3,
          startColumn: 1,
          endLineNumber: 3,
          endColumn: 1,
          message: "JSX element 'div' has no corresponding closing tag.",
          severity: 8,
        },
      ];

      const unclosedJSX = `
        export default function App() {
          return <div>Hello;
        }
      `;

      const errors = await validateCodeHeadless(unclosedJSX, mockMonaco);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("closing tag");
    });
  });

  describe("filtering by severity", () => {
    it("should only return errors, not warnings", async () => {
      mockMarkers = [
        {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 10,
          message: "Unused variable",
          severity: 4, // Warning
        },
        {
          startLineNumber: 2,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 1,
          message: "';' expected.",
          severity: 8, // Error
        },
      ];

      const codeWithWarnings = `
        const unused = 5
        const x = 10
      `;

      const errors = await validateCodeHeadless(codeWithWarnings, mockMonaco);

      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe(8);
      expect(errors[0].message).toBe("';' expected.");
    });

    it("should filter out hints and info messages", async () => {
      mockMarkers = [
        {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 5,
          message: "Consider using const",
          severity: 1, // Hint
        },
        {
          startLineNumber: 2,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 10,
          message: "This can be optimized",
          severity: 2, // Info
        },
      ];

      const errors = await validateCodeHeadless(
        "let x = 5;\nlet y = 10;",
        mockMonaco,
      );

      expect(errors).toHaveLength(0);
    });
  });

  describe("model lifecycle", () => {
    it("should create model with correct parameters", async () => {
      await validateCodeHeadless("const x = 5;", mockMonaco);

      expect(mockMonaco.editor.createModel).toHaveBeenCalledWith(
        "const x = 5;",
        "javascript",
        expect.anything(),
      );
      expect(mockMonaco.Uri.parse).toHaveBeenCalledWith(
        "inmemory://validate.jsx",
      );
    });

    it("should dispose model after validation", async () => {
      await validateCodeHeadless("const x = 5;", mockMonaco);

      expect(mockModel.dispose).toHaveBeenCalledTimes(1);
    });

    it("should dispose model even when errors are found", async () => {
      mockMarkers = [
        {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: "Error",
          severity: 8,
        },
      ];

      await validateCodeHeadless("invalid code", mockMonaco);

      expect(mockModel.dispose).toHaveBeenCalledTimes(1);
    });

    it("should query markers with correct resource", async () => {
      await validateCodeHeadless("const x = 5;", mockMonaco);

      expect(mockMonaco.editor.getModelMarkers).toHaveBeenCalledWith({
        resource: mockModel.uri,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty code", async () => {
      const errors = await validateCodeHeadless("", mockMonaco);

      expect(errors).toEqual([]);
      expect(mockModel.dispose).toHaveBeenCalled();
    });

    it("should handle code with only whitespace", async () => {
      const errors = await validateCodeHeadless("   \n\n  \t  ", mockMonaco);

      expect(errors).toEqual([]);
    });

    it("should handle very long code", async () => {
      const longCode = "const x = 1;\n".repeat(1000);

      const errors = await validateCodeHeadless(longCode, mockMonaco);

      expect(errors).toEqual([]);
      expect(mockModel.dispose).toHaveBeenCalled();
    });
  });
});

describe("formatValidationErrors", () => {
  it("should return empty string for no errors", () => {
    const formatted = formatValidationErrors([]);

    expect(formatted).toBe("");
  });

  it("should format single error correctly", () => {
    const errors: ValidationError[] = [
      {
        line: 5,
        column: 10,
        endLine: 5,
        endColumn: 15,
        message: "';' expected.",
        severity: 8,
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("Found 1 syntax error:");
    expect(formatted).toContain("Line 5, Column 10: ';' expected.");
  });

  it("should format multiple errors correctly", () => {
    const errors: ValidationError[] = [
      {
        line: 2,
        column: 5,
        endLine: 2,
        endColumn: 10,
        message: "'}' expected.",
        severity: 8,
      },
      {
        line: 7,
        column: 1,
        endLine: 7,
        endColumn: 1,
        message: "';' expected.",
        severity: 8,
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("Found 2 syntax errors:");
    expect(formatted).toContain("Line 2, Column 5: '}' expected.");
    expect(formatted).toContain("Line 7, Column 1: ';' expected.");
  });

  it("should use correct plural form", () => {
    const oneError = formatValidationErrors([
      {
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: "Error",
        severity: 8,
      },
    ]);

    const twoErrors = formatValidationErrors([
      {
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: "Error 1",
        severity: 8,
      },
      {
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 1,
        message: "Error 2",
        severity: 8,
      },
    ]);

    expect(oneError).toContain("1 syntax error:");
    expect(twoErrors).toContain("2 syntax errors:");
  });

  it("should include all error details in output", () => {
    const errors: ValidationError[] = [
      {
        line: 10,
        column: 25,
        endLine: 10,
        endColumn: 30,
        message: "Cannot find name 'foo'.",
        severity: 8,
      },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain("Line 10");
    expect(formatted).toContain("Column 25");
    expect(formatted).toContain("Cannot find name 'foo'.");
  });
});
