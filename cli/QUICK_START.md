# Vibes Plugin - Quick Start

**Created**: 2025-10-24
**Status**: Ready for testing

## What We Built

A Claude Code plugin that generates complete Fireproof/Vibes.diy Vite projects via the `/vibes` command.

## File Structure

```
cli/
├── .claude-plugin/marketplace.json    ← Marketplace definition
├── vibes/                              ← The plugin
│   ├── .claude-plugin/plugin.json     ← Plugin metadata
│   ├── commands/vibes.md              ← /vibes command
│   ├── skills/vibes-generator/        ← Core logic
│   │   ├── SKILL.md                   ← Main Skill (reads vibes.diy patterns)
│   │   └── templates/                 ← Vite project templates
│   ├── README.md                      ← User docs
│   └── DEVELOPMENT.md                 ← Full development docs
└── QUICK_START.md                     ← This file
```

## Installation

```bash
# In Claude Code:
/plugin marketplace add ./cli
/plugin install vibes@vibes-marketplace
# Restart Claude Code
```

## Usage

```bash
/vibes
# Enter app description when prompted
# Specify output directory (default: ./vibes-app)
# cd to output directory
# npm install && npm run dev
```

## How It Works

1. **Command** (`commands/vibes.md`) prompts user for input
2. **Skill** (`skills/vibes-generator/SKILL.md`):
   - Reads `prompts/pkg/prompts.ts` for system prompt patterns
   - Reads `prompts/pkg/llms/*.ts` for library docs
   - Reads `prompts/pkg/style-prompts.ts` for styling
   - Generates augmented prompt + React component
   - Processes templates and writes Vite project
3. **Output**: Complete runnable Vite project

## Generated Project

```
vibes-app/
├── package.json           # React 19, use-vibes, Vite
├── vite.config.js
├── index.html
├── .gitignore
└── src/
    ├── main.jsx          # React root
    └── App.jsx           # Generated component
```

## Key Files to Check

- `cli/vibes/skills/vibes-generator/SKILL.md` - Core generation logic (300+ lines)
- `cli/vibes/DEVELOPMENT.md` - Full documentation
- `cli/vibes/README.md` - User-facing docs

## Testing Checklist

- [ ] Plugin installs successfully
- [ ] `/vibes` command appears after restart
- [ ] Can generate a test app
- [ ] Generated files are created
- [ ] `npm install` works
- [ ] `npm run dev` starts server
- [ ] App runs in browser

## Differences from vibes:vibes

There's an existing `/vibes:vibes` plugin that creates single-file HTML apps.

**Existing vibes:vibes**:
- Single HTML file
- CDN imports
- Browser-based Babel
- No build step
- Output: `vibes-output/<timestamp>/index.html`

**Our new /vibes**:
- Full Vite project
- npm packages
- Proper build pipeline
- Modern dev workflow
- Output: user-specified directory

Both are valid for different use cases.

## Next Steps

1. Test installation and generation
2. Verify generated apps work
3. Fix any issues
4. Add more examples
5. Publish to public marketplace

## Quick Reference

**Install marketplace**: `/plugin marketplace add ./cli`
**Install plugin**: `/plugin install vibes@vibes-marketplace`
**Generate app**: `/vibes`
**Run app**: `cd <dir> && npm install && npm run dev`

**Full docs**: See `cli/vibes/DEVELOPMENT.md`
