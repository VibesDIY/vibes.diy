import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function LiveBullets({ database, useLiveQuery, useDocument, viewer, ViewerTag }) {
  const { docs } = useLiveQuery("type", { key: "bullet" });
  const sorted = [...docs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const { doc, merge, submit } = useDocument({ type: "bullet", text: "", authorHandle: viewer?.userHandle, createdAt: Date.now() });
  function onSubmit(e) {
    e.preventDefault();
    if (!viewer || !doc.text.trim()) return;
    submit();
  }
  const c = {
    frame: "border border-[#cccccc] rounded-sm p-4 bg-white",
    heading: "text-lg font-semibold mb-3 text-[#111111]",
    muted: "text-[#666666] text-sm",
    item: "flex items-start gap-2 py-2 border-b border-[#cccccc] last:border-b-0",
    bullet: "text-[#666666] mt-1",
    input: "flex-1 border border-[#cccccc] rounded-sm px-3 py-3 min-h-[44px] bg-white text-[#111111]",
    btn: "min-h-[44px] px-4 bg-[#111111] text-white rounded-sm disabled:bg-[#cccccc]",
    delBtn: "text-xs text-[#666666] hover:text-[#111111] underline ml-2",
  };
  return (
    <section id="live-bullets" className={c.frame}>
      <h2 className={c.heading}>Live notes</h2>
      {sorted.length === 0 && <p className={c.muted}>No bullets yet — start the meeting.</p>}
      <ul>
        {sorted.map((d) => (
          <li key={d._id} className={c.item}>
            <span className={c.bullet}>•</span>
            <div className="flex-1">
              <div className="text-[#111111]">{d.text}</div>
              <div className="text-xs text-[#666666] mt-1 flex items-center gap-2">
                <ViewerTag userHandle={d.authorHandle} />
                {viewer && d.authorHandle === viewer.userHandle && (
                  <button className={c.delBtn} onClick={() => database.del(d._id)}>
                    delete
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {viewer ? (
        <form onSubmit={onSubmit} className="flex gap-2 mt-3">
          <input
            className={c.input}
            value={doc.text}
            onChange={(e) => merge({ text: e.target.value })}
            placeholder="Add a bullet point…"
          />
          <button type="submit" className={c.btn} disabled={!doc.text.trim()}>
            Add
          </button>
        </form>
      ) : (
        <p className={`${c.muted} mt-3`}>Sign in to add bullets.</p>
      )}
    </section>
  );
}

function SummaryPanel({ database, useLiveQuery, isOwner, viewer }) {
  const { docs: bullets } = useLiveQuery("type", { key: "bullet" });
  const [isLoading, setIsLoading] = React.useState(false);
  async function summarize() {
    if (bullets.length === 0) return;
    setIsLoading(true);
    try {
      const text = bullets.map((b) => "- " + b.text).join("\n");
      const response = await callAI(
        `Summarize these meeting bullet points into decisions, action items, and open questions.\n\n${text}`,
        {
          schema: {
            properties: {
              decisions: { type: "array", items: { type: "string" } },
              actionItems: { type: "array", items: { type: "string" } },
              openQuestions: { type: "array", items: { type: "string" } },
            },
          },
        }
      );
      const parsed = JSON.parse(response);
      await database.put({ type: "summary", ...parsed, createdAt: Date.now(), bulletCount: bullets.length });
    } finally {
      setIsLoading(false);
    }
  }
  const c = {
    frame: "border border-[#cccccc] rounded-sm p-4 bg-white",
    heading: "text-lg font-semibold mb-3 text-[#111111]",
    muted: "text-[#666666] text-sm",
    btn: "min-h-[44px] px-4 bg-[#111111] text-white rounded-sm disabled:bg-[#cccccc] flex items-center gap-2",
  };
  if (!isOwner) {
    return (
      <section id="summary-panel" className={c.frame}>
        <h2 className={c.heading}>Summary</h2>
        <p className={c.muted}>The organizer will publish a summary at the end of the meeting.</p>
      </section>
    );
  }
  return (
    <section id="summary-panel" className={c.frame}>
      <h2 className={c.heading}>Summary</h2>
      <p className={c.muted}>
        {bullets.length} bullet{bullets.length === 1 ? "" : "s"} ready to summarize.
      </p>
      <button className={`${c.btn} mt-3`} onClick={summarize} disabled={isLoading || bullets.length === 0}>
        {isLoading && (
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
          </svg>
        )}
        {isLoading ? "Summarizing…" : "Publish summary"}
      </button>
    </section>
  );
}

function SummaryArchive({ useLiveQuery }) {
  const { docs } = useLiveQuery("type", { key: "summary" });
  const sorted = [...docs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const c = {
    frame: "border border-[#cccccc] rounded-sm p-4 bg-white",
    heading: "text-lg font-semibold mb-3 text-[#111111]",
    muted: "text-[#666666] text-sm",
    card: "border-b border-[#cccccc] last:border-b-0 py-3",
    label: "text-xs font-semibold uppercase tracking-wider text-[#666666] mt-2 mb-1",
    item: "text-[#111111] ml-4 list-disc",
    date: "text-xs text-[#666666]",
  };
  return (
    <section id="summary-archive" className={c.frame}>
      <h2 className={c.heading}>Past summaries</h2>
      {sorted.length === 0 && <p className={c.muted}>No summaries published yet.</p>}
      {sorted.map((s) => (
        <div key={s._id} className={c.card}>
          <div className={c.date}>
            {new Date(s.createdAt).toLocaleString()} · {s.bulletCount} bullets
          </div>
          {s.decisions?.length > 0 && (
            <>
              <div className={c.label}>Decisions</div>
              <ul>
                {s.decisions.map((d, i) => (
                  <li key={i} className={c.item}>
                    {d}
                  </li>
                ))}
              </ul>
            </>
          )}
          {s.actionItems?.length > 0 && (
            <>
              <div className={c.label}>Action items</div>
              <ul>
                {s.actionItems.map((d, i) => (
                  <li key={i} className={c.item}>
                    {d}
                  </li>
                ))}
              </ul>
            </>
          )}
          {s.openQuestions?.length > 0 && (
            <>
              <div className={c.label}>Open questions</div>
              <ul>
                {s.openQuestions.map((d, i) => (
                  <li key={i} className={c.item}>
                    {d}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, useDocument, database } = useFireproof("standupStream");
  const c = {
    page: "min-h-screen bg-[#ffffff] text-[#111111] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]",
    header: "border-b border-[#cccccc] px-4 py-3 flex items-center justify-between sticky top-0 bg-[#ffffff] z-10",
    title: "text-xl font-bold tracking-tight",
    sub: "text-xs text-[#666666] uppercase tracking-wider",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-24",
  };
  if (isViewerPending) return null;
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.sub}>Meeting notes</div>
          <div className={c.title}>Standup Stream</div>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <LiveBullets
          database={database}
          useLiveQuery={useLiveQuery}
          useDocument={useDocument}
          viewer={viewer}
          ViewerTag={ViewerTag}
        />
        <SummaryPanel database={database} useLiveQuery={useLiveQuery} isOwner={isOwner} viewer={viewer} />
        <SummaryArchive useLiveQuery={useLiveQuery} />
      </main>
    </div>
  );
}
