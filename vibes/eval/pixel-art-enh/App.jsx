import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";
import { callAI } from "call-ai";

const GRID = 16;
const DEFAULT_PALETTE = [
  "oklch(0.55 0.24 28)",
  "oklch(0.85 0.18 85)",
  "oklch(0.62 0.19 145)",
  "oklch(0.52 0.18 255)",
  "oklch(0.15 0.02 280)",
  "oklch(1 0 0)",
];

function CanvasArea() {
  return (
    <section
      id="canvas"
      className="bg-[oklch(1_0_0)] border-2 border-[oklch(0.15_0.02_280)] rounded p-3 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-sm uppercase tracking-wide mb-2 text-[oklch(0.15_0.02_280)]">Canvas</h2>
      {/* grid renders here */}
    </section>
  );
}

function PaletteBar({ usedColors, color, setColor, viewer, database }) {
  const [suggestions, setSuggestions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const swatches = Array.from(new Set([...DEFAULT_PALETTE, ...usedColors, ...suggestions]));

  const suggest = async () => {
    setLoading(true);
    try {
      const prompt = `Suggest 5 complementary OKLCH colors that pair well with these existing colors: ${usedColors.join(", ") || "none yet"}. Return only OKLCH strings like "oklch(0.6 0.2 100)".`;
      const raw = await callAI(prompt, { schema: { properties: { colors: { type: "array", items: { type: "string" } } } } });
      const parsed = JSON.parse(raw);
      setSuggestions(parsed.colors || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="palette"
      className="bg-[oklch(0.85_0.18_85)] border-2 border-[oklch(0.15_0.02_280)] rounded p-3 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm uppercase tracking-wide text-[oklch(0.15_0.02_280)]">Palette</h2>
        <button
          onClick={suggest}
          disabled={loading || !viewer}
          className="text-xs font-bold uppercase bg-[oklch(0.15_0.02_280)] text-[oklch(1_0_0)] px-2 py-1 rounded border-2 border-[oklch(0.15_0.02_280)] disabled:opacity-50 inline-flex items-center gap-1 min-h-[32px]"
        >
          {loading ? (
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          AI suggest
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-9 h-9 rounded border-2 touch-manipulation ${color === c ? "border-[oklch(0.15_0.02_280)] ring-2 ring-[oklch(0.15_0.02_280)]" : "border-[oklch(0.15_0.02_280)]"}`}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>
    </section>
  );
}

function LayersPanel({ painters, hiddenLayers, setHiddenLayers, ViewerTag, viewer, database, pixels }) {
  const toggle = (handle) => setHiddenLayers((h) => ({ ...h, [handle]: !h[handle] }));
  const clearMine = async () => {
    if (!viewer) return;
    const mine = pixels.filter((p) => p.authorHandle === viewer.userHandle);
    for (const p of mine) await database.del(p._id);
  };
  return (
    <section
      id="layers"
      className="bg-[oklch(0.62_0.19_145)] border-2 border-[oklch(0.15_0.02_280)] rounded p-3 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-sm uppercase tracking-wide mb-2 text-[oklch(1_0_0)]">Layers</h2>
      {painters.length === 0 && <p className="text-xs text-[oklch(1_0_0)]">No painters yet — tap the canvas to start.</p>}
      <ul className="space-y-2">
        {painters.map((handle) => (
          <li
            key={handle}
            className="flex items-center justify-between bg-[oklch(1_0_0)] border-2 border-[oklch(0.15_0.02_280)] rounded px-2 py-2 min-h-[44px]"
          >
            <ViewerTag userHandle={handle} />
            <button
              onClick={() => toggle(handle)}
              className="text-xs font-bold uppercase bg-[oklch(0.15_0.02_280)] text-[oklch(1_0_0)] px-2 py-1 rounded min-h-[32px]"
            >
              {hiddenLayers[handle] ? "Show" : "Hide"}
            </button>
          </li>
        ))}
      </ul>
      {viewer && (
        <button
          onClick={clearMine}
          className="mt-3 w-full text-xs font-bold uppercase bg-[oklch(0.55_0.24_28)] text-[oklch(1_0_0)] px-3 py-2 rounded border-2 border-[oklch(0.15_0.02_280)] min-h-[44px]"
        >
          Clear my layer
        </button>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  if (isViewerPending) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=optional');
        :root { --bg: oklch(0.96 0.01 90); --text: oklch(0.15 0.02 280); }
        body { font-family: 'Space Grotesk', sans-serif; background: var(--bg); color: var(--text); }
      `}</style>
      <main id="app" className="min-h-screen bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)] pb-24">
        <header
          id="app-header"
          className="sticky top-0 z-10 bg-[oklch(0.55_0.24_28)] border-b-2 border-[oklch(0.15_0.02_280)] px-4 py-3 flex items-center justify-between shadow-[0_4px_0_oklch(0.15_0.02_280)]"
        >
          <h1 className="text-xl font-bold text-[oklch(1_0_0)] tracking-tight">PixelStack</h1>
          <ViewerTag />
        </header>
        <div className="max-w-md mx-auto p-4 space-y-4">
          <CanvasArea pixels={pixels} hiddenLayers={hiddenLayers} viewer={viewer} color={color} database={database} />
          <PaletteBar usedColors={usedColors} color={color} setColor={setColor} viewer={viewer} database={database} />
          <LayersPanel
            painters={painters}
            hiddenLayers={hiddenLayers}
            setHiddenLayers={setHiddenLayers}
            ViewerTag={ViewerTag}
            viewer={viewer}
            database={database}
            pixels={pixels}
          />
        </div>
      </main>
    </>
  );
}
