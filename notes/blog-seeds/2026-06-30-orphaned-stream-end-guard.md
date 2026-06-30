# The render that assumed every "end" had a "begin"

Source: `claude/issue-2652-status-9oi5tv`

Code generations stream as paired begin/end boundaries per file/section, and the
live chat renderer leaned on that pairing as an invariant: on a section-end it
built a block straight from the matching `code.begin` it had stashed
(`begin: codeBegin!`, non-null assertion and all). A single section can stay open
for tens of seconds, and if the socket drops and reconnects inside that window,
the reconnected stream can replay the section's *end* onto a freshly-initialized
render pass whose *begin* lived on the now-superseded stream. The pairing breaks,
`codeBegin` is `undefined`, and the next `begin.sectionId` access throws — blanking
the live view mid-generation (VibesDIY/vibes.diy#2652).

The fix is small and defensive: if a `code.end` / `toplevel.end` (or the
`code.truncated` variant, same failure mode) arrives with no open begin, drop the
orphaned frame and keep rendering the rest. The persisted canonical event
sequence is still the source of truth, so a reload after the generation completes
renders the section correctly — the guard only has to keep the *live* view alive
through the reconnect window.

The gotcha worth writing up is the false-negative trap in the regression test. My
first repro put a *valid* code section before the orphan, and it passed even
without the fix — because the renderer never reset `codeBegin` after consuming a
section, so the orphan happily reused the previous section's stale begin instead
of crashing. The bug only bites when the orphan end has genuinely no preceding
begin in that render pass, so the test has to lead with the orphan. The fix
therefore does two things at once: guard against an absent begin, *and* reset the
begin to `undefined` once consumed so a stale one can't paper over the next gap.
