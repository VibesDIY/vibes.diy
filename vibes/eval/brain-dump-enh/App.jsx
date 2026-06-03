import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg: oklch(0.22 0.05 163);
        --card-bg: oklch(0.27 0.055 163);
        --text: oklch(0.95 0.01 100);
        --border: oklch(0.39 0.065 165);
        --accent: oklch(0.86 0.18 90);
        --accent-text: oklch(0.20 0.04 163);
        --muted: oklch(0.55 0.04 165);
      }
      body { font-family: 'Space Grotesk', sans-serif; }
    `}</style>
  );
}

function DumpComposer() {
  return (
    <section id="composer" className="bg-[oklch(0.27_0.055_163)] border border-[oklch(0.39_0.065_165)] rounded-2xl p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2 text-[oklch(0.95_0.01_100)]">Dump your brain</h2>
      <p className="text-sm text-[oklch(0.55_0.04_165)]">Composer lands here.</p>
    </section>
  );
}

const priorityStyle = {
  high: "bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)]",
  medium: "bg-[oklch(0.39_0.065_165)] text-[oklch(0.95_0.01_100)]",
  low: "bg-[oklch(0.27_0.055_163)] text-[oklch(0.55_0.04_165)] border border-[oklch(0.39_0.065_165)]",
};

function DumpsFeed({ dumps, database, viewer, isOwner, ViewerTag }) {
  const visible = dumps.filter((d) => d.type === "dump" && (d.shared || (viewer && d.createdBy === viewer.userHandle)));

  if (visible.length === 0) {
    return (
      <section id="feed" className="space-y-3">
        <h2 className="text-lg font-semibold">Your dumps</h2>
        <p className="text-sm text-[oklch(0.55_0.04_165)]">No dumps yet. Sort something above.</p>
      </section>
    );
  }

  return (
    <section id="feed" className="space-y-3">
      <h2 className="text-lg font-semibold">Your dumps</h2>
      <ul className="space-y-3">
        {visible.map((d) => {
          const mine = viewer && d.createdBy === viewer.userHandle;
          return (
            <li key={d._id} className="bg-[oklch(0.27_0.055_163)] border border-[oklch(0.39_0.065_165)] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{d.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[oklch(0.55_0.04_165)]">
                    <ViewerTag userHandle={d.createdBy} />
                    {d.shared && (
                      <span className="px-2 py-0.5 rounded-full bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold">
                        shared
                      </span>
                    )}
                    {!d.shared && <span>private</span>}
                  </div>
                </div>
                {mine && isOwner && (
                  <button
                    onClick={() => database.put({ ...d, shared: !d.shared })}
                    className="text-xs px-3 py-2 rounded-full border border-[oklch(0.39_0.065_165)] min-h-[44px]"
                  >
                    {d.shared ? "Make private" : "Share"}
                  </button>
                )}
              </div>
              <div className="space-y-3 mt-3">
                {(d.categories || []).map((cat, i) => (
                  <div key={i}>
                    <h4 className="text-xs uppercase tracking-wider text-[oklch(0.55_0.04_165)] mb-1">{cat.name}</h4>
                    <ul className="space-y-1">
                      {(cat.tasks || []).map((t, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 mt-0.5 ${priorityStyle[t.priority] || priorityStyle.low}`}
                          >
                            {t.priority || "low"}
                          </span>
                          <span className="flex-1">{t.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {mine && (
                <button
                  onClick={() => database.del(d._id)}
                  className="mt-3 text-xs text-[oklch(0.55_0.04_165)] hover:text-[oklch(0.95_0.01_100)]"
                >
                  Delete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("mindsort");
  const { docs: dumps } = useLiveQuery("createdAt", { descending: true });

  const c = {
    page: "min-h-screen bg-[oklch(0.22_0.05_163)] text-[oklch(0.95_0.01_100)]",
    header:
      "sticky top-0 z-10 bg-[oklch(0.22_0.05_163)]/95 backdrop-blur border-b border-[oklch(0.39_0.065_165)] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto px-4 py-4 pb-24",
  };

  if (isViewerPending)
    return (
      <div className={c.page}>
        <ThemeStyles />
      </div>
    );

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>MindSort</h1>
        <ViewerTag />
      </header>
      <main id="app">
        <div className={c.main}>
          <DumpComposer database={database} viewer={viewer} />
          <DumpsFeed dumps={dumps} database={database} viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} />
        </div>
      </main>
    </div>
  );
}
