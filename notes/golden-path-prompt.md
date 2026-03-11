# Golden Path: CLI → app.jsx → deployed vibe

Copy this prompt into a fresh Claude conversation. It will scaffold a project, write app.jsx, and prepare it for deployment.

---

## Prompt

I want you to build me a vibe app using the vibes.diy CLI tools. Here's the workflow:

### Step 1: Scaffold and install

```bash
npm create vibe@1.5.0-dev <creative-app-name> 2>/dev/null
cd <creative-app-name>
npm install 2>/dev/null
```

Pick a unique, descriptive name for your app (e.g. `beat-lab`, `recipe-box`, `mood-ring`). Don't reuse an existing directory name. This creates a new folder with `package.json`, `vibes.json`, and a placeholder `app.jsx`.

### Step 2: Browse available skills

```bash
npx use-vibes skills
```

This lists the available libraries (fireproof, callai, web-audio, d3, three-js, image-gen). Pick the ones your app needs.

### Step 3: Get the system prompt

```bash
npx use-vibes system --skills fireproof,callai,web-audio
```

Read the output — it tells you how to write app.jsx with the selected skills. Adjust the `--skills` list based on what your app needs.

### Step 4: Write app.jsx

Now write `app.jsx` based on the system prompt instructions. Build me: **[describe your app here, e.g. "a drum machine with sequencer and synth pads"]**

The file should:
- Be a single JSX file with a default export
- Import React, useFireproof, callAI, and any skill libraries at the top
- Use Tailwind CSS for styling
- Use Fireproof for data persistence
- Follow all the rules from the system prompt
- Do NOT `npm install` additional packages — all imports are resolved automatically via esm.sh at runtime

### Step 5: Verify

Show me the contents of:
- `vibes.json`
- `app.jsx`

---

## Notes

- The `system` command defaults to fireproof + callai skills if no `--skills` flag is given.
- Browse skills: `npx use-vibes skills`
- When using `npm run use-vibes` instead of `npx`, pass `--` before flags so npm forwards them: `npm run use-vibes -- system --skills fireproof,d3`
- Auth commands (`login`, `whoami`, `handle register`) and deploy commands (`dev`, `publish`) are coming soon.
- For now paste app.jsx into vibes.diy or use eject-vibe for a standalone Vite project.
