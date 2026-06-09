import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header id="app-header" className={`${c.headerBg} border-b ${c.separator} px-4 py-5 sticky top-0 z-10`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`${c.text} text-2xl font-bold tracking-tight`}>Sync Windows</h1>
          <p className={`${c.textDim} text-xs mt-0.5`}>Find when two schedules align</p>
        </div>
        <ViewerTag />
      </div>
    </header>
  );
}

function ScheduleInputs({ c, isOwner, draftA, draftB, setDraftA, setDraftB, saveSlot }) {
  if (!isOwner) {
    return (
      <section id="schedule-inputs" className="px-4 pt-5 space-y-3">
        <h2 className={`${c.textDim} text-xs uppercase tracking-widest mb-3`}>Schedules</h2>
        <div className={`${c.card} p-3`}>
          <div className={`${c.accentText} text-xs font-bold mb-1`}>Person A</div>
          <p className={`${c.textBody} text-sm whitespace-pre-wrap`}>{draftA || "No schedule yet."}</p>
        </div>
        <div className={`${c.card} p-3`}>
          <div className={`${c.accentText} text-xs font-bold mb-1`}>Person B</div>
          <p className={`${c.textBody} text-sm whitespace-pre-wrap`}>{draftB || "No schedule yet."}</p>
        </div>
      </section>
    );
  }
  return (
    <section id="schedule-inputs" className="px-4 pt-5 space-y-3">
      <h2 className={`${c.textDim} text-xs uppercase tracking-widest mb-3`}>Paste availability</h2>
      <div>
        <label className={`${c.accentText} text-xs font-bold block mb-1`}>Person A</label>
        <textarea
          className={c.input}
          placeholder="e.g. Mon-Wed 9-5, Thu free after 2pm, Fri busy all day"
          value={draftA}
          onChange={(e) => setDraftA(e.target.value)}
          onBlur={() => saveSlot("A", draftA)}
        />
      </div>
      <div>
        <label className={`${c.accentText} text-xs font-bold block mb-1`}>Person B</label>
        <textarea
          className={c.input}
          placeholder="e.g. Tue/Thu 10-4, Wed afternoons, weekends open"
          value={draftB}
          onChange={(e) => setDraftB(e.target.value)}
          onBlur={() => saveSlot("B", draftB)}
        />
      </div>
    </section>
  );
}

function FindButton({ c, isOwner, draftA, draftB, database }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);
  if (!isOwner) return null;
  async function findOverlaps() {
    if (!draftA.trim() || !draftB.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Two people's availability:\nPerson A: ${draftA}\nPerson B: ${draftB}\n\nExtract their free times, compute overlapping windows when BOTH are free, and rank top 5 by duration and convenience. For each window give a day label, time range, duration in minutes, and a short fit note.`;
      const res = await callAI(prompt, {
        schema: {
          properties: {
            overlaps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  timeRange: { type: "string" },
                  durationMinutes: { type: "number" },
                  fitNote: { type: "string" },
                },
              },
            },
            summary: { type: "string" },
          },
        },
      });
      const parsed = JSON.parse(res);
      await database.put({
        type: "result",
        overlaps: parsed.overlaps || [],
        summary: parsed.summary || "",
        scheduleA: draftA,
        scheduleB: draftB,
        createdAt: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }
  async function suggestExamples() {
    setSuggesting(true);
    try {
      const res = await callAI("Generate two realistic example availability blurbs for two coworkers trying to meet.", {
        schema: { properties: { a: { type: "string" }, b: { type: "string" } } },
      });
      const parsed = JSON.parse(res);
      await database.put({ type: "schedule", slot: "A", text: parsed.a });
      await database.put({ type: "schedule", slot: "B", text: parsed.b });
    } finally {
      setSuggesting(false);
    }
  }
  return (
    <section id="find-button" className="px-4 py-4 space-y-2 sticky bottom-0 bg-black/95 backdrop-blur border-t border-white/10">
      <button
        onClick={findOverlaps}
        disabled={isLoading || !draftA.trim() || !draftB.trim()}
        className={`${c.accent} w-full min-h-[52px] rounded-xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2`}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>Finding overlaps…</span>
          </>
        ) : (
          "Find overlapping times"
        )}
      </button>
      <button
        onClick={suggestExamples}
        disabled={suggesting}
        className={`w-full text-xs ${c.textDim} underline disabled:opacity-40 py-2`}
      >
        {suggesting ? "Loading example…" : "Try with example schedules"}
      </button>
    </section>
  );
}

function ResultsFeed({ c, isOwner, database }) {
  const { useLiveQuery } = useFireproof("syncWindows");
  const { docs: results } = useLiveQuery("type", { key: "result", descending: true });
  const sorted = [...results].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <section id="results-feed" className="px-4 pt-2 pb-8">
      <h2 className={`${c.textDim} text-xs uppercase tracking-widest mb-3`}>Overlap results ({sorted.length})</h2>
      {sorted.length === 0 && (
        <p className={`${c.textDim} text-sm italic`}>
          No analyses yet. {isOwner ? "Paste schedules above and tap the button." : "Waiting for the owner to run an analysis."}
        </p>
      )}
      <ul className="space-y-3">
        {sorted.map((r) => (
          <li key={r._id} className={`${c.card} p-4`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className={`${c.textDim} text-xs`}>{new Date(r.createdAt).toLocaleString()}</span>
              {isOwner && (
                <button onClick={() => database.del(r._id)} className={`${c.textDim} hover:text-white`} aria-label="Delete">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              )}
            </div>
            {r.summary && <p className={`${c.textBody} text-sm mb-3`}>{r.summary}</p>}
            <ol className="space-y-2">
              {(r.overlaps || []).map((o, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className={`${c.accent} rounded-md px-2 py-0.5 text-xs font-bold flex-shrink-0`}>#{i + 1}</span>
                  <div className="flex-1">
                    <div className={`${c.text} text-sm font-semibold`}>
                      {o.day} · {o.timeRange}
                    </div>
                    <div className={`${c.textDim} text-xs`}>
                      {o.durationMinutes} min{o.fitNote ? ` — ${o.fitNote}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("syncWindows");
  const { docs: schedules } = useLiveQuery("type", { key: "schedule" });
  const scheduleA = schedules.find((d) => d.slot === "A");
  const scheduleB = schedules.find((d) => d.slot === "B");
  const [draftA, setDraftA] = React.useState("");
  const [draftB, setDraftB] = React.useState("");
  React.useEffect(() => {
    if (scheduleA) setDraftA(scheduleA.text);
  }, [scheduleA?._id]);
  React.useEffect(() => {
    if (scheduleB) setDraftB(scheduleB.text);
  }, [scheduleB?._id]);
  async function saveSlot(slot, text) {
    const existing = slot === "A" ? scheduleA : scheduleB;
    if (existing) await database.put({ ...existing, text });
    else await database.put({ type: "schedule", slot, text });
  }

  const c = {
    page: "bg-black min-h-screen font-[Helvetica_Neue,Helvetica,Arial,sans-serif]",
    headerBg: "bg-black/90 backdrop-blur",
    text: "text-white",
    textBody: "text-[#dddddd]",
    textDim: "text-[#888888]",
    separator: "border-[#666666]/40",
    outline: "border-white/30",
    card: "bg-white/5 border border-white/10 rounded-xl",
    accent: "bg-[#D4FF00] text-black",
    accentText: "text-[#D4FF00]",
    input: "bg-black border border-white/30 text-white placeholder-[#666666] rounded-lg p-3 w-full min-h-[140px]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app" className="max-w-2xl mx-auto">
        <ScheduleInputs
          c={c}
          isOwner={isOwner}
          draftA={draftA}
          draftB={draftB}
          setDraftA={setDraftA}
          setDraftB={setDraftB}
          saveSlot={saveSlot}
        />
        <FindButton c={c} isOwner={isOwner} draftA={draftA} draftB={draftB} database={database} />
        <ResultsFeed c={c} isOwner={isOwner} database={database} />
      </main>
    </div>
  );
}
