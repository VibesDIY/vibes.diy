# qa-pr — local workstation setup (secondary path)

> **The cloud / web session is the default place to run `qa-pr`.** There the
> browser is provisioned automatically (see [`agents/cloud-browser-setup.md`](../../../../agents/cloud-browser-setup.md)
> and the _Browser environment_ section of [`SKILL.md`](../SKILL.md)). This file
> is the **secondary** path: running the skill on a developer Mac/Linux
> workstation against a real, installed Chrome. Its main current use is the
> authenticated full spine (Steps 4–7), because seeding a Google/Vibes session
> into a headless cloud profile is not yet automated.

## First-run setup (once per machine)

Before the skill can complete a run on a workstation, the box needs a handful of
tools and accounts in place. Most engineers working in this repo already have all
of them; this checklist exists so the _first_ run fails loudly with a fix instead
of stalling halfway. The skill's Step 1 preflight verifies each of these and tells
you exactly what's missing — this section is the human-readable version of what it
checks and how to satisfy each item.

1. **Google Chrome** — on a workstation `chrome-devtools-mcp` drives a real Chrome
   (not Chromium). Install it from <https://www.google.com/chrome/> if
   `open -Ra "Google Chrome"` errors. (In a cloud session this is unnecessary —
   the SessionStart hook points chrome-devtools at the container's Chromium.)
2. **Node.js** — needed to run the MCP server via `npx`. Any recent LTS is fine
   (`node --version`).
3. **GitHub CLI, authenticated** — `gh --version` and `gh auth status`. The skill
   reads PR metadata and posts the triage comment through `gh`. Run
   `gh auth login` if not authenticated.
4. **chrome-devtools MCP server** — provisioned by the repo's root
   [`.mcp.json`](../../../../.mcp.json), which declares the `chrome-devtools`
   server (`npx -y chrome-devtools-mcp@latest`). When you open this repo in Claude
   Code you'll be prompted to approve the project's MCP servers on repo-trust;
   approve it (or run `/mcp` and enable `chrome-devtools`), then the
   `mcp__chrome-devtools__*` tools appear. If those tools are absent, the skill
   cannot drive a browser — Step 1 preflight catches this first.
5. **A clone of this repo** — the skill is project-scoped (auto-discovered under
   `.claude/skills/` when Claude Code runs inside a clone of `vibes.diy`). Nothing
   to install beyond cloning; see [`README.md` › Distribution & upgrade path](../../README.md).
6. **git email set** — `git config user.email` must return a non-empty address; it
   labels the run in `qa-reports/runs.jsonl`. Ideally a `@vibes.diy` /
   `@fireproof.storage` Workspace address, but a personal address only triggers a
   warning, not an abort (see Step 1).
7. **A Vibes account** — the skill signs in as _your existing_ Vibes identity via
   Google OAuth; it does **not** create accounts. If you've never signed into
   vibes.diy, do that once in a normal browser first.
8. **Google session seeded into the chrome-devtools profile** — the one genuinely
   non-obvious step. See _Per-engineer one-time setup_ below; without it the
   Step 4.1 OAuth sign-in stalls on a password prompt the agent can't complete.

## Per-engineer one-time setup (Google session in chrome-devtools profile)

`chrome-devtools-mcp` launches Chrome against a persistent user-data-dir at
`~/.cache/chrome-devtools-mcp/chrome-profile/` by default (verified with
`npx chrome-devtools-mcp@latest --help`). The profile persists cookies, including
Google sessions, across runs.

For the OAuth sign-in in Step 4.1 to be a **one-click "Continue as &lt;you&gt;"**
instead of a full email + password + 2FA round-trip, each engineer signs into
Google **once** against that profile:

1. Quit any Claude Code session whose tool list includes `mcp__chrome-devtools__*`
   (Chrome refuses to launch against a locked user-data-dir).
2. From a terminal, launch Chrome against the profile:
   ```bash
   open -a "Google Chrome" --args \
     --user-data-dir="$HOME/.cache/chrome-devtools-mcp/chrome-profile" \
     --no-first-run --no-default-browser-check
   ```
3. In the launched Chrome window, sign in to Google as your `@vibes.diy` (or
   `@fireproof.storage`) Workspace account. Optionally visit
   <https://accounts.google.com> to confirm.
4. **Do not** visit `vibes.diy` or any `*.workers.dev` Vibes preview in this Chrome
   window — that would seed Vibes/Clerk cookies the skill expects to be absent at
   preflight.
5. Cmd-Q to fully quit Chrome.
6. Done. Next chrome-devtools MCP launch reuses this profile with the Google
   session intact.

If you ever need to redo the setup (e.g. you accidentally signed into the wrong
Google account, or the profile got polluted), wipe it first:

```bash
rm -rf "$HOME/.cache/chrome-devtools-mcp/chrome-profile"
```

Then repeat steps 1–6.
