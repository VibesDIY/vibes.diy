---
title: "Teaching an AI you're not 'the owner'"
date: 2026-06-27T09:00:00Z
author: "Vibes DIY"
summary: "Generated apps used to default to owner-gated permissions — broken for everyone but the creator. Here's how we flipped the default to author-owned, steered the model toward multiplayer without ever saying 'don't,' and built a metric so the prompt could iterate itself."
glyph: "author-owned ▸ default"
---

Ask a model to build an app and it quietly assumes one boss and a wall of permissions. That single default — buried in the system prompt — was making generated apps wrong by reflex. Here are the three moves it took to teach the generator that the default owner is just *you*. (Companion to the [generator eval post](how-we-eval-the-generator.html), which was about measuring quality.)

<figure>
    <img src="/images/blog/teaching-codegen-defaults/shared-meadow-mobile.png" alt="A shared meadow vibe on mobile: a dozen-plus colorful flowers scattered across a soft green gradient, with a faint 'tap the grass to plant a flower' hint at the bottom" loading="lazy">
    <figcaption>What "author-owned, multiplayer by default" produces: a meadow generated from one plain-language prompt, where every signed-in visitor plants flowers everyone sees — no owner gate, no permission wall. (Live: <a href="https://vibes.diy/vibe/garden-gnome/blog-demo-garden">blog-demo-garden</a>.)</figcaption>
</figure>

## The bug was a default, not a line of code

The old codegen guidance reflexively reached for owner-gating. Faced with any permission-shaped request, the model would write the equivalent of `if (!user.isOwner) throw "owner only"` and call it done. That made "the owner must grant roles before anyone can participate" the *default shape of every generated app*.

This is a latent-surprise bug. The app works perfectly for the person who generated it — they're the owner — and is silently broken for every visitor. A stranger opens a contact form they can't submit, a sign-up sheet they can't sign. Nobody sees it until somebody who isn't the author tries to use the thing.

The fix flips the default to **author-owned**: anyone signed-in creates and edits their own. Owner-managed channels get demoted to the advanced case — still reachable, just no longer the reflex.

## Retiring `isOwner` from the prompt's vocabulary

The subtle enabler was a runtime change. Owner-only documents now gate on `ctx.requireRole("owner")` instead of `user.isOwner`:

```js
ctx.requireRole("owner")
```

The flip is easiest to see side by side — the reflex the old guidance reached for, versus what the runtime now guarantees:

```js
// Before — the reflexive default: gate everything on the creator
if (!user.isOwner) throw "owner only";

// After — author-owned; owner-only docs ask for a role the platform seeds
ctx.requireRole("owner");
```

That works with *zero declaration* because the runtime always seeds the owner into a reserved `owner` role. The generated `access.js` no longer has to know it's special — it just asks for a role that the platform guarantees exists.

That change forced a clean separation we'd been muddling: public-versus-private is the owner's ACL envelope, never something `access.js` implements. The access function describes *who can do what with which object*; whether the whole app is published is a layer above it. Keeping those apart is what lets author-owned be the honest default.

## Steering toward multiplayer without saying "don't"

The design doc's conclusion — owner-only generated apps are a latent-surprise bug — is easy to state and hard to encode. The obvious move is to tell the model "don't make owner-only apps." That move is wrong twice.

First, **pink-elephant tokenization**: naming the bad shape raises its salience. Spend tokens describing owner-gating, even to forbid it, and you've made owner-gating more available to the sampler, not less. Second, it violates our own standing rule against enumerating limits — we feature targets as recipes and describe primitives as grammar; we don't hand the model a list of things not to do.

So instead of a prohibition, we gave it a positive, intent-anchored litmus:

> When a stranger opens the app, can they do the thing it's *for*?

That single question makes multiplayer the default *and* still permits the legitimate owner-published blog — because there the stranger's job is to read, and they can. No anti-pattern named, no limit enumerated. The grammar enables the right shape; composition handles the messy edges.

## Then we made the prompt iterate itself

Hand-tuning a system prompt is slow and the feedback loop is fuzzy. We wanted `/autoresearch` to iterate the `prompts/pkg/` corpus unattended — but **you can't autoresearch what you can't measure.** The real engineering wasn't the prompt edits; it was building a defensible metric for a fuzzy property: does the generated `access.js` let a stranger do the thing the app is for?

The grader is **static-first**. Greppable invariants — the per-object recipe, the write-gate, owner-published versus author-owned — do most of the scoring deterministically. LLM judging is the minority, reserved for the genuinely semantic dimension ("can a second signed-in visitor do the core action?"), with a consent-side judge added later. The composite is `mean(PASS=1/SOFT=.5/FAIL=0)` over an 8-prompt × 8-rep matrix, and the grader was validated against 8 ground-truth corpus rows before it was trusted to grade anything.

Two disciplines make the loop trustworthy:

- **Freeze the ruler.** The grader, both matrices, and `baseline.json` are frozen by default — only `prompts/pkg/**` may change — so the loop can't "improve" by editing its own metric. Re-baselining is allowed, but only when it's explicit and recorded.
- **A gate that enforces a prompt-writing principle.** One discard-gate rejects any prompt diff that enumerates prohibitions or names the anti-pattern. The negative-tokenization rule from the section above isn't advice anymore — it's an automated tripwire that fails the build.

Success isn't a number; it's the metric *plateauing*. Predict the gain before spending a batch, run at least 8 reps, accept only gains beyond noise, verify twice. The discipline is the deliverable, codified in `agents/access-model-autoresearch.md`.

One footgun the run surfaced: the system prompt is backend-served, so the loop iterates against a per-PR preview env that redeploys on every push — not local files. Get that wrong and you're grading a prompt nobody is running.

## The three moves, side by side

<div class="table-scroll">
<table>
    <thead><tr><th>Move</th><th>The reflex it replaces</th><th>What it does instead</th></tr></thead>
    <tbody>
        <tr><td>Flip the default to author-owned</td><td><code>if (!user.isOwner) throw "owner only"</code></td><td><code>ctx.requireRole("owner")</code> — owner-only demoted to the advanced case; anyone signed-in creates and edits their own</td></tr>
        <tr><td>Steer toward multiplayer without saying "don't"</td><td>Telling the model "don't make owner-only apps" — the negative-tokenization tripwire</td><td>A positive litmus: "when a stranger opens the app, can they do the thing it's <em>for</em>?" — no anti-pattern named</td></tr>
        <tr><td>Freeze a metric so the prompt can iterate itself</td><td>Hand-tuning against a fuzzy feedback loop</td><td>A frozen grader scoring <code>mean(PASS=1/SOFT=.5/FAIL=0)</code> over an 8-prompt × 8-rep matrix; only <code>prompts/pkg/**</code> may change</td></tr>
    </tbody>
</table>
</div>

<div class="post-cta">
  <h3>Built for the second visitor, by default.</h3>
  <p>Type a sentence and get an app a stranger can actually use — author-owned out of the box.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
