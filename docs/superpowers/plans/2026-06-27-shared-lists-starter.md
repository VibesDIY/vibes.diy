# `system/shared-lists` Starter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Productive starter vibe `system/shared-lists` — a multi-list collaborative todo with per-list friends and fractional drag-ordering — as a single flat `App.jsx` (+ `README.md`, + `access.js`), built root-local-first so each phase is independently deployable.

**Architecture:** One Fireproof database (`sharedLists`) with one channel per list (`list:<id>` + `list:<id>/admin`), the per-object hybrid from the access-model design. Items carry a float `position` so a reorder writes only the moved doc. Built in 4 phases: (1) local single list, no backend; (2) persist that list with Fireproof; (3) multi-list registry; (4) friends/sharing via `access.js`. Spec: `docs/superpowers/specs/2026-06-27-productive-starter-multi-list-todo-design.md`.

**Tech Stack:** React (single-file vibe), `use-fireproof` (`useFireproof`), `use-vibes` (`useViewer`, `useVibe`), Tailwind utility classes, native HTML5 drag-and-drop. Deployed with `npx vibes-diy push --vibe system/shared-lists`.

---

## How to verify in this repo (read first)

Individual vibes have **no local unit-test runner** — they are single-file React apps deployed via `push`. So this plan verifies each step three ways instead of `pytest`-style asserts:

1. **Prettier** must pass (`compile_test` CI runs `format:check` across the repo):
   `pnpm exec prettier --check vibes/shared-lists/` → expect "All matched files use Prettier code style!"
2. **Pure-logic checks:** the ordering/validation helpers (`positionForAppend`, `positionForDrop`, `safeId`) are pure functions. Each task that adds one includes a **worked example table** — trace the inputs by hand (or paste the function into `node -e`) and confirm the outputs before moving on.
3. **Behavior checklist:** each UI task lists exact interactions and expected on-screen results. For Phases 1–2 you can open the app in the vibes dev preview; from Phase 4 (login/sharing) use a real preview deploy or the `qa-pr` skill.

Commit after every task. Always run prettier before committing.

> **Reference patterns (read before starting):** `vibes/team-channels/App.jsx` + `access.js` (channels, `useVibe().can.*` gating, named access export), `vibes/pickathon-access/access.js` (`grant.users` per-user), `notes/vibes-app-jsx.md` (hooks), `prompts/pkg/llms/fireproof.md` §"Sortable Lists" (the `[listId, position]` compound-index idiom) and §"\_id temporal ordering".

---

## File structure

| File                           | Responsibility                                                                   | Introduced |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------- |
| `vibes/shared-lists/App.jsx`   | The entire app — **all components inline** (push ships no subdirs)               | Phase 1    |
| `vibes/shared-lists/README.md` | One-line description + canonical `--vibe system/shared-lists` push/pull commands | Phase 1    |
| `vibes/shared-lists/access.js` | `export function sharedLists(doc, oldDoc, user, ctx)` — the hybrid access policy | Phase 4    |

`App.jsx` grows across phases. Keep helper components (`ItemRow`, `EntryBox`, `ListRail`, `InviteBox`) as inline functions in the one file — do **not** create new files; `push` only uploads top-level files.

---

## Phase 1 — Root: a single LOCAL list (no backend)

Instant, no login, zero backend. Pure client state. This phase alone is a deployable `system/shared-lists` starter (the bloom-machine-equivalent root slice).

### Task 1: Scaffold the vibe directory

**Files:**

- Create: `vibes/shared-lists/App.jsx`
- Create: `vibes/shared-lists/README.md`

- [ ] **Step 1: Create the minimal App.jsx**

```jsx
import React, { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_95)] text-[oklch(0.2_0.02_260)] font-sans flex flex-col items-center">
      <h1 className="text-2xl font-black mt-8 mb-4">Shared Lists</h1>
      <p className="text-sm opacity-70">Starting up…</p>
    </div>
  );
}
```

- [ ] **Step 2: Create README.md**

```markdown
# shared-lists

The Productive category starter for the Instant Starter Stack — a multi-list collaborative todo with per-list friends and drag-sortable items. Owned by the `system` handle.

Live: https://vibes.diy/vibe/system/shared-lists

## Commands

\`\`\`sh
npx vibes-diy push --vibe system/shared-lists # deploy this directory
npx vibes-diy pull --vibe system/shared-lists # fetch the deployed source
\`\`\`

Always pass `--vibe system/shared-lists` so it isn't published under a personal handle.
Run `npx prettier --write .` before committing — CI's `compile_test` runs `format:check`.
```

- [ ] **Step 3: Verify prettier**

Run: `pnpm exec prettier --check vibes/shared-lists/`
Expected: "All matched files use Prettier code style!"

- [ ] **Step 4: Commit**

```bash
git add vibes/shared-lists/App.jsx vibes/shared-lists/README.md
git commit -m "feat(shared-lists): scaffold the starter vibe directory"
```

### Task 2: Add the pure ordering helpers

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add the helpers above the App component**

```jsx
const STEP = 1; // spacing for appends (epsilon guard intentionally omitted — see spec §4)

// `sorted` is the items already sorted ascending by position.
function positionForAppend(sorted) {
  return sorted.length ? sorted[sorted.length - 1].position + STEP : STEP;
}

// targetIndex = the slot in the visually-sorted array AFTER the dragged item is removed.
function positionForDrop(sorted, targetIndex) {
  const before = sorted[targetIndex - 1]; // undefined when dropping at the top
  const after = sorted[targetIndex]; // undefined when dropping at the bottom
  if (!before) return after.position - STEP; // top
  if (!after) return before.position + STEP; // bottom
  return (before.position + after.position) / 2; // between → average
}
```

- [ ] **Step 2: Verify the logic by hand**

Trace against this table (positions of the sorted array shown):

| sorted positions | call                      | expected                |
| ---------------- | ------------------------- | ----------------------- |
| `[]`             | `positionForAppend([])`   | `1`                     |
| `[1, 2, 3]`      | `positionForAppend(...)`  | `4`                     |
| `[1, 2, 3]`      | `positionForDrop(..., 0)` | `0` (top: `1 - 1`)      |
| `[1, 2, 3]`      | `positionForDrop(..., 3)` | `4` (bottom: `3 + 1`)   |
| `[1, 2, 3]`      | `positionForDrop(..., 1)` | `1.5` (between 1 and 2) |

Optional: paste both functions into `node -e "...; console.log(positionForDrop([{position:1},{position:2},{position:3}],1))"` and confirm `1.5`.

- [ ] **Step 3: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): add fractional ordering helpers"
```

### Task 3: Local list — add items and render sorted, entry box at bottom

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Replace the App component body with local-state list + entry box**

```jsx
export default function App() {
  // local-only items: { id, text, done, position }
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const sorted = [...items].sort((a, b) => a.position - b.position);

  function addItem(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setItems((cur) => {
      const s = [...cur].sort((a, b) => a.position - b.position);
      return [...cur, { id: crypto.randomUUID(), text: t, done: false, position: positionForAppend(s) }];
    });
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.01_95)] text-[oklch(0.2_0.02_260)] font-sans flex flex-col">
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-black">Shared Lists</h1>
      </header>
      <ul className="flex-1 overflow-y-auto px-5 space-y-2">
        {sorted.length === 0 ? (
          <li className="text-sm opacity-50 italic">No items yet — add one below.</li>
        ) : (
          sorted.map((it) => (
            <li key={it.id} className="px-3 py-2 bg-white border-2 border-black rounded">
              {it.text}
            </li>
          ))
        )}
      </ul>
      <form onSubmit={addItem} className="sticky bottom-0 bg-[oklch(0.98_0.01_95)] px-5 py-3 flex gap-2 border-t-2 border-black">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
          className="flex-1 px-3 py-2 border-2 border-black rounded bg-white min-h-[44px]"
        />
        <button type="submit" className="px-4 py-2 bg-[oklch(0.8_0.18_85)] border-2 border-black rounded font-bold min-h-[44px]">
          Add
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Behavior check**

- Load the app → see "No items yet" and an entry box pinned at the bottom.
- Type "buy milk", press Add → row appears; input clears; entry box stays at the bottom.
- Add "walk dog" → it appears **below** "buy milk" (append-at-bottom).

- [ ] **Step 3: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): local list with add + bottom entry box"
```

### Task 4: Check / strikethrough in place

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add a toggle handler inside App (above `return`)**

```jsx
function toggle(id) {
  setItems((cur) => cur.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
}
```

- [ ] **Step 2: Replace the `<li>` render with a checkbox + strikethrough**

```jsx
sorted.map((it) => (
  <li key={it.id} className="px-3 py-2 bg-white border-2 border-black rounded flex items-center gap-3">
    <input type="checkbox" checked={it.done} onChange={() => toggle(it.id)} className="w-5 h-5 shrink-0" />
    <span className={it.done ? "line-through opacity-50" : ""}>{it.text}</span>
  </li>
));
```

- [ ] **Step 3: Behavior check**

- Check an item → text gets a strikethrough and dims **in place** (does not move).
- Uncheck → strikethrough removed, still in the same position.

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): check/strikethrough in place"
```

### Task 5: Delete item

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add a remove handler inside App**

```jsx
function remove(id) {
  setItems((cur) => cur.filter((it) => it.id !== id));
}
```

- [ ] **Step 2: Add a delete button to the row (after the `<span>`)**

```jsx
<button
  onClick={() => remove(it.id)}
  className="ml-auto text-xs opacity-40 hover:opacity-100 hover:text-[oklch(0.6_0.2_25)] shrink-0"
  aria-label="delete"
>
  ✕
</button>
```

- [ ] **Step 3: Behavior check** — add two items, delete the first → only the second remains.

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): delete item"
```

### Task 6: Drag-to-reorder (native HTML5 DnD)

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add drag state + a reorder handler inside App**

```jsx
const [dragId, setDragId] = useState(null);

function setPosition(id, position) {
  setItems((cur) => cur.map((it) => (it.id === id ? { ...it, position } : it)));
}

// drop the dragged item just BEFORE `targetId` (or at the end when targetId is null)
function dropOn(targetId) {
  if (!dragId || dragId === targetId) return;
  const withoutDragged = sorted.filter((it) => it.id !== dragId);
  const targetIndex = targetId ? withoutDragged.findIndex((it) => it.id === targetId) : withoutDragged.length;
  setPosition(dragId, positionForDrop(withoutDragged, targetIndex));
  setDragId(null);
}
```

- [ ] **Step 2: Make rows draggable and drop targets**

Add these props to the `<li>`:

```jsx
<li
  key={it.id}
  draggable
  onDragStart={() => setDragId(it.id)}
  onDragOver={(e) => e.preventDefault()}
  onDrop={() => dropOn(it.id)}
  className={
    "px-3 py-2 bg-white border-2 border-black rounded flex items-center gap-3 " +
    (dragId === it.id ? "opacity-40" : "")
  }
>
```

And add a drop zone at the very end of the list (after the `.map(...)`, still inside the `<ul>`) so you can drop at the bottom:

```jsx
<li onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(null)} className="h-6" />
```

- [ ] **Step 3: Behavior check (desktop)**

- Add A, B, C. Drag C above A → order becomes C, A, B.
- Drag A to the bottom drop zone → order becomes C, B, A.
- Confirm only the dragged item's `position` changes (React DevTools, or reason from `setPosition` only mutating one id).

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): drag-to-reorder via native DnD"
```

### Task 7: Up/down nudge arrows (touch fallback)

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add a nudge handler inside App**

```jsx
// move item at sorted-index `i` by delta (-1 up, +1 down) by swapping positions
function nudge(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= sorted.length) return;
  const a = sorted[i];
  const b = sorted[j];
  setItems((cur) =>
    cur.map((it) => (it.id === a.id ? { ...it, position: b.position } : it.id === b.id ? { ...it, position: a.position } : it))
  );
}
```

- [ ] **Step 2: Add arrows to the row** (pass the index — change the map to `sorted.map((it, i) => ...)`, then add before the delete button):

```jsx
<span className="flex flex-col leading-none shrink-0">
  <button onClick={() => nudge(i, -1)} disabled={i === 0} className="text-xs disabled:opacity-20" aria-label="move up">
    ▲
  </button>
  <button
    onClick={() => nudge(i, 1)}
    disabled={i === sorted.length - 1}
    className="text-xs disabled:opacity-20"
    aria-label="move down"
  >
    ▼
  </button>
</span>
```

- [ ] **Step 3: Behavior check** — add A, B, C; tap ▼ on A → A,B,C becomes B,A,C; ▲ disabled on the top row, ▼ disabled on the bottom row.

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): up/down nudge arrows for touch"
```

### Task 8: Deploy the local root starter

- [ ] **Step 1: Push to the system handle**

Run from the vibe dir: `cd vibes/shared-lists && npx vibes-diy push --vibe system/shared-lists`
Expected: prints a live HTTPS URL (`https://vibes.diy/vibe/system/shared-lists`).

- [ ] **Step 2: Smoke-test the live URL on a phone viewport** — add / check / delete / drag / nudge all work, no login prompt, instant load.

> **Phase 1 done = a real, instant, anonymous `system/shared-lists` starter is live.** Phases 2–4 layer persistence and sharing.

---

## Phase 2 — Persist the single list with Fireproof

Wire the one list to a database so it survives reload. Login is required on the first **write** (the platform gates codegen/writes); reads stay anonymous. Items become docs: `{ type: "item", listId: "default", text, done, position, authorHandle, createdAt }`. We keep a single hard-coded `listId: "default"` until Phase 3.

### Task 9: Swap local state for Fireproof docs

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Update imports**

```jsx
import React, { useState } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer, useVibe } from "use-vibes";

const DB = "sharedLists";
const DEFAULT_LIST = "default";
```

- [ ] **Step 2: Replace local-state queries/handlers with Fireproof** (inside App, replacing `useState([])` for items and the handlers)

```jsx
const { useLiveQuery, database } = useFireproof(DB);
const { viewer } = useViewer();
const { can, ready, me } = useVibe(DB);
// compound index [listId, position] → already sorted ascending by position (fireproof.md §Sortable Lists)
const { docs: sorted } = useLiveQuery((d) => (d.type === "item" ? [d.listId, d.position] : undefined), {
  prefix: [DEFAULT_LIST],
});
const [text, setText] = useState("");
const [dragId, setDragId] = useState(null);

const writeVerdict = ready ? can.create({ type: "item", listId: DEFAULT_LIST, authorHandle: me?.userHandle }) : null;

async function addItem(e) {
  e.preventDefault();
  const t = text.trim();
  if (!t || !me) return;
  setText("");
  await database.put({
    type: "item",
    listId: DEFAULT_LIST,
    text: t,
    done: false,
    position: positionForAppend(sorted),
    authorHandle: me.userHandle,
    createdAt: Date.now(),
  });
}

async function toggle(doc) {
  await database.put({ ...doc, done: !doc.done });
}

async function remove(doc) {
  await database.del(doc._id);
}

async function setPosition(doc, position) {
  await database.put({ ...doc, position });
}

async function dropOn(targetDoc) {
  if (!dragId || dragId === targetDoc?._id) return;
  const dragged = sorted.find((d) => d._id === dragId);
  const without = sorted.filter((d) => d._id !== dragId);
  const targetIndex = targetDoc ? without.findIndex((d) => d._id === targetDoc._id) : without.length;
  await setPosition(dragged, positionForDrop(without, targetIndex));
  setDragId(null);
}

async function nudge(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= sorted.length) return;
  const a = sorted[i];
  const b = sorted[j];
  await setPosition(a, b.position);
  await setPosition(b, a.position);
}
```

- [ ] **Step 3: Update the row render** to use `_id`/doc objects (key off `d._id`, pass the doc to `toggle`/`remove`/`dropOn`):

```jsx
{
  sorted.length === 0 ? (
    <li className="text-sm opacity-50 italic">No items yet — add one below.</li>
  ) : (
    sorted.map((it, i) => (
      <li
        key={it._id}
        draggable
        onDragStart={() => setDragId(it._id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropOn(it)}
        className={
          "px-3 py-2 bg-white border-2 border-black rounded flex items-center gap-3 " + (dragId === it._id ? "opacity-40" : "")
        }
      >
        <input type="checkbox" checked={it.done} onChange={() => toggle(it)} className="w-5 h-5 shrink-0" />
        <span className={it.done ? "line-through opacity-50" : ""}>{it.text}</span>
        <span className="flex flex-col leading-none shrink-0 ml-auto">
          <button onClick={() => nudge(i, -1)} disabled={i === 0} className="text-xs disabled:opacity-20" aria-label="move up">
            ▲
          </button>
          <button
            onClick={() => nudge(i, 1)}
            disabled={i === sorted.length - 1}
            className="text-xs disabled:opacity-20"
            aria-label="move down"
          >
            ▼
          </button>
        </span>
        <button
          onClick={() => remove(it)}
          className="text-xs opacity-40 hover:opacity-100 hover:text-[oklch(0.6_0.2_25)] shrink-0"
          aria-label="delete"
        >
          ✕
        </button>
      </li>
    ))
  );
}
<li onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(null)} className="h-6" />;
```

- [ ] **Step 4: Gate the entry box on the write verdict** (replace the `<form>` with a verdict check)

```jsx
{
  ready && writeVerdict && !writeVerdict.ok ? (
    <div className="px-5 py-3 border-t-2 border-black text-sm opacity-70 italic">
      {writeVerdict.reason || "Sign in to add items."}
    </div>
  ) : (
    <form onSubmit={addItem} className="sticky bottom-0 bg-[oklch(0.98_0.01_95)] px-5 py-3 flex gap-2 border-t-2 border-black">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an item…"
        className="flex-1 px-3 py-2 border-2 border-black rounded bg-white min-h-[44px]"
      />
      <button type="submit" className="px-4 py-2 bg-[oklch(0.8_0.18_85)] border-2 border-black rounded font-bold min-h-[44px]">
        Add
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Behavior check**

- Load anonymously → items (if any) render; the entry box shows the sign-in reason instead of a dead input.
- Sign in, add an item → it persists across reload.
- Reorder/check/delete persist across reload.

- [ ] **Step 6: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): persist the list with Fireproof, gate writes"
```

---

## Phase 3 — Multi-list registry + list rail

Introduce `list` docs and a registry, so a user can have many lists. Still single-user (no sharing yet).

### Task 10: List registry data + rail UI

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Query lists and track the active list** (add inside App, near the other queries)

```jsx
// lists ordered newest-first via _id (roughly temporal — no createdAt needed for ordering, per fireproof.md)
const { docs: lists } = useLiveQuery((d) => (d.type === "list" ? d._id : undefined), { descending: true });
const [activeId, setActiveId] = useState(null);
const activeListId = activeId || lists[0]?._id || null;

async function createList() {
  if (!me) return;
  const created = await database.put({ type: "list", title: "Untitled list", creatorHandle: me.userHandle });
  setActiveId(created.id);
}
```

- [ ] **Step 2: Make the items query use `activeListId`** (replace the `prefix: [DEFAULT_LIST]` and `DEFAULT_LIST` usages)

```jsx
const { docs: sorted } = useLiveQuery((d) => (d.type === "item" ? [d.listId, d.position] : undefined), {
  prefix: activeListId ? [activeListId] : ["__none__"],
});
```

In `addItem` and `writeVerdict`, replace `DEFAULT_LIST` with `activeListId`. Guard `addItem` with `if (!t || !me || !activeListId) return;`. Remove the `DEFAULT_LIST` constant.

- [ ] **Step 3: Add an inline `ListRail` component** (above App)

```jsx
function ListRail({ lists, activeId, onPick, onNew, canCreate }) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-5 py-3 border-b-2 border-black">
      {lists.map((l) => (
        <button
          key={l._id}
          onClick={() => onPick(l._id)}
          className={
            "px-3 py-2 rounded border-2 border-black whitespace-nowrap min-h-[44px] " +
            (l._id === activeId ? "bg-[oklch(0.8_0.18_85)] font-bold" : "bg-white")
          }
        >
          {l.title || "Untitled"}
        </button>
      ))}
      {canCreate && (
        <button onClick={onNew} className="px-3 py-2 rounded border-2 border-black bg-white min-h-[44px] shrink-0">
          + New list
        </button>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Render the rail + active list title** (in App's JSX, under the header)

```jsx
<ListRail
  lists={lists}
  activeId={activeListId}
  onPick={setActiveId}
  onNew={createList}
  canCreate={ready && can.create({ type: "list", creatorHandle: me?.userHandle }).ok}
/>
```

(For now the header title can show the active list's title; rename is added in Phase 4 where admin gating exists.)

- [ ] **Step 5: Behavior check**

- Sign in → "+ New list" appears; click it twice → two list chips; items added go to the active list only; switching chips swaps the item set.
- Reload → lists persist, newest-first.

- [ ] **Step 6: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): multi-list registry + list rail"
```

---

## Phase 4 — Friends / sharing (channels + access.js)

Add per-list channels, the access policy, invite-by-handle, author tagging, and revoke/delete semantics. This is where `access.js` is introduced and the app becomes multiplayer.

### Task 11: Add access.js (the hybrid policy with hardening)

**Files:**

- Create: `vibes/shared-lists/access.js`

- [ ] **Step 1: Write the access function** (named export `sharedLists` — matches the DB name; see `vibes/team-channels/access.js`)

```js
// Per-object hybrid: each list owns a channel "list:<id>" (its data) plus
// "list:<id>/admin" (who may invite). Creator is sole admin; members have full
// read/write on items. See the spec for the full rationale and the immutable-field
// discipline. The export name MUST match the database name ("sharedLists").

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
function safeId(id) {
  if (typeof id !== "string" || !SAFE_ID.test(id)) throw { forbidden: "Invalid id" };
  return id;
}

export function sharedLists(doc, oldDoc, user, ctx) {
  if (!user?.userHandle) throw { forbidden: "Sign in to make changes" };
  if (oldDoc && doc.type !== oldDoc.type) throw { forbidden: "type is immutable" };

  switch (doc.type) {
    case "list": {
      const chan = "list:" + safeId(doc._id);
      if (oldDoc) {
        if (doc.creatorHandle !== oldDoc.creatorHandle) throw { forbidden: "creatorHandle is immutable" };
        ctx.requireAccess(chan + "/admin");
      } else if (doc.creatorHandle !== user.userHandle) {
        throw { forbidden: "You must be the creator" };
      }
      return { channels: [chan], grant: { users: { [doc.creatorHandle]: [chan, chan + "/admin"] } } };
    }
    case "item": {
      const chan = "list:" + safeId(oldDoc ? oldDoc.listId : doc.listId);
      ctx.requireAccess(chan);
      if (oldDoc) {
        if (doc.listId !== oldDoc.listId) throw { forbidden: "listId is immutable" };
        if (doc.authorHandle !== oldDoc.authorHandle) throw { forbidden: "authorHandle is immutable" };
      } else if (doc.authorHandle !== user.userHandle) {
        throw { forbidden: "authorHandle must be you" };
      }
      return { channels: [chan] };
    }
    case "member": {
      const chan = "list:" + safeId(doc.listId);
      ctx.requireAccess(chan + "/admin");
      if (oldDoc) throw { forbidden: "Membership grants are immutable" };
      if (doc.addedBy !== user.userHandle) throw { forbidden: "addedBy must be you" };
      return { channels: [chan], grant: { users: { [doc.userHandle]: [chan] } } };
    }
    default:
      throw { forbidden: "Unknown doc type" };
  }
}
```

- [ ] **Step 2: Sanity-check `safeId`**

| input          | result                               |
| -------------- | ------------------------------------ |
| `"abc123"`     | returns `"abc123"`                   |
| `"abc/admin"`  | throws `{ forbidden: "Invalid id" }` |
| `123` (number) | throws `{ forbidden: "Invalid id" }` |

- [ ] **Step 3: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/access.js
git commit -m "feat(shared-lists): add access.js hybrid policy"
```

### Task 12: Author tagging on items (ViewerTag)

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Pull `ViewerTag` from `useViewer`** (update the destructure)

```jsx
const { viewer, ViewerTag } = useViewer();
```

- [ ] **Step 2: Render the author tag in each row** (after the text `<span>`, before the nudge arrows)

```jsx
{
  it.authorHandle && <ViewerTag userHandle={it.authorHandle} className="text-xs opacity-60 shrink-0" />;
}
```

- [ ] **Step 3: Behavior check** — items show the avatar/handle of who added them; only the handle is stored on the doc (verify the doc has `authorHandle`, not `displayName`/`avatarUrl`).

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): author tags on items via ViewerTag"
```

### Task 13: Invite-by-handle + members row + rename

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Query members of the active list** (inside App)

```jsx
const { docs: members } = useLiveQuery((d) => (d.type === "member" ? d.listId : undefined), {
  key: activeListId || "__none__",
});
const activeList = lists.find((l) => l._id === activeListId) || null;
const canInvite = ready && activeList ? can.create({ type: "member", listId: activeListId, addedBy: me?.userHandle }).ok : false;

async function invite(handle) {
  const h = handle.trim();
  if (!h || !activeListId || !me) return;
  await database.put({ type: "member", listId: activeListId, userHandle: h, addedBy: me.userHandle });
}

async function renameList(title) {
  if (!activeList) return;
  await database.put({ ...activeList, title });
}
```

- [ ] **Step 2: Add an inline `InviteBox` component** (above App)

```jsx
function InviteBox({ onInvite }) {
  const [handle, setHandle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onInvite(handle);
        setHandle("");
      }}
      className="flex gap-2"
    >
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="friend handle"
        className="px-2 py-1 text-sm border-2 border-black rounded bg-white min-w-0"
      />
      <button type="submit" className="px-2 py-1 text-sm border-2 border-black rounded bg-white shrink-0">
        + invite
      </button>
    </form>
  );
}
```

> Invite-by-handle is intentionally minimal — the platform friend picker will replace this input later (spec §6).

- [ ] **Step 3: Render the members row + rename** (under the ListRail, when a list is active)

```jsx
{
  activeList && (
    <div className="px-5 py-3 border-b-2 border-black flex items-center gap-3 flex-wrap">
      <input
        defaultValue={activeList.title}
        onBlur={(e) => renameList(e.target.value)}
        disabled={!(ready && can.edit({ ...activeList, title: activeList.title }).ok)}
        className="font-bold bg-transparent border-b-2 border-transparent focus:border-black disabled:opacity-100 min-w-0"
      />
      <div className="flex items-center gap-1 ml-auto">
        {members.map((m) => (
          <ViewerTag key={m._id} userHandle={m.userHandle} className="text-xs" />
        ))}
      </div>
      {canInvite && <InviteBox onInvite={invite} />}
    </div>
  );
}
```

- [ ] **Step 4: Behavior check (needs two accounts / preview)**

- As creator: rename works; "+ invite" appears; invite a second handle → a member tag appears.
- As the invited user: after a short sync, the list shows up in your rail and you can add/check items.
- As a non-member: the list does not appear; if you somehow open it, the entry box shows the denial `.reason`.

- [ ] **Step 5: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): invite-by-handle, members row, rename"
```

### Task 14: Revoke + list delete (§5a semantics)

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Add revoke + delete-list handlers** (inside App)

```jsx
async function revoke(memberDoc) {
  await database.del(memberDoc._id);
}

async function deleteList() {
  if (!activeList) return;
  await database.del(activeList._id); // orphaned items are ignored by queries (no cascade in a CRDT)
  setActiveId(null);
}
```

- [ ] **Step 2: Add a revoke ✕ to each member tag** (only for the creator) and a "Delete list" button

In the members map, wrap each tag with a remove control gated on admin:

```jsx
{
  members.map((m) => (
    <span key={m._id} className="flex items-center gap-1">
      <ViewerTag userHandle={m.userHandle} className="text-xs" />
      {ready && can.delete(m).ok && (
        <button onClick={() => revoke(m)} className="text-xs opacity-40 hover:opacity-100" aria-label="revoke">
          ✕
        </button>
      )}
    </span>
  ));
}
```

And, when the viewer is the creator, a delete-list button in the members row:

```jsx
{
  ready && activeList && can.delete(activeList).ok && (
    <button onClick={deleteList} className="text-xs opacity-50 hover:text-[oklch(0.6_0.2_25)]">
      Delete list
    </button>
  );
}
```

- [ ] **Step 3: Behavior check**

- As creator: revoke a member → after sync the list disappears from their rail and their writes fail with `.reason`.
- As creator: "Delete list" removes it from your rail.
- As a revoked member during the brief sync window: the entry box shows the denial reason, not a silent dead button.

- [ ] **Step 4: Verify prettier & commit**

```bash
pnpm exec prettier --check vibes/shared-lists/
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): revoke member + delete list (§5a)"
```

### Task 15: Final styling pass + deploy

**Files:**

- Modify: `vibes/shared-lists/App.jsx`

- [ ] **Step 1: Polish** — confirm neobrutalist house aesthetic (bold borders, bright accent), mobile-first full-bleed, 44px tap targets, empty states for "no lists" and "no items".

- [ ] **Step 2: Verify prettier**

Run: `pnpm exec prettier --check vibes/shared-lists/`

- [ ] **Step 3: Deploy**

Run: `cd vibes/shared-lists && npx vibes-diy push --vibe system/shared-lists`

- [ ] **Step 4: QA** — run the `qa-pr` skill (or a manual two-account pass) against the live URL on desktop + mobile (390×844). Confirm: anonymous read, login on first write, multi-list, invite/accept, drag/nudge, revoke.

- [ ] **Step 5: Commit any polish**

```bash
git add vibes/shared-lists/App.jsx
git commit -m "feat(shared-lists): styling polish + deploy"
```

---

## Self-review (spec coverage)

| Spec section                                                          | Covered by                                |
| --------------------------------------------------------------------- | ----------------------------------------- |
| §2 single-db, channel-per-list                                        | access.js (Task 11), DB constant (Task 9) |
| §3 data model (list/item/member)                                      | Tasks 9, 10, 11, 13                       |
| §3 registry by `_id` desc; items by `[listId, position]`              | Tasks 9, 10                               |
| §4 fractional ordering (append/drop/nudge, no epsilon, strikethrough) | Tasks 2, 3, 4, 6, 7                       |
| §5 access.js + immutability + safeId + identity binding               | Task 11                                   |
| §5a revoke/delete + propagation-lag UX (`can.*` + `.reason`)          | Tasks 9 (gating), 13, 14                  |
| §6 UI (rail, members row, entry box bottom, ViewerTag, can.\* gating) | Tasks 3, 10, 12, 13                       |
| §8 evolution order (local → persist → multi-list → friends)           | Phases 1→4                                |
| §9 flat layout, system handle deploy, prettier gate                   | Tasks 1, 8, 15; prettier in every task    |

**Open items intentionally deferred (spec §8):** delegated admin, request-to-join, renormalize-on-collision, due dates/kanban. Not in this plan.

**Note for the implementer:** `crypto.randomUUID()` is used for local ids in Phase 1 only; from Phase 2 on, Fireproof auto-assigns `_id`. The compound-index query returns docs **already sorted by position**, so no client-side sort is needed once on Fireproof (Phase 1's `.sort()` is local-only).
