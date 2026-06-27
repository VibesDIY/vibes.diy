# Productive starter vibe — multi-list collaborative todo

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
export default function access(doc, oldDoc, user, ctx) {
  if (!user?.userHandle) throw { forbidden: "Sign in to make changes" };

  switch (doc.type) {
    case "list": {
      const chan = "list:" + doc._id;
      if (oldDoc) {
        // edit: creator is immutable, and only the creator (admin) may edit
        if (doc.creatorHandle !== oldDoc.creatorHandle) throw { forbidden: "creatorHandle is immutable" };
        ctx.requireAccess(chan + "/admin");
      } else {
        // create: you can only create a list you own
        if (doc.creatorHandle !== user.userHandle) throw { forbidden: "You must be the creator" };
      }
      return {
        channels: [chan],
        grant: { users: { [doc.creatorHandle]: [chan, chan + "/admin"] } },
      };
    }
    case "item": {
      // gate on the EXISTING list on edits so listId can't be used to hop channels
      const chan = "list:" + (oldDoc ? oldDoc.listId : doc.listId);
      ctx.requireAccess(chan); // any member: add/edit/check/reorder/delete
      if (oldDoc) {
        // listId and authorHandle are immutable once written
        if (doc.listId !== oldDoc.listId) throw { forbidden: "listId is immutable" };
        if (doc.authorHandle !== oldDoc.authorHandle) throw { forbidden: "authorHandle is immutable" };
      } else if (doc.authorHandle !== user.userHandle) {
        // honest attribution: you can only author as yourself
        throw { forbidden: "authorHandle must be you" };
      }
      return { channels: [chan] };
    }
    case "member": {
      const chan = "list:" + doc.listId;
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

This is the field-diff discipline the access-model doc flags as easy to get subtly wrong
(§7a) — written out explicitly here so the generated `access.js` carries it from day one.

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

- Slicing into the starter tree (root app = single shared list; chiclets = "Add more lists",
  "Invite friends").
- Delegated admin (friends inviting friends) — free via granting the `/admin` channel.
- Request-to-join flow (relies on the request-doc pattern; invite-by-handle covers v1).
- Renormalize-on-collision for float precision.
- Due dates, kanban view, "Done" section — candidate sideways chiclet transforms.
