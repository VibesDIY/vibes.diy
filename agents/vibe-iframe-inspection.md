# Inspecting & measuring a deployed vibe inside its iframe (Chrome MCP)

How to read state and measure exact layout of a **deployed vibe's UI** when it runs
inside the `vibes.diy/vibe/<handle>/<slug>` wrapper. The app renders in a
**cross-origin iframe** (`<slug>--<handle>.<host>`), which breaks the obvious tools —
these are the channels that actually work. Companion to
[`chrome-mcp-debug.md`](chrome-mcp-debug.md) (the general debug loop) and
[`vibe-code.md`'s skill](../.claude/skills/vibe-code/SKILL.md) (pull/push source).

## The core constraint

`mcp__chrome-devtools__evaluate_script` runs in the **top** `vibes.diy` frame. The vibe
renders in a **different-origin** child iframe, so from the top frame you **cannot**
reach into the app's DOM — `iframe.contentDocument` is `null`, and there's no
`evaluate_script` frame-targeting. So you can't just `getBoundingClientRect()` a vibe
element the way you would a normal page. Use the channels below instead.

## Channels that DO cross the iframe boundary

### 1. `console.log` → `list_console_messages` (the good one)

Logs emitted **inside the vibe app** are captured. Add a temporary
`console.log("TAG", ...)` in the vibe source, `push`, load via the `/vibe/` route, then:

```
mcp__chrome-devtools__list_console_messages  types: ["log"]
```

You'll see e.g. `CALLOUT_DEBUG DBG w=240 h=60 pl=16px pr=16px gL=18 gR=18 ...`. This is
the cleanest way to pull structured data (measurements, resolved state, JSON) out of the
iframe. Prefer a unique TAG so it's easy to grep the output.

### 2. `document.title` → `take_snapshot`

Setting `document.title` inside the vibe surfaces as the iframe's **RootWebArea
accessible name** in the a11y snapshot (`uid=.. RootWebArea "DBG w=240 ...")`). Handy for
a single short string when the console is noisy, or to eyeball a value without a
`list_console_messages` round-trip.

### 3. `take_snapshot` for text/labels

The a11y tree includes the iframe's text content and control labels — better than a
screenshot for reading copy, nav labels, counts. It does **not** give geometry.

## Measuring exact layout (padding, gaps, alignment)

Screenshots hide sub-pixel/asymmetry problems ("looks centered" when padding is 6px vs
30px). Measure precisely with a temporary effect in the vibe that logs geometry. Recipe —
box vs **actual rendered text** extent, so you catch left-aligned slack:

```jsx
// TEMP — remove before final deploy
useEffect(() => {
  const id = setTimeout(() => {
    const el = document.querySelector("[data-measure]"); // or find by text
    if (!el) return;
    const cs = getComputedStyle(el),
      r = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const tr = range.getBoundingClientRect(); // the text's real box
    console.log(
      "MEASURE",
      `w=${Math.round(r.width)} h=${Math.round(r.height)} pl=${cs.paddingLeft} pr=${cs.paddingRight}` +
        ` gapL=${Math.round(tr.left - r.left)} gapR=${Math.round(r.right - tr.right)}` +
        ` gapT=${Math.round(tr.top - r.top)} gapB=${Math.round(r.bottom - tr.bottom)}`
    );
  }, 2500);
  return () => clearTimeout(id);
}, []);
```

`gapL !== gapR` means the box is wider than the text and the text isn't centered — the
slack is on one side even though `padding-left === padding-right`. Fix by centering
(`flex justify-center text-center`) and/or `text-wrap: balance`, then re-measure until the
gaps match.

## Platform chrome (the Vibes switch) IS measurable from the top frame

The logo / "vibe switch" lives in the **vibes.diy** page, not the iframe — so it's
directly readable with `evaluate_script`. Use it to align app elements to the switch:

```js
() => {
  const r = document.querySelector('[aria-label="Open vibe menu"]').getBoundingClientRect();
  return { h: Math.round(r.height), fromBottom: Math.round(innerHeight - r.bottom), fromRight: Math.round(innerWidth - r.right) };
};
// → { h: 60, fromBottom: 28, fromRight: 16 }  (as of 2026-07)
```

## Gotchas learned the hard way

- **Don't load the raw iframe origin.** Navigating the top browser to
  `<slug>--<handle>.<host>/...` trips a **client-side frame guard** that redirects back to
  `vibes.diy/vibe/...` via `location.href =` (both docs return 200 — it's not a server
  302). Overriding `window.top`/`parent`/`frameElement`/`Location.prototype.assign` via
  `navigate_page initScript` does **not** stop an `href` assignment. So always drive
  through the **`/vibe/<handle>/<slug>` route** and use the cross-boundary channels above.
  (Loading the bare origin is fine for pure-style work _if_ a vibe has no such guard, but
  expect the redirect.)
- **Tailwind spacing in vibes is px-scaled, not rem.** Measured `px-5` → **5px** (not
  20px); the vibe runtime's spacing scale is ~1 unit = 1px while `fontSize` stays normal
  rem. For predictable spacing use **explicit arbitrary px** — `px-[16px]`, `h-[60px]`,
  `bottom-7` (Tailwind `bottom-7` is 28px and behaved as expected) — rather than trusting
  the numeric spacing scale.
- **`can`/data behavior is wrong outside the wrapper.** Even if you bypass the guard, a
  standalone iframe has no platform runtime (viewer is null, writes fail) — style only.

## Cleanup

Remove every temp `console.log` / `document.title =` / measurement effect before the final
`push`. Grep for your TAG (e.g. `grep -n "MEASURE\|DBG" App.jsx`) so nothing ships.
