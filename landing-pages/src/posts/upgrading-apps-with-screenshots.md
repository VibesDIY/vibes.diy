---
title: "How we batch-upgrade apps with screenshots"
date: 2026-06-09T12:00:00Z
author: "Vibes DIY"
summary: "Every deployed Vibe serves both a live screenshot and its own source. That closes a visual feedback loop an agent can run alone — see the app, fix the code, push, look again — and fan out across dozens of apps at once."
description: "Every deployed Vibes app exposes a live screenshot and its own source. That closes a visual feedback loop an agent can run by itself — see the app, fix the code, push, look again — and fan out across dozens of apps at once."
thumb: "/images/blog/upgrading-apps-with-screenshots/card.jpg"
---

<style>
  /* Post-specific decorations: the screenshot gallery and the loop diagram.
     Shared chrome/prose styling comes from the blog-post layout. */
  .shot-gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.9rem;
    margin: 1.5rem 0 0.7rem;
  }
  .shot-gallery figure { margin: 0; }
  .shot-gallery img {
    width: 100%;
    height: auto;
    display: block;
    border: 2px solid var(--black);
    border-radius: 10px;
    box-shadow: 4px 4px 0 var(--black);
  }
  .shot-gallery figcaption {
    margin-top: 0.45rem;
    font-family: 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
    font-size: 0.7rem;
    color: var(--os-gray);
  }
  .shot-gallery figcaption::before { content: "/screenshot.jpg · "; color: var(--bluey); }
  .gallery-caption {
    font-size: 0.85rem;
    color: var(--os-gray);
    font-style: italic;
    margin-bottom: 2rem;
    line-height: 1.45;
  }
  @media (max-width: 560px) { .shot-gallery { grid-template-columns: 1fr; } }

  /* the loop diagram */
  .loop {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.6rem;
    margin: 0.5rem 0 2rem;
  }
  .loop .step {
    flex: 1 1 120px;
    background: var(--ivory);
    border: 2px solid var(--black);
    border-radius: 12px;
    padding: 0.9rem 0.9rem;
    position: relative;
  }
  .loop .step .n {
    font-family: 'SFMono-Regular','Menlo',monospace;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    color: var(--bluey);
    display: block;
    margin-bottom: 0.35rem;
  }
  .loop .step .t { font-weight: bold; font-size: 0.98rem; line-height: 1.2; }
  .loop .step .d { font-size: 0.8rem; color: var(--os-gray); margin-top: 0.25rem; line-height: 1.35; }
  .loop .arrow { align-self: center; color: var(--os-gray); font-weight: bold; }
  .loop .repeat {
    flex-basis: 100%;
    text-align: center;
    font-size: 0.82rem;
    color: var(--sprout-green);
    font-style: italic;
    margin-top: 0.2rem;
  }
</style>

This site you're reading embeds *hundreds* of live Vibes apps — games, trackers, schedule boards, party tools, one per card across dozens of landing pages. They get generated fast, and fast-generated apps have rough edges: a button hugging the viewport edge, text that's white-on-pale, a game board that overflows on mobile. Polishing them one by one, by hand, in a browser, would be a full-time job nobody wants.

So we don't. We let an agent do it — and the trick that makes that possible is that **every deployed Vibe is both *visible* and *editable* over plain HTTP.**

<figure>
    <img src="/images/blog/upgrading-apps-with-screenshots/card.jpg" alt="Illustration card: “look → fix → push ↺” set over a backlit keyboard, in the Vibes DIY teal-and-goldenrod style." loading="lazy">
    <figcaption>Every deployed Vibe serves a live screenshot and its own source — look, fix, push, repeat.</figcaption>
</figure>

## Two URLs are the whole story

Each deployed app serves two things an agent cares about:

- A **live screenshot** at `/screenshot.jpg` — a real render of the running app, regenerated server-side after every deploy.
- Its **own source** at `/App.jsx` — the single React file that *is* the app (Vibes apps are one file, no bundler).

That's a closed loop. The agent can *see* the app (read the screenshot) and *change* it (edit the source and push), with no browser, no human pointing at things, and no design spec — just "look, this is wrong, fix it, look again." It's the same loop a person does with their eyes and a code editor, except an agent can run it on forty apps before lunch.

Here's what "see the app" actually looks like — three live `/screenshot.jpg` renders pulled straight off apps embedded on this site. This is the exact image an agent reads on each pass:

<div class="shot-gallery">
    <figure>
        <img src="/images/blog/upgrade-examples/cave-gem-runner.jpg" alt="Cave Gem Runner — a neon cave platformer with a player, gems, and Start Run / Jump buttons" loading="lazy">
        <figcaption>cave-gem-runner</figcaption>
    </figure>
    <figure>
        <img src="/images/blog/upgrade-examples/block-smasher.jpg" alt="Block Smasher — a CRT-styled breakout arcade game with colored brick rows" loading="lazy">
        <figcaption>block-smasher</figcaption>
    </figure>
    <figure>
        <img src="/images/blog/upgrade-examples/acorn-bounce.jpg" alt="Acorn Bounce — a forest platformer with acorns to collect among trees and mushrooms" loading="lazy">
        <figcaption>acorn-bounce</figcaption>
    </figure>
</div>
<div class="gallery-caption">Real renders, fetched the same way the loop does. Reading these, an agent can spot a clipped header, a low-contrast HUD, or a board that runs off the frame — then go fix the one file behind it.</div>

## The single-app loop

One app at a time, the cycle is five moves:

<div class="loop">
    <div class="step"><span class="n">01</span><span class="t">Look</span><span class="d">Fetch <code>/screenshot.jpg</code>, read it.</span></div>
    <div class="arrow">→</div>
    <div class="step"><span class="n">02</span><span class="t">Diagnose</span><span class="d">Name one concrete visual issue.</span></div>
    <div class="arrow">→</div>
    <div class="step"><span class="n">03</span><span class="t">Edit</span><span class="d">Change <code>App.jsx</code> — just that one thing.</span></div>
    <div class="arrow">→</div>
    <div class="step"><span class="n">04</span><span class="t">Push</span><span class="d">Redeploy from the app dir.</span></div>
    <div class="arrow">→</div>
    <div class="step"><span class="n">05</span><span class="t">Re-look</span><span class="d">New screenshot — better or not?</span></div>
    <div class="repeat">↺ repeat until it's clean — one issue per pass</div>
</div>

Step one has a sharp edge worth calling out, because it's where naive versions of this break:

```sh
# -f makes curl FAIL on 4xx/5xx and write nothing, instead of
# silently saving a JSON error body as "screenshot.jpg"
curl -sfL "https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg" \
  -o /tmp/<slug>.jpg || echo "no screenshot yet"

# always confirm it's a real JPEG before you Read it
wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg
# Good: >5KB, "JPEG image data"   ·   Bad: file absent, or JSON
```

If you skip the verify and hand a 2KB JSON error to an image reader, the agent "sees" garbage and starts fixing problems that don't exist. The `-f` flag plus a one-line size/type check is the difference between a loop that self-corrects and one that hallucinates.

Editing is ordinary: `App.jsx` is plain React, so the agent makes a focused change — bump a contrast ratio, add padding, constrain a grid's max-width. The discipline that matters is **one visual issue per iteration.** Batch five fixes into one edit and, if the screenshot gets worse, you can't tell which one did it. One change, one screenshot, one verdict.

## Push is content-addressed, so there's no "force"

Pushing a Vibe hashes every file, and the deploy's identity is derived from those hashes. Two consequences shape the loop:

- **Identical bytes → no-op.** If your "edit" didn't actually change the file (whitespace, or it wasn't saved), push detects it, uploads nothing, and cuts no new release. There's no `--force` because there's nothing to force — change the bytes and you get a release.
- **Any real change → new release.** Every genuine edit deploys and triggers a fresh screenshot. So a "screenshot looks unchanged" after a confirmed push almost always means the edit didn't land — wrong directory, or no real diff.

And the directory thing is the single most common foot-gun: **`push` reads the files in the current directory.** Run it from the repo root instead of the app folder and you deploy the wrong (or an empty) file set, the push "succeeds," and nothing changes. Always `cd` into the app first.

## Now do it forty times at once

The loop is the same whether you run it once or in bulk — bulk just adds fan-out. The apps on a given hub are already grouped into categories (each landing page is a cluster of four-or-so apps), and the slugs are sitting right there in the page templates. So the batch version is:

1. **Map slugs to categories** by grepping the cluster's `.hbs` pages for the app subdomains.
2. **Pull every `App.jsx` locally** (each live deploy serves its source at `/App.jsx`), so the agents have files to edit.
3. **Dispatch one sub-agent per category** — eight agents, ~four apps each — and let every agent run the five-move loop on its apps independently. No shared state between categories means they run fully in parallel.

> The unit of work is one app's screenshot loop; the unit of *scale* is one agent per category. Forty apps polish in roughly the time the slowest single app takes — not forty times longer.

Each agent gets the same instructions a person would: here are your slugs and their local files, here's how to fetch a screenshot and how to push, fix one thing at a time, verify after each push. Because the feedback is visual and self-checking, the agents don't need a human in the loop — they can tell whether their own change helped by looking at the next screenshot.

## The pitfalls, collected

Most of what can go wrong is mechanical, and each symptom has a tell:

<div class="table-scroll">
<table>
    <thead><tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr></thead>
    <tbody>
        <tr><td>Push succeeds, screenshot unchanged</td><td>Ran push from the wrong directory — wrong file set</td><td><code>cd</code> into the app dir first</td></tr>
        <tr><td>Push reports a no-op</td><td>Content-hash dedup — the bytes didn't change</td><td>Make a real edit, save, re-push</td></tr>
        <tr><td>Agent "sees" nonsense</td><td>A 4xx error body got saved as the JPEG</td><td>Use <code>curl -f</code> + check <code>file</code> says JPEG before reading</td></tr>
        <tr><td>Screenshot lags the deploy</td><td>Render is server-side async</td><td>Wait ~8s after push, then re-fetch</td></tr>
        <tr><td>Confirmed push, app still wrong</td><td>A stuck slug</td><td>Redeploy under a fresh slug</td></tr>
    </tbody>
</table>
</div>

## Why this works at all

The deeper point isn't the curl flags — it's that **a deployed Vibe is a complete, inspectable artifact.** It renders itself to an image and serves its own source, so improving it doesn't require any privileged access, a design system, or a running dev environment. That's what turns "polish this app" into something you can hand to an agent, and "polish all these apps" into something you can hand to eight of them at once. The same property that lets *you* remix any app on this site — see it, open its source, change it — is what lets us keep the whole catalog looking sharp.

<div class="post-cta">
    <h3>Every app here is yours to open.</h3>
    <p>See it, read its source, change it — the same loop, in your hands.</p>
    <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
