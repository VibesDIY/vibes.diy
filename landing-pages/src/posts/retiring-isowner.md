---
title: "The vibe that locked out its owner"
date: 2026-06-23T12:00:00Z
author: "Vibes DIY"
summary: "A vibe locked its own owner out of saving. The fix wasn't a better isOwner check — it was deleting isOwner and treating 'owner' as a seeded, revocable role instead of an ambient super-user."
glyph: "isOwner ✗"
---

A vibe locked its own creator out of saving. The bug wasn't the rule — it was the word *owner*. Not a stranger, not an edge-case account: the person who deployed the app, staring at it, unable to write to it.

The cause was a single magic boolean. Write authority ran through `user.isOwner`, and the generated access function granted owner-write *only* via that flag. The trouble is that `isOwner` was resolved across three independent code paths — and the moment it came back false in any one of them, the owner fell through to a `requireRole("editor")` they had never been granted. A multi-handle user, a handle-binding gap, a client-side predictor disagreeing with the server: any of these flipped the boolean, and the owner was locked out of their own data.

You can patch that bug three times. Or you can notice that the primitive itself is wrong.

## "Owner" is not a property of a user

The mental model behind `isOwner` is the site-with-an-admin model — WordPress, basically. There's one site, and some users are admins of it. `isOwner` is the vestigial organ of that worldview: an ambient super-user flag you evaluate at runtime, everywhere, on every write.

But that's not what a vibe is. A vibe is closer to Drive or Notion: per-user workspaces with per-object sharing. "Owner" isn't a global property of a person — it's a per-object-graph *role*. The deployer isn't an admin of the site; they're just user #1. They happen to be the first person in the workspace, and they should start out holding the roles that make the workspace usable.

Once you frame it that way, `isOwner` stops being a feature and starts being a bug factory. An access function that asks "is this person *the* owner?" is asking a question that has no single, stable answer — so it gets three answers, and one of them is wrong.

## The fix: declare the role, don't extract it

Instead of extracting owner-ness at runtime, have the **generator declare** the roles the owner should be seeded with at deploy time. The model already wrote the access function. It already knows the role names it just invented — `lead`, `editor`, whatever the app calls them. Declaration beats runtime extraction precisely because the information exists at authoring time; you don't have to go re-derive it from a user object three different ways.

The shape of the access function changes accordingly.

### Before

```js
// owner-write rides on an ambient super-user boolean,
// resolved at runtime across three independent code paths
if (user.isOwner) return allow; // false anywhere => owner locked out
requireRole("editor"); // ...and falls through to a role they never had
```

### After

```js
// no ambient flag — owner is just user #1 holding a seeded role.
// the grant lives in docContributions, declared at deploy time,
// so requireRole("editor") sees a role the owner actually holds
requireRole("editor");
```

This is worth dwelling on, because at a glance a reserved, always-seeded `owner` role looks like the thing we just deleted. It isn't. A boolean evaluated in three places is invisible, implicit, and unstable. A grant is a thing you can *see*: it shows up as a role the owner holds, and it is therefore revocable and transferable. The deployer can hand it off. They can take it away from themselves. None of that is expressible as `user.isOwner`, because a property of a user is not a thing you can give to someone else.

There's a related trap the new model makes obvious — call it the Form-A trap. An owner-only app is invisibly broken to the only person who can verify it works. If you can only see the app working when you're the owner, "owner-only" isn't a permission style; it's a defect. Deleting `isOwner` forces the question into the open: who, exactly, gets to read and write this, and how did they get that grant?

## The seed has to be a stored contribution, not a mutation

Implementing the seed surfaced one more sharp edge, and it's a nice systems lesson.

The obvious move is to inject the owner straight into `effectiveMembers`. That's a bug. `GrantReduce` does a full rebuild on any doc update — `rebuild()` re-unions only the stored `docContributions`. So a directly-mutated seed lives outside the rebuild set, and the *next* real doc write silently wipes it. The owner gets re-locked, and now the bug is intermittent, which is worse.

The fix is to make the seed *be* a source row. Add it as a synthetic contribution under a reserved docId, so it's part of the set `rebuild()` re-unions every time:

```js
// the owner seed is a stored docContribution under a reserved docId,
// so rebuild() re-unions it like any other source row
```

The general rule: a materialized view that rebuilds from source rows forces every injected fact to *be* a source row. If you mutate the view directly, the next rebuild eats your edit. The test that pins this just writes an unrelated doc and asserts the owner seed survives the rebuild.

It helps that the seed is safe to re-emit. An append-only CRDT can no-op a content-identical write — it's the identity element of the merge — which de-risks exactly the kind of "ensure this exists" effect an LLM loves to emit. Writing the seed twice costs nothing.

## What we tell the generator now

The prompt-design principle that falls out of all this: feature targets as recipes, describe primitives as grammar, and never enumerate limits. Show the model what a role-seeded workspace looks like, give it the grammar of channels and grants and seeded roles — and let it reach the clunky edge of the design space only when an app genuinely needs to. `isOwner` was a shortcut that read like grammar but behaved like a wall. We took it out.

<div class="post-cta">
  <h3>Permissions that bend to plain language.</h3>
  <p>Describe who gets to see and do what. The generator turns it into roles you can grant, revoke, and hand off — no magic booleans.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
