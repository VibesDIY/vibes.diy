#!/usr/bin/env node

/**
 * Build Plugin Data
 *
 * This script extracts prompt data from the vibes.diy monorepo and compiles it
 * into a single JSON file that can be distributed with the Claude Code plugin.
 *
 * This allows the plugin to work standalone without requiring users to clone
 * the entire vibes.diy repository.
 */

const fs = require('fs');
const path = require('path');

// Paths relative to the vibes.diy repository root
const REPO_ROOT = path.join(__dirname, '../../..');
const PROMPTS_PKG = path.join(REPO_ROOT, 'prompts/pkg');
const LLMS_DIR = path.join(PROMPTS_PKG, 'llms');
const OUTPUT_FILE = path.join(__dirname, '../plugin-data.json');

console.log('Building plugin data from vibes.diy repository...\n');

/**
 * Read a file and return its contents
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract style prompts from style-prompts.ts
 *
 * This uses a simple approach: since the styles don't change often,
 * we hardcode them here to avoid complex TypeScript parsing.
 */
function extractStylePrompts() {
  const stylePromptsPath = path.join(PROMPTS_PKG, 'style-prompts.ts');
  const content = readFile(stylePromptsPath);

  if (!content) {
    console.error('Failed to read style-prompts.ts');
    return { styles: [], defaultStyle: 'brutalist web' };
  }

  // Extract default style name
  const defaultMatch = content.match(/export const DEFAULT_STYLE_NAME = "([^"]+)"/);
  const defaultStyle = defaultMatch ? defaultMatch[1] : 'brutalist web';

  // Hardcoded style prompts (kept in sync with style-prompts.ts)
  const styles = [
    {
      name: "brutalist web",
      prompt: 'Create a UI theme in a neo-brutalist style: blocky geometry, oversized controls, thick 4-12px outlines, and big bold offsets (hard shadow plates offset 6-12px bottom-right; active press reduces offset by 2-4px). Use grid/blueprint cues—graph lines, micro-dots, hatch/stipple textures—on flat matte surfaces; reserve subtle gloss only for CTAs. Background (only skeuomorphic element): grey-blue graph paper via CSS—base #f1f5f9, grid from repeating-linear-gradients in #cbd5e1/#94a3b8 at 16-24px; add a fullscreen grain layer (SVG turbulence or 1px noise PNG) at 3-6% opacity with filter: blur(0.4-0.8px) contrast(102%) brightness(101%); lock to viewport. Corner rule: components are either square (0px radius) or very rounded (50% of component height)—no in-between. Mobile-first layout: single-column flow on phones, 4/8/16/24 spacing scale, tap targets >= 48x48, sticky header + bottom nav; expand to 2-4 columns at sm >= 640 / md >= 768 / lg >= 1024 with asymmetric stacks. Maintain high contrast on light backgrounds. Secret name "Neobrute Blueprint." Use these colors: #f1f5f9 #cbd5e1 #94a3b8 #64748b #0f172a #242424 #ffffff. Never use white text; #ffffff is for surfaces only.'
    },
    {
      name: "memphis",
      prompt: "Create a UI theme inspired by the Memphis Group and Studio Alchimia from the 1980s. Incorporate bold, playful geometric shapes (squiggles, triangles, circles), vibrant primary colors (red, blue, yellow) with contrasting pastels (pink, mint, lavender), and asymmetrical layouts. Use quirky patterns like polka dots, zigzags, and terrazzo textures. Ensure a retro-futuristic vibe with a mix of matte and glossy finishes, evoking a whimsical yet functional design. Secretly name the theme 'Memphis Alchemy' to reflect its roots in Ettore Sotsass's vision and global 1980s influences. Make sure the app background has some kind of charming patterned background using memphis styled dots or squiggly lines. Use thick \"neo-brutalism\" style borders for style to enhance legibility. Make sure to retain high contrast in your use of colors. Light background are better than dark ones. Use these colors: #70d6ff #ff70a6 #ff9770 #ffd670 #e9ff70 #242424 #ffffff Never use white text."
    },
    {
      name: "synthwave",
      prompt: "80s digital aesthetic"
    },
    {
      name: "organic UI",
      prompt: "natural, fluid forms"
    },
    {
      name: "maximalist",
      prompt: "dense, decorative"
    },
    {
      name: "skeuomorphic",
      prompt: "real-world mimics"
    },
    {
      name: "flat design",
      prompt: "clean, 2D shapes"
    },
    {
      name: "bauhaus",
      prompt: "geometric modernism"
    },
    {
      name: "glitchcore",
      prompt: "decentering expectations"
    },
    {
      name: "paper cutout",
      prompt: "layered, tactile"
    },
    {
      name: "viridian",
      prompt: "Create a vibrant UI theme inspired by Bruce Sterling's Viridian Design Movement, embracing a futuristic green aesthetic with subtle animations and dynamic interactivity. Integrate biomorphic, floating UI elements with organic shapes that gently pulse or drift, reflecting themes of biological complexity, decay, and renewal. Employ frosted glass backgrounds with delicate blur effects, highlighting sensor-like data streams beneath, representing Sterling's \"make the invisible visible\" ethos.\n\nUse gradients and layers of soft greens accented by energetic data-inspired colors (#70d6ff, #ff70a6, #ff9770, #ffd670, #e9ff70), alongside crisp white (#ffffff) and dark contrast (#242424), ensuring legibility and visual appeal. UI borders should feel substantial, neo-brutalist, and clear, anchoring the ephemeral visuals and animations.\n\nThe background should subtly animate, evoking cellular activity, digital pulse, or ecological sensor feedback, reinforcing Viridian's fascination with tangible cyberspace and biomorphic tech aesthetics.\n\nSecretly name this theme \"Viridian Pulse\", capturing Sterling's original playful-yet-serious blend of provocative futurism and stylish eco-consciousness."
    }
  ];

  console.log(`✓ Extracted ${styles.length} style prompts (default: ${defaultStyle})`);

  return { styles, defaultStyle };
}

/**
 * Extract library documentation from llms directory
 */
function extractLibraryDocs() {
  const libraries = {};

  const libFiles = [
    { key: 'fireproof', file: 'fireproof.txt' },
    { key: 'callai', file: 'callai.txt' },
    { key: 'd3', file: 'd3.md' },
    { key: 'three-js', file: 'three-js.md' },
    { key: 'web-audio', file: 'web-audio.txt' },
    { key: 'image-gen', file: 'image-gen.txt' }
  ];

  libFiles.forEach(({ key, file }) => {
    const filePath = path.join(LLMS_DIR, file);
    const content = readFile(filePath);
    if (content) {
      libraries[key] = content.trim();
      console.log(`✓ Loaded ${file}`);
    } else {
      console.warn(`⚠ Could not load ${file}`);
    }
  });

  return libraries;
}

/**
 * Generate core coding guidelines
 * These are the fundamental patterns that every generated app should follow
 */
function generateCoreGuidelines() {
  return {
    react: `Use modern React practices and hooks. JavaScript only (no TypeScript). Tailwind CSS for mobile-first, accessible styling. Don't use external libraries unless essential. Keep components concise and focused.`,

    fireproof: `Use the useFireproof hook from use-fireproof to create a local-first database. Store all data as Fireproof documents with proper structure. Use useLiveQuery for real-time updates. File uploads are supported via doc._files API.`,

    callAI: `For AI integration, use callAI from call-ai package. Set stream: true for streaming responses. Use structured JSON outputs with schemas for consistent data. Save final responses as individual Fireproof documents. Example: callAI(prompt, { schema: { properties: { todos: { type: 'array', items: { type: 'string' } } } } })`,

    ui: `Include vivid app description and usage instructions in italic text at the top. If the app uses callAI with schema, include a Demo Data button. List data items on main page (make lists clickable for details). Use placeholder image APIs like https://picsum.photos/400 when images are needed.`,

    imports: `Always start components with:
import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

Only add other imports when specifically requested.`,

    tailwind: `Use Tailwind CSS classes directly in JSX. Remember to use brackets like bg-[#242424] for custom colors. Mobile-first responsive design with 4/8/16/24 spacing scale. Components are either square (0px radius) or very rounded (50% of height).`
  };
}

/**
 * Main build function
 */
function build() {
  console.log(`Repository root: ${REPO_ROOT}\n`);

  // Extract all data
  const { styles, defaultStyle } = extractStylePrompts();
  const libraries = extractLibraryDocs();
  const coreGuidelines = generateCoreGuidelines();

  // Compile into final structure
  const pluginData = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    repository: 'https://github.com/fireproof-storage/vibes.diy',
    coreGuidelines,
    stylePrompts: styles,
    defaultStyle,
    libraries
  };

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pluginData, null, 2), 'utf8');

  console.log(`\n✓ Plugin data compiled successfully!`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log(`  Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  console.log(`  Styles: ${styles.length}`);
  console.log(`  Libraries: ${Object.keys(libraries).length}\n`);
}

// Run the build
build();
