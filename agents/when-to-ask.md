# When to ask — decide the _how_ yourself, ask only about the _what_

The default is to **keep moving**. You're the one doing the work; the user trusts your
recommendation. Don't stop to ask permission for decisions that are yours to make.

## Don't ask about _how_

Implementation choices are yours. Which approach, which pattern, which layer to fix at, whether to
refactor, how to structure the code, which of two equally-valid mechanisms to use — figure these out
yourself. Use the tools you have: read the code, run the tests, and lean on review (Charlie, Codex,
`requesting-code-review`) to pressure-test and correct your direction. If a first attempt turns out
wrong (a reviewer catches it), just fix it and carry on — that's the loop working, not a reason to
escalate.

A useful gut-check before asking a _how_ question: **could Charlie or a code review answer this?**
If yes, it's not a question for the user — get the answer from them (or from the code) and proceed.

## Ask only about the _what_ — and only when you're genuinely stuck

Escalate to the user when it's about **what to do**, not how:

- The goal itself is ambiguous or underspecified and you can't infer it from the request or the code.
- A decision changes product direction, scope, or priorities (what to build, what to ship, what to
  cut) in a way you can't reasonably choose for them.
- An action is hard to reverse or outward-facing and the user hasn't authorized it.
- **You and Charlie (or review) genuinely can't figure it out** — you've tried, you've iterated, and
  it's still stuck. _Then_ bring it to the user, with the context and your best recommendation.

When you do ask, ask in plain text with inline options (see
[asking-questions.md](asking-questions.md)) — and lead with your recommendation, because you're
closest to the work.

## The failure mode this prevents

Asking the user to choose between implementation approaches you could have chosen yourself (or
validated with Charlie) — that just offloads work back onto them and slows things down. A wrong-but-
recoverable _how_ decision, made and then corrected via review, is almost always better than a
stall. Reserve the user's attention for the _what_.
