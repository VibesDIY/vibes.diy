# When an app keeps your work private, it should say so — and offer one tap to publish

Source: `prompts/pkg/system-prompt.md`, `prompts/pkg/system-prompt-initial.md`

The codegen system prompt already teaches the model to route a user's own work
to a channel only they can read — a per-user `user:<handle>` for a private
journal, notes app, or tracker. What it didn't say was that the *UI* has to make
that privacy legible, and that private-by-default shouldn't be a dead end. Two
new directives (one in each access-model guidance block) close that gap.

Decisions worth a full post:

- **A private channel is invisible to the user it protects.** The access fn does
  the right thing — no `grant.public`, so nobody else can read it — but the
  person looking at their own half-finished entry has no way to know whether
  it's a public wall or a private drawer. The model now must render a small,
  persistent "Only you can see this" / "Private to you" cue near the content.
  The honest move is to *show* the privacy, not leave the user guessing who's
  watching.

- **Publish is a UI affordance over a mechanism we already had.** The initial
  prompt's habit-tracker worked example already drives read-visibility from a
  `visibility` field (`if (doc.visibility === "public") grant.public = [ch]`).
  The new guidance reuses exactly that: a publish button promotes a chosen item
  to a broadcast channel everyone reads — `grant.public` for anonymous visitors,
  or the app's shared channel for all granted members — gated on
  `useVibe(dbName).can`, with the affordance flipping to "Published — anyone can
  see this" (and an unpublish to flip back). No new access primitive; just the
  insistence that the model wire the control and reflect its state.

- **Opt-in, not mandatory.** A strictly private journal can stay private — the
  directive says publish *where sharing fits the app*, so the model isn't forced
  to bolt a share button onto a diary. The bar is: anything worth showing off
  should be one tap from public, and nothing private should be ambiguous about
  its privacy.

- **The publish footgun: channels are the unit of read isolation, not docs.**
  The first draft said "publish a chosen item: `grant.public = [ch]`" — and a
  Codex review (P1) caught that if `ch` is the shared per-user `user:<handle>`
  channel, flipping it public exposes _every_ private item routed there, not just
  the one. The grant shape is literally `publicChannels: string[]`, so public is
  channel-scoped. The fix: publish at channel granularity — route each
  publishable item to its **own** channel (`entry:<id>`) and flip only that
  channel's read-grant. Making the user's whole space public is fine when that's
  the intent; leaking their other notes by publishing one is the trap. A good
  reminder that a prompt that hand-waves the access mechanism will get the
  mechanism wrong in generated apps.

Trade-off: this is prompt-behavior guidance, not a code path, so its only test
is generation quality — the access-model autoresearch eval is the place to watch
for whether the affordance actually lands in generated apps.
