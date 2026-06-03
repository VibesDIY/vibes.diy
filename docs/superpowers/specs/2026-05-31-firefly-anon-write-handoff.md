# Handoff: Anonymous Write Safety Gap

**Date:** 2026-05-31  
**Status:** Resolved by PR #2069 (https://github.com/VibesDIY/vibes.diy/pull/2069)

---

## The Problem

The current model says: if the access function does not throw, the write succeeds. For authenticated users this is fine — the function inspects `user.userHandle` and throws on bad writes. For anonymous users (`user === null`) the documented default is to throw, but this default lives in prose, not in the runtime.

A minimal valid access function written as an arrow function:

```js
const access = (doc) => ({ channels: [doc.type] });
```

This is a completely natural thing to write. It maps every document to a channel by type and returns. It never inspects `user`. The runtime sees no throw — so anonymous writes succeed. The app developer did not intend to allow anonymous writes; they just forgot the null check.

The same problem applies to any function that handles specific doc types and falls through:

```js
const access = (doc, oldDoc, user, ctx) => {
  if (doc.type === "message") {
    ctx.requireAccess(doc.channelId); // throws if user null ✓
    return { channels: [doc.channelId] };
  }
  // forgot to handle other doc types — fall-through returns undefined
  // undefined = no throw = anon write succeeds
};
```

---

## What We Have Now

- `user` is `null` for anonymous requests
- `ctx.requireAccess()` and `ctx.requireRole()` both throw if user is null — any branch that calls them is safe
- The documented default is `if (!user) throw { forbidden: "authentication required" }` but this is advisory, not enforced by the runtime

---

## Proposed Resolution Options

### Option A — Require explicit `allowAnonymous` on return

Add a field to `AccessDescriptor`:

```ts
type AccessDescriptor = {
  channels?: string[]
  members?: Record<string, string[]>
  grant?: { users?: ..., roles?: ..., public?: string[] }
  expiry?: string | number | null
  allowAnonymous?: boolean   // ← new
}
```

If `user` is null and the function returns without throwing, the runtime checks `result.allowAnonymous`. If it is not `true`, the runtime rejects the write with `{ forbidden: "authentication required" }`. The developer must explicitly opt in:

```js
if (doc.type === "survey-response") {
  if (doc._id) throw { forbidden: "id must be server-generated" };
  return { channels: ["inbound-responses"], allowAnonymous: true };
}
```

**Pro:** Makes anonymous intent explicit and visible in code review. The arrow-function footgun is closed.  
**Con:** Adds a field. Slightly more verbose for intentional anonymous cases.

---

### Option B — Runtime always throws on null user, no opt-out in return value

Remove the ability to allow anonymous writes from the access function entirely. Anonymous submissions must go through a separate endpoint (e.g. a form POST handler that runs server-side and bypasses the access function gate).

**Pro:** Simplest safety model. Access function always has an authenticated user.  
**Con:** Breaks the survey-response pattern. Anonymous submit is a real use case.

---

### Option C — Status quo: prose default, no runtime enforcement

Document clearly that the implicit default is to throw on null user, and that any function which intentionally allows anonymous writes must handle null explicitly. Ship it and see if it bites anyone.

**Pro:** No API change.  
**Con:** The arrow-function footgun remains. Easy to miss in code review.

---

## Recommended Resolution

**Option A** with `allowAnonymous: true`. The footgun is real — `doc => ({ channels: [doc.type] })` is the first thing most developers will write, and it silently opens anonymous writes. Making the opt-in explicit costs one field and closes the gap.

Rename consideration: `allowAnonymous` vs `anonymous` vs `public` (already used for read). Keep it separate from `grant.public` — public read and anonymous write are orthogonal concerns.

---

## Questions to Resolve Before Implementing

1. Should `allowAnonymous` live on the return value, or on the database-level `acl` option (opt the whole database into anonymous writes)? Return value is more granular; `acl` is coarser but checked at a different layer.

2. If a function returns `{ channels: [...], allowAnonymous: true }` for an authenticated user, does `allowAnonymous` have any effect (i.e., is it safe to always include it)? It should be — when user is not null the field is irrelevant.

3. Does `grant.public` on channels imply anonymous write access, or is read and write always independent? Current position: independent. A channel with `grant.public` read does not allow anonymous writes.
