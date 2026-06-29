# Creator Documentation Hub + Connect Backend Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create two new dark-themed pages (`/connect-backend-data/` and `/creator-documentation/`) and add a hub card to `index.hbs`. Then commit and push to main.

**Architecture:** Both pages use `layout: "webring"` (full HTML in the .hbs body) and inherit the `generate.hbs` dark design system (Inter + JetBrains Mono, oklch dark palette, `.cmd` code blocks). Code blocks include hidden `.raw` spans for copy-button text extraction. No external dependencies beyond fonts already used by `generate.hbs`.

**Tech Stack:** Handlebars templates, plain HTML/CSS, `build.js` (`pnpm check`), `npx prettier --write` on non-hbs files before commit.

---

## File Map

| Action | File |
|---|---|
| Create | `src/pages/connect-backend-data.hbs` |
| Create | `src/pages/creator-documentation.hbs` |
| Modify | `src/pages/index.hbs` |

---

## Task 1: connect-backend-data.hbs — scaffold, CSS, topbar, hero

**Files:**
- Create: `src/pages/connect-backend-data.hbs`

- [ ] **Step 1: Create the file with frontmatter, CSS, topbar, and hero**

Create `src/pages/connect-backend-data.hbs` with this exact content:

```html
{{!--
{
  "layout": "webring",
  "title": "Connect Backend Data — Vibes DIY",
  "description": "Your Vibes app's database, live from any JS backend. Read, write, and subscribe to real-time data outside the browser with use-vibes.",
  "ogUrl": "https://good.vibes.diy/connect-backend-data/",
  "source": "connect-backend-data"
}
--}}

<style>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=optional");

:root {
  --bg: oklch(0.16 0.015 260);
  --bg-elev: oklch(0.21 0.018 260);
  --bg-deep: oklch(0.12 0.018 260);
  --fg: oklch(0.97 0.005 260);
  --fg-dim: oklch(0.65 0.015 260);
  --fg-faint: oklch(0.45 0.015 260);
  --border: oklch(1 0 0 / 0.08);
  --border-strong: oklch(1 0 0 / 0.18);
  --live: oklch(0.86 0.21 135);
  --live-text: oklch(0.18 0.05 135);
  --punk: oklch(0.70 0.24 350);
  --warn: oklch(0.85 0.18 80);
  --cyan: oklch(0.75 0.14 220);
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: "Inter", system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  font-size: 16px;
  background-image:
    radial-gradient(circle at 8% 0%, rgba(180,255,140,0.05), transparent 35%),
    radial-gradient(circle at 95% 100%, rgba(255,120,200,0.06), transparent 40%);
  background-attachment: fixed;
}
a { color: var(--live); text-decoration: none; border-bottom: 1px dashed var(--live); transition: color 0.15s; }
a:hover { color: var(--fg); border-bottom-color: var(--fg); }
code { font-family: "JetBrains Mono", monospace; font-size: 0.85em; background: var(--bg-deep); color: var(--live); padding: 1px 6px; border-radius: 4px; }

.layout { max-width: 860px; margin: 0 auto; padding: 0 1.5rem; }

.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 0; border-bottom: 1px solid var(--border);
}
.topbar .brand {
  font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 1rem;
  color: var(--fg); text-decoration: none; border-bottom: none;
}
.topbar .brand:hover { color: var(--live); }
.topbar .back-link {
  font-family: "JetBrains Mono", monospace; font-size: 0.75rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--fg-faint); border-bottom: none;
}
.topbar .back-link:hover { color: var(--live); }

.hero { padding: 4rem 0 2.5rem; }
.hero .eyebrow {
  font-family: "JetBrains Mono", monospace; font-size: 0.7rem;
  letter-spacing: 0.3em; text-transform: uppercase;
  color: var(--live); margin-bottom: 1rem;
}
.hero h1 {
  font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 900;
  letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 1rem;
}
.hero .sub { font-size: 1.1rem; color: var(--fg-dim); max-width: 600px; line-height: 1.65; }

.section-label {
  padding: 3rem 0 0.5rem;
  font-family: "JetBrains Mono", monospace; font-size: 0.7rem;
  letter-spacing: 0.3em; text-transform: uppercase; color: var(--fg-faint);
}
.section-label::before { content: "// "; color: var(--live); }
.section-title {
  font-size: clamp(1.4rem, 3vw, 1.9rem); font-weight: 800;
  letter-spacing: -0.02em; margin-bottom: 0.5rem;
}
.section-sub { color: var(--fg-dim); font-size: 0.97rem; margin-bottom: 1.25rem; line-height: 1.6; }
.caption {
  color: var(--fg-faint); font-size: 0.82rem; font-family: "JetBrains Mono", monospace;
  margin-top: 0.6rem; padding-left: 0.25rem;
}

.cmd {
  background: var(--bg-deep); border: 1px solid var(--border-strong);
  border-radius: 12px; padding: 1.25rem 1.5rem;
  font-family: "JetBrains Mono", monospace; font-size: 0.9rem; line-height: 1.8;
  overflow-x: auto; margin: 1rem 0; position: relative;
}
.cmd::before {
  content: "shell"; position: absolute; top: 0; right: 0;
  padding: 4px 12px; background: var(--border); border-bottom-left-radius: 8px;
  font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-faint);
}
.cmd--js::before { content: "javascript"; }
.cmd--copy::before { display: none; }
.cmd .p { color: var(--live); user-select: none; }
.cmd .c { color: var(--fg-faint); }
.cmd .k { color: var(--punk); }
.cmd .s { color: var(--warn); }
.cmd .b { color: var(--fg); font-weight: 600; }
.cmd .fn { color: var(--live); }
.cmd .raw { display: none; }

.copy-btn {
  position: absolute; top: 0; right: 0; padding: 6px 14px;
  background: var(--border); color: var(--fg-faint); border: none;
  border-bottom-left-radius: 8px; font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
  cursor: pointer; transition: background 0.12s, color 0.12s; z-index: 2;
}
.copy-btn:hover { background: var(--live); color: var(--live-text); }
.copy-btn.copied { background: var(--live); color: var(--live-text); }

.prereq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
@media (max-width: 600px) { .prereq-grid { grid-template-columns: 1fr; } }

.callout-list {
  list-style: none; background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: 10px; padding: 1.25rem 1.5rem; margin: 1rem 0;
}
.callout-list li {
  padding: 0.45rem 0; font-size: 0.93rem; color: var(--fg-dim); line-height: 1.5;
  border-bottom: 1px solid var(--border);
}
.callout-list li:last-child { border-bottom: none; }

.defaults-table {
  width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 1rem 0;
  border: 1px solid var(--border-strong); border-radius: 10px; overflow: hidden;
}
.defaults-table th {
  background: var(--bg-elev); text-align: left; padding: 0.65rem 1rem;
  font-family: "JetBrains Mono", monospace; font-size: 0.7rem;
  letter-spacing: 0.15em; text-transform: uppercase; color: var(--fg-faint);
  border-bottom: 1px solid var(--border-strong);
}
.defaults-table td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.defaults-table tr:last-child td { border-bottom: none; }
.defaults-table td:first-child { font-family: "JetBrains Mono", monospace; color: var(--live); font-size: 0.85rem; }
.defaults-table td:last-child { color: var(--fg-dim); font-size: 0.9rem; }

.caching-callout {
  background: var(--bg-elev); border: 1px solid var(--border);
  border-left: 3px solid var(--cyan); border-radius: 10px;
  padding: 1.25rem 1.5rem; margin: 1rem 0;
}
.caching-callout ul { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; }
.caching-callout li { font-size: 0.93rem; color: var(--fg-dim); line-height: 1.55; }
.caching-callout li::before { content: "→ "; color: var(--cyan); }

.bullets { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; margin: 0.75rem 0; }
.bullets li {
  font-size: 0.95rem; color: var(--fg-dim); line-height: 1.55;
  padding-left: 1.2rem; position: relative;
}
.bullets li::before { content: "–"; position: absolute; left: 0; color: var(--fg-faint); }

.api-table {
  width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 1rem 0;
  border: 1px solid var(--border-strong); border-radius: 10px; overflow: hidden;
}
.api-table th {
  background: var(--bg-elev); text-align: left; padding: 0.65rem 1rem;
  font-family: "JetBrains Mono", monospace; font-size: 0.7rem;
  letter-spacing: 0.15em; text-transform: uppercase; color: var(--fg-faint);
  border-bottom: 1px solid var(--border-strong);
}
.api-table td { padding: 0.65rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.api-table tr:last-child td { border-bottom: none; }
.api-table td:first-child { font-family: "JetBrains Mono", monospace; color: var(--live); font-size: 0.85rem; white-space: nowrap; }
.api-table td:last-child { color: var(--fg-dim); font-size: 0.88rem; }
.badge {
  display: inline-block; font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 2px 6px; border-radius: 4px; margin-left: 0.4rem;
  background: oklch(0.86 0.21 135 / 0.15); color: var(--live);
}
.badge.unverified { background: oklch(0.85 0.18 80 / 0.15); color: var(--warn); }

.cta {
  margin: 4rem 0 2rem; padding: 2.5rem;
  background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 14px;
}
.cta h2 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
.cta p { color: var(--fg-dim); font-size: 0.95rem; margin-bottom: 1.25rem; }
.cta-buttons { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn {
  display: inline-block; padding: 0.6rem 1.4rem;
  background: var(--live); color: var(--live-text) !important;
  font-weight: 700; font-size: 0.9rem; border-radius: 8px;
  text-decoration: none; border: none; border-bottom: none; transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; color: var(--live-text) !important; border-bottom: none; }
.btn-secondary {
  background: transparent; color: var(--fg) !important;
  border: 2px solid var(--border-strong); border-radius: 8px;
  padding: 0.55rem 1.4rem;
}
.btn-secondary:hover { border-color: var(--live); color: var(--live) !important; }

footer.term-footer {
  padding: 1.5rem 0; border-top: 1px solid var(--border);
  font-family: "JetBrains Mono", monospace; font-size: 0.65rem;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-faint);
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
}
footer.term-footer a { color: var(--fg-faint); border-bottom: none; }
footer.term-footer a:hover { color: var(--live); }
</style>

<div class="layout">
  <header class="topbar">
    <a href="https://links.vibes.diy/homepage" class="brand">vibes.diy</a>
    <a href="/creator-documentation/" class="back-link">← Creator Documentation</a>
  </header>

  <section class="hero">
    <div class="eyebrow">use-vibes@2.2.18</div>
    <h1>Your Vibes app's database,<br>from any JS backend</h1>
    <p class="sub">Your app's live data is accessible outside the browser — from Node, Deno, Bun, Cloudflare Workers, or any runtime that can run npm packages.</p>
  </section>

</div>
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/jchris/code/landing-pages && pnpm check
```

Expected output includes: `connect-backend-data.hbs -> connect-backend-data.html`  
If error: check frontmatter JSON is valid (no trailing commas, all strings quoted).

---

## Task 2: Prerequisites + minimal example + callout list

**Files:**
- Modify: `src/pages/connect-backend-data.hbs`

- [ ] **Step 1: Add prerequisites section after the hero closing tag**

Remove the closing `</div>` at the bottom and replace with:

```html
  <!-- PREREQUISITES -->
  <div class="section-label">before you start</div>
  <h2 class="section-title">Prerequisites</h2>
  <div class="prereq-grid">
    <div>
      <p class="section-sub">Login once per device — stores a device cert in your keybag.</p>
      <div class="cmd cmd--copy">
        <button class="copy-btn" type="button">COPY</button>
        <span class="raw">npx vibes-diy login</span><span class="p">$</span> npx <span class="b">vibes-diy</span> login
      </div>
    </div>
    <div>
      <p class="section-sub">Install the package. Works with npm, pnpm, and yarn.</p>
      <div class="cmd cmd--copy">
        <button class="copy-btn" type="button">COPY</button>
        <span class="raw">npm install use-vibes</span><span class="p">$</span> npm install <span class="b">use-vibes</span>
      </div>
    </div>
  </div>
  <p class="caption">// Deno / Bun: <code>import { fireproof } from "https://esm.sh/use-vibes@2.2.18"</code></p>
```

- [ ] **Step 2: Add minimal example section**

Append after the prerequisites section (before the closing `</div>`):

```html
  <!-- MINIMAL EXAMPLE -->
  <div class="section-label">start here</div>
  <h2 class="section-title">Minimal working example</h2>
  <p class="section-sub">Connect to the same database that backs your Vibes app — the name must match what's in your <code>App.jsx</code>.</p>
  <div class="cmd cmd--js cmd--copy">
    <button class="copy-btn" type="button">COPY</button>
    <span class="raw">import { fireproof } from "use-vibes";

const db = fireproof("todos");          // database name matches the name used inside your vibe

const ok = await db.put({ text: "hello from Node" });
const doc = await db.get(ok.id);
const { docs } = await db.query("type", { key: "todo" });

db.subscribe((changes) => {
  console.log("live update:", changes);
}, true);</span><span class="k">import</span> { <span class="fn">fireproof</span> } <span class="k">from</span> <span class="s">"use-vibes"</span>;<br/><br/><span class="k">const</span> db = <span class="fn">fireproof</span>(<span class="s">"todos"</span>);          <span class="c">// database name matches the name used inside your vibe</span><br/><br/><span class="k">const</span> ok = <span class="k">await</span> db.<span class="fn">put</span>({ text: <span class="s">"hello from Node"</span> });<br/><span class="k">const</span> doc = <span class="k">await</span> db.<span class="fn">get</span>(ok.id);<br/><span class="k">const</span> { docs } = <span class="k">await</span> db.<span class="fn">query</span>(<span class="s">"type"</span>, { key: <span class="s">"todo"</span> });<br/><br/>db.<span class="fn">subscribe</span>((changes) => {<br/>&nbsp;&nbsp;console.<span class="fn">log</span>(<span class="s">"live update:"</span>, changes);<br/>}, <span class="k">true</span>);
  </div>
  <ul class="callout-list">
    <li><code>fireproof("todos")</code> — opens the database; name must match the one your Vibes app uses</li>
    <li><code>put(doc)</code> — write a document; returns <code>{ id, clock }</code></li>
    <li><code>get(id)</code> — fetch a document by id</li>
    <li><code>query(field, opts)</code> — index query by field value</li>
    <li><code>subscribe(fn, true)</code> — live updates over WebSocket; second arg fires immediately with current state</li>
  </ul>
```

- [ ] **Step 3: Verify build**

```bash
pnpm check
```

Expected: no errors. If there's an HTML parse error, check that the `<span class="raw">` block has no unclosed tags and the `.cmd` div's visible content uses `<br/>` for line breaks.

---

## Task 3: Defaults table + explicit options + caching rules

**Files:**
- Modify: `src/pages/connect-backend-data.hbs`

- [ ] **Step 1: Add defaults table and explicit options**

Append after the callout list (before closing `</div>`):

```html
  <!-- DEFAULTS TABLE -->
  <div class="section-label">configuration</div>
  <h2 class="section-title">How defaults resolve</h2>
  <p class="section-sub">When you call <code>fireproof("todos")</code> with no options, these defaults apply in order.</p>
  <table class="defaults-table">
    <thead>
      <tr><th>Field</th><th>Default</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>apiUrl</td>
        <td><code>VIBES_DIY_API_URL</code> env var, then <code>https://vibes.diy/api</code></td>
      </tr>
      <tr>
        <td>appSlug</td>
        <td><code>VIBES_APP_SLUG</code> env var, then <code>basename(process.cwd())</code></td>
      </tr>
      <tr>
        <td>getToken</td>
        <td>device cert from <code>npx vibes-diy login</code> keybag</td>
      </tr>
      <tr>
        <td>userSlug</td>
        <td>looked up automatically from your account on first request</td>
      </tr>
    </tbody>
  </table>

  <!-- EXPLICIT OPTIONS -->
  <h2 class="section-title" style="padding-top: 1.5rem;">Explicit config</h2>
  <p class="section-sub">For CI, Wrangler, or service accounts — environments without a device keybag.</p>
  <div class="cmd cmd--js cmd--copy">
    <button class="copy-btn" type="button">COPY</button>
    <span class="raw">const db = fireproof("todos", {
  apiUrl: "https://vibes.diy/api",
  appSlug: "my-app",
  userSlug: "alice",
  getToken: async () => myTokenResult,
});</span><span class="k">const</span> db = <span class="fn">fireproof</span>(<span class="s">"todos"</span>, {<br/>&nbsp;&nbsp;apiUrl: <span class="s">"https://vibes.diy/api"</span>,<br/>&nbsp;&nbsp;appSlug: <span class="s">"my-app"</span>,<br/>&nbsp;&nbsp;userSlug: <span class="s">"alice"</span>,<br/>&nbsp;&nbsp;<span class="fn">getToken</span>: <span class="k">async</span> () => myTokenResult,<br/>});
  </div>

  <!-- CACHING RULES -->
  <div class="section-label">important</div>
  <h2 class="section-title">Instance caching</h2>
  <p class="section-sub">These rules apply per process — important for long-running scripts and Workers.</p>
  <div class="caching-callout">
    <ul>
      <li><code>fireproof("todos") === fireproof("todos")</code> — same name returns the same instance within a process</li>
      <li>Multiple database names share one WebSocket connection</li>
      <li>First call's opts win for the whole process — later calls with different names inherit the connection settings</li>
    </ul>
  </div>
```

- [ ] **Step 2: Verify build**

```bash
pnpm check
```

Expected: `connect-backend-data.hbs -> connect-backend-data.html` with no errors.

---

## Task 4: Limitations + API table + CTA + footer + copy script; commit

**Files:**
- Modify: `src/pages/connect-backend-data.hbs`

- [ ] **Step 1: Add limitations, API table, CTA, footer, and script**

Append after the caching callout (before closing `</div>`):

```html
  <!-- V1 LIMITATIONS -->
  <div class="section-label">v1 limitations</div>
  <h2 class="section-title">What's not supported yet</h2>
  <ul class="bullets">
    <li>File uploads (<code>_files</code> field) are not yet supported — pure document workflows only</li>
    <li>Inside a Vibes iframe, the import is automatically rewritten to the postMessage bridge — this factory is only for external scripts</li>
  </ul>

  <!-- API REFERENCE -->
  <div class="section-label">reference</div>
  <h2 class="section-title">Available methods</h2>
  <p class="section-sub">These are the only methods. Do not use others.</p>
  <table class="api-table">
    <thead>
      <tr><th>Method</th><th>Notes</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>put(doc)</td>
        <td>Write a document. Returns <code>{ id, clock }</code>. <span class="badge">verified</span></td>
      </tr>
      <tr>
        <td>get(id)</td>
        <td>Fetch a document by id. <span class="badge">verified</span></td>
      </tr>
      <tr>
        <td>del(id)</td>
        <td>Delete a document by id. <span class="badge">verified</span></td>
      </tr>
      <tr>
        <td>query(field, opts)</td>
        <td>Index query by field value. <span class="badge">verified</span></td>
      </tr>
      <tr>
        <td>subscribe(fn, runNow?)</td>
        <td>Live updates over WebSocket. Second arg fires immediately. <span class="badge">verified</span></td>
      </tr>
      <tr>
        <td>allDocs(opts?)</td>
        <td>Fetch all documents. <span class="badge unverified">listed, unverified</span></td>
      </tr>
      <tr>
        <td>bulk(docs)</td>
        <td>Batch write. <span class="badge unverified">listed, unverified</span></td>
      </tr>
    </tbody>
  </table>

  <!-- CTA -->
  <div class="cta">
    <h2>Ready to connect?</h2>
    <p>Open your Vibes app, grab the database name from your <code>App.jsx</code>, and start reading data from your script.</p>
    <div class="cta-buttons">
      <a class="btn" href="https://links.vibes.diy/homepage">Open Vibes DIY →</a>
      <a class="btn btn-secondary" href="/creator-documentation/">← Creator Documentation</a>
    </div>
  </div>

  <footer class="term-footer">
    <span>$ use-vibes@2.2.18 · npm</span>
    <span>
      <a href="https://links.vibes.diy/discord">discord</a>
      &nbsp;·&nbsp;
      <a href="https://links.vibes.diy/CLI">github</a>
      &nbsp;·&nbsp;
      <a href="/creator-documentation/">docs</a>
    </span>
  </footer>
</div>

<script>
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.cmd');
      const raw = block.querySelector('.raw');
      const text = raw ? raw.textContent.trim() : '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'COPIED ✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 1800);
      }).catch(() => {
        btn.textContent = 'FAILED';
        setTimeout(() => { btn.textContent = 'COPY'; }, 1800);
      });
    });
  });
</script>
```

- [ ] **Step 2: Verify build and open in browser**

```bash
pnpm check && open _site/connect-backend-data.html
```

Check:
- Dark background renders correctly
- Topbar shows "vibes.diy" + "← Creator Documentation"
- Code blocks display with syntax coloring
- Click a COPY button — text should be copied to clipboard (test with paste)
- Table rows render with borders and monospace field names
- Caching callout has cyan left border

- [ ] **Step 3: Commit**

```bash
git add src/pages/connect-backend-data.hbs && git commit -m "Add /connect-backend-data — Node.js getting started guide for use-vibes"
```

---

## Task 5: Create creator-documentation.hbs; commit

**Files:**
- Create: `src/pages/creator-documentation.hbs`

- [ ] **Step 1: Create the file with full content**

Create `src/pages/creator-documentation.hbs`:

```html
{{!--
{
  "layout": "webring",
  "title": "Creator Documentation — Vibes DIY",
  "description": "Guides for building apps, scripting against your data, and shipping with Vibes DIY.",
  "ogUrl": "https://good.vibes.diy/creator-documentation/",
  "source": "creator-documentation"
}
--}}

<style>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=optional");

:root {
  --bg: oklch(0.16 0.015 260);
  --bg-elev: oklch(0.21 0.018 260);
  --fg: oklch(0.97 0.005 260);
  --fg-dim: oklch(0.65 0.015 260);
  --fg-faint: oklch(0.45 0.015 260);
  --border: oklch(1 0 0 / 0.08);
  --border-strong: oklch(1 0 0 / 0.18);
  --live: oklch(0.86 0.21 135);
  --live-text: oklch(0.18 0.05 135);
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: "Inter", system-ui, sans-serif;
  background: var(--bg); color: var(--fg);
  line-height: 1.6; font-size: 16px; min-height: 100vh;
  background-image:
    radial-gradient(circle at 8% 0%, rgba(180,255,140,0.05), transparent 35%),
    radial-gradient(circle at 95% 100%, rgba(255,120,200,0.06), transparent 40%);
  background-attachment: fixed;
}
a { color: var(--live); text-decoration: none; transition: color 0.15s; }
a:hover { color: var(--fg); }

.layout { max-width: 1000px; margin: 0 auto; padding: 0 1.5rem; }

.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 0; border-bottom: 1px solid var(--border);
}
.topbar .brand {
  font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 1rem;
  color: var(--fg); text-decoration: none;
}
.topbar .brand:hover { color: var(--live); }
.topbar .home-link { font-size: 0.85rem; color: var(--fg-faint); }
.topbar .home-link:hover { color: var(--live); }

.hero { padding: 4rem 0 3rem; }
.hero .eyebrow {
  font-family: "JetBrains Mono", monospace; font-size: 0.7rem;
  letter-spacing: 0.3em; text-transform: uppercase; color: var(--live); margin-bottom: 1rem;
}
.hero h1 {
  font-size: clamp(2.5rem, 7vw, 4.5rem); font-weight: 900;
  letter-spacing: -0.04em; line-height: 1.0; margin-bottom: 1rem;
}
.hero .sub { font-size: 1.1rem; color: var(--fg-dim); max-width: 480px; line-height: 1.65; }

.doc-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin: 0 0 4rem;
}
@media (max-width: 640px) { .doc-grid { grid-template-columns: 1fr; } }

.doc-card {
  display: flex; flex-direction: column;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: 14px; padding: 2rem; text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.doc-card:hover { border-color: var(--live); transform: translateY(-2px); }
.doc-card .tag {
  font-family: "JetBrains Mono", monospace; font-size: 0.65rem;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--live); margin-bottom: 0.75rem;
}
.doc-card h2 {
  font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em;
  color: var(--fg); margin-bottom: 0.5rem; line-height: 1.2;
}
.doc-card p { font-size: 0.9rem; color: var(--fg-dim); line-height: 1.55; flex: 1; }
.doc-card .arrow {
  display: block; margin-top: 1.25rem;
  font-family: "JetBrains Mono", monospace; font-size: 0.8rem; color: var(--live);
}

footer.term-footer {
  padding: 1.5rem 0; border-top: 1px solid var(--border);
  font-family: "JetBrains Mono", monospace; font-size: 0.65rem;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-faint);
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
}
footer.term-footer a { color: var(--fg-faint); }
footer.term-footer a:hover { color: var(--live); }
</style>

<div class="layout">
  <header class="topbar">
    <a href="https://links.vibes.diy/homepage" class="brand">vibes.diy</a>
    <a href="https://links.vibes.diy/homepage" class="home-link">Home</a>
  </header>

  <section class="hero">
    <div class="eyebrow">creator documentation</div>
    <h1>Build, script,<br>and ship.</h1>
    <p class="sub">Guides for making Vibes apps, connecting backend data, and deploying with the CLI.</p>
  </section>

  <div class="doc-grid">
    <a href="/how-to/" class="doc-card">
      <div class="tag">// guide 01</div>
      <h2>How to Make &amp; Share an App</h2>
      <p>Step-by-step screenshot walkthrough — from prompt to live, shareable app in minutes. No coding required.</p>
      <span class="arrow">Read the guide →</span>
    </a>
    <a href="/generate.html" class="doc-card">
      <div class="tag">// guide 02</div>
      <h2>CLI: npx vibes-diy generate</h2>
      <p>One command deploys a live React app from a prompt. 85 apps built this way. Read the workflow.</p>
      <span class="arrow">See the CLI →</span>
    </a>
    <a href="/connect-backend-data/" class="doc-card">
      <div class="tag">// guide 03</div>
      <h2>Connect Backend Data</h2>
      <p>Read and write your app's live database from any JS backend — Node, Deno, Bun, or Cloudflare Workers.</p>
      <span class="arrow">Read the guide →</span>
    </a>
    <a href="/psu-hackathon/" class="doc-card">
      <div class="tag">// event</div>
      <h2>PSU Hackathon</h2>
      <p>Claude Code Hackathon — Portland State University. Build something real with Vibes DIY and win lifetime access.</p>
      <span class="arrow">See the event →</span>
    </a>
  </div>

  <footer class="term-footer">
    <span>$ vibes.diy · creator docs</span>
    <span>
      <a href="https://links.vibes.diy/discord">discord</a>
      &nbsp;·&nbsp;
      <a href="https://links.vibes.diy/CLI">github</a>
      &nbsp;·&nbsp;
      <a href="https://links.vibes.diy/homepage">home</a>
    </span>
  </footer>
</div>
```

- [ ] **Step 2: Verify build and open in browser**

```bash
pnpm check && open _site/creator-documentation.html
```

Check:
- Dark hero renders with "Build, script, and ship."
- Four cards in 2×2 grid (1 column on narrow window)
- Each card hover: border brightens and card lifts
- Card links point to correct destinations

- [ ] **Step 3: Commit**

```bash
git add src/pages/creator-documentation.hbs && git commit -m "Add /creator-documentation — dark hub linking all creator guides"
```

---

## Task 6: Add creator-documentation card to index.hbs; build, commit, push

**Files:**
- Modify: `src/pages/index.hbs`

- [ ] **Step 1: Add CSS variant for `.creator-docs` card**

In `src/pages/index.hbs`, find the last `.landing-card.*` CSS block (`.landing-card.games:hover`). Add after it:

```css
        .landing-card.creator-docs {
            border-color: #4ade80;
        }

        .landing-card.creator-docs:hover {
            background: linear-gradient(135deg, #fff 0%, #f0fff4 100%);
        }
```

- [ ] **Step 2: Add the card to the grid**

In `src/pages/index.hbs`, find the `<a href="generate.html" class="landing-card engineers">` card. Add the creator-docs card immediately before it:

```html
            <a href="creator-documentation/" class="landing-card creator-docs">
                <div class="card-icon">//</div>
                <h2 class="card-title">Creator Documentation</h2>
                <p class="card-description">Guides for building apps, scripting against your data, and shipping with the CLI.</p>
                <span class="card-cta">Read the Docs →</span>
            </a>
```

- [ ] **Step 3: Verify build and open index**

```bash
pnpm check && open _site/index.html
```

Check: new green-bordered card appears in the grid, links to `creator-documentation/`.

- [ ] **Step 4: Commit and push**

```bash
git add src/pages/index.hbs
git commit -m "Add creator-documentation card to index"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `/connect-backend-data/` page — Task 1–4
- [x] `use-vibes@2.2.18` eyebrow — Task 1
- [x] Prerequisites: login + install — Task 2
- [x] Deno/Bun esm.sh note — Task 2
- [x] Minimal working example with copy button — Task 2
- [x] Callout list for each method — Task 2
- [x] Defaults table (4 rows) — Task 3
- [x] Explicit options code block — Task 3
- [x] Caching rules (3 bullets, cyan left border) — Task 3
- [x] v1 limitations (2 bullets) — Task 4
- [x] API reference table (put/get/del/query/subscribe verified; allDocs/bulk unverified) — Task 4
- [x] CTA + footer — Task 4
- [x] Copy button JS — Task 4
- [x] `/creator-documentation/` hub — Task 5
- [x] Four cards: how-to / generate / connect-backend-data / psu-hackathon — Task 5
- [x] Topbar on connect-backend-data links back to creator-documentation — Task 1
- [x] index.hbs card — Task 6
- [x] `pnpm check` before each commit — all tasks
- [x] commit + push to main — Task 6
