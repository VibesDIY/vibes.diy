# A vibe that rendered blank in headless but fine for the user — a WebGL throw in a useEffect

**Hook:** Building `rolling-today` (a Bike Summer ride calendar), the app rendered
**completely blank** in the cloud headless browser — empty a11y tree, blank
screenshot — yet loaded perfectly in the user's real browser. Classic "works on my
machine," inverted: it only *failed* on the headless machine.

**Source:** `vibes/rolling-today/` (branch `claude/rolling-today`). The app embedded a
MapLibre GL map. Map init lived in a `useEffect`:

```js
const map = new mlib.Map({ container, style, center, zoom }); // throws: no WebGL
```

Headless Chromium usually has **no WebGL**, so `new maplibregl.Map()` throws. A throw
inside a `useEffect` isn't caught by anything — React unwinds and the whole tree
unmounts, leaving a blank root. The user's browser has WebGL, so it never threw.

**The tell:** the DOM *did* contain content (the browser's issue panel reported ~10
form fields = the ride-card note inputs), but the a11y tree and screenshot were empty
— i.e. it rendered, then got torn down. That gap (DOM had nodes, tree was empty) is
the fingerprint of a post-mount effect throw, not a compile error.

**Fix / trade-off:** two options — guard the throw (`try { new Map() } catch { return }`
so it degrades to "no map"), or drop the map entirely. We did both: guarded it first
to confirm the diagnosis (app rendered instantly once guarded), then removed the map
altogether because it added little for riders and its geocoding was often wrong.

**Gotcha worth repeating:** any browser API that can be unavailable in a rendering
context (WebGL, `IntersectionObserver` in odd sandboxes, `matchMedia`) will **blank
your whole app** if you call it unguarded in an effect. Wrap risky external-lib init
in try/catch inside the effect. And when a headless preview is blank but the DOM has
nodes, suspect an effect throw before you suspect a compile error — check a real
browser before chasing the transform.
