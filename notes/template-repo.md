# Creating a Vite Template Repository for **vibes.diy**

This note captures the plan discussed in [Issue #77](https://github.com/vibesDIY/vibes.diy/issues/77) – **shipping a GitHub template that can be consumed from both the Vite CLI and the “Use this template” button.**

---

## 1⃣ What we want to enable

```bash
# From anywhere
pnpm create vite@latest my-app -- --template vibesDIY/eject-vibe
# (yarn create / npm create work too)
```

A single command should scaffold a ready-to-run Vite project that already contains the _vibes.diy_ opinionated setup (Fireproof, tailwind, routing, etc.).

Additionally, users browsing GitHub should be able to click **Use this template → Create a new repository** and get the _exact_ same starter.

---

## 2⃣ Repository structure expected by `create-vite`

The Vite CLI literally downloads a tarball of the repository root and copies it into the target directory. Therefore **everything we want in the user’s fresh project must live at the root of the template repo**.

Minimal top-level layout:

```
├── index.html              # Vite entry file (uses /src/main.tsx)
├── package.json            # Declares dependencies & scripts
├── tsconfig.json           # TS / JSX config (or jsconfig.json for JS)
├── vite.config.ts          # Any plugins (react, tailwind, etc.)
├── postcss.config.cjs      # Tailwind / autoprefixer
├── tailwind.config.cjs     # Tailwind setup
├── public/                 # Static assets
└── src/
    ├── main.tsx            # Mounts <App />
    ├── App.tsx             # Example component w/ Fireproof hook
    └── ...                 # Any starter routes/components
```

Tips:

- Keep **`name`, `version`, `description`, `repository`** fields generic so `create-vite` can rewrite them.
- Prefer **npm** in `README` and `package.json` scripts (`dev`, `build`, `preview`, `lint`, `test`).
- Don’t check in `.env` – ship an `env-template` instead.
- If we ever need a sub-folder template we can use `vibesDIY/eject-vibe#templates/xyz`, but flat root keeps the CLI syntax simplest.

---

## 3⃣ Marking the repo as a **Template** (GitHub Settings ▸ _Template repository_)

| Why it matters                                            | CLI                                                        | Web UI / Cloud IDE                     |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `create-vite` – downloads tarball                         | ✅ _Works whether or not the repo is marked as a template_ | N/A                                    |
| **"Use this template"** button                            | 🔸 _Requires the flag to be set_                           | Users can fork without forking history |
| StackBlitz / Codesandbox "Create from template" shortcuts | 🔸 Reads the template flag to list suggestions             | Instant online playground              |

Enabling the flag therefore:

1. Exposes the **green “Use this template”** button – crucial for non-CLI users.
2. Makes the repository discoverable via GitHub’s _template_ search API (used by some online editors).
3. Keeps the commit history of the template separate from the generated project (the new repo starts at commit `0`).

> **TL;DR** – the flag isn’t needed for `npm create vite`, but it _completes the story_ for GUI users and online IDEs. Always enable it.

---

## 4⃣ Smoke-testing before we publish

```bash
npm create vite@latest my-test-app -- --template vibesDIY/eject-vibe
cd my-test-app
npm install
npm dev
```

✔️ The dev server should come up on `http://localhost:5173` with the starter UI and no ESLint/TypeScript errors.

Run `npm test` and `npm lint` to ensure a clean slate. Remember the team preference: **JSX props must obey the linter rule explained in /notes/testing.md**.

---

## 5⃣ Next steps / checklist

- [ ] Create **`vibesDIY/eject-vibe`** repository.
- [ ] Copy the layout above into the repo root.
- [ ] Add a **concise README** explaining both usage paths (`create-vite` + "Use this template").
- [ ] Push → Settings → **Template repository ➜ Enable**.
- [ ] Tag a semantic release so users can pin a version (`username/repo@v1`).

Once merged we can update `vibes.diy` docs to reference the new one-liner.
