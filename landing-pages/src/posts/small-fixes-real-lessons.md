---
title: "The NUL byte that broke every write (+7 more)"
date: 2026-06-27T15:00:00Z
author: "Vibes DIY"
summary: "Eight little fixes from the build log — a NUL byte that took down every Postgres write, an iOS audio-unlock race, a markdown blank line that clobbered a file — each with a lesson bigger than the diff."
thumb: "/images/blog/small-fixes-real-lessons/card.jpg"
---

A single NUL byte once took down every Postgres write we made. The fix was one line; the lesson wasn't. Most fixes are like that — the diff is forgettable, the reason it was wrong is not. We keep a seed note for every change that touched the build, because the line gets merged and forgotten, but the lesson — *clever encodings break at boundaries, defaults hide bugs, the real engine is the only honest test* — outlives it and shows up again next week wearing a different hat. Here are eight from the recent log, starting with that NUL byte.

<figure>
    <img src="/images/blog/small-fixes-real-lessons/card.jpg" alt="Illustration card: “small fix · real lesson” set over a workbench of tools, in the Vibes DIY teal-and-goldenrod style." loading="lazy">
    <figcaption>Eight small fixes from the build log, each with a lesson bigger than the diff.</figcaption>
</figure>

## The clever NUL separator that took down every Postgres write

We needed a per-doc advisory-lock key, so we joined `(owner, app, db, docId)` with a literal NUL byte — chosen *precisely because* NUL "cannot appear in these identifiers," making it a collision-proof separator. It was too clever. That key gets bound into a Postgres text param, and Postgres rejects `0x00` in text (SQLSTATE 22021), so *every* pg `putDoc`/`deleteDoc` failed. The exact property that made NUL a perfect uniqueness trick made it an invalid value one layer down.

Two lessons fell out of it. First: prefer encodings that are obviously correct everywhere over ones that are minimal-but-fragile. The boring fix — `JSON.stringify` the tuple — is unambiguous *and* survives every layer boundary; a clever encoding that leans on a low-level invariant ("this byte can't appear") is a latent bug at the first boundary that disagrees. Second: debug against the real engine, and beware the false negative. The bug was invisible in CI because tests run on libsql, which tolerates NUL in text; only real Postgres rejects it. The first repro even *passed* — because it used a clean key, not the actual NUL-separated one. Reproducing with the real input against the real engine, and walking the `.cause` chain that the WebSocket only surfaces as a generic `Failed query:` wrapper, is what pinned SQLSTATE 22021.

## The half-life of a rule: empty jsonb breaks on pg too

After the NUL incident we didn't just fix the bug — we generalized it into a coding standard: prefer the boring encoding that's obviously correct at every layer, and test against the real engine, not the convenient one. Days later that rule earned its keep. This time there was no clever trick at all — just drizzle quietly expanding an interpolated JS array into a parenthesized param list. A populated `fileSystem` became `($6, $7, $8, $9, $10)`; an empty `meta: []` became `()` → Postgres `42601 syntax error at or near ")"`.

Since an empty `meta` is the common case for a fresh generate, this broke essentially *every* new-app INSERT on pg — and, exactly as the rule warned, it was invisible in CI because libsql's `jsonParam` branch already used `JSON.stringify`. The fix is the same boring-but-portable move: `JSON.stringify(value)::jsonb`, one param per column regardless of array length. A debugging war story is worth one blog post; a rule extracted from it that catches the next instance within the week is worth more. The throughline across both bugs is one failure mode — "it works on libsql, it breaks on the engine that matters" — and the standing fix is structural: serialize to a self-describing value at the boundary, and make the real engine part of the test loop.

## The blank line that let access.js overwrite App.jsx

A one-shot generation shipped its access-control function *inside* `App.jsx`, wiped the React component, and never wrote `access.js`. The model was innocent: it emitted the conventional aider shape — filename on its own line, a blank line, then the fence. But the streaming fence parser only binds a "path line" to a fence when the label is on the line *immediately* before the opening fence. The blank line in between took the `else` branch, flushed the pending filename as prose, and left `currentPath` to fall back to `DEFAULT_PATH = "App.jsx"`. Both fences got `path: "App.jsx"`, and the second clobbered the first.

The interesting part is *why it survived so long*. For a single-file app the bug is invisible, because `App.jsx` is the default — the wrong answer and the right answer coincide. It only bites multi-file generations (anything with `access.js`). The existing test even fed the exact `filename / blank / fence` shape, but asserted `path === "App.jsx"`, so the default fallback masked the bug *inside the test that should have caught it*. A sensible default is a great way to hide a bug: when the fallback equals the common-case correct value, the failing path looks like it works and your test passes for the wrong reason. The fix is to test with a *non-default* value (`access.js`) so the binding is genuinely exercised — and to have streaming parsers hold candidates across separators: buffer blank lines while a path candidate is pending, drop them when a fence consumes the path, flush them in order only if real prose or EOF intervenes.

## Deleting a column before it ever reached prod

The owner-role-seeding work shipped an `ownerRoles` column on `AccessFunctionBindings` so the generator could declare custom owner roles. By the time the design finalized, we'd decided not to build the *producer* — codegen never declares them — and that the reserved `owner` role plus app-level grant docs subsume the use case. So the column was always NULL with no writer. Because the drizzle schema-push hadn't run in prod yet, removing it cost nothing.

That timing is the whole lesson. "Is this column without purpose?" is a question with a hard deadline: the next deploy. Ask it before the migration runs and the answer is a clean delete; ask it after and you've baked a dead column into Postgres behind a future `DROP COLUMN` migration. The discipline of asking *before* the schema-push is what keeps the schema honest — and the diff was satisfying on its own, a feature collapsing back to its actual mechanism (seed one reserved role from the `ownerHandle`) while ~50 references across six hot-path reduce sites melted away, behavior identical.

## iOS Safari only unlocks Web Audio inside the gesture

Building Bloom Machine — a tap-a-pad-to-play-a-note grid — surfaced the canonical mobile Web Audio gotcha. On iOS Safari an `AudioContext` starts `suspended`, and it will only resume if `resume()` (and the first sound) happen **synchronously inside the user-gesture handler**. The moment you `await` anything before kicking the audio — a fetch, a dynamic import, a microtask hop — Safari no longer considers you "in" the gesture, and the context stays muted. Desktop and Android are forgiving here; iOS is not. Classic "works on my machine, silent on the phone."

The fix that shipped: lazy-init the context on the *first* pad tap and unlock it in the same synchronous tick, before any async work. It was worth codifying beyond the one app — the PR also added a `docs(web-audio)` note stating the synchronous-unlock rule with an example, so the next vibe with sound doesn't relearn it. (A bonus first: this was also the first deployment under the `system` handle, which self-creates on first `npx vibes-diy push` — curated starter apps served as real, addressable, platform-owned vibes rather than baked-in templates.)

## The dynamic import that already did the right thing

The design feared a fight with the bundler. To keep a lean shared/read Durable Object from re-parsing QuickJS on a cold-isolate wake, we needed QuickJS out of the worker entry chunk — and the architecture doc said to reach for wrangler's `find_additional_modules` + `rules`. But this worker is bundled by Vite + `@cloudflare/vite-plugin` (Rollup), where that esbuild knob doesn't apply. So the plan staged an escalation ladder: bare `import()` → `manualChunks` → the plugin's wasm handling → wrangler. Rung 1 won outright. Converting the static top-level `import { getQuickJSWASMModule }` to `await import("@cf-wasm/quickjs")` at the call site was enough — Rollup's default dynamic-import code-splitting put the entire 622 kB of QuickJS glue (and the 503 kB `RELEASE_SYNC.wasm`) into their own chunks, leaving the entry with nothing but the `import()` reference. Zero extra config. The scariest task in the plan was a one-liner.

The lesson worth keeping is about the test, not the fix. The real property — "a shared instance never parses QuickJS" — is a *build-output* fact: is the glue in the entry chunk or a lazy one? You can only see that in the built bundle, but `pnpm check` here is tsc + vitest and never builds the worker, so a test that needs the bundle would just be skipped in CI and rot. The fix is two-layer: an always-on **source invariant** (no worker file may statically value-import `@cf-wasm/quickjs`) that runs in CI as the regression guard, plus a **bundle assertion** that `skipIf`s when no build is present and runs locally for the empirical confirmation. The cheap proxy guards the expensive truth. (A small trap along the way: the first source-guard regex, `/import\s+(?!type)[^;]*?from\s+["']@cf-wasm\/quickjs["']/`, kept flagging the file that was *correctly* using `import type` + dynamic import, because a doc comment containing the word "import" let `[^;]*?` bridge across the comment to the real statement. Strip comments before matching.)

## The logo that teleported

The Vibes logo appeared top-left during load, then jumped to the bottom-right. It read as a bug — but it wasn't one element moving. It was two logos in opposite corners, mounting and unmounting at different times. The top-left `VibesSwitch` renders whenever `!isAccessGranted` (including the transient `"loading"` state) behind a `Delayed ms={1000}`; the bottom-right `ExpandedVibesPill` mounts only after `isAccessGranted`, behind its *own* `Delayed ms={1000}`. Slow grant resolution meant the top-left flash, then the pill.

The gotcha is that the top-left logo isn't decorative — it's the only `SessionSidebar` toggle, and it only exists while access is ungranted. So "just delete it" strands the sidebar on the card and not-found screens. The fix that actually ships suppresses the logo during `"loading"` only, and keeps it on the persistent card / not-found screens: invisible until the bottom-right pill takes over, sidebar toggle intact. The teleport was a state machine showing its seams; the fix was to name the one state that should hide it, not to remove the element.

## Copy buttons on warning toasts, not just errors

`CopyableToaster` already appended a "Copy" button to error toasts so a user could grab a stack-trace-ish message for debugging. Warnings — "preview may be stale," "Hot-swap failed: …" — carry exactly the failure detail a user needs to report, but the button was gated on `t.type === "error"`. The catch: react-hot-toast has no "warning" type. Warnings are plain `toast("…")` calls (type `"blank"`) distinguished only by `icon: "⚠️"`. Keying Copy off `t.type === "blank"` would have splattered it onto every neutral toast, so the discriminator is the icon itself — a shared `WARNING_ICON` constant, exported from `CopyableToaster` and imported at the call sites so producer and detector can't drift. Detection collapsed into one pure, unit-testable predicate, `isCopyableToast(t)` = error-or-warning **and** has plain text.

The second half is the real lesson: the affordance and the time to use it have to ship together. Error toasts already got a 10s duration *specifically* so there's time to click Copy. A copy button on a 4s default-duration warning is a button that vanishes before you reach it — so the two warning call sites now pass `duration: 10000` too. (The per-type duration config in `<Toaster toastOptions={{ error: {...} }}>` can't help here, since warnings are type `"blank"` and you'd bump every blank toast; duration is set per-call instead. A third warning toast needs the same `WARNING_ICON` + `duration: 10000` pair or it regresses on both axes, silently.)

<div class="post-cta">
  <h3>The line gets merged. The lesson stays.</h3>
  <p>Every one of these started as a one-line diff and a seed note. Build something, break something, write down why — that's the loop.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
