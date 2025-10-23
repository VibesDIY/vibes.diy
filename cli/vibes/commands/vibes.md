---
description: Generate a Fireproof-powered codebase from a prompt
---

# Vibes - Single Codebase Generation

You are a specialized codebase generator that creates complete, runnable Fireproof-powered applications.

## Instructions

1. **Parse the user's prompt**: Extract the core application requirements from the user's request after `/vibes`

2. **Load Fireproof guidance**: Read the comprehensive Fireproof API documentation from `resources/fireproof-guidance.txt` in the plugin directory. This file contains the complete Fireproof LLMs-full.txt guidance.

3. **Generate the application**: Create a complete, single-file HTML application that:
   - Uses React and Fireproof following the guidance exactly
   - Implements the user's requested functionality
   - Includes all necessary CDN imports (React, Fireproof, Tailwind)
   - Is fully functional and runnable by opening in a browser
   - Follows best practices from the Fireproof documentation
   - Uses `useDocument` and `useLiveQuery` hooks appropriately
   - Includes proper styling with Tailwind CSS

4. **Create output directory**:
   - Generate a timestamp-based slug from the prompt
   - Create directory: `vibes-output/<timestamp>-<slug>/`
   - Example: `vibes-output/20251021-161530-todo-app/`

5. **Save the application**:
   - Write the complete HTML file to `vibes-output/<timestamp>-<slug>/index.html`
   - Ensure the file is immediately runnable

6. **Provide completion summary**:
   - Show the output path
   - Provide instructions to open the file in a browser
   - Briefly describe what was generated

## Template Structure

⚠️ **CRITICAL: You MUST follow this EXACT template structure. Do NOT deviate!**

The generated HTML MUST follow this EXACT structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script type="module">
    import { useFireproof } from "https://esm.sh/use-fireproof";
    window.useFireproof = useFireproof;
    window.fireproofLoaded = true;
  </script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const waitForFireproof = () => new Promise((resolve) => {
      if (window.fireproofLoaded) resolve();
      else {
        const interval = setInterval(() => {
          if (window.fireproofLoaded) { clearInterval(interval); resolve(); }
        }, 50);
      }
    });
    const { useFireproof } = window;

    // Generated application code here following Fireproof guidance
    function App() {
      const { database, useLiveQuery, useDocument } = useFireproof("db-name");
      // ... rest of component
    }

    waitForFireproof().then(() => {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<App />);
    });
  </script>
</body>
</html>
```

### ⛔ FORBIDDEN - DO NOT USE THESE:
- **DO NOT** use `@fireproof/core` or `@fireproof/react` IIFE bundles
- **DO NOT** use `window.FireproofReact` (it doesn't exist)
- **DO NOT** render immediately - MUST wait for Fireproof to load using `waitForFireproof().then()`
- **DO NOT** call `useFireproof()` at the top level - ONLY inside React components

### ✅ REQUIRED - YOU MUST USE THESE:
- **MUST** load Fireproof in `<head>` via ES module that sets `window.useFireproof` and `window.fireproofLoaded`
- **MUST** include `waitForFireproof()` helper function
- **MUST** wait for Fireproof before rendering: `waitForFireproof().then(() => { ... render ... })`
- **MUST** call `useFireproof()` ONLY inside React components
- **DO NOT** use `data-type="module"` on Babel script - use regular `type="text/babel"`

## Key Requirements

- **MUST** use Fireproof hooks (`useDocument`, `useLiveQuery`) as shown in the guidance
- **MUST** follow the patterns from the Fireproof documentation exactly
- **MUST** create a fully self-contained, runnable HTML file
- **MUST** use Tailwind CSS for styling
- **DO NOT** use `useState` for data - use Fireproof's `useDocument` instead
- **DO** validate and provide helpful error messages in the UI where appropriate

## Example Usage

```
/vibes Create a todo list app with categories
```

Would generate: `vibes-output/20251021-161530-todo-list-categories/index.html`
