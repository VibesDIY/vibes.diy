import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function DumpPad() {
  const { database } = useFireproof("brainDump");
  const [text, setText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function sort() {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const dumpId = (await database.put({ type: "dump", text, createdAt: Date.now() })).id;
      const raw = await callAI(`Sort these messy thoughts into 2-5 titled task groups. Thoughts:\n\n${text}`, {
        schema: {
          properties: {
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  tasks: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      });
      const { groups } = JSON.parse(raw);
      for (const g of groups) {
        await database.put({ type: "list", title: g.title, tasks: g.tasks, shared: false, dumpId, createdAt: Date.now() });
      }
      setText("");
    } finally {
      setIsLoading(false);
    }
  }

  async function suggest() {
    setIsLoading(true);
    try {
      const raw = await callAI(
        "Generate a realistic messy brain dump of 6-10 mixed thoughts spanning work, errands, and ideas. Plain text, line breaks ok.",
        {
          schema: { properties: { dump: { type: "string" } } },
        }
      );
      setText(JSON.parse(raw).dump);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dump every thought, task, idea, worry…"
        rows={6}
        className="w-full bg-[oklch(0.22_0.05_163)] border border-[oklch(0.39_0.065_165)] rounded-lg p-3 text-[oklch(0.95_0.01_100)] placeholder:text-[oklch(0.55_0.04_165)] focus:outline-none focus:border-[oklch(0.86_0.18_90)]"
      />
      <div className="flex gap-2">
        <button
          onClick={sort}
          disabled={isLoading || !text.trim()}
          className="flex-1 bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold rounded-lg min-h-[44px] px-4 active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            "Sort it"
          )}
        </button>
        <button
          onClick={suggest}
          disabled={isLoading}
          className="bg-transparent border border-[oklch(0.39_0.065_165)] text-[oklch(0.95_0.01_100)] rounded-lg min-h-[44px] px-3 active:opacity-80 disabled:opacity-50 text-sm"
        >
          Example
        </button>
      </div>
    </div>
  );
}

function SortedLists() {
  const { useLiveQuery, database } = useFireproof("brainDump");
  const { isOwner } = useViewer();
  const { docs: allLists } = useLiveQuery("type", { key: "list", descending: true });
  const lists = isOwner ? allLists : allLists.filter((l) => l.shared);

  if (lists.length === 0) {
    return (
      <p className="text-sm text-[oklch(0.55_0.04_165)] italic py-6 text-center">
        {isOwner ? "Dump some thoughts and sort to see lists here." : "No shared lists yet."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {lists.map((list) => (
        <li key={list._id} className="bg-[oklch(0.22_0.05_163)] border border-[oklch(0.39_0.065_165)] rounded-lg p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-[oklch(0.95_0.01_100)]">{list.title}</h3>
            {isOwner && (
              <button
                onClick={() => database.put({ ...list, shared: !list.shared })}
                className={`text-xs font-semibold rounded-md px-2 py-1 min-h-[28px] ${list.shared ? "bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)]" : "bg-transparent border border-[oklch(0.39_0.065_165)] text-[oklch(0.55_0.04_165)]"}`}
              >
                {list.shared ? "Shared" : "Private"}
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {list.tasks.map((t, i) => (
              <li key={i} className="text-sm text-[oklch(0.95_0.01_100)] flex gap-2">
                <span className="text-[oklch(0.86_0.18_90)] mt-0.5">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {isOwner && (
            <button onClick={() => database.del(list._id)} className="text-xs text-[oklch(0.55_0.04_165)] mt-2 active:opacity-60">
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-[oklch(0.22_0.05_163)] text-[oklch(0.95_0.01_100)] font-['Space_Grotesk',sans-serif]",
    header:
      "sticky top-0 z-10 bg-[oklch(0.22_0.05_163)]/95 backdrop-blur border-b border-[oklch(0.39_0.065_165)] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    subtitle: "text-xs text-[oklch(0.55_0.04_165)] mt-0.5",
    main: "px-4 py-4 pb-24 max-w-3xl mx-auto space-y-4",
    section: "bg-[oklch(0.27_0.055_163)] border border-[oklch(0.39_0.065_165)] rounded-xl p-4",
    sectionTitle: "text-sm font-semibold uppercase tracking-wider text-[oklch(0.55_0.04_165)] mb-3",
    empty: "text-sm text-[oklch(0.55_0.04_165)] italic py-6 text-center",
    accent: "bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold rounded-lg min-h-[44px] px-4 active:opacity-80",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Brain Dump Sorter</h1>
          <p className={c.subtitle}>{isOwner ? "your workspace" : "team view"}</p>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {isOwner && (
          <section id="dump-pad" className={c.section}>
            <h2 className={c.sectionTitle}>Brain Dump</h2>
            <DumpPad />
          </section>
        )}
        <section id="sorted-lists" className={c.section}>
          <h2 className={c.sectionTitle}>{isOwner ? "Your Sorted Lists" : "Shared Lists"}</h2>
          <SortedLists />
        </section>
      </main>
    </div>
  );
}
