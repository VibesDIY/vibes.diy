import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const SIZE = 16;
const DEFAULT_PALETTE = ["#1a1822", "#e23636", "#f5d547", "#3fa34d", "#3f7fa3", "#f5f3ec"];

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("pixelforge");
  const { docs: pixelDocs } = useLiveQuery("type", { key: "pixel" });
  const { docs: paletteDocs } = useLiveQuery("type", { key: "palette-color" });
  const [activeColor, setActiveColor] = React.useState(DEFAULT_PALETTE[1]);
  const [isDragging, setIsDragging] = React.useState(false);

  const pixelMap = React.useMemo(() => {
    const m = {};
    for (const p of pixelDocs) m[p._id] = p.color;
    return m;
  }, [pixelDocs]);

  const palette = paletteDocs.length > 0 ? paletteDocs.map((d) => d.color) : DEFAULT_PALETTE;

  const paintCell = (r, col) => {
    if (!viewer) return;
    const id = `px:${r}:${col}`;
    database.put({ _id: id, type: "pixel", color: activeColor, row: r, col });
  };

  const c = {
    page: "min-h-screen bg-[#f5f3ec] text-[#1a1822] font-sans",
    header: "sticky top-0 z-10 bg-[#1a1822] text-[#f5f3ec] border-b-4 border-[#1a1822] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto p-4 space-y-4",
    section: "bg-white border-2 border-[#1a1822] rounded p-4",
    sectionTitle: "text-sm font-bold uppercase tracking-wide mb-3 text-[#1a1822]",
    btn: "min-h-[44px] px-4 py-2 bg-[#e23636] text-white font-semibold rounded border-2 border-[#1a1822] hover:bg-[#c52a2a] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-2 bg-white text-[#1a1822] font-semibold rounded border-2 border-[#1a1822] hover:bg-[#f5f3ec]",
    muted: "text-sm text-[#6b6878]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>PixelForge</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <section id="canvas" className={c.section}>
          <h2 className={c.sectionTitle}>Canvas</h2>
          <div
            className="grid select-none touch-none mx-auto border-2 border-[#1a1822]"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, width: "min(100%, 384px)", aspectRatio: "1 / 1" }}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchEnd={() => setIsDragging(false)}
          >
            {Array.from({ length: SIZE * SIZE }).map((_, i) => {
              const r = Math.floor(i / SIZE);
              const col = i % SIZE;
              const id = `px:${r}:${col}`;
              const fill = pixelMap[id] || "#ffffff";
              return (
                <div
                  key={id}
                  onMouseDown={() => paintCell(r, col)}
                  onMouseEnter={() => isDragging && paintCell(r, col)}
                  onTouchStart={() => paintCell(r, col)}
                  style={{ backgroundColor: fill }}
                  className="border border-[#e5e3dc] cursor-pointer"
                />
              );
            })}
          </div>
          {!viewer && <p className={c.muted + " mt-3"}>Sign in to paint.</p>}
        </section>
        <section id="palette" className={c.section}>
          <h2 className={c.sectionTitle}>Palette</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {palette.map((col) => (
              <button
                key={col}
                onClick={() => setActiveColor(col)}
                className={`w-11 h-11 rounded border-2 ${activeColor === col ? "border-[#e23636] ring-2 ring-[#e23636]" : "border-[#1a1822]"}`}
                style={{ backgroundColor: col }}
                aria-label={`Select ${col}`}
              />
            ))}
          </div>
          {isOwner && (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="color"
                onChange={(e) => database.put({ type: "palette-color", color: e.target.value })}
                className="w-11 h-11 cursor-pointer border-2 border-[#1a1822] rounded"
                aria-label="Add color to palette"
              />
              <span className={c.muted}>Add color</span>
              {paletteDocs.length > 0 && (
                <button className={c.btnGhost} onClick={() => paletteDocs.forEach((d) => database.del(d._id))}>
                  Reset palette
                </button>
              )}
            </div>
          )}
        </section>
        <section id="actions" className={c.section}>
          <h2 className={c.sectionTitle}>Actions</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              className={c.btn}
              onClick={() => {
                const scale = 16;
                const cv = document.createElement("canvas");
                cv.width = SIZE * scale;
                cv.height = SIZE * scale;
                const ctx = cv.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, cv.width, cv.height);
                for (let r = 0; r < SIZE; r++) {
                  for (let col = 0; col < SIZE; col++) {
                    const fill = pixelMap[`px:${r}:${col}`];
                    if (fill) {
                      ctx.fillStyle = fill;
                      ctx.fillRect(col * scale, r * scale, scale, scale);
                    }
                  }
                }
                const link = document.createElement("a");
                link.download = `pixelforge-${Date.now()}.png`;
                link.href = cv.toDataURL("image/png");
                link.click();
              }}
            >
              Export PNG
            </button>
            {isOwner && (
              <button
                className={c.btnGhost}
                onClick={() => {
                  if (confirm("Clear all pixels?")) {
                    pixelDocs.forEach((d) => database.del(d._id));
                  }
                }}
              >
                Clear canvas
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
