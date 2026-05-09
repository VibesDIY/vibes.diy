# Coding Standards

Team-wide standards for agent behavior and code review.

## Rules-bag scope and remediation

Rules-bag is mandatory for repository-authored code.
Prompt-generated `App.jsx` is exempt while it remains generated output.

During PR review/remediation, auto-fix low-risk rules-bag violations without asking first. Ask clarifying questions before higher-risk fixes.

## No inline HTML in TypeScript

Never put HTML inside TypeScript code as template literal strings (code-in-code). Keep HTML in separate files and load/serve them. When a worker needs to serve HTML, put the HTML in a separate file (e.g. `ui.html`) and load it at build time or serve it as a static asset.

## No CSS imports across packages

Never use `@import "@vibes.diy/base/theme.css"` or `import "@pkg/foo.css"` across packages. The import map infrastructure requires every cross-package reference to be resolvable without extra import map entries. Any non-JS/TS asset (CSS, text, etc.) must be loaded via `loadAsset()` from `@adviser/cement`.

Use: `loadAsset("./file.css", { fallBackUrl: "https://esm.sh/@pkg/", basePath: () => import.meta.url })` and inject the result as a `<style>` tag. This repo avoids package.json `exports` fields entirely.

## Clickable links

Every link in responses must be clickable. Never output a bare reference without making it a proper link. `owner/repo#123` shorthand is NOT clickable in VS Code or the terminal — always use full markdown `[text](url)` links for PRs, issues, files, deployment URLs, and any other reference.

## Stable-entry param naming

Use dots (`.stable-entry.`) not `@` signs (`@stable-entry@`) for query parameter names. `@` gets URL-encoded to `%40` in browser address bars, making links ugly and hard to share.

## Logs are append-only

Never modify existing entries in setup logs or similar chronological docs — only append new information. Logs are a historical record; editing past entries destroys the timeline.

## Say command timing & style

Only use `echo 'message' | say` after a waiting period completes or when a full work epic finishes — never at the beginning of a job or right after kicking something off. The point is to call the human back when something they're waiting on is done, not to announce the start of work.

**Style: every `say` must be funny and different.** Open with a playful nickname or vocative to grab attention — *captain*, *chief*, *boss*, *king*, *wizard*, *navigator*, *commodore*, *shipmate*, *legend*, *artisan*, *maestro*, *hot stuff*, *space cadet*, *deploy gremlin*, *king of the woods* — and never reuse the same opener twice. The body should be short, punchy, and hint at what's done in a goofy or unexpected way ("the bytes have crossed the rubicon," "your photo just round-tripped through the wormhole," "stage B has clocked in for its shift," "the regression vibe is no longer a hostage"). If the deploy or run failed, the `say` should be distinct *and* deflated — but still in character ("uh oh, captain, the rocket fizzled"). The voice cue exists because the user is doing something else; the goal is to make the alert worth coming back for.

Forbidden patterns: bare `'<thing> deployed' | say`, `'<thing> done' | say`, anything that sounds like a CI bot. If you'd be embarrassed to read it out loud, rewrite.

## Review commits before pushing

Read every commit diff before pushing. Check each pattern against the rules-bag — no `instanceof`, no complex stringification chains, no casts. If something looks like a workaround, it probably is. Ask for guidance or rethink the approach.

## App URL format

When linking to a deployed app on vibes.diy, always use the canonical path form:

```
https://vibes.diy/vibe/{userSlug}/{appSlug}
```

Example: `https://vibes.diy/vibe/garden-gnome/meeting-picker`. Do not use the `https://{appSlug}.vibesdiy.app` subdomain form when surfacing links in chat or PR descriptions — the subdomain exists for internal fetches but is not the canonical user-facing link.

## Tag GitHub issues on creation

When creating issues in `VibesDIY/vibes.diy`, always apply labels via `--label` on `gh issue create` (or `gh issue edit --add-label` after the fact). Untagged issues require manual triage cleanup.

Pick a type label + at least one area label. Add `agent-created` whenever an agent files the issue.

Type labels: `bug`, `enhancement`, `documentation`.

Area labels: `Creator DX` (builder/chat/publish), `Vibe Runner UX` (end-user of published vibes), `Vibe Runtime` (runtime/storage/hooks inside generated apps), `Vibe Virality` (notifications, sharing, comments, signups), `Published App`, `Fireproof`, `protocol` (wire format/message shapes), `mobile`.

Other: `agent-created` (every agent-filed issue), `good first issue`, `duplicate`, `wontfix` (situational).

## No rollback/emergency language in long-lived code

When shipping work that has a soak/rollback window (activation of a new path, migration, feature flag rollout), it's fine to add temporary tooling — validation scripts, blast-radius probes, "BASELINE vs NEW" verdict logic. **After success, clean it up**:

- **Repurpose** as a generic operational tool — strip activation-specific framing, keep the underlying inspection pattern.
- **Delete** if the tool was purely emergency-focused.

Future readers shouldn't have to mentally parse "wait, why is this script talking about a 2026 cement-bug canary?" Activation-specific language ages into noise. Git history captures the why; the working tree should reflect current state. Plan the cleanup phase from the start; rule of thumb is ~2 weeks of clean soak before stripping framing. Tests can stay as silent regression guards — rename them to describe what they assert, drop the "canary for X" naming. PR descriptions and commit messages are permanent; no action needed there.
