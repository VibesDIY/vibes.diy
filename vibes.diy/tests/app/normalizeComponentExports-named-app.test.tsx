import { describe, it, expect } from "vitest";
import { normalizeComponentExports } from "@vibes.diy/prompts";

describe("normalizeComponentExports edge cases", () => {
  // Test for the case in app1.jsx where a component named 'App' is already declared
  it("should handle components already named App correctly", () => {
    const input = `
import React, { useRef, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { callAI } from "call-ai";

const App = () => {
  // Component implementation...
  return (
    <div>App content</div>
  );
};

export default App;
`;

    const normalized = normalizeComponentExports(input);

    // The function should detect that App is already declared and not try to redeclare it
    expect(normalized).not.toContain("const App = App");

    // Should still have the export default App
    expect(normalized).toContain("export default App");

    // Overall structure should be preserved
    expect(normalized).toContain("const App = () => {");

    // Make sure we don't have duplicate exports
    const exportCount = (normalized.match(/export\s+default\s+App/g) || [])
      .length;
    expect(exportCount).toBe(1);
  });

  // Direct test of the exact case from app1.jsx causing the error
  it("should correctly handle the app1.jsx example file", () => {
    // Simplified version of app1.jsx that reproduces the error
    const input = `
import React, { useRef, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { callAI } from "call-ai";

const App = () => {
  const { useDocument, useLiveQuery } = useFireproof("guitar-solos");
  // More implementation details...
  
  return (
    <div className="p-6 max-w-screen-xl mx-auto bg-white shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-4 text-center">Hendrix-Like Guitar Solos Generator</h1>
      {/* More JSX */}
    </div>
  );
};

export default App;
`;

    const normalized = normalizeComponentExports(input);

    // Should not result in duplicate App declarations
    expect(normalized).not.toMatch(/const\s+App\s+=\s+App/);

    // Check for specific syntax error patterns
    expect(normalized).not.toMatch(/const\s+App\s+=\s+App/); // No duplicate App declarations
    expect(normalized).toContain("export default App"); // Has the export
    expect(normalized).not.toMatch(
      /export\s+default\s+App.*export\s+default\s+App/s,
    ); // No duplicate exports
  });

  // Test with variable declaration pattern
  it("should handle variable declarations that are already named App", () => {
    const input = `
import React from "react";

// Component already named App
const App = ({ count }) => {
  return <div>{count}</div>;
};

export default App;
`;

    const normalized = normalizeComponentExports(input);

    // Should not add redundant declaration
    expect(normalized).not.toMatch(/const\s+App\s+=\s+App/);

    // Should maintain the original declaration
    expect(normalized).toContain("const App = ({ count }) => {");

    // Should have exactly one export default App
    const exportCount = (normalized.match(/export\s+default\s+App/g) || [])
      .length;
    expect(exportCount).toBe(1);
  });
});
