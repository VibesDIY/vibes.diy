import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ListsBar() {
  return (
    <section id="lists" className="px-4 py-3 border-b border-[oklch(0.39_0.065_165)] overflow-x-auto">
      {/* lists chips */}
    </section>
  );
}

function BrainDump({ viewer, activeListId, database }) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  async function suggest() {
    setLoading(true);
    try {
      const r = await callAI(
        "Give one short example brain dump someone might paste to plan their day. Plain text, 2-4 sentences.",
        { schema: { properties: { example: { type: "string" } } } }
      );
      setText(JSON.parse(r).example || "");
    } finally {
      setLoading(false);
    }
  }
  async function parse() {
    if (!text.trim() || !activeListId || !viewer) return;
    setLoading(true);
    try {
      const r = await callAI(`Split this brain dump into discrete actionable tasks. Text:\n${text}`, {
        schema: {
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short imperative task title" },
                  description: { type: "string", description: "Optional detail, can be empty" },
                  priority: { type: "string", description: "low, medium, or high" },
                },
              },
            },
          },
        },
      });
      const { tasks } = JSON.parse(r);
      for (const t of tasks || []) {
        await database.put({
          type: "task",
          listId: activeListId,
          title: t.title,
          description: t.description || "",
          priority: t.priority || "medium",
          done: false,
          authorHandle: viewer.userHandle,
          createdAt: Date.now(),
        });
      }
      setText("");
    } finally {
      setLoading(false);
    }
  }
  if (!viewer)
    return (
      <section id="braindump" className="px-4 py-4 border-b border-[oklch(0.39_0.065_165)] text-sm text-[oklch(0.55_0.04_165)]">
        Sign in to add tasks.
      </section>
    );
  return (
    <section id="braindump" className="px-4 py-4 border-b border-[oklch(0.39_0.065_165)] space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dump everything on your mind. AI will split it into tasks."
        rows={4}
        className="w-full px-3 py-2 rounded-md bg-[oklch(0.27_0.055_163)] border border-[oklch(0.39_0.065_165)] text-sm placeholder:text-[oklch(0.55_0.04_165)] resize-y"
      />
      <div className="flex gap-2">
        <button
          onClick={parse}
          disabled={loading || !text.trim() || !activeListId}
          className="flex-1 min-h-[44px] rounded-md bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 3a9 9 0 1 1-9 9" />
            </svg>
          ) : null}
          {loading ? "Parsing..." : "Parse into tasks"}
        </button>
        <button
          onClick={suggest}
          disabled={loading}
          className="px-3 min-h-[44px] rounded-md border border-[oklch(0.39_0.065_165)] text-xs text-[oklch(0.55_0.04_165)]"
        >
          Example
        </button>
      </div>
    </section>
  );
}

function TaskList({ activeListId, viewer, isOwner, database, useLiveQuery }) {
  const { docs: tasks } = useLiveQuery("listId", { key: activeListId || "__none__" });
  if (!activeListId)
    return (
      <section id="tasks" className="px-4 py-4 flex-1 text-sm text-[oklch(0.55_0.04_165)]">
        Pick or create a list to see tasks.
      </section>
    );
  const sorted = [...tasks].sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1));
  const priorityColor = (p) =>
    p === "high" ? "text-[oklch(0.86_0.18_90)]" : p === "low" ? "text-[oklch(0.55_0.04_165)]" : "text-[oklch(0.95_0.01_100)]";
  return (
    <section id="tasks" className="px-4 py-4 flex-1">
      {sorted.length === 0 && <p className="text-sm text-[oklch(0.55_0.04_165)]">No tasks yet. Dump some thoughts above.</p>}
      <ul className="space-y-2">
        {sorted.map((t) => {
          const canEdit = viewer && (t.authorHandle === viewer.userHandle || isOwner);
          return (
            <li
              key={t._id}
              className={`p-3 rounded-md border border-[oklch(0.39_0.065_165)] bg-[oklch(0.27_0.055_163)] ${t.done ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => viewer && database.put({ ...t, done: !t.done })}
                  disabled={!viewer}
                  className={`mt-0.5 w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center ${t.done ? "bg-[oklch(0.86_0.18_90)] border-[oklch(0.86_0.18_90)]" : "border-[oklch(0.39_0.065_165)]"}`}
                  aria-label="toggle done"
                >
                  {t.done && (
                    <svg
                      className="w-4 h-4 text-[oklch(0.20_0.04_163)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${t.done ? "line-through" : ""}`}>{t.title}</span>
                    <span className={`text-xs uppercase tracking-wide ${priorityColor(t.priority)}`}>{t.priority}</span>
                  </div>
                  {t.description && <p className="text-sm text-[oklch(0.55_0.04_165)] mt-1">{t.description}</p>}
                </div>
                {canEdit && (
                  <button
                    onClick={() => database.del(t._id)}
                    className="text-xs text-[oklch(0.55_0.04_165)] hover:text-[oklch(0.86_0.18_90)] min-h-[44px] px-2"
                    aria-label="delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("taskparse");
  const { docs: lists } = useLiveQuery("type", { key: "list" });
  const [activeListId, setActiveListId] = React.useState(null);
  React.useEffect(() => {
    if (!activeListId && lists.length) setActiveListId(lists[0]._id);
  }, [lists, activeListId]);

  const c = {
    page: "min-h-screen bg-[oklch(0.22_0.05_163)] text-[oklch(0.95_0.01_100)] font-['Space_Grotesk',sans-serif] flex flex-col",
    header:
      "px-4 py-3 border-b border-[oklch(0.39_0.065_165)] flex items-center justify-between sticky top-0 bg-[oklch(0.22_0.05_163)] z-10",
    title: "text-xl font-semibold tracking-tight",
    main: "flex-1 flex flex-col",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>TaskParse</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <ListsBar
          lists={lists}
          activeListId={activeListId}
          setActiveListId={setActiveListId}
          isOwner={isOwner}
          database={database}
        />
        <BrainDump viewer={viewer} activeListId={activeListId} database={database} />
        <TaskList activeListId={activeListId} viewer={viewer} isOwner={isOwner} database={database} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  );
}
