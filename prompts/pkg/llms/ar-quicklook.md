# AR Quick Look Reference for Coding Agents

_AR Quick Look is Apple's native 3D/AR viewer built into iOS, iPadOS, and macOS. It requires zero SDK — just an HTML link with `rel="ar"`. No WebXR, no Babylon.js, no build step._

## When to Use AR Quick Look vs WebXR

|             | AR Quick Look                                     | WebXR (Babylon.js)                              |
| ----------- | ------------------------------------------------- | ----------------------------------------------- |
| Platforms   | iOS/iPadOS/macOS Safari only                      | Chrome/Quest/Firefox cross-platform             |
| Setup       | One HTML `<a>` tag                                | Full 3D engine setup                            |
| File format | USDZ or .reality                                  | GLTF, OBJ, custom geometry                      |
| Use case    | Display a single product/object in the real world | Full immersive experiences, custom interactions |
| Feel        | Native Apple UI, zero friction                    | Custom built                                    |

**Choose AR Quick Look when:** the user wants to place a real-looking 3D object in their room via iPhone/iPad. Choose WebXR when you need custom interactions, non-Apple platforms, or VR.

---

## Web Implementation (Safari on iOS/macOS)

The entire AR Quick Look web API is a single HTML attribute:

```html
<!-- Minimal: just a link -->
<a rel="ar" href="/models/chair.usdz"> View in AR </a>

<!-- With thumbnail image (shows the model preview on long-press) -->
<a rel="ar" href="/models/chair.usdz">
  <img src="/models/chair-thumbnail.jpg" alt="Chair" />
</a>

<!-- .reality format (supports animations, behaviors from Reality Composer) -->
<a rel="ar" href="/models/scene.reality">
  <img src="/models/scene-thumbnail.jpg" alt="Scene" />
</a>
```

**Rules:**

- The `rel="ar"` attribute is what triggers AR Quick Look
- The link must point to a `.usdz` or `.reality` file served over HTTPS
- `localhost` works for local development
- Only works in Safari on iOS 12+ / macOS 10.15+; other browsers treat it as a normal download

### Canonical Web Page URL (for sharing)

Add `#` with a URL to set what gets shared when the user taps Share inside AR Quick Look:

```html
<a rel="ar" href="/models/chair.usdz#canonicalWebPageURL=https://example.com/chair"> View in AR </a>
```

### Custom Action Button (e.g. "Buy Now")

Add a `callToAction` and `checkoutTitle`/`checkoutSubtitle` to show a banner:

```html
<a
  rel="ar"
  href="/models/chair.usdz#callToAction=Buy%20Now&checkoutTitle=Acme%20Chair&checkoutSubtitle=Starting%20at%20%24299&price=%24299"
>
  View in AR
</a>
```

### Apple Pay Button

```html
<a rel="ar" href="/models/chair.usdz#applePayButtonType=buy&checkoutTitle=Acme%20Chair&price=%24299"> View in AR </a>
```

---

## JavaScript Trigger

You can launch AR Quick Look from a JS event by programmatically clicking an `<a rel="ar">` element:

```javascript
function launchAR(modelUrl) {
  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = modelUrl;
  // Must be appended and clicked synchronously in a user gesture handler
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

// Use inside a click handler:
button.addEventListener("click", () => launchAR("/models/chair.usdz"));
```

---

## iOS Detection (Show Fallback for Non-iOS)

```javascript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const supportsARQuickLook = isIOS && isSafari;

// Feature-detect via <a> element
function canARQuickLook() {
  const a = document.createElement("a");
  return a.relList && a.relList.supports && a.relList.supports("ar");
}
```

---

## Disabling Content Scaling

By default the user can pinch-to-scale your model. To lock scale:

```html
<!-- Web: append #allowsContentScaling=0 -->
<a rel="ar" href="/models/chair.usdz#allowsContentScaling=0"> View in AR (fixed scale) </a>
```

---

## Free USDZ Models

Apple provides free sample USDZ files in their AR Quick Look Gallery. For demos, use publicly hosted models. The easiest approach: let users provide a URL to their own `.usdz` file, or use a model hosting service.

Sample Apple USDZ files are available for download from Apple's AR Quick Look Gallery at:
`https://developer.apple.com/augmented-reality/quick-look/`

---

## React + Fireproof Example: AR Model Gallery

A gallery where users add USDZ model URLs, see thumbnails, and tap to view in AR. Non-iOS visitors see a 3D viewer fallback message.

```javascript
import React, { useState } from "react";
import { useFireproof } from "use-fireproof";

// ── AR Quick Look link component ───────────────────────────────────────────

function ARModelCard({ model, onDelete }) {
  const canAR =
    typeof document !== "undefined" &&
    (() => {
      const a = document.createElement("a");
      return a.relList?.supports?.("ar");
    })();

  return (
    <div className="relative rounded-xl overflow-hidden bg-white border-2 border-gray-100 shadow-sm">
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-50 flex items-center justify-center">
        {model.thumbnailUrl ? (
          <img src={model.thumbnailUrl} alt={model.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-4xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{model.name}</h3>
        {model.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{model.description}</p>}
      </div>

      {/* AR / Fallback button */}
      <div className="px-3 pb-3">
        {canAR ? (
          <a
            rel="ar"
            href={`${model.modelUrl}#allowsContentScaling=0${
              model.canonicalUrl ? `&canonicalWebPageURL=${encodeURIComponent(model.canonicalUrl)}` : ""
            }`}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-black text-white rounded-lg text-sm font-medium"
          >
            <span>View in AR</span>
            <span>🔮</span>
          </a>
        ) : (
          <a
            href={model.modelUrl}
            download
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
          >
            <span>Download USDZ</span>
            <span>⬇️</span>
          </a>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(model._id)}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-white text-xs flex items-center justify-center"
        aria-label="Remove"
      >
        ✕
      </button>
    </div>
  );
}

// ── Add model form ─────────────────────────────────────────────────────────

function AddModelForm({ onAdd }) {
  const [name, setName] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !modelUrl.trim()) return;
    onAdd({ name: name.trim(), modelUrl: modelUrl.trim(), thumbnailUrl: thumbnailUrl.trim(), description: description.trim() });
    setName("");
    setModelUrl("");
    setThumbnailUrl("");
    setDescription("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Add USDZ Model
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">Add Model</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Model name *"
        required
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
      />
      <input
        value={modelUrl}
        onChange={(e) => setModelUrl(e.target.value)}
        placeholder="USDZ or .reality URL (https://...) *"
        required
        type="url"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
      />
      <input
        value={thumbnailUrl}
        onChange={(e) => setThumbnailUrl(e.target.value)}
        placeholder="Thumbnail image URL (optional)"
        type="url"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 resize-none"
      />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const { database, useLiveQuery } = useFireproof("ar-gallery");
  const { docs: models } = useLiveQuery("type", { key: "model" });

  const canAR =
    typeof document !== "undefined" &&
    (() => {
      const a = document.createElement("a");
      return a.relList?.supports?.("ar");
    })();

  async function addModel(data) {
    await database.put({ ...data, type: "model", addedAt: Date.now() });
  }

  async function deleteModel(id) {
    await database.del(id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">AR Gallery</h1>
            <p className="text-xs text-gray-500">
              {models.length} model{models.length !== 1 ? "s" : ""}
            </p>
          </div>
          {!canAR && (
            <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-200">
              Open in Safari on iPhone/iPad for AR
            </div>
          )}
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <AddModelForm onAdd={addModel} />

        {models.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🔮</div>
            <p className="text-sm">Add a USDZ model to get started</p>
            <p className="text-xs mt-1">Open on iPhone or iPad to view in AR</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {models
              .sort((a, b) => b.addedAt - a.addedAt)
              .map((model) => (
                <ARModelCard key={model._id} model={model} onDelete={deleteModel} />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Common Mistakes

- **Not using `rel="ar"`** — without it, the link is a plain download
- **Non-HTTPS in production** — AR Quick Look refuses plain HTTP; `localhost` is fine for dev
- **Wrong file format** — only `.usdz` and `.reality` are supported; `.glb`, `.gltf` will not work
- **Missing user gesture** — programmatic `.click()` only works inside a synchronous user-event handler (click, tap)
- **Scaling mismatch** — USDZ files encode real-world scale (1 unit = 1 meter); verify your model's units before exporting
- **Non-Safari browsers** — Chrome/Firefox on iOS use WebKit under the hood and do support `rel="ar"`, but test on actual devices
