import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

function ColumnSection({ col, isOwner, viewer }) {
  const c = {
    section:
      "flex-1 min-w-[260px] md:min-w-0 bg-[oklch(0.27_0.055_163)] border border-[oklch(0.39_0.065_165)] rounded-2xl p-3 flex flex-col gap-3",
    header: "flex items-center justify-between px-1",
    title: "text-[oklch(0.95_0.01_100)] font-semibold tracking-tight text-lg",
    count: "text-xs font-mono text-[oklch(0.55_0.04_165)] bg-[oklch(0.22_0.05_163)] px-2 py-1 rounded-full",
    list: "flex flex-col gap-2 min-h-[120px]",
    addBtn:
      "min-h-[44px] mt-auto w-full bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold rounded-xl active:scale-[0.98] transition",
    empty: "text-[oklch(0.55_0.04_165)] text-sm italic text-center py-6",
  };
  return (
    <section id={`col-${col.id}`} className={c.section} data-col={col.id}>
      <div className={c.header}>
        <h2 className={c.title}>{col.label}</h2>
        <span className={c.count}>0</span>
      </div>
      <ul className={c.list}>
        <li className={c.empty}>No cards yet</li>
      </ul>
      {isOwner && <button className={c.addBtn}>+ New</button>}
    </section>
  );
}

function NewCardSheet() {
  // Placeholder — modal sheet for creating cards with AI suggest
  return null;
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("flowboard");
  const { docs: cards } = useLiveQuery("type", { key: "card" });
  const [draggingId, setDraggingId] = React.useState(null);
  const [sheetCol, setSheetCol] = React.useState(null);

  const c = {
    page: "min-h-screen bg-[oklch(0.22_0.05_163)] text-[oklch(0.95_0.01_100)] font-sans",
    header:
      "sticky top-0 z-10 bg-[oklch(0.22_0.05_163)]/95 backdrop-blur border-b border-[oklch(0.39_0.065_165)] px-4 py-3 flex items-center justify-between",
    brand: "flex flex-col",
    title: "text-xl font-bold tracking-tight",
    subtitle: "text-xs font-mono text-[oklch(0.55_0.04_165)]",
    main: "p-3 md:p-6",
    board: "flex gap-3 md:gap-4 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 pb-4 snap-x snap-mandatory",
    col: "snap-center",
    pending: "p-8 text-center text-[oklch(0.55_0.04_165)]",
  };

  if (isViewerPending)
    return (
      <div className={c.page}>
        <div className={c.pending}>Loading…</div>
      </div>
    );

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <span className={c.title}>FlowBoard</span>
          <span className={c.subtitle}>{isOwner ? "owner view" : viewer ? "viewer" : "spectator"}</span>
        </div>
        <ViewerTag />
      </header>
      <div className={c.main}>
        <div className={c.board}>
          {COLUMNS.map((col) => (
            <div key={col.id} className={c.col}>
              <ColumnSection
                col={col}
                isOwner={isOwner}
                cards={cards.filter((x) => (x.column || "todo") === col.id)}
                database={database}
                onAdd={(id) => setSheetCol(id)}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
              />
            </div>
          ))}
        </div>
        <NewCardSheet open={!!sheetCol} column={sheetCol} onClose={() => setSheetCol(null)} database={database} />
      </div>
    </main>
  );
}
