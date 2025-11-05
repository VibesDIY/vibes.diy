---
name: vibes-generator
description: Generate complete Fireproof and Vibes.diy codebases. Use when the user wants to create a new React application with Fireproof data persistence and AI integration. This skill reads the vibes.diy system prompt patterns and generates production-ready code.
---

# Vibes Codebase Generator

This Skill generates complete, production-ready React applications using Fireproof for data persistence and Vibes.diy patterns.

## Overview

You will:

1. Read and understand the system prompt patterns from the vibes.diy codebase
2. Generate an augmented system prompt based on the user's request
3. Create a React component using that augmented prompt
4. Set up a complete Vite project structure
5. Write all files to the user's specified directory

## Step 1: Load Plugin Data

Read the plugin data file that contains all the prompt guidelines, style prompts, and library documentation:

```bash
cat ${CLAUDE_PLUGIN_ROOT}/../plugin-data.json
```

This JSON file contains:

- `coreGuidelines`: React best practices, Fireproof patterns, callAI usage, UI patterns, imports, and Tailwind guidelines
- `stylePrompts`: Array of available style themes (name and prompt for each)
- `defaultStyle`: The default style name ("brutalist web")
- `libraries`: Documentation for fireproof, callai, d3, three-js, web-audio, and image-gen

Parse this JSON to access the data you need for generating the system prompt.

## Step 2: Understand the System Prompt Pattern

Based on the plugin data JSON, the system prompt should include:

### Core Guidelines (from `coreGuidelines` in JSON)

Use the guidelines from the `coreGuidelines` object in plugin-data.json:

- **React**: Modern practices, hooks, JavaScript only, Tailwind CSS, no unnecessary dependencies
- **Fireproof**: useFireproof hook, document storage, useLiveQuery for real-time
- **callAI**: Streaming responses, JSON schemas, saving to Fireproof
- **UI**: App descriptions, demo data buttons, clickable lists, placeholder images
- **Imports**: Standard React, useFireproof, callAI pattern
- **Tailwind**: Direct JSX classes, custom colors with brackets, mobile-first

### Style Guidance (from `stylePrompts` and `defaultStyle` in JSON)

Get the default style prompt:

1. Find the style in `stylePrompts` array where `name` matches `defaultStyle`
2. Use that style's `prompt` field for styling guidance
3. The default is "brutalist web" with detailed neo-brutalist specifications

If the user requests a specific style, search for it in the `stylePrompts` array by name.

## Step 3: Generate the Augmented System Prompt

Create a system prompt by combining data from the plugin-data.json:

1. **User's app description** (from their request)
2. **Core guidelines** (from `coreGuidelines.react`, `coreGuidelines.fireproof`, `coreGuidelines.callAI`, `coreGuidelines.ui`, `coreGuidelines.imports`, `coreGuidelines.tailwind`)
3. **Style prompt** (from the matching style in `stylePrompts` array, default to `defaultStyle`)
4. **Library documentation** (from `libraries` object if user mentions specific libraries like d3, three-js, web-audio, or image-gen)

Format it like this:

```
You are creating a React component for: [USER'S APP DESCRIPTION]

[Insert coreGuidelines.react]

[Insert coreGuidelines.fireproof]

[Insert coreGuidelines.callAI]

[Insert coreGuidelines.ui]

[Insert coreGuidelines.tailwind]

[Insert selected style prompt from stylePrompts array]

[Insert relevant library docs from libraries object if applicable]

IMPORTANT: You are working in one JavaScript file, use tailwind classes for styling.
Remember to use brackets like bg-[#242424] for custom colors.

Provide a title and brief explanation followed by the component code. The component should
demonstrate proper Fireproof integration with real-time updates and proper data persistence.
```

## Step 4: Generate the Component Code

Using the augmented system prompt you created, generate the React component code for `App.jsx`.

The component should:

- Be a complete, working React component
- Use the `useFireproof` hook for data persistence
- Include proper state management
- Implement the requested functionality
- Follow the style guidelines
- Include instructional text explaining how to use the app
- Be self-contained (all code in one file)

## Step 5: Set Up Project Structure

Create the complete Vite project structure by:

1. **Create project directory** at the user-specified path (e.g., `./vibes-app`)

2. **Copy and process templates** from `${CLAUDE_PLUGIN_ROOT}/skills/vibes-generator/templates/`:
   - Read each `.template` file
   - Replace placeholders:
     - `{{APP_NAME}}` → kebab-case version of app title (e.g., "todo-app")
     - `{{APP_TITLE}}` → human-readable app title
   - Write processed files (remove `.template` extension)

3. **Create directory structure**:

```
[output-dir]/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .gitignore
└── src/
    ├── index.css
    ├── main.jsx
    └── App.jsx
```

## Step 6: Write Files

Use the Write tool to create each file:

1. **package.json** - from package.json.template with placeholders replaced
2. **vite.config.js** - from vite.config.js.template
3. **tailwind.config.js** - from tailwind.config.js.template
4. **postcss.config.js** - from postcss.config.js.template
5. **index.html** - from index.html.template with title replaced
6. **.gitignore** - from gitignore.template
7. **src/index.css** - from src/index.css.template
8. **src/main.jsx** - from main.jsx.template
9. **src/App.jsx** - the generated component code from Step 4

## Step 7: Provide Next Steps

After all files are created, tell the user:

```bash
cd [output-directory]
npm install
npm run dev
```

Explain that:

- The app will open at http://localhost:5173
- It uses Fireproof for local-first data persistence
- Data persists across page reloads
- callAI is available for AI integration
- They can edit src/App.jsx and see changes immediately with hot reload

## Important Notes

- **Default libraries**: Always include fireproof and callai imports in the generated component
- **Single file**: The entire app is in src/App.jsx
- **No TypeScript**: Use JavaScript only
- **Tailwind classes**: Use Tailwind CSS classes directly in JSX
- **Database naming**: Use a stable, descriptive database name (e.g., "todo-app-db")
- **Error handling**: Include basic error handling for callAI calls
- **Loading states**: Show loading indicators for async operations

## Example App.jsx Structure

```javascript
import React, { useState, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { callAI } from "call-ai";

export default function App() {
  const { database, useLiveQuery } = useFireproof("app-name-db");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Live query for real-time data
  const result = useLiveQuery((query) => query.type === "item", []);
  const items = result.docs || [];

  // Function to add item with AI
  const handleAdd = async () => {
    setLoading(true);
    try {
      const response = await callAI(input, {
        schema: {
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
        },
      });

      const parsed = JSON.parse(response);
      await database.put({
        type: "item",
        ...parsed,
        createdAt: Date.now(),
      });

      setInput("");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">App Title</h1>
        <p className="italic mb-8">App description and usage instructions...</p>

        {/* Input UI */}
        <div className="mb-8">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-4 border-4 border-[#242424]"
            placeholder="Enter something..."
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-[#242424] text-white border-4 border-[#242424]"
          >
            {loading ? "Loading..." : "Add Item"}
          </button>
        </div>

        {/* List items */}
        <div>
          {items.map((item) => (
            <div
              key={item._id}
              className="mb-4 p-4 bg-white border-4 border-[#242424]"
            >
              <h3 className="font-bold">{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Troubleshooting

If you encounter errors:

- Ensure all template files are read successfully
- Check that the output directory path is valid
- Verify all placeholders are replaced
- Make sure the generated App.jsx has valid JSX syntax
- Confirm imports match available packages in package.json

## Success Criteria

- ✅ All files created in output directory
- ✅ App.jsx uses useFireproof and follows patterns
- ✅ Code is valid JavaScript/JSX
- ✅ Styling follows brutalist web theme
- ✅ Component is complete and functional
- ✅ User receives clear next steps

## Updating Plugin Data

The plugin-data.json file is cached locally and updated when the plugin itself is updated. If you need to manually refresh the plugin data to get the latest prompts and library documentation:

```bash
curl -o ${CLAUDE_PLUGIN_ROOT}/../plugin-data.json \
  https://raw.githubusercontent.com/fireproof-storage/vibes.diy/main/cli/vibes/plugin-data.json
```

This fetches the latest version from the vibes.diy GitHub repository.
