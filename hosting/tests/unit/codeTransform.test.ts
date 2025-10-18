import { describe, it, expect } from "vitest";
import { transformImports } from "@vibes.diy/hosting";

describe("transformImports function", () => {
  it("should normalize function names to App", () => {
    const testCode = `import React from 'react';
export default function MyCustomComponent() {
  return <div>Hello World</div>;
}`;

    const result = transformImports(testCode);

    expect(result).toContain("function App(");
    expect(result).toContain("export default App;");
    expect(result).not.toContain("export default function MyCustomComponent(");
  });

  it("should handle function names with various whitespace", () => {
    const testCode = `export default function    AsyncDataLab   () {
  return <div>Test</div>;
}`;

    const result = transformImports(testCode);

    expect(result).toContain("function App(");
    expect(result).toContain("export default App;");
    expect(result).not.toContain("AsyncDataLab");
  });

  it("should not transform imports that are in the libraryImportMap", () => {
    const testCode = `import React from 'react';
import { useFireproof } from 'use-fireproof';
import { callAI } from 'call-ai';
import * as Three from 'three';`;

    const result = transformImports(testCode);

    // Should remain unchanged since all imports are in libraryImportMap
    expect(result).toBe(testCode);
  });

  it("should transform imports that are not in the libraryImportMap", () => {
    const testCode = `import axios from 'axios';
import { debounce } from 'lodash';
import async from 'async';`;

    const result = transformImports(testCode);

    const expected = `import axios from "https://esm.sh/axios";
import { debounce } from "https://esm.sh/lodash";
import async from "https://esm.sh/async";`;

    expect(result).toBe(expected);
  });

  it("should not transform imports that are already URLs", () => {
    const testCode = `import React from 'https://esm.sh/react@19.1.1';
import axios from 'https://cdn.skypack.dev/axios';
import { something } from 'http://example.com/module';`;

    const result = transformImports(testCode);

    // Should remain unchanged since these are already URLs
    expect(result).toBe(testCode);
  });

  it("should handle mixed imports correctly", () => {
    const testCode = `import React from 'react';
import axios from 'axios';
import { useFireproof } from 'use-fireproof';
import { debounce } from 'lodash';
import something from 'https://esm.sh/something';`;

    const result = transformImports(testCode);

    const expected = `import React from 'react';
import axios from "https://esm.sh/axios";
import { useFireproof } from 'use-fireproof';
import { debounce } from "https://esm.sh/lodash";
import something from 'https://esm.sh/something';`;

    expect(result).toBe(expected);
  });

  it("should handle different import syntaxes", () => {
    const testCode = `import defaultExport from 'moment';
import * as everything from 'rxjs';
import { named1, named2 } from 'ramda';
import defaultExport, { named } from 'date-fns';`;

    const result = transformImports(testCode);

    const expected = `import defaultExport from "https://esm.sh/moment";
import * as everything from "https://esm.sh/rxjs";
import { named1, named2 } from "https://esm.sh/ramda";
import defaultExport, { named } from "https://esm.sh/date-fns";`;

    expect(result).toBe(expected);
  });

  it("should handle imports with and without semicolons", () => {
    const testCode = `import axios from 'axios'
import lodash from 'lodash';`;

    const result = transformImports(testCode);

    const expected = `import axios from "https://esm.sh/axios"
import lodash from "https://esm.sh/lodash";`;

    expect(result).toBe(expected);
  });

  it("should not transform relative imports", () => {
    const testCode = `import { helper } from './utils';
import config from '../config';
import Component from './components/Button';`;

    const result = transformImports(testCode);

    // Should remain unchanged since these are relative paths
    expect(result).toBe(testCode);
  });

  it("should handle edge cases with library imports", () => {
    // Test specifically that use-fireproof is not transformed
    const testCode = `import { useFireproof } from 'use-fireproof';
import { useState } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';`;

    const result = transformImports(testCode);

    // All should remain unchanged as they're in libraryImportMap
    expect(result).toBe(testCode);
  });

  it("should handle empty strings and malformed imports gracefully", () => {
    const testCode = ``;
    const result = transformImports(testCode);
    expect(result).toBe("");

    const malformedCode = `not an import statement
some other code
import incomplete`;
    const malformedResult = transformImports(malformedCode);
    expect(malformedResult).toBe(malformedCode);
  });

  it("should preserve original quote style when not transforming", () => {
    const testCode = `import React from "react";
import { useFireproof } from 'use-fireproof';`;

    const result = transformImports(testCode);

    // Should preserve original quotes
    expect(result).toBe(testCode);
  });

  it("should transform 'async' package correctly", () => {
    const testCode = `import async from 'async';`;
    const result = transformImports(testCode);
    const expected = `import async from "https://esm.sh/async";`;
    expect(result).toBe(expected);
  });

  it("should not transform biomimetic app imports that are in import map", () => {
    const testCode = `import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"
import { ImgGen } from "use-vibes"`;

    const result = transformImports(testCode);

    // Should remain unchanged since all imports are in libraryImportMap
    expect(result).toBe(testCode);
  });
});
