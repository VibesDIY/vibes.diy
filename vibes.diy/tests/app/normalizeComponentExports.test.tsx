import { describe, it, expect } from "vitest";
import { normalizeComponentExports } from "@vibes.diy/prompts";

describe("normalizeComponentExports", () => {
  // Case 1: TaskTracker pattern - function declaration followed by export
  it("properly normalizes function declaration followed by default export", () => {
    const input = `
import React from "react";

function TaskTracker() {
  return <div>Task Tracker Component</div>;
}

export default TaskTracker;
`;

    const expectedOutput = `
import React from "react";

function App() {
  return <div>Task Tracker Component</div>;
}

export default App;
`;

    expect(
      normalizeComponentExports(input).replace(/\s+/g, " ").trim(),
    ).toEqual(expectedOutput.replace(/\s+/g, " ").trim());
  });

  // Case 2: RecipeGenerator pattern - direct export default function
  it("properly normalizes export default function declaration", () => {
    const input = `
import React from "react";

export default function RecipeGenerator() {
  return <div>RecipeGenerator</div>;
}`;

    const normalized = normalizeComponentExports(input);

    // Check that we've replaced only the function declaration and not JSX content
    expect(normalized).toContain("export default function App");
    expect(normalized).toContain("return <div>RecipeGenerator</div>;");
    expect(normalized).not.toContain("function RecipeGenerator");
  });

  // Case 3: Class component
  it("properly normalizes class components", () => {
    const input = `
import React from "react";

class TodoList extends React.Component {
  render() {
    return <div>Todo List</div>;
  }
}

export default TodoList;
`;

    const expectedOutput = `
import React from "react";

class App extends React.Component {
  render() {
    return <div>Todo List</div>;
  }
}

export default App;
`;

    expect(
      normalizeComponentExports(input).replace(/\s+/g, " ").trim(),
    ).toEqual(expectedOutput.replace(/\s+/g, " ").trim());
  });

  // Case 4: Arrow function component with named variable
  it("properly normalizes arrow function component with variable declaration", () => {
    const input = `
import React from "react";

const Counter = () => {
  return <div>Counter</div>;
};

export default Counter;
`;

    const expectedOutput = `
import React from "react";

const Counter = () => {
  return <div>Counter</div>;
};

export default App;`;

    expect(
      normalizeComponentExports(input).replace(/\s+/g, " ").trim(),
    ).toEqual(expectedOutput.replace(/\s+/g, " ").trim());
  });

  // Case 5: Direct arrow function export
  it("handles direct arrow function export", () => {
    const input = `
import React from "react";

export default () => {
  return <div>Anonymous Component</div>;
};`;

    const expectedOutput = `
import React from "react";

const App = () => {
  return <div>Anonymous Component</div>;
}; 
export default App;`;

    expect(
      normalizeComponentExports(input).replace(/\s+/g, " ").trim(),
    ).toEqual(expectedOutput.replace(/\s+/g, " ").trim());
  });

  // Case 6: Higher-order component wrapping (memo)
  it("properly normalizes higher-order component exports", () => {
    const input = `
import React, { memo } from "react";

const UserProfile = () => {
  return <div>User Profile</div>;
};

export default memo(UserProfile);`;

    const expectedOutput = `
import React, { memo } from "react";

const UserProfile = () => {
  return <div>User Profile</div>;
};

const App = memo(UserProfile); export default App;`;

    expect(
      normalizeComponentExports(input).replace(/\s+/g, " ").trim(),
    ).toEqual(expectedOutput.replace(/\s+/g, " ").trim());
  });

  // Case 7: Object literal export
  it("properly normalizes object literal exports", () => {
    const input = `
import React from "react";

const Header = () => <header>My App</header>;
const Footer = () => <footer>Copyright 2025</footer>;

export default {
  Header,
  Footer
};`;

    // Using includes instead of exact match since regex replacements vary slightly
    const normalized = normalizeComponentExports(input)
      .replace(/\s+/g, " ")
      .trim();
    expect(normalized).toContain("const AppObject =");
    expect(normalized).toContain("const App = AppObject.default || AppObject");
    expect(normalized).toContain("export default App");
  });

  // Case 8: SymbioticCreatureGenerator pattern - with import statements
  it("properly normalizes export default function with multiple imports", () => {
    const input = `
import React, { useState } from 'react';
import { useFireproof } from '@fireproof/use-fireproof';
import { callAI } from 'call-ai';

export default function SymbioticCreatureGenerator() {
  const { database, useLiveQuery, useDocument } = useFireproof('symbiotic-creatures');

 return (
    <div className="p-4 max-w-2xl mx-auto bg-yellow-50 border-4 border-dashed border-orange-600 font-mono text-neutral-800">
      <h1 className="text-3xl font-bold text-center mb-4 text-purple-800 ">Symbiotic Creature Lab</h1>
    </div>
  );
}`;

    const normalized = normalizeComponentExports(input);

    // Check that function name is replaced in declaration, but not in JSX or strings
    expect(normalized).toContain("export default function App");
    expect(normalized).not.toContain("function SymbioticCreatureGenerator");
    expect(normalized).toContain("symbiotic-creatures");
    expect(normalized).toContain("Symbiotic Creature Lab");
    expect(normalized).toContain(
      "import { useFireproof } from '@fireproof/use-fireproof'",
    );
  });
});
