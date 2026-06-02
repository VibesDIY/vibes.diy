# Make access.js Pervasive Across All Prompt Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the access function pattern so pervasive across all prompt examples that the model never generates client-side permission checks — the correct pattern (access.js + `access.hasRole()`/`access.hasChannel()`) is the only pattern it can reproduce.

**Architecture:** Update every `useFireproof()` example across all prompt/llm docs to use camelCase database names, add minimal `access.js` to examples that touch data, and show the full access round-trip (access.js declares → App.jsx reads via `access`) in every permission-relevant example. Theme files are design-only (no code) and need no changes.

**Tech Stack:** Markdown prompt docs

**Issue:** Prompted by review of AI-generated team board that used client-side role queries instead of `access.hasRole()`

---

## Scope Boundaries

**Changes:** `prompts/pkg/llms/fireproof.md`, `prompts/pkg/llms/use-viewer.md`, `prompts/pkg/system-prompt.md`, `prompts/pkg/system-prompt-initial.md`, `prompts/pkg/llms/webxr.md`, `prompts/pkg/llms/three-js.md`, `notes/vibes-app-jsx.md`

**Unchanged:** Theme files (`prompts/pkg/themes/*.md`) — these are design systems with no code examples. `prompts/pkg/llms/callai.md`, `prompts/pkg/llms/d3.md`, `prompts/pkg/llms/image-gen.md`, `prompts/pkg/llms/web-audio.md` — no `useFireproof()` calls or hyphenated db names.

---

### Task 1: Rename all hyphenated database names to camelCase in fireproof.md

**Files:**

- Modify: `prompts/pkg/llms/fireproof.md`

This task is purely mechanical — find-and-replace database name strings. No example restructuring.

- [ ] **Step 1: Rename `my-ledger` → `myLedger` everywhere**

Lines 10, 33, 50, 80, 146, 201, 587: replace `"my-ledger"` with `"myLedger"` (7 occurrences).

Also update line 10's generic `"db-name"` to `"dbName"`.

- [ ] **Step 2: Rename remaining hyphenated names**

- Line 258: `"public-notes"` → `"publicNotes"`
- Line 604: `"todo-list-db"` → `"todoList"`
- Line 722: `"todo-list-db"` → `"todoList"`
- Line 623: `"photo-album"` → `"photoAlbum"`
- Line 813: `"image-uploads"` → `"imageUploads"`

- [ ] **Step 3: Update the hyphenated-name footnote**

The section at line 493 currently presents hyphenated names as a normal pattern. Reframe it as an edge case footnote. Change from:

```markdown
**Hyphenated database names** (like `useFireproof("crew-chat")`) can't be direct JavaScript identifiers. Use `export { localName as "db-name" }` to map a local function to the hyphenated name:
```

To:

```markdown
**Hyphenated database names** are rare — prefer camelCase (`useFireproof("crewChat")`). If you inherit a hyphenated name, use `export { localName as "db-name" }` to map a local function:
```

- [ ] **Step 4: Verify no hyphenated database names remain (except the footnote example)**

Run: `grep -n 'useFireproof("[^"]*-[^"]*")' prompts/pkg/llms/fireproof.md`

Expected: Only the footnote example line (~496) should remain.

- [ ] **Step 5: Commit**

```bash
git add prompts/pkg/llms/fireproof.md
git commit -m "docs: rename all hyphenated db names to camelCase in fireproof.md"
```

---

### Task 2: Add access.js to existing fireproof.md examples

**Files:**

- Modify: `prompts/pkg/llms/fireproof.md`

Add minimal `access.js` blocks to the existing example apps. The access function should feel like part of the skeleton — even simple apps include one.

- [ ] **Step 1: Add access.js to the Basic Example (line ~42)**

After the existing basic example code block (which ends around line 73), add a minimal access.js that requires authentication:

````markdown
The access function lives in a separate file. Even simple apps include one — it's the server-side authority for who can write:

access.js

```js
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return {};
}
```
````

````

- [ ] **Step 2: Add access.js to the Todo Example (line ~712)**

After the todo tracker App.jsx code block (which ends around line 798), add:

```markdown
The todo app's access function validates authorship:

access.js
```js
export function todoList(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "todo" && doc.createdBy !== user.userHandle) {
    throw { forbidden: "only the author can edit" };
  }
  return {};
}
````

````

Also update the todo App.jsx to stamp `createdBy: viewer?.userHandle` on new todos — add `import { useViewer } from "use-vibes"` and `const { viewer } = useViewer()` to the hooks section, and add `createdBy: ""` to the useDocument default shape.

- [ ] **Step 3: Add access.js to the Image Uploader Example (line ~803)**

After the image uploader App.jsx code block (which ends at line 875), add:

```markdown
access.js
```js
export function imageUploads(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to upload" };
  return {};
}
````

````

- [ ] **Step 4: Commit**

```bash
git add prompts/pkg/llms/fireproof.md
git commit -m "docs: add access.js to every example app in fireproof.md"
````

---

### Task 3: Add a complete round-trip reference app to fireproof.md

**Files:**

- Modify: `prompts/pkg/llms/fireproof.md`

Add a full working example that shows both files together — access.js declaring roles/channels/grants, and App.jsx reading them back via `access.hasRole()` / `access.hasChannel()`. This goes after the "Reading Resolved Grants" section (line ~308) and before the "Access Function" section (line ~312).

- [ ] **Step 1: Insert the complete round-trip example**

Insert after line 308 (`The AI agent writes the access function...`):

````markdown
### Complete example: Team announcements with roles and channels

This example shows the full round-trip — access.js declares roles, channels, and grants; App.jsx reads them back via `access`.

access.js

```js
export function announcements(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "roleGrant") {
    ctx.requireRole("admin");
    return { members: { [doc.role]: [doc.userHandle] } };
  }

  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess(doc.channel);
    return { channels: [doc.channel] };
  }

  return {};
}
```
````

App.jsx — `access.hasRole()` and `access.hasChannel()` gate the UI based on what the access function declared:

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

export default function App() {
  const { viewer, can, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("announcements");

  const { docs: posts } = useLiveQuery("type", { key: "post" });
  const [draft, setDraft] = React.useState("");
  const [channel, setChannel] = React.useState("general");

  if (isViewerPending) return null;

  async function submitPost() {
    if (!draft.trim() || !viewer) return;
    await database.put({
      type: "post",
      channel,
      body: draft.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    setDraft("");
  }

  return (
    <div>
      <ViewerTag />

      {/* membership gate — can they interact at all? */}
      {can("write") && access.hasChannel(channel) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPost();
          }}
        >
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit">Post</button>
        </form>
      )}

      {/* role gate — admin-only controls */}
      {access.hasRole("admin") && (
        <button onClick={() => database.put({ type: "roleGrant", role: "poster", userHandle: "newUser" })}>
          Grant poster role
        </button>
      )}

      {posts.map((p) => (
        <div key={p._id}>
          <ViewerTag userHandle={p.authorHandle} />
          <p>{p.body}</p>
          {access.hasRole("admin") && <button onClick={() => database.del(p._id)}>Delete</button>}
        </div>
      ))}
    </div>
  );
}
```

The pattern: `can("write")` is the door (membership). `access.hasRole()` and `access.hasChannel()` are the room (what you can do once inside). The access function is the server-side authority — the UI just reflects its decisions.

````

- [ ] **Step 2: Commit**

```bash
git add prompts/pkg/llms/fireproof.md
git commit -m "docs: add complete round-trip access function reference app"
````

---

### Task 4: Update use-viewer.md — clarify can() vs access, fix field names, camelCase db names

**Files:**

- Modify: `prompts/pkg/llms/use-viewer.md`

- [ ] **Step 1: Fix the `can()` examples — remove dbName parameter**

Lines 51 and 104 still use `can("write", "comments")`. Change to `can("write")` (no second arg — the dbName parameter was removed in the earlier simplification PR).

Line 51:

```markdown
      {viewer && !can("write") && <p>Contact the owner to request write access so you can post.</p>}
      {viewer && can("write") && <form>...</form>}
```

Line 104 (same pattern).

- [ ] **Step 2: Update the `comments` example to show the access round-trip**

The example at line 63 uses `useFireproof("comments")` but doesn't destructure `access`. Update it to show the full pattern:

Change the useFireproof line from:

```jsx
const { useLiveQuery, database } = useFireproof("comments");
```

To:

```jsx
const { useLiveQuery, database, access } = useFireproof("comments");
```

And update the permission section of the example to show both layers:

```jsx
{
  /* membership gate */
}
{
  viewer && can("write") && (
    <>
      {/* access function gate — poster role required */}
      {access.hasRole("poster") && <CommentForm database={database} />}
      {access.hasRole("moderator") && <ModTools />}
    </>
  );
}
```

- [ ] **Step 3: Update line 133 — strengthen the access guidance**

Current line 133 reads as a footnote. Replace with:

```markdown
- `can("write")` checks app-level membership — is the viewer through the door? For per-database permissions (roles and channels), use `access` from `useFireproof()`: `access.hasRole("moderator")`, `access.hasChannel("engineering")`. The access function (access.js) is the server-side authority; `access` in the UI reflects its decisions.
```

- [ ] **Step 4: Fix `userSlug` reference at line 151**

Line 151 mentions `userSlug` — change to `userHandle`:

```markdown
**Undefined safety.** If `userHandle` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring.
```

- [ ] **Step 5: Commit**

```bash
git add prompts/pkg/llms/use-viewer.md
git commit -m "docs: update use-viewer.md — can() without dbName, access round-trip, userHandle"
```

---

### Task 5: Update system-prompt.md — camelCase db names, reinforce access.js as skeleton

**Files:**

- Modify: `prompts/pkg/system-prompt.md`

- [ ] **Step 1: Update line 390 — camelCase the vibe db name pattern**

Change from:

```markdown
- "Just me" — all persistent data in a single Fireproof database (`useFireproof("vibe-…")`), no user attribution needed
```

To:

```markdown
- "Just me" — all persistent data in a single Fireproof database (`useFireproof("myApp")`), no user attribution needed
```

- [ ] **Step 2: Update the useViewer exception (line 48) to also include access**

The current exception at line 48 says to destructure `useViewer` early so `can("write")` is available. Extend it to also note that `access` from `useFireproof()` carries roles and channels:

After the existing text about `can("write")`, add:

```markdown
When the app has an `access.js`, the first `useFireproof` wire pass should also destructure `access` — `const { database, useLiveQuery, access } = useFireproof("dbName")` — so permission gates can use `access.hasRole()` and `access.hasChannel()` alongside `can("write")`.
```

- [ ] **Step 3: Commit**

```bash
git add prompts/pkg/system-prompt.md
git commit -m "docs: camelCase db names and access destructuring in system-prompt.md"
```

---

### Task 6: Update system-prompt-initial.md — same changes as system-prompt.md

**Files:**

- Modify: `prompts/pkg/system-prompt-initial.md`

- [ ] **Step 1: Update line 163 — camelCase the vibe db name pattern**

Same change as Task 5 Step 1: `"vibe-…"` → `"myApp"`.

- [ ] **Step 2: Update the useViewer exception (line 117) to also mention access**

Same addition as Task 5 Step 2: when an `access.js` exists, destructure `access` from `useFireproof()` in the first wire pass.

- [ ] **Step 3: Commit**

```bash
git add prompts/pkg/system-prompt-initial.md
git commit -m "docs: camelCase db names and access destructuring in system-prompt-initial.md"
```

---

### Task 7: Fix hyphenated db names in webxr.md and three-js.md

**Files:**

- Modify: `prompts/pkg/llms/webxr.md`
- Modify: `prompts/pkg/llms/three-js.md`

- [ ] **Step 1: Rename db names in webxr.md**

- Line 509: `"galaxy-sessions"` → `"galaxySessions"`
- Line 664: `"ar-orbs"` → `"arOrbs"`

- [ ] **Step 2: Rename db names in three-js.md**

- Line 1071: `"sky-glider-scores"` → `"skyGliderScores"`
- Line 1478: `"halftone-studio"` → `"halftoneStudio"`

- [ ] **Step 3: Commit**

```bash
git add prompts/pkg/llms/webxr.md prompts/pkg/llms/three-js.md
git commit -m "docs: camelCase db names in webxr.md and three-js.md"
```

---

### Task 8: Update notes/vibes-app-jsx.md — camelCase db names, fix stale channel API

**Files:**

- Modify: `notes/vibes-app-jsx.md`

- [ ] **Step 1: Rename hyphenated db names**

- Line 18: `"database-name"` → `"myDatabase"`
- Line 23: `"database-name"` → `"myDatabase"`
- Line 30: `"database-name"` → `"myDatabase"`
- Line 134: `'channel-registry'` → `'channelRegistry'`

- [ ] **Step 2: Update the stale `can('read', channelName)` pattern (line 129)**

This file still uses the old `can(action, dbName)` signature. Update to use the access API:

Change from:

```markdown
Each named Fireproof database is a **channel** — an isolated data space with its own access policy configured by the app owner via settings. App.jsx never sets access policy; it only reads it via `can()`.

Store available channels in a registry database, then filter by `can('read', channelName)` so each user only sees channels they can access:
```

To:

```markdown
Each named Fireproof database is a **channel** — an isolated data space with its own access policy. App.jsx reads permissions via `access` from `useFireproof()`:

Store available channels in a registry database, then filter by `access.hasChannel(name)` so each user only sees channels they have access to:
```

Update the code example at line 134 to use `access.hasChannel()` instead of `can('read', name)`.

- [ ] **Step 3: Commit**

```bash
git add notes/vibes-app-jsx.md
git commit -m "docs: camelCase db names and access API in vibes-app-jsx.md"
```

---

### Task 9: Run format check and final verification

- [ ] **Step 1: Format all changed files**

```bash
npx prettier --write prompts/pkg/llms/fireproof.md prompts/pkg/llms/use-viewer.md prompts/pkg/system-prompt.md prompts/pkg/system-prompt-initial.md prompts/pkg/llms/webxr.md prompts/pkg/llms/three-js.md notes/vibes-app-jsx.md
```

- [ ] **Step 2: Verify no hyphenated db names remain (except the one footnote)**

```bash
grep -rn 'useFireproof("[^"]*-[^"]*")' prompts/pkg/ notes/
```

Expected: Only the footnote in fireproof.md showing the `export { localName as "db-name" }` pattern.

- [ ] **Step 3: Verify `userHandle` is used consistently (no `userSlug` in identity contexts)**

```bash
grep -n 'userSlug' prompts/pkg/llms/use-viewer.md prompts/pkg/llms/fireproof.md
```

Expected: No results (or only in non-identity contexts like URL slugs).

- [ ] **Step 4: Commit any formatting changes**

```bash
git add -A && git commit -m "style: format prompt docs"
```
