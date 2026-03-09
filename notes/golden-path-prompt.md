# Golden Path: CLI → app.jsx → deployed vibe

Copy this prompt into a fresh Claude conversation. It will scaffold a project, write app.jsx, and prepare it for deployment.

---

## Prompt

I want you to build me a vibe app using the vibes.diy CLI tools. Here's the workflow:

### Step 1: Scaffold and install

```bash
npm create vibe@1.4.0-dev my-app 2>/dev/null
cd my-app
npm install 2>/dev/null
```

This creates `my-app/` with `package.json`, `vibes.json`, and a placeholder `app.jsx`. The install pulls in `use-vibes` as a dev dependency.

### Step 2: Browse available skills

```bash
npm run use-vibes skills 2>/dev/null
```

This lists the available libraries (fireproof, callai, web-audio, d3, three-js, image-gen). Pick the ones your app needs.

### Step 3: Get the system prompt

```bash
npm run use-vibes -- system --skills fireproof,callai,web-audio 2>/dev/null
```

Read the output — it tells you how to write app.jsx with the selected skills. Adjust the `--skills` list based on what your app needs.

### Step 4: Write app.jsx

Now write `my-app/app.jsx` based on the system prompt instructions. Build me: **[describe your app here, e.g. "a drum machine with sequencer and synth pads"]**

The file should:
- Be a single JSX file with a default export
- Import React, useFireproof, callAI, and any skill libraries at the top
- Use Tailwind CSS for styling
- Use Fireproof for data persistence
- Follow all the rules from the system prompt

### Step 5: Verify

Show me the contents of:
- `my-app/vibes.json`
- `my-app/app.jsx`

---

## Notes

- The `system` command defaults to fireproof + callai skills if no `--skills` flag is given.
- Browse skills: `npm run use-vibes skills 2>/dev/null`
- Note: pass `--` before flags so npm forwards them: `npm run use-vibes -- system --skills fireproof,d3`
- Steps 3-6 (auth, config, push, dev, publish) aren't built yet — for now the app runs on vibes.diy via copy-paste or eject-vibe.
