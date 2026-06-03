import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Composer({ database, viewer }) {
  const [text, setText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function save() {
    if (!text.trim() || !viewer) return;
    setIsLoading(true);
    try {
      const raw = await callAI(`Analyze this journal entry and respond with structured JSON.\n\nEntry: ${text}`, {
        schema: {
          properties: {
            mood: { type: "string", description: "single-word mood tag" },
            summary: { type: "string", description: "one-sentence summary" },
            keywords: { type: "array", items: { type: "string" }, description: "3-5 topical keywords" },
          },
        },
      });
      const tags = JSON.parse(raw);
      await database.put({
        type: "entry",
        text: text.trim(),
        mood: tags.mood,
        summary: tags.summary,
        keywords: tags.keywords || [],
        shared: false,
        createdAt: Date.now(),
        authorHandle: viewer.userHandle,
      });
      setText("");
    } finally {
      setIsLoading(false);
    }
  }

  async function suggest() {
    setIsLoading(true);
    try {
      const raw = await callAI("Write a short, evocative journal entry (2-3 sentences) as inspiration.", {
        schema: { properties: { entry: { type: "string" } } },
      });
      setText(JSON.parse(raw).entry || "");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section id="composer" className="border border-[color:var(--border)] rounded-lg p-4 bg-black/20">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          New entry
        </h2>
        <button onClick={suggest} disabled={isLoading} className="text-xs italic opacity-70 hover:opacity-100 underline">
          inspire me
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Today…"
        rows={5}
        className="w-full bg-transparent border border-[color:var(--border)] rounded p-3 text-lg leading-relaxed focus:outline-none focus:border-[color:var(--fg)]"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      />
      <button
        onClick={save}
        disabled={isLoading || !text.trim()}
        className="mt-3 w-full min-h-[44px] py-3 px-4 rounded border border-[color:var(--fg)] text-[color:var(--fg)] hover:bg-[color:var(--fg)] hover:text-[color:var(--bg)] transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
          </svg>
        ) : null}
        <span style={{ fontFamily: "'Cormorant Garamond', serif" }}>{isLoading ? "Tagging…" : "Save entry"}</span>
      </button>
    </section>
  );
}

function EntryList({ docs, database }) {
  const entries = docs.filter((d) => d.type === "entry");
  return (
    <section id="entries" className="border border-[color:var(--border)] rounded-lg p-4 bg-black/10">
      <h2 className="text-2xl mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
        Journal
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm italic opacity-60">Your entries will appear here.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e._id} className="border-b border-[color:var(--border)] pb-4 last:border-0">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm opacity-70">
                  {new Date(e.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </span>
                {e.mood && <span className="text-xs italic uppercase tracking-wider opacity-80">{e.mood}</span>}
              </div>
              {e.summary && <p className="text-sm italic opacity-80 mb-2">{e.summary}</p>}
              <p className="text-lg leading-relaxed mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {e.text}
              </p>
              {e.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {e.keywords.map((k) => (
                    <span key={k} className="text-xs px-2 py-0.5 border border-[color:var(--border)] rounded-full opacity-70">
                      {k}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => database.put({ ...e, shared: !e.shared })}
                  className="text-xs min-h-[36px] px-3 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)]"
                >
                  {e.shared ? "● Shared — make private" : "○ Share this entry"}
                </button>
                <button
                  onClick={() => database.del(e._id)}
                  className="text-xs min-h-[36px] px-3 rounded border border-[color:var(--border)] hover:border-[color:var(--fg)] opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SharedView({ docs }) {
  const shared = docs.filter((d) => d.type === "entry" && d.shared);
  return (
    <section id="shared" className="border border-[color:var(--border)] rounded-lg p-4 bg-black/10">
      <h2 className="text-2xl mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
        Shared entries
      </h2>
      {shared.length === 0 ? (
        <p className="text-sm italic opacity-60">Nothing has been shared with you yet.</p>
      ) : (
        <ul className="space-y-5">
          {shared.map((e) => (
            <li key={e._id} className="border-b border-[color:var(--border)] pb-4 last:border-0">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm opacity-70">
                  {new Date(e.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </span>
                {e.mood && <span className="text-xs italic uppercase tracking-wider opacity-80">{e.mood}</span>}
              </div>
              {e.summary && <p className="text-sm italic opacity-80 mb-2">{e.summary}</p>}
              <p className="text-lg leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {e.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database, access } = useFireproof("palateNotes");
  const sharedQuery = useLiveQuery("shared", { key: true, descending: true });
  const allQuery = useLiveQuery("createdAt", { descending: true });

  const c = {
    page: "min-h-screen bg-[#0a0a0d] text-[#e8e6f0]",
    wrap: "max-w-2xl mx-auto px-4 py-6 space-y-5",
    header: "flex items-center justify-between pb-4 border-b border-[color:var(--border)]",
    title: "text-3xl tracking-wide",
    muted: "text-sm opacity-70",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=optional');
        :root {
          --bg: oklch(0.17 0 0);
          --fg: oklch(0.93 0.006 265);
          --muted: oklch(0.71 0.02 261);
          --border: oklch(0.37 0.03 260);
        }
        body, #app { font-family: 'Cormorant Garamond', serif; background: var(--bg); color: var(--fg); }
      `}</style>
      <main id="app" className={c.page}>
        <div className={c.wrap}>
          <header id="app-header" className={c.header}>
            <h1 className={c.title} style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Palate Notes
            </h1>
            <ViewerTag />
          </header>
          {isOwner ? (
            <>
              <Composer database={database} viewer={viewer} />
              <EntryList docs={allQuery.docs} database={database} />
            </>
          ) : (
            <SharedView docs={sharedQuery.docs} />
          )}
          {!viewer && <p className={c.muted}>Sign in to begin your journal.</p>}
        </div>
      </main>
    </>
  );
}
