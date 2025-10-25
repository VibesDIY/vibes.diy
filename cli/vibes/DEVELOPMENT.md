# Vibes Plugin Development Summary

**Date**: 2025-10-24
**Status**: Initial implementation complete, ready for testing

## What We Built

A complete Claude Code plugin that provides a `/vibes` command for generating Fireproof/Vibes.diy codebases. The plugin uses the Agent Skills system to read system prompt patterns from the vibes.diy codebase and generate production-ready React applications.

## Plugin Architecture

### Directory Structure

```
cli/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace manifest
└── vibes/
    ├── .claude-plugin/
    │   └── plugin.json                # Plugin manifest
    ├── commands/
    │   ├── vibes.md                   # /vibes slash command (generate apps)
    │   └── vibes-update.md            # /vibes-update slash command (update prompts)
    ├── scripts/
    │   └── build-plugin-data.js       # Builds plugin-data.json from monorepo
    ├── skills/
    │   └── vibes-generator/
    │       ├── SKILL.md               # Core generation logic (most important file)
    │       └── templates/             # Vite project templates
    │           ├── package.json.template
    │           ├── vite.config.js.template
    │           ├── tailwind.config.js.template
    │           ├── postcss.config.js.template
    │           ├── index.html.template
    │           ├── src/
    │           │   ├── index.css.template
    │           │   └── main.jsx.template
    │           └── gitignore.template
    ├── package.json                   # Build scripts and metadata
    ├── plugin-data.json               # Cached prompt data (generated, 127KB)
    ├── README.md                      # User documentation
    └── DEVELOPMENT.md                 # This file
```

### Component Roles

#### 1. Marketplace (`cli/.claude-plugin/marketplace.json`)
- Defines the "vibes-marketplace" with local plugin source
- Points to `./vibes` as the plugin directory
- Enables local development and testing

#### 2. Plugin Manifest (`cli/vibes/.claude-plugin/plugin.json`)
- Name: `vibes`
- Describes the plugin functionality
- Metadata for marketplace listing

#### 3. Command (`cli/vibes/commands/vibes.md`)
- User-facing `/vibes` command
- Prompts for app description and output directory
- Invokes the `vibes-generator` Skill
- Provides post-generation instructions

#### 4. Skill (`cli/vibes/skills/vibes-generator/SKILL.md`)
**This is the core of the plugin** - 300+ lines of instructions for Claude

**Key responsibilities:**
1. Load cached prompt data from `plugin-data.json`
2. Parse JSON to extract:
   - Core guidelines (react, fireproof, callAI, ui, imports, tailwind)
   - Style prompts (default: "brutalist web")
   - Library documentation (fireproof, callai, d3, three-js, web-audio, image-gen)
3. Generate augmented system prompt combining:
   - User's app description
   - Core guidelines from JSON
   - Selected style prompt
   - Relevant library documentation
4. Create React component code in `App.jsx`
5. Process templates and write complete Vite project
6. Output installation instructions

**Important patterns it implements:**
- Uses `useFireproof` hook from use-vibes package
- Integrates callAI for LLM features with streaming + schemas
- Applies "brutalist web" design aesthetic by default
- Mobile-first responsive layout with Tailwind
- Real-time data updates with Fireproof live queries

#### 5. Templates (`cli/vibes/skills/vibes-generator/templates/`)
Pre-configured files with `{{PLACEHOLDER}}` syntax:
- `package.json.template` - Dependencies (React 19, use-vibes, Vite)
- `vite.config.js.template` - Vite + React plugin config
- `index.html.template` - HTML entry point with {{APP_TITLE}}
- `main.jsx.template` - React root mounting logic
- `gitignore.template` - Standard Node.js ignores

## How It Works

### Generation Flow

```
User runs: /vibes
    ↓
Command prompts for:
  - App description
  - Output directory (default: ./vibes-app)
    ↓
Skill activates and:
  1. Loads plugin-data.json (cached prompts, styles, library docs)
  2. Parses JSON to extract core guidelines and style prompts
  3. Selects default style ("brutalist web") or user-requested style
  4. Generates comprehensive system prompt
  5. Uses that prompt to create App.jsx component code
  6. Processes templates (replaces {{APP_NAME}}, {{APP_TITLE}})
  7. Writes complete project structure:
     - package.json
     - vite.config.js
     - index.html
     - .gitignore
     - src/main.jsx
     - src/App.jsx
  8. Outputs: cd <dir> && npm install && npm run dev
    ↓
User gets complete, runnable Vite project
```

### Key Design Decisions

1. **Skill-based approach**: Uses Agent Skills for progressive disclosure
   - Only loads instructions when triggered
   - Can read from vibes.diy codebase files
   - No runtime dependencies needed

2. **Template-based**: Pre-configured Vite project structure
   - Consistent project setup
   - Easy to maintain and update
   - Placeholder substitution for customization

3. **Single-file output**: Generated app is one `App.jsx` file
   - Follows vibes.diy pattern
   - Easy to understand and modify
   - All app logic in one place

4. **use-vibes package**: Uses official package
   - Includes useFireproof hook
   - callAI imported via use-vibes
   - Ensures compatibility

## Differences from Existing vibes:vibes Plugin

There's another plugin providing `/vibes:vibes` command that:
- Creates **single-file HTML** applications
- Uses CDN imports (React, Fireproof via ESM)
- Uses `@babel/standalone` for JSX transformation
- Outputs to `vibes-output/<timestamp>-<slug>/index.html`
- Immediately runnable in browser (no build step)

**Our new plugin:**
- Creates **Vite projects** with build pipeline
- Uses npm packages (modern development workflow)
- Outputs to user-specified directory (e.g., `./vibes-app`)
- Requires `npm install` and `npm run dev`
- Proper development experience with HMR

Both are valid approaches for different use cases:
- **Single-file HTML**: Quick prototypes, no build tools needed
- **Vite project** (ours): Production apps, proper dev workflow

## Installation & Testing

### Install the plugin

```bash
# In Claude Code:
/plugin marketplace add ./cli
/plugin install vibes@vibes-marketplace
# Restart when prompted
```

### Test the plugin

```bash
/vibes
```

Then:
1. Enter app description (e.g., "todo list with AI suggestions")
2. Enter output path (or use default `./vibes-app`)
3. Verify files created
4. Test the app:
   ```bash
   cd vibes-app  # or your chosen directory
   npm install
   npm run dev
   ```

### Verify generated code

Check that `src/App.jsx`:
- Imports from `use-vibes` (not `use-fireproof`)
- Uses `useFireproof` hook correctly
- Implements user's requested features
- Follows brutalist web styling
- Has proper error handling

## Integration with Vibes.diy Codebase

The Skill reads these files to understand patterns:

### System Prompt Generation (`prompts/pkg/prompts.ts`)
- `makeBaseSystemPrompt()` function (line ~297)
- Shows how to combine:
  - User prompt
  - Library selections
  - Style guidelines
  - Documentation snippets

### Library Catalog (`prompts/pkg/llms/`)
- `index.ts` - Exports all library configs
- `fireproof.ts` - Fireproof API documentation
- `callai.ts` - callAI integration patterns
- `image-gen.ts`, `d3.ts`, `three-js.ts`, `web-audio.ts` - Optional libraries

Each config has:
```typescript
{
  name: "fireproof",
  label: "Fireproof",
  description: "...",
  importModule: "use-vibes",
  importName: "useFireproof",
  importType: "named",
  // ... plus documentation text
}
```

### Style Prompts (`prompts/pkg/style-prompts.ts`)
- Array of style options
- Default: "brutalist web" (DEFAULT_STYLE_NAME)
- Detailed CSS/design guidance

The Skill doesn't import these as TypeScript, but reads them to understand the patterns and implement similar logic.

## Dependencies in Generated Projects

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "use-fireproof": "^0.23.15",
    "call-ai": "^0.15.13"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.4",
    "vite": "^7.1.9",
    "tailwindcss": "^3.4.18",
    "postcss": "^8.5.6",
    "autoprefixer": "^10.4.21"
  }
}
```

Note: We use `use-fireproof` and `call-ai` packages directly instead of `use-vibes` because the latter has unpublished dependencies (`@vibes.diy/use-vibes-types`) that cause npm install failures.

## Example Generated App Structure

```javascript
import React, { useState } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

export default function App() {
  const { database, useLiveQuery } = useFireproof("my-app-db")

  // Real-time query
  const result = useLiveQuery(doc => doc.type === "item", [])
  const items = result.docs || []

  // AI-powered function
  const handleAI = async (prompt) => {
    const response = await callAI(prompt, {
      stream: true,
      schema: {
        properties: {
          title: { type: "string" },
          description: { type: "string" }
        }
      }
    })

    await database.put({
      type: "item",
      ...JSON.parse(response),
      createdAt: Date.now()
    })
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4">
      {/* Brutalist web styled UI */}
    </div>
  )
}
```

## Known Issues & Todos

### Testing Needed
- [ ] Test plugin installation flow
- [ ] Verify Skill can read vibes.diy files correctly
- [ ] Test generated apps actually work
- [ ] Verify npm install succeeds
- [ ] Check HMR works in development

### Potential Issues
1. **Path resolution**: Skill needs to read from vibes.diy codebase root
2. **Template placeholders**: Ensure all `{{PLACEHOLDERS}}` are replaced
3. **Generated code syntax**: JSX must be valid
4. **Database naming**: Should be derived from app name

### Future Enhancements
- [ ] Support for additional libraries (D3, Three.js, Web Audio)
- [ ] Custom style selection (not just brutalist web)
- [ ] TypeScript option
- [ ] Multi-page apps
- [ ] Component library integration
- [ ] Deployment scripts (Netlify, Vercel)

## Plugin Data Build Process

### Overview

The plugin uses a standalone architecture with cached prompt data in `plugin-data.json`. This eliminates the need for users to clone the entire vibes.diy monorepo.

### Build Script: `scripts/build-plugin-data.js`

**Purpose**: Extracts data from the vibes.diy monorepo and compiles it into a single JSON file.

**Source Files**:
- `prompts/pkg/style-prompts.ts` - Style themes (brutalist web, memphis, etc.)
- `prompts/pkg/llms/*.txt|md` - Library documentation (fireproof, callai, d3, three-js, web-audio, image-gen)

**Output**: `plugin-data.json` (127KB)

**Structure**:
```json
{
  "version": "1.0.0",
  "generatedAt": "2025-10-24T...",
  "repository": "https://github.com/fireproof-storage/vibes.diy",
  "coreGuidelines": {
    "react": "...",
    "fireproof": "...",
    "callAI": "...",
    "ui": "...",
    "imports": "...",
    "tailwind": "..."
  },
  "stylePrompts": [
    { "name": "brutalist web", "prompt": "..." },
    { "name": "memphis", "prompt": "..." },
    ...
  ],
  "defaultStyle": "brutalist web",
  "libraries": {
    "fireproof": "...",
    "callai": "...",
    "d3": "...",
    "three-js": "...",
    "web-audio": "...",
    "image-gen": "..."
  }
}
```

### Running the Build

From the `cli/vibes` directory:

```bash
npm run build-plugin-data
```

Output:
```
Building plugin data from vibes.diy repository...

✓ Extracted 11 style prompts (default: brutalist web)
✓ Loaded fireproof.txt
✓ Loaded callai.txt
✓ Loaded d3.md
✓ Loaded three-js.md
✓ Loaded web-audio.txt
✓ Loaded image-gen.txt

✓ Plugin data compiled successfully!
  Output: /path/to/cli/vibes/plugin-data.json
  Size: 127.09 KB
  Styles: 11
  Libraries: 6
```

### When to Rebuild

Rebuild `plugin-data.json` when:
- Style prompts change in `prompts/pkg/style-prompts.ts`
- Library documentation updates in `prompts/pkg/llms/*.txt|md`
- Core guidelines need to be updated in the build script

### Updating Plugin Data

**For maintainers**:

After rebuilding plugin-data.json:
1. Increment the version number in the build script or manually in the JSON
2. Commit the new `plugin-data.json` to the repository
3. Push to GitHub main branch
4. Users can then update via `/vibes-update` command

**For users**:

Users have two options for updating their cached prompt data:

**Option 1: `/vibes-update` command (Recommended)**
```shell
/vibes-update
```

This command will:
- Check current vs. latest version
- Show what's changed
- Ask for confirmation
- Create backup before updating
- Download and apply the update

**Option 2: Manual curl (Alternative)**
```bash
curl -o ~/.claude/plugins/vibes@vibes-marketplace/plugin-data.json \
  https://raw.githubusercontent.com/fireproof-storage/vibes.diy/main/cli/vibes/plugin-data.json
```

### Distribution

The `plugin-data.json` file is:
1. **Committed** to the repository
2. **Distributed** with the plugin
3. **Loaded** by SKILL.md at runtime via `cat ${CLAUDE_PLUGIN_ROOT}/../plugin-data.json`
4. **Updated** when the plugin is updated, or manually refreshed by users

This architecture enables:
- **Offline-first** plugin operation
- **No monorepo dependency** for end users
- **Easy updates** via GitHub raw URLs
- **Version control** of prompt data

## Lessons Learned from Testing

### Fantasy OS Simulator Test (2025-10-24)

Successfully generated a complete fantasy operating system simulator to test the plugin. Key findings:

#### Issues Discovered

1. **Broken use-vibes Dependency**
   - `use-vibes@0.14.6` depends on `@vibes.diy/use-vibes-types` which isn't published to npm
   - This caused npm install to fail with 404 errors
   - **Solution**: Use `use-fireproof` and `call-ai` packages directly

2. **Missing Tailwind CSS Setup**
   - Generated projects didn't include Tailwind configuration files
   - Had to manually install and configure Tailwind after generation
   - **Solution**: Added tailwind.config.js, postcss.config.js, and src/index.css templates

3. **Tailwind v4 Incompatibility**
   - Initial attempt to use Tailwind v4 failed due to PostCSS plugin changes
   - **Solution**: Use Tailwind v3.x (stable and compatible)

#### Fixes Implemented

1. **Updated package.json.template**
   - Changed from `use-vibes@^0.14.6` to:
     - `use-fireproof@^0.23.15`
     - `call-ai@^0.15.13`
   - Added Tailwind CSS dependencies:
     - `tailwindcss@^3.4.18`
     - `postcss@^8.5.6`
     - `autoprefixer@^10.4.21`

2. **Added Tailwind Configuration Templates**
   - `tailwind.config.js.template` - Tailwind CSS config
   - `postcss.config.js.template` - PostCSS config
   - `src/index.css.template` - Tailwind directives
   - Updated `main.jsx.template` to import index.css

3. **Updated All Documentation**
   - SKILL.md: Corrected import statements and added Tailwind setup steps
   - README.md: Updated project structure and dependencies
   - DEVELOPMENT.md: Documented the issues and solutions

#### Test Results

- ✅ Generated Fantasy OS app with draggable windows, file manager, notepad, terminal
- ✅ npm install completed without errors
- ✅ npm run dev started successfully
- ✅ Tailwind CSS compiled correctly
- ✅ All Fireproof features (live queries, persistence) working
- ✅ Brutalist web styling applied correctly

The plugin now generates fully working Vite projects with no manual configuration required.

## Troubleshooting

### Plugin not found
- Check marketplace was added: `/plugin marketplace list`
- Verify plugin installed: `/plugin` (browse installed)
- Try reinstalling after restart

### Skill can't read files
- Ensure running from vibes.diy repo root
- Check file paths in SKILL.md are correct
- Verify `prompts/pkg/` exists

### Generated code errors
- Check template syntax in `templates/`
- Verify placeholder replacement works
- Ensure imports use `use-fireproof` and `call-ai` (not `use-vibes`)

### npm install fails
- Check package.json syntax
- Verify use-fireproof and call-ai versions are correct
- Ensure Tailwind CSS v3 is specified (not v4)
- Try clearing npm cache

## Next Steps

1. **Test the plugin end-to-end**
   - Install in fresh Claude Code session
   - Generate a test app
   - Verify it runs

2. **Refine based on testing**
   - Fix any path issues
   - Improve generated code quality
   - Better error handling

3. **Documentation**
   - Add examples to README
   - Create video walkthrough
   - Write blog post

4. **Distribution**
   - Push to GitHub
   - Create public marketplace
   - Announce to community

## Resources

- **Plugin docs**: Claude Code plugin documentation (provided by user)
- **Vibes.diy codebase**: `/Users/marcusestes/Websites/vibes.diy/`
- **Key files**:
  - `prompts/pkg/prompts.ts` - System prompt logic
  - `prompts/pkg/llms/*.ts` - Library catalog
  - `use-vibes/examples/react-example/` - Reference implementation

## Contact

For questions or issues:
- **GitHub**: https://github.com/fireproof-storage/vibes.diy
- **Email**: hello@vibes.diy
