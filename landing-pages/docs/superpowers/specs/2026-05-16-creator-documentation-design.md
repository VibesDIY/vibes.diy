# Creator Documentation Hub + Connect Backend Data — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

---

## Overview

Two new pages:

1. **`/creator-documentation/`** — A dark-themed hub linking to all creator-facing guides. Owned chrome, dark aesthetic matching `generate.hbs`.
2. **`/connect-backend-data/`** — A getting-started guide for reading and writing Vibes app data from any JS backend. Framed around the capability, not the runtime; Node.js is the example path.

Plus: add a card for `/creator-documentation/` to `index.hbs`.

---

## Page 1: `/connect-backend-data/`

### File
`src/pages/connect-backend-data.hbs`

### Frontmatter
```json
{
  "layout": "webring",
  "title": "Connect Backend Data — Vibes DIY",
  "description": "Your Vibes app's database, live from any JS backend. Read, write, and subscribe to real-time data outside the browser with use-vibes.",
  "ogUrl": "https://good.vibes.diy/connect-backend-data/",
  "source": "connect-backend-data"
}
```

### Design system
Inherits the `generate.hbs` aesthetic:
- **Fonts:** Inter + JetBrains Mono (Google Fonts)
- **Background:** dark (`oklch(0.16 0.015 260)`) with subtle radial gradients
- **Borders:** `1px solid` translucent white
- **Code blocks:** `.cmd` class — dark inset panels, token color, `language` label top-right, copy button
- **Token colors:** prompt (`--live` green), keywords (`--punk` pink), strings (`--warn` amber), comments (`--fg-faint`)

### Section order

#### 1. Topbar
- Left: Vibes DIY logo (links to `https://links.vibes.diy/homepage`)
- Right: "← Creator Documentation" link back to `/creator-documentation/`

#### 2. Hero
- Eyebrow tag: `use-vibes@2.2.18`
- Headline: **"Your Vibes app's database, from any JS backend"**
- Sub: One sentence — your app's live data is accessible outside the browser, from Node, Deno, Bun, Cloudflare Workers, or any JS runtime.

#### 3. Prerequisites
Two `cmd` blocks, each with a copy button:

**Login (once per device):**
```sh
npx vibes-diy login
```
Caption: Stores a device cert in your keybag. Run once; it persists across sessions.

**Install:**
```sh
npm install use-vibes
```
Caption: Works with npm, pnpm, and yarn. For Deno/Bun, import directly from `esm.sh`.

#### 4. Minimal working example
One full `cmd` block (copy button, `javascript` label):
```js
import { fireproof } from "use-vibes";

const db = fireproof("todos");          // database name matches the name used inside your vibe

const ok = await db.put({ text: "hello from Node" });
const doc = await db.get(ok.id);
const { docs } = await db.query("type", { key: "todo" });

db.subscribe((changes) => {
  console.log("live update:", changes);
}, true);
```

Inline callout list below the block explaining each operation in one line each:
- `fireproof("todos")` — opens the database; name must match the one your Vibes app uses
- `put` — write a document; returns `{ id, clock }`
- `get` — fetch a document by id
- `query` — index query by field value
- `subscribe` — live updates over WebSocket; `true` fires immediately with current state

#### 5. Defaults table
Heading: **How defaults resolve**

| Field | Default |
|---|---|
| `apiUrl` | `VIBES_DIY_API_URL` env var, then `https://vibes.diy/api` |
| `appSlug` | `VIBES_APP_SLUG` env var, then `basename(process.cwd())` |
| `getToken` | device cert from `npx vibes-diy login` keybag |
| `userSlug` | looked up automatically from your account on first request |

Rendered as a proper HTML `<table>` styled with the dark design system (thin borders, monospace values).

#### 6. Explicit options
Heading: **Explicit config (CI, Wrangler, service accounts)**

```js
const db = fireproof("todos", {
  apiUrl: "https://vibes.diy/api",
  appSlug: "my-app",
  userSlug: "alice",
  getToken: async () => myTokenResult,
});
```

One-line caption: Use explicit opts when running in CI or environments without a device keybag.

#### 7. Caching rules
Small callout card (dark, cyan-bordered or inset rule line), heading: **Instance caching**

- `fireproof("todos") === fireproof("todos")` — same name, same instance within a process
- Multiple database names share one WebSocket connection
- First call's opts win for the whole process; later calls with a different name inherit connection settings

#### 8. v1 Limitations
Heading: **v1 limitations**

Two bullets:
- File uploads (`_files` field) are not yet supported — pure document workflows only
- Inside a Vibes iframe, the import is automatically rewritten to the postMessage bridge — this factory is only for external scripts

#### 9. API reference (brief)
Heading: **Available methods**

Inline code list:
- `put(doc)` ✓ verified
- `get(id)` ✓ verified
- `del(id)` ✓ verified
- `query(field, opts)` ✓ verified
- `subscribe(fn, runImmediately?)` ✓ verified
- `allDocs(opts?)` — listed, unverified in test suite
- `bulk(docs)` — listed, unverified in test suite

#### 10. Footer / CTA
Dark panel: "Ready to build?" → link to `https://vibes.diy` + "← Back to Creator Documentation"

---

## Page 2: `/creator-documentation/`

### File
`src/pages/creator-documentation.hbs`

### Frontmatter
```json
{
  "layout": "webring",
  "title": "Creator Documentation — Vibes DIY",
  "description": "Guides for building, scripting, and shipping with Vibes DIY.",
  "ogUrl": "https://good.vibes.diy/creator-documentation/",
  "source": "creator-documentation"
}
```

### Design system
Same dark aesthetic as `generate.hbs` and `connect-backend-data.hbs`.

### Structure

#### Topbar
- Left: Vibes DIY logo → `https://links.vibes.diy/homepage`
- (No nav links needed — page is self-contained)

#### Hero
- Heading: **Creator Documentation**
- Sub: One line — guides for building apps, scripting against your data, and shipping with Vibes DIY.

#### Card grid
Four cards in a 2×2 grid (responsive: 1 column on mobile):

| Card | Title | Description | URL |
|---|---|---|---|
| 1 | How to Make & Share an App | Step-by-step screenshot guide — from prompt to live app | `/how-to` |
| 2 | CLI: `npx vibes-diy generate` | One command deploys a live React app from a prompt | `/generate` |
| 3 | Connect Backend Data | Read and write your app's data from any JS backend | `/connect-backend-data` |
| 4 | PSU Hackathon | Claude Code Hackathon — May 16 at Portland State | `/psu-hackathon` |

Each card: title, one-line description, "→" link. Hover state: subtle border brighten.

#### Footer
Logo + copyright line, same pattern as `generate.hbs`.

---

## index.hbs change

Add a `.landing-card` entry for `/creator-documentation/` in the card grid. Use the `.builders` color theme (cyan-ish) or a new `.creator-docs` variant. Title: **Creator Documentation**. One-line description: guides for building and scripting.

---

## Constraints

- No `<pre>` without copy button on code blocks
- No invented API methods beyond: `put`, `get`, `del`, `query`, `allDocs`, `subscribe`, `bulk`
- All external links use `https://links.vibes.diy/<short>` where a shortlink exists
- `.hbs` files must not be run through prettier (`.prettierignore` already excludes them)
- Run `pnpm check` before committing to catch frontmatter/template errors
