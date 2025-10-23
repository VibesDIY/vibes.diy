---
description: Generate multiple Fireproof codebase versions in parallel for comparison
---

# Vibes Select - Multi-Version Parallel Generation

You are a specialized orchestrator that generates multiple codebase variants in parallel for user comparison.

## Instructions

### Phase 1: Parse and Setup

1. **Parse the command**:
   - Extract the user's prompt after `/vibes-select`
   - Look for optional `--versions N` flag (default: 3)
   - Valid range: 2-5 versions (prevent overwhelming generation)

2. **Create output structure**:
   - Generate timestamp-based slug from prompt
   - Create base directory: `vibes-output/<timestamp>-<slug>/`
   - Example: `vibes-output/20251021-161530-todo-app/`

### Phase 2: Parallel Generation

3. **Load Fireproof guidance**: Read `resources/fireproof-guidance.txt` from the plugin directory

4. **Spawn parallel subagents**: Use the Task tool to launch N agents IN PARALLEL (in a single message with multiple Task tool calls):
   - Each agent generates a complete, distinct variation of the codebase
   - Each agent should interpret the prompt differently to create meaningful variants
   - Examples of variation strategies:
     - Different UI layouts (grid vs list, sidebar vs tabs)
     - Different feature priorities (simple vs feature-rich)
     - Different visual styles (minimal vs colorful, professional vs playful)
   - Each agent saves to: `vibes-output/<timestamp>-<slug>/version-{N}/index.html`

5. **Agent task specification**: Each subagent should receive:
   ```
   Generate a complete, runnable Fireproof application for this prompt: "{user_prompt}"

   Use the Fireproof guidance from resources/fireproof-guidance.txt

   Create a DISTINCT variation (version {N} of {total}). Make this version unique by:
   {variation_strategy_for_this_version}

   ⚠️ CRITICAL: You MUST follow the EXACT HTML template structure below!

   Generate a single-file HTML application with:
   - React + Fireproof hooks (useDocument, useLiveQuery)
   - Tailwind CSS styling
   - All CDN imports included
   - Fully functional and runnable

   REQUIRED HTML Structure:
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

       function App() {
         const { database, useLiveQuery, useDocument } = useFireproof("db-name");
         // Your app code here
       }

       waitForFireproof().then(() => {
         const root = ReactDOM.createRoot(document.getElementById('root'));
         root.render(<App />);
       });
     </script>
   </body>
   </html>

   ⛔ FORBIDDEN:
   - DO NOT use @fireproof/core or @fireproof/react IIFE bundles
   - DO NOT use window.FireproofReact (it doesn't exist)
   - DO NOT render immediately - MUST wait for Fireproof using waitForFireproof().then()
   - DO NOT call useFireproof() at top level - ONLY inside React components

   ✅ REQUIRED:
   - MUST load Fireproof in <head> via ES module that sets window.useFireproof and window.fireproofLoaded
   - MUST include waitForFireproof() helper function
   - MUST wait before rendering: waitForFireproof().then(() => { ... render ... })
   - MUST call useFireproof() ONLY inside React components
   - DO NOT use data-type="module" on Babel script - use regular type="text/babel"

   Save to: vibes-output/{timestamp}-{slug}/version-{N}/index.html
   ```

### Phase 3: Create Viewer

6. **Generate comparison viewer**: After all agents complete, create `vibes-output/<timestamp>-<slug>/viewer.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vibes Version Selector</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    iframe { border: none; }
  </style>
</head>
<body class="bg-gray-900">
  <div class="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 shadow-lg z-10">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Vibes Version Selector</h1>
        <p class="text-sm opacity-90">Use ← → arrow keys to navigate</p>
      </div>
      <div class="text-right">
        <p class="text-3xl font-bold" id="version-indicator">Version 1 of {total}</p>
        <p class="text-sm opacity-90">Press 'S' to select current version</p>
      </div>
    </div>
  </div>

  <div class="pt-24 h-screen">
    <iframe id="viewer" src="./version-1/index.html" class="w-full h-full"></iframe>
  </div>

  <script>
    const totalVersions = {total};
    let currentVersion = 1;

    function updateVersion(newVersion) {
      if (newVersion < 1 || newVersion > totalVersions) return;
      currentVersion = newVersion;
      document.getElementById('viewer').src = `./version-${currentVersion}/index.html`;
      document.getElementById('version-indicator').textContent = `Version ${currentVersion} of ${totalVersions}`;
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        updateVersion(currentVersion - 1);
      } else if (e.key === 'ArrowRight') {
        updateVersion(currentVersion + 1);
      } else if (e.key === 's' || e.key === 'S') {
        if (confirm(`Select Version ${currentVersion} as the final version?`)) {
          alert(`Version ${currentVersion} selected! Return to Claude Code to complete the selection process.`);
        }
      }
    });
  </script>
</body>
</html>
```

### Phase 4: User Selection

7. **Guide the user**:
   - Provide the path to viewer.html
   - Explain keyboard navigation (← → arrows, 'S' to mark preference)
   - Ask which version they prefer after they've reviewed

8. **Handle selection**:
   - Use AskUserQuestion tool to get their preferred version number
   - Options: "Version 1", "Version 2", etc., plus "Keep all versions"

9. **Cleanup non-selected versions**:
   - If user selected a specific version:
     - Ask for confirmation to delete others
     - If confirmed, delete all `version-N/` directories except selected
     - Rename selected version directory to `selected/` or move contents to parent
   - Provide summary of final output location

## Example Usage

```
/vibes-select Create a task management app --versions 3
```

Would generate:
- `vibes-output/20251021-161530-task-app/version-1/index.html`
- `vibes-output/20251021-161530-task-app/version-2/index.html`
- `vibes-output/20251021-161530-task-app/version-3/index.html`
- `vibes-output/20251021-161530-task-app/viewer.html`

## Variation Strategies

Ensure each version is meaningfully different:

1. **UI Layout Variations**:
   - Version 1: List-based layout
   - Version 2: Card/grid layout
   - Version 3: Kanban/column layout

2. **Feature Complexity Variations**:
   - Version 1: Minimal, essential features only
   - Version 2: Moderate features with filtering
   - Version 3: Feature-rich with categories, search, etc.

3. **Visual Style Variations**:
   - Version 1: Minimal, monochrome design
   - Version 2: Colorful, playful design
   - Version 3: Professional, business-focused design

## Important Notes

- **MUST** spawn all subagents in a single message (parallel execution)
- **MUST** ensure each version is distinctly different
- **MUST** wait for all agents to complete before creating viewer
- **MUST** follow Fireproof guidance exactly in all generated code
- **DO NOT** use placeholder code - all versions must be fully functional
