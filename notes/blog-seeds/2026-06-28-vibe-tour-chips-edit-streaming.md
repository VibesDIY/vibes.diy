# When the edit card "did nothing": layering the stream over the chips

Source: `claude/vibe-tour-chips-edit-2b212n` — the in-place edit on `/vibe`
(owner clicks a suggestion chip → codegen streams + the app de-blurs) worked, but
the card itself looked frozen: the old suggestion chips just sat there the whole
time. The report was "it doesn't change anything in the edit panel… but it edits
and blurs the app just fine."

Two bugs hid behind one symptom.

**The stream window was too narrow.** The card showed the `GenerationStreamView`
only while `generation.phase === "streaming"` — the sliver *before* the first
`code.end`. For an in-place edit on an existing app that sliver is tiny: the model
emits a short narration then a code block, phase flips to `"live"`, and the body
snaps straight back to chips while the turn is *still running* and the app is
*still blurred*. So the user mostly saw chips → chips, and read it as "nothing
happened." Fix: gate on `isGenerating` (true until block-end settles), not on the
pre-code phase. The stream now stays up for the whole turn.

**The chips that came back were stale.** `useLatestVibeChips` reads the persisted
chat once at mount; after an in-place edit it still holds the *pre-edit*
suggestions. The model had just streamed *fresh* follow-up `▸` options in the same
turn — already in memory — so we parse those out of the latest block
(`generation.suggestionChips`) and prefer them over the persisted ones. No server
re-read, no race: the data we want is the data we just received.

The non-obvious part was **"without resizing the edit panel."** The naive fix —
swap the chips body out for the stream body — makes the bottom-anchored card jump,
because the two contents are different heights, and worse, the live-parsed chips
churn line-by-line as narration streams so even the *reserved* height wobbles. The
move that made it calm: don't replace, **layer**. A new `streamBody` prop keeps the
chips+Other region mounted but `visibility:hidden` + `inert` (so it still reserves
its height and the panel can't resize), and absolutely-positions the stream on top.
And freeze which chips are *displayed* to a settled value while a turn is in flight,
so the hidden-but-measured region holds still. Result: the chat streams in over a
panel that doesn't move, and the moment it settles the panel reveals the *new*
chips in the exact same footprint.

Angles worth a full post:

1. **"Nothing happened" is usually "it happened too briefly to see."** The honest
   bug was a state window (`phase==="streaming"`) that closed a beat after it
   opened. The lifecycle flag you reach for matters: `phase` answers "where in the
   turn are we," `isGenerating` answers "is the turn still mine" — and the UI
   wanted the second question.

2. **Prefer the data you already have over a fresh read.** The fresh chips were
   sitting in the in-memory reducer block the whole time; re-reading the server
   would have been slower *and* racy. The reusable shaping (`chipsFromNarration`)
   let the streamed block and the persisted chat apply identical chip semantics.

3. **"Don't resize" is a layout invariant, not a tweak.** Reserve-and-overlay
   beats swap-and-measure: keeping the old content mounted-but-hidden makes the
   container's height the *same DOM* in both states, so there's nothing to jump.
   The subtlety that bites is the second-order one — the reserved content itself
   must hold still, which meant freezing the displayed chips for the duration of
   the turn.
