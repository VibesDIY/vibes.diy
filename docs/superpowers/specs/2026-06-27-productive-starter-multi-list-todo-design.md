# Productive starter vibe — multi-list collaborative todo (`system/shared-lists`)

**Date:** 2026-06-27
**Status:** design ratified in brainstorming; ready for implementation plan.
**Parent:** the Productive category of the Instant Starter Stack (#1896), tracked under the
agent-in-vibe UX epic (#2675). Music is the only category fleshed out so far; this is the
first real design for **Productive**.

> **Scope decision (jchris): design the full app standalone.** We are _not_ shaping this to
> the root-vs-chiclet starter tree yet. Build the complete collaborative multi-list todo as
> one vibe, then split it into an evolution of starter steps (root app + 2+Other transforms)
> afterward. The data model and ordering algorithm are identical regardless of how it is
> later sliced into the tree.

---

## 1. The shape

A multi-list todo app:

- You have **many lists**.
- You can **add friends to each list independently** — sharing is per-list, not app-wide.
- List items are **drag-sortable**, using a **fractional float `position`** so a reorder
  writes **only the moved item** (average the neighbours on a drop-between; never rewrite the
  whole list).

This is the **per-object hybrid** that `2026-06-24-vibe-access-model-design.md` names as the
recommended collaborative default: each list is a **channel** (channels have "the arity of
objects"), friends are **grants** on that channel. It is multiplayer-by-default and "just
runs" — it deliberately avoids the **Form-A trap** (owner-only writes that work for the
creator and are silently dead for everyone else).

---

## 2. Architecture decision: one database, one channel per list

**Chosen: a single Fireproof database, one channel `list:<id>` per list (the per-object
hybrid).**

Everything lives in one db (`useFireproof("lists")`). A list is a doc; items are docs tagged
with `listId`; each list owns a channel `list:<id>`; friends are grants on that channel. The
"my lists" view is **one live query** (`type:"list"`) that the grant system naturally filters
to only the lists the viewer can see — per-list independent sharing falls out for free.

**Alternatives considered and rejected:**

- **One database per list (database = channel).** The literal Slack-style pattern from the
  channels guide. Worse fit: a registry db plus N list-dbs, and "lists I'm on" has to fan out
  across many databases instead of one query. More moving parts for no benefit at todo scale.
- **Single db, no channels (public shared).** Simplest, but everyone with the URL sees every
  list — cannot do per-list independent sharing, so it fails the core requirement.

---

## 3. Data model

Three doc types in one database:

```js
// a list
{ type: "list", _id, title, createdAt, creatorHandle }

// an item in a list
{ type: "item", _id, listId, text, done: false,
  position: <float>, authorHandle, createdAt }

// a membership grant (one per friend per list)
{ type: "member", _id, listId, userHandle, addedBy, createdAt }
```

**Channels & grants:**

- A **list** doc → `channels: ["list:"+_id]`; on creation projects
  `grant.users[creatorHandle] = ["list:"+_id, "list:"+_id+"/admin"]`. The creator gets both
  the list channel and its admin channel.
- An **item** doc → `channels: ["list:"+listId]`; create/edit/delete gated by
  `requireAccess("list:"+listId)`. **Any member has full read/write** on items (add, check,
  edit, reorder, delete) — Shape A.
- A **member** doc → writing one is gated by `requireAccess("list:"+listId+"/admin")` and
  projects `grant.users[userHandle] = ["list:"+listId]`. Only the creator is in the admin
  channel, so **only the creator can invite** (sole-admin, Shape A). Delegated admin (Shape B)
  is a free later step: also grant the invitee the `/admin` channel.

**Why an admin channel even for "sole admin":** `access.js` cannot query other docs — it sees
only `(doc, oldDoc, user, grantState)`. So "is this writer the list's creator?" must already
be in `grantState`. The list doc projecting `list:<id>/admin` to its creator is how that fact
gets there; it makes the invite gate enforceable rather than honor-system. This is the access
doc's hybrid mechanism.

**Queries:**

- Registry: `useLiveQuery("type", { key: "list" })` → only lists whose channel the viewer can
  read; no client-side access filtering needed.
- Items: `useLiveQuery("listId", { key: activeListId })`, sorted client-side ascending by
  `position`.

> **Ordering note (per the #2675 system-handle guide):** items need an _explicit_ order
> (drag), so `position` is justified — but the **list registry** does not. Fireproof's
> auto `_id` is roughly temporal, so order lists newest-first with `_id` descending for free
> rather than adding a `createdAt` just to sort (see `prompts/pkg/llms/fireproof.md`). Keep
> `createdAt` only where it's shown to the user, not for ordering.

---

## 4. Fractional ordering

Items carry a float `position`; the list renders sorted ascending; only the moved item is
ever written.

```js
const STEP = 1; // spacing for appends

function positionForAppend(sorted) {
  return sorted.length ? sorted[sorted.length - 1].position + STEP : STEP;
}

// dropping at index `target` in the visually-sorted array (dragged item removed first)
function positionForDrop(sorted, targetIndex) {
  const before = sorted[targetIndex - 1]; // undefined at top
  const after = sorted[targetIndex]; // undefined at bottom
  if (!before) return after.position - STEP; // top
  if (!after) return before.position + STEP; // bottom
  return (before.position + after.position) / 2; // between → average
}
```

- **New item** → `positionForAppend` (max + 1). Entry box is pinned at the **bottom**; new
  rows appear at the bottom.
- **Drag between two** → average → a single `database.put` on the dragged doc only.
- **Drag to top / bottom** → first − 1 / last + 1.
- **No epsilon guard (decided).** After ~50 repeated drops into the _exact same gap_, float
  precision is exhausted; acceptable for a starter. If it ever matters, renormalize-on-
  collision becomes a later evolution step.
- **Completion:** checking a box sets `done: true` and renders strikethrough **in place** —
  `position` unchanged, item stays in the drag order.

**Drag mechanics:** native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/
`onDrop`), target index computed from the drop target's place in the sorted array — zero
dependencies, works in the vibe sandbox. Because native DnD is weak on touch, each row also
gets **up/down nudge arrows** (a nudge swaps `position` with the neighbour) as a mobile-
friendly fallback. v1 ships both.

---

## 5. `access.js`

```js
// List ids ride inside channel names ("list:" + id [+ "/admin"]). Reject anything
// that isn't a plain token so a crafted id can't inject a channel or collide with
// the "/admin" namespace (e.g. listId = "abc/admin" → "list:abc/admin").
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
function safeId(id) {
  if (typeof id !== "string" || !SAFE_ID.test(id)) throw { forbidden: "Invalid id" };
  return id;
}

export default function access(doc, oldDoc, user, ctx) {
  if (!user?.userHandle) throw { forbidden: "Sign in to make changes" };
  // doc type can never change under an existing _id (no retyping across auth paths)
  if (oldDoc && doc.type !== oldDoc.type) throw { forbidden: "type is immutable" };

  switch (doc.type) {
    case "list": {
      const chan = "list:" + safeId(doc._id);
      if (oldDoc) {
        // edit: creator is immutable, and only the creator (admin) may edit
        if (doc.creatorHandle !== oldDoc.creatorHandle) throw { forbidden: "creatorHandle is immutable" };
        ctx.requireAccess(chan + "/admin");
      } else {
        // create: you can only create a list you own (bind identity to the writer)
        if (doc.creatorHandle !== user.userHandle) throw { forbidden: "You must be the creator" };
      }
      return {
        channels: [chan],
        grant: { users: { [doc.creatorHandle]: [chan, chan + "/admin"] } },
      };
    }
    case "item": {
      // gate on the EXISTING list on edits so listId can't be used to hop channels
      const chan = "list:" + safeId(oldDoc ? oldDoc.listId : doc.listId);
      ctx.requireAccess(chan); // any member: add/edit/check/reorder/delete
      if (oldDoc) {
        // listId and authorHandle are immutable once written
        if (doc.listId !== oldDoc.listId) throw { forbidden: "listId is immutable" };
        if (doc.authorHandle !== oldDoc.authorHandle) throw { forbidden: "authorHandle is immutable" };
      } else if (doc.authorHandle !== user.userHandle) {
        // honest attribution: bind authorHandle to the writer
        throw { forbidden: "authorHandle must be you" };
      }
      return { channels: [chan] };
    }
    case "member": {
      const chan = "list:" + safeId(doc.listId);
      ctx.requireAccess(chan + "/admin"); // only the creator (sole admin)
      if (oldDoc) throw { forbidden: "Membership grants are immutable" };
      if (doc.addedBy !== user.userHandle) throw { forbidden: "addedBy must be you" };
      return {
        channels: [chan],
        grant: { users: { [doc.userHandle]: [chan] } },
      };
    }
    default:
      throw { forbidden: "Unknown doc type" };
  }
}
```

No `user.isOwner` anywhere — purely channel/grant driven, per the access model.

**Immutable-field enforcement (why the `oldDoc` checks matter).** Because any member can
write item docs and any signed-in user can create a list, the access fn must pin the fields
that authority and attribution hinge on — otherwise a write could quietly reassign them:

- **`list.creatorHandle`** — validated `=== user.userHandle` on create and frozen on edit, so
  nobody can create a list owned by someone else, and a title edit can't reseed `/admin` to
  the wrong handle (which would lock out the real creator).
- **`item.listId`** — frozen on edit and gated against the _existing_ channel, so a member of
  list B can't move an item into list A (or out of a list they shouldn't reach).
- **`item.authorHandle`** — `=== user.userHandle` on create, frozen on edit, so `ViewerTag`
  attribution can't be forged by a collaborator re-PUTting the doc.
- **`member`** docs are create-only (no edits) and `addedBy` is pinned to the writer.
- **`doc.type`** is frozen across any existing `_id`, so a doc can't be retyped to slip
  through a different branch's auth path.
- **List ids are canonicalized** (`safeId`, `/^[A-Za-z0-9_-]+$/`) before they're concatenated
  into channel names, so a crafted `listId` can't inject a channel or collide with the
  `/admin` suffix (e.g. `listId = "abc/admin"`).

This is the field-diff discipline the access-model doc flags as easy to get subtly wrong
(§7a) — written out explicitly here so the generated `access.js` carries it from day one.

### 5a. Revoke / delete semantics & propagation lag

Grant changes flow through the `GrantReduce`, so a revoke/delete is **eventually**, not
instantly, consistent — the UI must expect a short transition window and read it from the
runtime rather than assuming immediate effect.

- **Revoking a friend.** The creator deletes the friend's `member` doc; the reduce drops that
  user's `grant.users[handle]` entry for `list:<id>`, after which the list disappears from
  their registry query and their item writes fail. (Deleting a `member` doc is gated by the
  same `/admin` rule — only the creator revokes.)
- **Deleting an item.** A Fireproof delete by any member; gated like any item write
  (`requireAccess("list:"+listId)` against the existing channel). Soft-delete (a `done`-style
  `deleted` flag) is an option if we want undo, but v1 uses hard delete.
- **Deleting a list.** Creator-only (`/admin`); v1 deletes the list doc and leaves orphaned
  item docs to be ignored by the registry/item queries (no cascade in a CRDT). A later
  evolution step can sweep them.
- **Propagation-lag UX.** Write surfaces already render `useVibe("lists").can.*.reason` when a
  write is denied, so during the brief post-revoke window a removed collaborator sees the
  denial reason (not a silent dead button), and a just-added friend may see a short "syncing
  access…" state before the list resolves. Never assume the grant is live the instant the
  `member` doc is written — gate on `can.*`, surface `.reason`.

---

## 6. UI layout (mobile-first)

Single screen, two zones:

- **List rail** (top, horizontally-scrollable chips; a left drawer on wider screens): the
  registry query + a `+ New list` affordance. Tapping selects `activeListId`.
- **Active list** (main area):
  - Header: list title (creator can rename) + a **members row** of `ViewerTag` avatars +
    an `+ invite` control (handle text field for now; the platform friend picker drops in
    later — keep this surface light).
  - **Items** sorted by `position`: each row = drag handle + checkbox + text (strikethrough
    when `done`) + up/down nudge arrows + delete + a tiny `<ViewerTag userHandle={authorHandle}/>`.
  - **Entry box pinned at the bottom** → new item at `maxPosition + 1`, stamped
    `authorHandle: viewer.userHandle`.

- Write surfaces gated with `useVibe("lists").can.*`; when denied, render `.reason` (a
  not-yet-invited visitor sees the reason, not a dead button) — "never show a control that
  only rejects."
- Author identity: stamp `authorHandle` at write time; render with `<ViewerTag/>`. Persist
  only the handle.
- Neobrutalist house aesthetic (bold borders, bright accents).

---

## 7. Decisions log (from brainstorming)

| Decision               | Choice                                                          |
| ---------------------- | --------------------------------------------------------------- |
| Starter-tree placement | Design full app standalone; slice into root + chiclets later    |
| Lists ↔ databases      | Single db, one channel `list:<id>` per list (per-object hybrid) |
| Sharing model          | Creator = sole admin; friends = full read/write members         |
| Inviting               | Invite-by-handle, kept minimal (platform friend picker coming)  |
| Author tagging         | Yes — `authorHandle` + `ViewerTag` on items                     |
| New item placement     | Bottom; entry box pinned at bottom                              |
| Reorder                | Fractional float `position`; average neighbours on drop-between |
| Precision exhaustion   | Ignore epsilon for v1                                           |
| Completed items        | Strikethrough in place                                          |
| Touch fallback         | Native DnD + up/down nudge arrows                               |
| `STEP`                 | 1                                                               |

---

## 8. Out of scope for v1 (future evolution steps)

This spec describes the **full built-up destination** app. When we slice it into the starter
tree, the **root must follow the instant-starter philosophy** the #2675 system-handle guide
sets out (and `bloom-machine` demonstrates): instant, no-login, no-codegen, **fully usable
anonymously with zero backend**, built up interactively. So the natural evolution is:

- **Root (first step): a single local list, no Fireproof.** Pure client state — add, check,
  strikethrough, drag-reorder (the `position` math is local-only here). Instant page view, no
  login. This is the `bloom-machine`-equivalent slice for Productive.
- **Step: persist (Fireproof).** Wire the single list to a db so it survives reload (login on
  first write). Defer the DB until this step — don't add it at the root.
- **Step: multi-list.** Introduce the `list` doc + registry + list rail.
- **Step: friends.** Introduce channels + `access.js` + the `member`/invite flow (everything
  in §3–§5). This is where the access posture becomes a deliberate decision (per the guide:
  reads anonymous, writes require login).

Also deferred:

- Delegated admin (friends inviting friends) — free via granting the `/admin` channel.
- Request-to-join flow (relies on the request-doc pattern; invite-by-handle covers v1).
- Renormalize-on-collision for float precision.
- Due dates, kanban view, "Done" section — candidate sideways chiclet transforms.

---

## 9. Starter conventions & deployment (`system` handle)

Per the #2675 system-handle guide (written alongside `bloom-machine`/#2683):

- **Curated starters are real apps owned by the platform `system` handle** — a starter is just
  a system-owned public app, addressable at `vibes.diy/vibe/system/<slug>`.
- **Source layout:** `vibes/<slug>/`, files **flat at the root** — `App.jsx` + `README.md`
  (+ `access.js` once persistence/sharing land). `push` only ships top-level files (**no
  subdirectories**), so **all components live inline in `App.jsx`** — don't split the list
  rail / rows / forms into separate files.
- **Deploy:** from the vibe's dir, `npx vibes-diy push --vibe system/<slug>` (always pass
  `--vibe system/<slug>` so it isn't published under a personal handle). Handle/app
  self-create on first push. `system` is currently on jchris's account (first-writer-wins) —
  **coordinate before pushing from another account.**
- **Prettier-clean or CI fails** (`compile_test` runs `format:check`) — `npx prettier --write`
  before committing.
- **README** carries the canonical `--vibe system/<slug>` push/pull commands + a one-line
  description so collaborators don't mis-publish.
- **Slug:** `system/shared-lists` (decided, jchris). Source at `vibes/shared-lists/`,
  deployed with `npx vibes-diy push --vibe system/shared-lists`.
