# iOS Safari only unlocks Web Audio inside the gesture — not one await later

Source: #2683 (Bloom Machine; see also the `docs(web-audio)` rule it added)

Building Bloom Machine — a tap-a-pad-to-play-a-note grid, the first curated app of
the Instant Starter Stack — surfaced the canonical mobile Web Audio gotcha. On iOS
Safari an `AudioContext` starts `suspended`, and it will only resume if `resume()`
(and the first sound) happen **synchronously inside the user-gesture handler**. The
moment you `await` anything before kicking the audio — a fetch, a dynamic import, a
microtask hop — Safari no longer considers you "in" the gesture and the context
stays muted. Desktop and Android are forgiving here; iOS is not, so it's the
classic "works on my machine, silent on the phone" bug.

The fix that shipped: lazy-init the context on the *first* pad tap and unlock it in
the same synchronous tick, before any async work. It was worth codifying beyond the
one app — the PR also added a `docs(web-audio)` note stating the synchronous-unlock
rule with an example, so the next vibe with sound doesn't relearn it.

Worth a standalone post (reusable by anyone, not just vibes-diy): the precise
mechanics of the iOS gesture/unlock window, why an `await` before first sound breaks
it, and the pattern of unlocking audio on first interaction. Second angle for an
internal post: this is also the **first deployment under the `system` handle**,
which self-creates on first `npx vibes-diy push` — curated starter apps served as
real, addressable, platform-owned vibes rather than baked-in templates.
