# The type guard that quietly kept only `array[0]`

Source: branch `claude/issue-2707-szt9dq` — `call-ai/v2/block-stream.ts` (guards) +
`call-ai/v2/block-stream-guards.test.ts` (new regression). Fixes VibesDIY/vibes.diy#2707.

The `call-ai-v2` block-stream type guards (`isToplevelLine`, `isCodeLine`, `isBlockEnd`, …) take
an optional second `streamId` argument so a consumer can scope a check to one stream:
`isCodeBegin(msg, streamId)`. That dual-purpose signature is a footgun the moment one of these
guards is handed *bare* to an array method:

```ts
blocks.filter(isToplevelLine) // looks fine. isn't.
```

`Array.prototype.filter(fn)` calls `fn(element, index, array)`, so the **element index** lands in
the `streamId` slot. The old body was `!streamId || msg.streamId === streamId`:

- index `0` → `streamId = 0` → falsy → scope check skipped → element passes
- index `≥1` → `streamId = 1, 2, …` → requires `msg.streamId === 1`, but real streamIds are
  generated id **strings**, never numbers → every element past the first is silently dropped

Net effect: a bare `.filter(isToplevelLine)` deterministically keeps at most `array[0]`. No throw,
no type error — the array just comes back short.

The trade-off worth a post:

- **Why harden the guard instead of banning the bare call?** Three options were on the table — a
  lint rule, hardening the guard, or splitting the API into a curried `isToplevelLineOf(streamId)`.
  We took the cheapest durable one: a shared `streamIdMatches(msg, streamId)` helper that treats
  **only a string** as a real filter (`typeof streamId !== "string" || …`). A number (the index JS
  injects) is ignored, so the guards are now safe to pass bare *and* still scope correctly when you
  hand them an actual id. The genuine stream-scoped callers in `filesystem-stream.ts` are unchanged.

- **Latent, not active.** Grepping non-test code for `.{filter,map,some,find}(is{Toplevel,Code,Block}*)`
  found zero live victims — the only occurrence had already been wrapped in an arrow. So this is a
  guard rail against a future paper cut, which is exactly why a regression test (bare `.filter`
  keeps all three lines) is the real deliverable: it pins the safe behavior so the sharp edge can't
  grow back.
