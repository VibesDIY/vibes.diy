import { describe, it, expect } from "vitest";
import { transformImports } from "../../pkg/app/utils/dev-shims.js";

describe("transformImports - Bare Import Transformation", () => {
  it("should not transform imports that are in the libraryImportMap", () => {
    const testCode = `import React from 'react';
import { useFireproof } from 'use-fireproof';
import { callAI } from 'call-ai';
import * as Three from 'three';`;

    const result = transformImports(testCode);

    // Should keep imports unchanged
    expect(result).toContain("import React from 'react'");
    expect(result).toContain("import { useFireproof } from 'use-fireproof'");
    expect(result).toContain("import { callAI } from 'call-ai'");
  });

  it("should transform imports that are not in the libraryImportMap", () => {
    const testCode = `import axios from 'axios';
import { debounce } from 'lodash';
import async from 'async';`;

    const result = transformImports(testCode);

    expect(result).toContain('import axios from "https://esm.sh/axios"');
    expect(result).toContain(
      'import { debounce } from "https://esm.sh/lodash"',
    );
    expect(result).toContain('import async from "https://esm.sh/async"');
  });

  it("should not transform imports that are already URLs", () => {
    const testCode = `import React from 'https://esm.sh/react@19.1.1';
import axios from 'https://cdn.skypack.dev/axios';
import { something } from 'http://example.com/module';`;

    const result = transformImports(testCode);

    // Should remain unchanged since these are already URLs
    expect(result).toContain("import React from 'https://esm.sh/react@19.1.1'");
    expect(result).toContain(
      "import axios from 'https://cdn.skypack.dev/axios'",
    );
    expect(result).toContain(
      "import { something } from 'http://example.com/module'",
    );
  });

  it("should handle mixed imports correctly", () => {
    const testCode = `import React from 'react';
import axios from 'axios';
import { useFireproof } from 'use-fireproof';
import { debounce } from 'lodash';
import something from 'https://esm.sh/something';`;

    const result = transformImports(testCode);

    expect(result).toContain("import React from 'react'");
    expect(result).toContain('import axios from "https://esm.sh/axios"');
    expect(result).toContain("import { useFireproof } from 'use-fireproof'");
    expect(result).toContain(
      'import { debounce } from "https://esm.sh/lodash"',
    );
    expect(result).toContain(
      "import something from 'https://esm.sh/something'",
    );
  });

  it("should handle different import syntaxes", () => {
    const testCode = `import defaultExport from 'moment';
import * as everything from 'rxjs';
import { named1, named2 } from 'ramda';
import defaultExport, { named } from 'date-fns';`;

    const result = transformImports(testCode);

    expect(result).toContain(
      'import defaultExport from "https://esm.sh/moment"',
    );
    expect(result).toContain(
      'import * as everything from "https://esm.sh/rxjs"',
    );
    expect(result).toContain(
      'import { named1, named2 } from "https://esm.sh/ramda"',
    );
    expect(result).toContain(
      'import defaultExport, { named } from "https://esm.sh/date-fns"',
    );
  });

  it("should handle imports with and without semicolons", () => {
    const testCode = `import axios from 'axios'
import lodash from 'lodash';`;

    const result = transformImports(testCode);

    expect(result).toContain('import axios from "https://esm.sh/axios"');
    expect(result).toContain('import lodash from "https://esm.sh/lodash"');
  });

  it("should not transform relative imports", () => {
    const testCode = `import { helper } from './utils';
import config from '../config';
import Component from './components/Button';`;

    const result = transformImports(testCode);

    // Should remain unchanged since these are relative paths
    expect(result).toContain("import { helper } from './utils'");
    expect(result).toContain("import config from '../config'");
    expect(result).toContain("import Component from './components/Button'");
  });

  it("should handle edge cases with library imports", () => {
    // Test specifically that use-fireproof is not transformed
    const testCode = `import { useFireproof } from 'use-fireproof';
import { useState } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';`;

    const result = transformImports(testCode);

    // All should remain unchanged as they're in libraryImportMap
    expect(result).toContain("import { useFireproof } from 'use-fireproof'");
    expect(result).toContain("import { useState } from 'react'");
    expect(result).toContain("import ReactDOM from 'react-dom'");
    expect(result).toContain("import { createRoot } from 'react-dom/client'");
  });

  it("should handle empty strings gracefully", () => {
    const testCode = ``;
    const result = transformImports(testCode);
    expect(result).toBe("");
  });

  it("should handle malformed imports gracefully", () => {
    const malformedCode = `not an import statement
some other code
import incomplete`;
    const result = transformImports(malformedCode);
    // Should not crash, just return the code as-is
    expect(result).toContain("not an import statement");
    expect(result).toContain("some other code");
  });

  it("should preserve original quote style when not transforming", () => {
    const testCode = `import React from "react";
import { useFireproof } from 'use-fireproof';`;

    const result = transformImports(testCode);

    // Should preserve original quotes
    expect(result).toContain('import React from "react"');
    expect(result).toContain("import { useFireproof } from 'use-fireproof'");
  });

  it("should transform 'async' package correctly", () => {
    const testCode = `import async from 'async';`;
    const result = transformImports(testCode);
    expect(result).toContain('import async from "https://esm.sh/async"');
  });

  it("should handle d3 import (the bug we're fixing)", () => {
    const testCode = `import * as d3 from 'd3';`;
    const result = transformImports(testCode);
    expect(result).toContain('import * as d3 from "https://esm.sh/d3"');
  });

  it("should not transform biomimetic app imports that are in import map", () => {
    const testCode = `import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"
import { ImgGen } from "use-vibes"`;

    const result = transformImports(testCode);

    // Should keep all imports unchanged since they're in libraryImportMap
    expect(result).toContain(
      'import React, { useState, useEffect } from "react"',
    );
    expect(result).toContain('import { useFireproof } from "use-fireproof"');
    expect(result).toContain('import { callAI } from "call-ai"');
    expect(result).toContain('import { ImgGen } from "use-vibes"');
  });

  it("should handle JSX runtime import", () => {
    const testCode = `import { jsx } from 'react/jsx-runtime';`;
    const result = transformImports(testCode);
    // react/jsx-runtime is in the library map, should not be transformed
    expect(result).toContain("import { jsx } from 'react/jsx-runtime'");
  });
});
