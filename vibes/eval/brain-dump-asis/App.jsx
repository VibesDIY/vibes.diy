import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ListPicker() {
  return (
    <section id="list-picker" className="px-4 py-3 border-b-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.92_0.01_90)]">
      <h2 className="font-mono text-xs uppercase tracking-widest mb-2 text-[oklch(0.40_0.01_0)]">Lists</h2>
      {/* horizontal scrolling list chips land here */}
      <div className="text-sm text-[oklch(0.40_0.01_0)] italic">Loading lists…</div>
    </section>
  );
}

function BrainDump({ viewer, activeListId, database }) {
  const [text, setText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function parseTasks() {
    if (!text.trim() || !activeListId || !viewer) return;
    setIsLoading(true);
    try {
      const response = await callAI(
        `Break this brain dump into discrete task items. For each, provide a short title, optional description, and priority (low, medium, high).\n\nBrain dump:\n${text}`,
        {
          schema: {
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string" },
                  },
                },
              },
            },
          },
        }
      );
      const { tasks } = JSON.parse(response);
      for (const t of tasks) {
        await database.put({
          type: "task",
          title: t.title,
          description: t.description || "",
          priority: t.priority || "medium",
          listId: activeListId,
          completed: false,
          authorHandle: viewer.userHandle,
          createdAt: Date.now(),
        });
      }
      setText("");
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestExample() {
    setIsLoading(true);
    try {
      const response = await callAI(
        "Generate a realistic 2-3 sentence brain dump someone might write — mixing personal todos, work items, and ideas. Just the freeform text.",
        { schema: { properties: { dump: { type: "string" } } } }
      );
      setText(JSON.parse(response).dump);
    } finally {
      setIsLoading(false);
    }
  }

  if (!viewer) {
    return (
      <section id="brain-dump" className="p-4 border-b-2 border-[oklch(0.05_0.01_0)]">
        <div className="text-sm text-[oklch(0.40_0.01_0)] italic">Sign in to capture tasks.</div>
      </section>
    );
  }

  return (
    <section id="brain-dump" className="p-4 border-b-2 border-[oklch(0.05_0.01_0)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[oklch(0.40_0.01_0)]">Brain Dump</h2>
        <button
          onClick={suggestExample}
          disabled={isLoading}
          className="font-mono text-xs uppercase px-2 py-1 border-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.88_0.01_90)] disabled:opacity-50"
        >
          Example
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dump everything on your mind..."
        rows={5}
        className="w-full p-3 bg-[oklch(0.92_0.01_90)] border-2 border-[oklch(0.05_0.01_0)] font-sans text-base resize-none"
      />
      <button
        onClick={parseTasks}
        disabled={isLoading || !text.trim() || !activeListId}
        className="mt-2 w-full min-h-[44px] bg-[oklch(0.90_0.20_110)] border-2 border-[oklch(0.05_0.01_0)] font-mono text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
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
            Parsing...
          </>
        ) : (
          "Parse into tasks"
        )}
      </button>
    </section>
  );
}

function TaskFeed({ activeListId, viewer, database, useLiveQuery, ViewerTag }) {
  const { docs: tasks } = useLiveQuery("listId", { key: activeListId });
  const sorted = [...tasks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const priorityColor = {
    high: "bg-[oklch(0.70_0.20_25)] text-[oklch(0.98_0.01_90)]",
    medium: "bg-[oklch(0.90_0.20_110)] text-[oklch(0.05_0.01_0)]",
    low: "bg-[oklch(0.85_0.05_200)] text-[oklch(0.05_0.01_0)]",
  };

  return (
    <section id="task-feed" className="p-4 pb-32">
      <h2 className="font-mono text-xs uppercase tracking-widest mb-3 text-[oklch(0.40_0.01_0)]">Tasks ({sorted.length})</h2>
      {sorted.length === 0 ? (
        <div className="text-sm text-[oklch(0.40_0.01_0)] italic">No tasks yet.</div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const mine = viewer && t.authorHandle === viewer.userHandle;
            return (
              <li key={t._id} className="border-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.92_0.01_90)] p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!t.completed}
                    disabled={!mine}
                    onChange={() => database.put({ ...t, completed: !t.completed })}
                    className="mt-1 w-5 h-5 accent-[oklch(0.05_0.01_0)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-sans text-base font-semibold ${t.completed ? "line-through text-[oklch(0.40_0.01_0)]" : ""}`}
                      >
                        {t.title}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border border-[oklch(0.05_0.01_0)] ${priorityColor[t.priority] || priorityColor.medium}`}
                      >
                        {t.priority || "medium"}
                      </span>
                    </div>
                    {t.description && <p className="text-sm text-[oklch(0.40_0.01_0)] mt-1">{t.description}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <ViewerTag userHandle={t.authorHandle} />
                      {mine && (
                        <button
                          onClick={() => database.del(t._id)}
                          className="ml-auto font-mono text-[10px] uppercase px-2 py-1 border-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.88_0.01_90)]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  if (isViewerPending) return null;

  const c = {
    page: "min-h-screen bg-[oklch(0.88_0.01_90)] text-[oklch(0.05_0.01_0)]",
    header:
      "sticky top-0 z-10 bg-[oklch(0.90_0.20_110)] border-b-4 border-[oklch(0.05_0.01_0)] px-4 py-3 flex items-center justify-between",
    title: "font-mono text-lg font-bold uppercase tracking-tight",
  };

  return (
    <div className={c.page}>
      <style>{`body { font-family: 'Inter', sans-serif; } .font-mono { font-family: 'Space Mono', monospace; }`}</style>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Mono:wght@400;700&display=optional"
        rel="stylesheet"
      />
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Brain Dump</h1>
        <ViewerTag />
      </header>
      <main id="app">
        <ListPicker
          lists={lists}
          activeListId={activeListId}
          setActiveListId={setActiveListId}
          isOwner={isOwner}
          newListName={newListName}
          setNewListName={setNewListName}
          createList={createList}
        />
        <BrainDump viewer={viewer} activeListId={activeListId} database={database} />
        <TaskFeed
          activeListId={activeListId}
          viewer={viewer}
          database={database}
          useLiveQuery={useLiveQuery}
          ViewerTag={ViewerTag}
        />
      </main>
    </div>
  );
}
