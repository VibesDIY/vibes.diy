# The theme stops fighting your custom design after the first turn

Source: `vibes.diy/api/svc/intern/prompt-assembly.ts`,
`vibes.diy/api/svc/public/prompt-chat-section.ts`,
`vibes.diy/api/types/invite.ts`

Codegen rebuilds the system prompt from scratch every turn, and it was injecting
the `<theme-design-md>` restyle block (plus the app-workflow preamble) on *every*
turn from the app's persisted `active.theme`. So once you'd picked a theme, every
follow-up — "make the header sticky", "add a delete button" — carried a fresh
"restyle the app to this theme" instruction that quietly fought any custom design
you'd done by hand.

Now the theme design + workflow preamble ride only on the **initial turn or when
a new theme is selected**. Skill/API docs (fireproof, callai) still go on every
turn — the model needs them to edit correctly.

Two things worth a post:

- **"A new theme was selected" is a server-side diff, not a client flag.** There
  was no per-turn signal — the theme-change flow just writes `active.theme` and
  auto-submits, and nothing recorded which theme a turn was *built* with. So we
  added an `active.codegen-theme` marker: after a successful codegen turn,
  `persistCodegenThemeMarker` records the theme the app was built against. Next
  turn, `assemblePromptPayload` compares live `active.theme` vs the marker —
  equal ⇒ omit the block, different (or absent) ⇒ a new theme was picked ⇒
  re-inject. Reload-durable, no fragile React submit plumbing, and it sidesteps
  the known "submit races `ensureAppSettings`" theme bug because it's all read
  from persisted settings.

- **The marker is written post-success, on purpose.** Writing it pre-dispatch
  would strand a failed theme-change: the retry would see marker == active and
  skip the theme. So the write lives in `handlePromptContext` after the
  filesystem commits (`fsRef.IsSome()`), and it's best-effort — a failed marker
  write only risks re-sending the theme once, never fails the turn. The initial
  turn is covered independently by `timeline.length === 0`, so a first-turn
  failure still re-sends the theme on retry.

Gotcha for tests: `active.theme` values must be real catalog slugs
(`atlas`, `matrix`) or `makeBaseSystemPrompt` validates them away and never emits
the block — so an arbitrary `"new-theme"` string would make the assertion pass for
the wrong reason. And two `createApiTestCtx` calls in one file collide on the
shared connection cache (default port), so the suite shares one ctx.
