# Golden Path: CLI → app.jsx → deployed vibe

Copy this prompt into a fresh Claude conversation. It will scaffold a project, write app.jsx, and prepare it for deployment.

---

## Prompt

I want you to build me a vibe app using the vibes.diy CLI tools. Here's the workflow:

### Step 1: Scaffold and install

```bash
npm create vibe my-app 2>/dev/null
cd my-app
npm install 2>/dev/null
```

This creates `my-app/` with `package.json`, `vibes.json`, and a placeholder `app.jsx`. The install pulls in `use-vibes` as a dev dependency.

### Step 2: Get the system prompt

```bash
npx use-vibes system 2>/dev/null
```

Read the output — it tells you how to write app.jsx (React + Tailwind + Fireproof + callAI, single file, no TypeScript).

### Step 3: Write app.jsx

Now write `my-app/app.jsx` based on the system prompt instructions. Build me: **[describe your app here, e.g. "a recipe organizer where I can paste recipes and tag them by cuisine"]**

The file should:
- Be a single JSX file with a default export
- Import React, useFireproof, and callAI at the top
- Use Tailwind CSS for styling
- Use Fireproof for data persistence
- Follow all the rules from the system prompt

### Step 4: Verify

Show me the contents of:
- `my-app/vibes.json`
- `my-app/app.jsx`

---

## Notes

- The `system` command defaults to fireproof + callai skills. Use `--skills fireproof,d3` to add other libraries.
- Available skills: `npx use-vibes skills 2>/dev/null`
- Steps 3-6 (auth, config, push, dev, publish) aren't built yet — for now the app runs on vibes.diy via copy-paste or eject-vibe.
