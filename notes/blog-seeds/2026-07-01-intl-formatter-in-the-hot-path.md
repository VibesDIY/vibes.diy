# The 320ms favorite toggle was `new Intl.DateTimeFormat` in a sort comparator

**Hook:** A single heart-tap in the Pickathon Picker took ~330ms to re-render.
Instrumentation split render time into JS vs paint (`useLayoutEffect` at render
start → `useEffect` after paint) and the answer was unambiguous: `renderMs=328.6`,
`afterPaint sinceClick=329.9`. Paint was ~0.5ms. It was all scripting.

**Source:** `vibes/pickathon-picker/festival-utils.js`. `toFestivalDate`,
`festivalDayFor`, `fmtTime`, and `fmtDate` each constructed a fresh
`Intl.DateTimeFormat` (and called `formatToParts`) on *every* call. Those helpers
live inside sort comparators and filters that run over hundreds of events, several
times per render — so one App render built *thousands* of `Intl.DateTimeFormat`
objects. Constructing that object is one of the most expensive things you can do
in a JS hot loop (tens of µs each; it loads locale + timezone data).

**Fix / trade-off:** Hoist each formatter to a module-scope singleton (built once)
and memoize the parse/format results by their input string — the festival's date
strings are a tiny, stable set parsed over and over. Toggle render dropped from
~328ms to ~5ms (~60×), output identical.

**Gotcha worth repeating:** When a re-render feels slow, measure JS-vs-paint before
reaching for `React.memo`. "Wide repaint" was the wrong hypothesis here — nothing
about the DOM was heavy; the cost was a formatter constructor called in an
`O(n log n)` comparator. `React.memo`/`useCallback` would not have touched it. The
cheap, boring caches (module singleton + `Map` keyed by input) were the whole win.
