---
title: "If tokens were free, we'd precompute every chip"
date: 2026-06-30T20:00:00Z
author: "Vibes DIY"
summary: "A suggestion chip is a transform of the vibe you're on, and clicking it is real codegen. So we cache the result — a repeat click becomes an instant read instead of regenerating. The interesting part isn't the cache; it's the deny-by-default gate that decides who is allowed to read it."
thumb: "/images/blog/precompute-every-chip/card.jpg"
---

<figure>
    <img src="/images/blog/precompute-every-chip/card.jpg" alt="Title card: 'chip ↦ cached read', over a teal-to-goldenrod duotone of a vibe mid-build." loading="lazy">
    <figcaption>The cheapest chip click is the one you've already paid for.</figcaption>
</figure>

Every Vibe carries a few suggestion chips — small, curated "try this next" edits offered right on the app. Tap one and the app changes. But a chip isn't a shortcut to a pre-baked result: it's a *transform of the vibe you're on*, and running it is real codegen that costs real tokens. As jchris put it: **if tokens were free, we'd precompute every chip.** They're not, so we did the next best thing — we cache the ones people actually click.

This is the story of that cache, and of the part that took the real work: not making a click fast, but deciding who is allowed to read a result somebody else paid to generate.

<figure>
    <img src="/images/blog/precompute-every-chip/vibe-card-chips.png" alt="A Vibes app — a glowing teal orb — with the edit card open underneath showing three suggestion chips and a 'Describe a change…' box." loading="lazy">
    <figcaption>A vibe's edit card. Each chip ("Slower, deeper breathing rhythm", …) is a transform of <em>this</em> version of the app. The free-text "Describe a change…" box below them is the other lane — and it's never cached. (Live: <a href="https://vibes.diy/vibe/garden-gnome/blog-demo-inplace">blog-demo-inplace</a>.)</figcaption>
</figure>

## A chip is a content-address

The cache key is the whole trick. A chip's result is fully determined by *what you transformed* and *what you asked for*: the source vibe version plus the (normalized) transform text. Hash those together and you get a deterministic content-address — `cf-<hash>-<hash>` — that the same chip on the same version always produces. The first time anyone clicks it, codegen runs and stages a result under that key. Every click after that is an O(1) lookup.

Crucially, the staged result isn't a fork or a new app. It's **a new version under the source vibe's own owner and slug** — same place, new code. Precompute stages versions; it never advances the public HEAD. The owner publishes if and when they want.

## A hit is a read; a miss is a write

The read/write decision is made *before* anything commits, and it depends on exactly one thing: does a staged result exist for this key?

- **Hit** → it's a read. Navigate to that version. No codegen, no login, no fork.
- **Miss** (or *any* lookup error) → it soft-fails to the write lane, where the existing fail-loud generation path takes over.

What it deliberately does **not** depend on is *who clicked*. The lookup is identity-free. Identity only matters in the write lane it falls through to — an owner edits in place; a non-owner forks. Keeping identity out of the read decision is what lets the same cached result serve a signed-in owner and an anonymous visitor through one code path.

So the owner's first click is the write that fills the cache:

<figure>
    <img src="/images/blog/precompute-every-chip/produce-draft.png" alt="The edit card after a chip click: a 'Draft · unpublished' badge, an 'Unpublished changes. Only you can see this draft.' banner with a Publish button, and a refreshed set of chips." loading="lazy">
    <figcaption>Clicking a chip as the owner runs codegen <em>in place</em> and stages the result as a new, unpublished version. The "Draft · unpublished" badge is the tell: the result exists, but nothing about the public app has moved yet.</figcaption>
</figure>

## The hard part: a precomputed result is a permission question

Here's where a cache stops being a cache. Serving a staged version to a visitor means serving code derived from someone's vibe — possibly to someone who isn't signed in. "It's just a transform of a public app" is *almost* a safe assumption, and almost-safe is exactly the kind of assumption that leaks. So the serve path is **deny-by-default**, with three gates that all have to agree:

1. **Visibility** — the read uses the same gate as the chips themselves: it serves when the app is public-readable, or to a signed-in owner/member. It is never owner-scoped, and a miss returns the *same* answer as "not visible" — so it can never become an existence oracle.
2. **Bless** — and this is the one that does the heavy lifting. A *produced* result is not the same as a *servable* one. The owner has to explicitly **bless** a specific result before it serves as a fast-path "stay"; everything unblessed forks. Blessing is a server-authenticated, owner-only action recorded over the exact `{key, fsId, sourceFsId}` tuple, and it's independently revocable. Revoke it and the read drops straight back to forking.
3. **Source-was-public** — the serve path re-verifies that the *source version* the result was derived from was itself publicly readable, on that exact entry. A cached read has to be a transform of already-public code — never a window into an owner's unpublished draft.

The default across all three is the same: when in doubt, **fork**. A miss, a private source, an invisible app, even a settings-read error all degrade to the identical "no cached result here" answer. We call it fail-to-fork: the unsafe direction is never the fallback.

## "The UI only sends safe keys" is not "the endpoint only accepts safe keys"

One more gate, at a layer that's easy to forget. The read endpoint is *public*, and its request schema only requires `key: string`. The chip keys the UI sends are content-addresses with no PII in them — true. But "the UI is well-behaved" is a statement about the caller, not the endpoint. A non-browser caller could stuff PII or an oversized blob into `key` and have it land in production logs.

So the PII guarantee lives at the *log boundary*, not in the caller's good manners. The reader echoes `key` into telemetry raw only when it matches the canonical `cf-<hash>-<hash>` shape (and length); anything else is redacted to `<non-canonical:LEN>` — still debuggable, never persisting attacker-controlled input. The shape check lives right next to the key *producer*, so the two definitions can't drift apart.

And because the read lane *fails to fork* — a real infra hiccup looks identical to a cold cache — each lookup emits one structured outcome (`hit | miss | lookup-error`). Separating `lookup-error` out is the whole point: a spike there means infrastructure, not user behavior. A safe failure mode is a terrible observability mode unless you instrument it.

<figure>
    <img src="/images/blog/precompute-every-chip/in-place-build.png" alt="The edit card streaming a build: a pinned 'building your app… · 3 msgs · ~124 lines' line above the streaming transform text, with the app rendering behind it." loading="lazy">
    <figcaption>A cache miss falls through to the real thing — codegen streaming straight into the card, the count pinned while the result forms in place. The next identical click won't have to.</figcaption>
</figure>

## The shape of it

A suggestion chip is a deterministic transform, so its result is cacheable; the cache key is just the content-address of `(source version, transform)`. The read/write decision is identity-free, so one path serves everyone. And a precomputed result serves to a visitor only after it clears three independent gates and the owner has explicitly blessed it — with the unsafe answer wired as the fallback at every step, and the public log boundary redacting anything that isn't a real content-address.

The cheapest click is the one you've already paid for. The safest cache is the one that serves nothing until the owner says so.

<div class="post-cta">
  <h3>Tap a chip. See what's cached.</h3>
  <p>Open a Vibe, try a suggestion, and keep changing it just by talking to it.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
