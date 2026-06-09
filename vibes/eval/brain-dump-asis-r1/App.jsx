import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ListSwitcher({ lists, activeListId, setActiveListId, viewer, newListName, setNewListName, createList, suggestListName }) {
  return (
    <section id="lists" className="px-4 py-3 border-b border-[oklch(0.31_0.005_285)] bg-[oklch(0.25_0.005_285)]">
      <h2 className="text-xs uppercase tracking-wider text-[oklch(0.71_0.02_261)] mb-2">Lists</h2>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {lists.length === 0 && <div className="text-sm text-[oklch(0.87_0.01_258)] italic">No lists yet.</div>}
        {lists.map((l) => {
          const active = l._id === activeListId;
          return (
            <button
              key={l._id}
              onClick={() => setActiveListId(l._id)}
              className={`min-h-[40px] px-3 rounded-full text-sm whitespace-nowrap border ${
                active
                  ? "bg-[oklch(0.79_0.18_75)] text-[oklch(0.18_0.005_285)] border-[oklch(0.79_0.18_75)] font-medium"
                  : "bg-[oklch(0.18_0.005_285)] text-[oklch(0.87_0.01_258)] border-[oklch(0.31_0.005_285)]"
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      {viewer ? (
        <form onSubmit={createList} className="flex gap-2 mt-1">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            className="flex-1 min-h-[44px] px-3 rounded-md bg-[oklch(0.18_0.005_285)] border border-[oklch(0.31_0.005_285)] text-[oklch(1.00_0.000_0)] text-sm placeholder:text-[oklch(0.71_0.02_261)]"
          />
          <button
            type="button"
            onClick={suggestListName}
            className="min-h-[44px] px-3 rounded-md border border-[oklch(0.31_0.005_285)] text-[oklch(0.87_0.01_258)] text-xs"
            title="AI suggestion"
          >
            ✨
          </button>
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-md bg-[oklch(0.68_0.20_35)] text-[oklch(1.00_0.000_0)] text-sm font-medium"
          >
            Add
          </button>
        </form>
      ) : (
        <div className="text-sm text-[oklch(0.71_0.02_261)] mt-1">Sign in to manage lists.</div>
      )}
    </section>
  );
}

function TaskDump({ activeListId, viewer, database }) {
  const [text, setText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function parse() {
    if (!text.trim() || !activeListId || !viewer) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Break the following freeform note into discrete actionable task items. For each task, give a short title, an optional description (or empty string), and a priority of "low", "medium", or "high". Note: ${text}`,
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
      const { tasks } = JSON.parse(res);
      for (const t of tasks || []) {
        await database.put({
          type: "task",
          listId: activeListId,
          title: t.title,
          description: t.description || "",
          priority: t.priority || "medium",
          completed: false,
          createdAt: Date.now(),
          createdBy: viewer.userHandle,
        });
      }
      setText("");
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestExample() {
    const res = await callAI(
      "Give one short freeform brain-dump example a busy person might type, mixing 3-4 tasks with priorities, run on, casual.",
      {
        schema: { properties: { example: { type: "string" } } },
      }
    );
    setText(JSON.parse(res).example || "");
  }

  if (!activeListId) {
    return (
      <section id="dump" className="px-4 py-4 border-b border-[oklch(0.31_0.005_285)]">
        <h2 className="text-xs uppercase tracking-wider text-[oklch(0.71_0.02_261)] mb-2">Dump tasks</h2>
        <div className="text-sm text-[oklch(0.71_0.02_261)] italic">Pick or create a list first.</div>
      </section>
    );
  }

  return (
    <section id="dump" className="px-4 py-4 border-b border-[oklch(0.31_0.005_285)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-wider text-[oklch(0.71_0.02_261)]">Dump tasks</h2>
        {viewer && (
          <button onClick={suggestExample} className="text-xs text-[oklch(0.79_0.18_75)]" type="button">
            ✨ example
          </button>
        )}
      </div>
      {viewer ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type freely — buy milk, finish report by Friday, call mom urgent..."
            rows={4}
            className="w-full px-3 py-2 rounded-md bg-[oklch(0.25_0.005_285)] border border-[oklch(0.31_0.005_285)] text-[oklch(1.00_0.000_0)] text-sm placeholder:text-[oklch(0.71_0.02_261)] resize-none"
          />
          <button
            onClick={parse}
            disabled={isLoading || !text.trim()}
            className="mt-2 w-full min-h-[48px] rounded-md bg-[oklch(0.79_0.18_75)] text-[oklch(0.18_0.005_285)] font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Parsing…
              </>
            ) : (
              "Parse into tasks"
            )}
          </button>
        </>
      ) : (
        <div className="text-sm text-[oklch(0.71_0.02_261)]">Sign in to add tasks.</div>
      )}
    </section>
  );
}

function TaskBoard({ activeListId, viewer, database }) {
  const { useLiveQuery } = useFireproof("taskparse");
  const { docs: tasks } = useLiveQuery("listId", { key: activeListId || "__none__" });

  const sorted = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt);

  const priorityColor = {
    high: "bg-[oklch(0.63_0.24_25)]",
    medium: "bg-[oklch(0.79_0.18_75)]",
    low: "bg-[oklch(0.77_0.22_145)]",
  };

  if (!activeListId) {
    return (
      <section id="board" className="px-4 py-4 flex-1">
        <div className="text-sm text-[oklch(0.71_0.02_261)] italic">No list selected.</div>
      </section>
    );
  }

  return (
    <section id="board" className="px-4 py-4 flex-1">
      <h2 className="text-xs uppercase tracking-wider text-[oklch(0.71_0.02_261)] mb-2">Tasks ({sorted.length})</h2>
      {sorted.length === 0 ? (
        <div className="text-sm text-[oklch(0.71_0.02_261)] italic">Empty — dump some text above.</div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const mine = viewer && t.createdBy === viewer.userHandle;
            return (
              <li
                key={t._id}
                className={`flex items-start gap-3 p-3 rounded-md border border-[oklch(0.31_0.005_285)] bg-[oklch(0.25_0.005_285)] ${
                  t.completed ? "opacity-50" : ""
                }`}
              >
                <button
                  onClick={() => mine && database.put({ ...t, completed: !t.completed })}
                  disabled={!mine}
                  className="mt-1 w-5 h-5 rounded border border-[oklch(0.31_0.005_285)] flex items-center justify-center flex-shrink-0 disabled:cursor-not-allowed"
                >
                  {t.completed && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="oklch(0.77 0.22 145)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColor[t.priority] || priorityColor.medium}`} />
                    <div className={`text-sm font-medium ${t.completed ? "line-through" : ""}`}>{t.title}</div>
                  </div>
                  {t.description && <div className="text-xs text-[oklch(0.87_0.01_258)] mt-1">{t.description}</div>}
                </div>
                {mine && (
                  <button
                    onClick={() => database.del(t._id)}
                    className="text-[oklch(0.71_0.02_261)] hover:text-[oklch(0.63_0.24_25)] flex-shrink-0"
                    aria-label="Delete"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14H7L5 6" />
                    </svg>
                  </button>
                )}
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
  const { database, useLiveQuery } = useFireproof("taskparse");
  const { docs: lists } = useLiveQuery("type", { key: "list" });
  const [activeListId, setActiveListId] = React.useState(null);
  const [newListName, setNewListName] = React.useState("");

  React.useEffect(() => {
    if (!activeListId && lists.length) setActiveListId(lists[0]._id);
  }, [lists, activeListId]);

  async function createList(e) {
    e.preventDefault();
    if (!newListName.trim() || !viewer) return;
    const ok = await database.put({
      type: "list",
      name: newListName.trim(),
      createdAt: Date.now(),
      createdBy: viewer.userHandle,
    });
    setActiveListId(ok.id);
    setNewListName("");
  }

  async function suggestListName() {
    const res = await callAI("Suggest one short creative name for a personal task list. Just the name.", {
      schema: { properties: { name: { type: "string" } } },
    });
    setNewListName(JSON.parse(res).name || "");
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.18_0.005_285)] text-[oklch(1.00_0.000_0)] font-sans flex flex-col",
    header:
      "sticky top-0 z-10 px-4 py-3 bg-[oklch(0.25_0.005_285)] border-b border-[oklch(0.31_0.005_285)] flex items-center justify-between",
    title: "text-lg font-semibold tracking-tight",
    sub: "text-xs text-[oklch(0.71_0.02_261)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>TaskParse</div>
          <div className={c.sub}>Dump it. Parse it. Done.</div>
        </div>
        <ViewerTag />
      </header>
      <ListSwitcher
        lists={lists}
        activeListId={activeListId}
        setActiveListId={setActiveListId}
        viewer={viewer}
        newListName={newListName}
        setNewListName={setNewListName}
        createList={createList}
        suggestListName={suggestListName}
      />
      <TaskDump activeListId={activeListId} viewer={viewer} database={database} />
      <TaskBoard activeListId={activeListId} viewer={viewer} database={database} />
    </main>
  );
}
