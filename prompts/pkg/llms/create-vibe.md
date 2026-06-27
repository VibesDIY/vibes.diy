# createVibe — meta-vibes (a vibe that builds another vibe)

`createVibe(prompt)` hands off to the Vibes builder to generate a **new,
personalized vibe** from a prompt you construct at runtime. It is the primitive
behind **meta-vibes**: a vibe whose output is *another* vibe.

The motivating shape is an **interviewer vibe**. The first vibe is *process* — it
runs a short, adaptive conversation (often with `callAI`) to gather what it needs.
When it has enough, it calls `createVibe(richPrompt)` with a fully-specified,
opinionated prompt built from the answers. The user lands in a second vibe that is
**personalized from birth** — a pitch deck that already knows their company, a
course outline already filled with their topic, a workout plan already matching
their goals — instead of a blank generic tool.

Use this skill only when the app's job is to *produce another app*. A normal app
that just stores and shows data does not need it.

## The one rule: call it from a click

`createVibe()` opens the builder in a **new tab**, leaving the interviewer open
behind it. Browsers only allow opening a tab from inside a real user gesture, so
**always call `createVibe()` from an `onClick` (or other direct interaction)** —
never automatically from an effect, a timer, or straight out of an async `callAI`
resolution. Gate it behind an explicit "Create my ___" button the user presses
when they're ready.

```jsx
import React from "react";
import { createVibe } from "use-vibes";

export default function App() {
  const c = { btn: "min-h-[44px] px-5 rounded-xl bg-[#0f172a] text-white" };
  // `ready` + `spec` come from the interview (see the full example below).
  return (
    <button
      className={c.btn}
      disabled={!ready}
      onClick={() => createVibe(spec)}   // ← user gesture: the new tab is allowed
    >
      Create my pitch deck
    </button>
  );
}
```

## Build a rich, opinionated prompt — not a one-liner

The whole point is that the second vibe arrives already specific. Construct a
detailed prompt from the interview: what to build, the sections/screens it needs,
and the user's actual content baked in. Treat it like a brief you'd hand a
designer, not a search query.

```js
const spec = `Build a pitch deck app for ${company}, a ${stage} startup in ${market}.
Pre-populate these slides with the content below — do not leave them blank:
1. Problem: ${problem}
2. Solution: ${solution}
3. Market size: ${marketSize}
4. Team: ${team}
5. The ask: ${ask}
Let the user edit each slide inline and present full-screen.`;
```

## Full pattern — interview, then hand off

```jsx
import React from "react";
import { callAI } from "call-ai";
import { createVibe } from "use-vibes";

export default function App() {
  const [answers, setAnswers] = React.useState({});
  const [spec, setSpec] = React.useState("");
  const [building, setBuilding] = React.useState(false);

  // ... interview UI fills `answers` via callAI-driven questions ...

  async function finish() {
    setBuilding(true);
    try {
      // Use callAI to turn the raw answers into a rich, opinionated brief.
      const spec = await callAI(
        `Write a detailed builder prompt for a pitch deck app, baking in: ${JSON.stringify(answers)}`
      );
      setSpec(spec);
    } finally {
      setBuilding(false);
    }
  }

  const c = { btn: "min-h-[44px] px-5 rounded-xl bg-[#0f172a] text-white" };
  return (
    <main id="app">
      {/* ...interview... */}
      {!spec ? (
        <button className={c.btn} disabled={building} onClick={finish}>
          {building ? "Preparing…" : "I'm ready"}
        </button>
      ) : (
        // Prompt is prepared; THIS click opens the builder (user gesture).
        <button className={c.btn} onClick={() => createVibe(spec)}>
          Create my pitch deck
        </button>
      )}
    </main>
  );
}
```

Note the two-step flow: the async work (`callAI` building the brief) happens
first, and the **final `createVibe()` runs in its own click**. Don't call
`createVibe()` inside the `await` chain — by then the user's gesture has expired
and the new tab will be blocked.

## API

- `createVibe(prompt, options?)` → `Window | null`. Opens the builder in a new
  tab; returns the opened window, or `null` if the popup was blocked. Options:
  `baseURL` (builder origin, defaults to the production builder) and
  `maxUrlLength` (warn threshold).
- `buildCreateVibeUrl(prompt, baseURL?)` → `string`. The hand-off URL without
  navigating — use it for a fallback link.

Very long prompts (a verbose brief over a few thousand characters) make a long
URL; `createVibe()` warns in the console when it crosses a safe threshold but
still proceeds. Keep the brief focused. If `createVibe()` returns `null` (popup
blocked), offer a fallback link so the hand-off still works:

```jsx
const win = createVibe(spec);
// If you want a belt-and-suspenders fallback, render an <a> with the URL:
//   <a href={buildCreateVibeUrl(spec)} target="_blank" rel="noopener">Open the builder</a>
```
