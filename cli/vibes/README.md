# Vibes Claude Code Plugin

Generate complete Fireproof and Vibes.diy codebases with AI-powered component generation.

## What It Does

This plugin provides a `/vibes` command that:

1. Takes your app description as input
2. Generates an augmented system prompt based on vibes.diy patterns
3. Creates a complete React component with:
   - Fireproof for local-first data persistence
   - callAI for LLM integration
   - Tailwind CSS for styling
   - Neo-brutalist design aesthetic
4. Sets up a full Vite project with all dependencies configured
5. Provides ready-to-run code with hot module reloading

## Installation

### From This Repository (Local Development)

1. Add the marketplace:
```bash
claude
```

```shell
/plugin marketplace add ./cli
```

2. Install the plugin:
```shell
/plugin install vibes@vibes-marketplace
```

3. Restart Claude Code when prompted

### From GitHub (Coming Soon)

```shell
/plugin marketplace add fireproof-storage/vibes.diy
/plugin install vibes@vibes.diy
```

## Usage

### Generating Apps

1. Run the command:
```shell
/vibes
```

2. Describe your app when prompted:
```
I want to build a todo list app with AI-powered task suggestions
```

3. Specify output directory (or use default `./vibes-app`):
```
./my-awesome-app
```

4. The plugin generates the complete project structure

5. Follow the next steps:
```bash
cd my-awesome-app
npm install
npm run dev
```

### Updating Plugin Data

The plugin uses cached prompt data that includes coding guidelines, style prompts, and library documentation. To update to the latest version:

```shell
/vibes-update
```

This command will:
1. Check your current plugin data version
2. Fetch the latest version from GitHub
3. Show you what's changed
4. Ask for confirmation before updating
5. Create a backup and apply the update

**When to update:**
- Monthly updates are typically available
- Check for updates when you want the latest styles or library docs
- Update before generating important projects to get newest best practices

**What gets updated:**
- Style prompts (brutalist web, memphis, etc.)
- Library documentation (Fireproof, callAI, D3, Three.js, etc.)
- Core coding guidelines
- UI patterns and best practices

**What stays the same:**
- The plugin code itself
- Your generated apps
- Project templates

### What Gets Generated

Your project will have this structure:

```
my-awesome-app/
├── package.json          # Dependencies configured
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── index.html            # HTML entry point
├── .gitignore            # Git ignore rules
└── src/
    ├── index.css         # Tailwind directives
    ├── main.jsx          # React root mounting
    └── App.jsx           # Your generated component
```

### Generated App Features

Every generated app includes:

- **Local-first data**: Fireproof database with real-time updates
- **AI integration**: callAI for LLM-powered features
- **Modern styling**: Tailwind CSS with neo-brutalist aesthetic
- **React 19**: Latest React with hooks
- **Hot reload**: Vite dev server for instant updates
- **Type safety**: Through use-fireproof and call-ai packages
- **Mobile-first**: Responsive design patterns

## How It Works

### System Prompt Augmentation

The plugin uses a cached data file (`plugin-data.json`) containing all the patterns and guidelines:

1. Loads `plugin-data.json` with prompt guidelines, library docs, and style prompts
2. Selects the appropriate style (default: "brutalist web")
3. Combines core guidelines with your app description
4. Adds relevant library documentation if your app uses specific features (D3, Three.js, etc.)
5. Generates a comprehensive system prompt
6. Uses that prompt to create the React component

The `plugin-data.json` file is compiled from the vibes.diy monorepo and cached locally for offline use. It's automatically updated when the plugin is updated, or can be manually refreshed from GitHub.

### Component Generation Pattern

The generated components follow this pattern:

```javascript
import React, { useState } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

export default function App() {
  const { database, useLiveQuery } = useFireproof("app-db")

  // Live queries for real-time data
  const result = useLiveQuery(query => query.type === "item", [])
  const items = result.docs || []

  // AI-powered features with callAI
  const handleAIAction = async (prompt) => {
    const response = await callAI(prompt, {
      stream: true,
      schema: { /* your schema */ }
    })
    // Save to Fireproof
    await database.put({ type: "item", data: JSON.parse(response) })
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4">
      {/* Your UI */}
    </div>
  )
}
```

### Style Aesthetic

By default, apps use the "brutalist web" style:

- **Blocky geometry** with oversized controls
- **Thick borders** (4-12px outlines)
- **Bold offsets** (hard shadow plates offset 6-12px)
- **Grid/blueprint cues** on backgrounds
- **High contrast** on light backgrounds
- **Mobile-first** responsive layout
- **Accessible** tap targets (≥48x48px)

Colors: `#f1f5f9` `#cbd5e1` `#94a3b8` `#64748b` `#0f172a` `#242424` `#ffffff`

## Examples

### Todo List with AI Suggestions

```shell
/vibes
```

> "Create a todo list where users can add tasks and get AI-powered suggestions for breaking down complex tasks into smaller steps"

### Image Gallery with Fireproof

```shell
/vibes
```

> "Build an image gallery app where users can upload photos, add captions, and organize them into collections. Use Fireproof's file API for image storage."

### Chat Interface

```shell
/vibes
```

> "Make a chat interface that uses callAI for responses and stores the conversation history in Fireproof for offline access"

## Configuration

The plugin uses these defaults:

- **Output directory**: `./vibes-app`
- **Style**: Brutalist web
- **Default libraries**: fireproof, callai
- **React version**: 19.1.0
- **Vite version**: 7.1.9

These can be customized by modifying:
- `skills/vibes-generator/SKILL.md` - Generation logic
- `skills/vibes-generator/templates/` - Project templates

## Troubleshooting

### Plugin not found after installation

Make sure you restarted Claude Code after installation:
```shell
exit
claude
```

### Generated app won't start

1. Make sure you ran `npm install` in the output directory
2. Check that Node.js version is ≥18
3. Try removing `node_modules` and reinstalling:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Import errors in generated code

The generated code uses these packages:
- `react` - React library
- `use-vibes` - Includes useFireproof hook
- `call-ai` - AI integration (imported via use-vibes)

These are automatically included in package.json.

### Styling looks broken

Make sure Tailwind classes are working:
1. Check that browser dev tools show classes applied
2. Vite should process Tailwind automatically
3. Custom colors use bracket notation: `bg-[#242424]`

## Development

### Project Structure

```
cli/vibes/
├── .claude-plugin/
│   └── plugin.json                    # Plugin metadata
├── commands/
│   ├── vibes.md                       # /vibes command (generate apps)
│   └── vibes-update.md                # /vibes-update command (update prompts)
├── scripts/
│   └── build-plugin-data.js           # Build script for plugin data
├── skills/
│   └── vibes-generator/
│       ├── SKILL.md                   # Main generation logic
│       └── templates/                 # Project templates
│           ├── package.json.template
│           ├── vite.config.js.template
│           ├── tailwind.config.js.template
│           ├── postcss.config.js.template
│           ├── index.html.template
│           ├── src/
│           │   ├── index.css.template
│           │   └── main.jsx.template
│           └── gitignore.template
├── package.json                       # Build scripts and metadata
├── plugin-data.json                   # Cached prompt data (generated)
├── README.md                          # This file
└── DEVELOPMENT.md                     # Development guide
```

### Modifying Generation Logic

To customize how apps are generated, edit:

**skills/vibes-generator/SKILL.md**
- Change system prompt patterns
- Modify component structure
- Add new libraries
- Adjust style guidelines

**skills/vibes-generator/templates/**
- Update project configuration
- Change default dependencies
- Modify base HTML structure

### Testing Changes

After modifying the plugin:

1. Uninstall current version:
```shell
/plugin uninstall vibes@vibes-marketplace
```

2. Reinstall:
```shell
/plugin install vibes@vibes-marketplace
```

3. Restart Claude Code

4. Test with `/vibes`

## Architecture

### Components

1. **Command** (`commands/vibes.md`)
   - User interaction
   - Input gathering
   - Skill invocation

2. **Skill** (`skills/vibes-generator/SKILL.md`)
   - System prompt generation
   - Component code creation
   - Project structure setup
   - File writing

3. **Templates** (`skills/vibes-generator/templates/`)
   - Base project files
   - Placeholder substitution
   - Configuration defaults

### Data Flow

```
User prompt
    ↓
/vibes command
    ↓
vibes-generator Skill
    ↓
Load plugin-data.json (cached prompts/styles/libs)
    ↓
Generate augmented system prompt
    ↓
Create React component code
    ↓
Process templates
    ↓
Write project files
    ↓
Output next steps
```

### Plugin Data Architecture

The plugin uses a standalone architecture that doesn't require the vibes.diy monorepo:

**Build Process** (for maintainers):
```
vibes.diy/prompts/pkg/*.ts
        ↓
npm run build-plugin-data
        ↓
vibes.diy/cli/vibes/plugin-data.json
        ↓
Committed to repository
        ↓
Distributed with plugin
```

**Runtime Process** (for users):
```
Plugin loads plugin-data.json
        ↓
Offline-first (no network needed)
        ↓
Optional: Manual refresh from GitHub raw URL
```

**Updating Plugin Data**:

Use the `/vibes-update` command for easy updates:
```shell
/vibes-update
```

Alternatively, users can manually download the latest version:
```bash
curl -o ~/.claude/plugins/vibes@vibes-marketplace/plugin-data.json \
  https://raw.githubusercontent.com/fireproof-storage/vibes.diy/main/cli/vibes/plugin-data.json
```

## Contributing

To contribute to this plugin:

1. Fork the vibes.diy repository
2. Make changes in `cli/vibes/`
3. Test locally with the local marketplace
4. Submit a pull request

## License

MIT License - see vibes.diy repository for details

## Links

- **Vibes.diy**: https://vibes.diy
- **Fireproof**: https://use-fireproof.com
- **GitHub**: https://github.com/fireproof-storage/vibes.diy
- **Documentation**: https://vibes.diy/docs

## Support

- **Issues**: https://github.com/fireproof-storage/vibes.diy/issues
- **Discord**: https://discord.gg/fireproof (coming soon)
- **Email**: hello@vibes.diy
