import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";
import { useVibe } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header
      id="app-header"
      className={`${c.headerBg} sticky top-0 z-10 px-4 py-3 border-b-[length:var(--border-width)] border-[var(--border)] flex items-center justify-between`}
    >
      <h1 className={`text-2xl font-bold ${c.text}`}>To Do</h1>
      <ViewerTag />
    </header>
  );
}

function AddTaskForm({ c, database, useDocument, can, ready }) {
  const { doc, merge, submit } = useDocument({ text: "", type: "task", done: false, createdAt: Date.now() });
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);

  if (!ready)
    return (
      <section className={`${c.surface} p-4 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)]`}>
        <p className={c.muted}>Loading...</p>
      </section>
    );

  const verdict = can.create({ type: "task", text: doc.text, done: false });
  if (!verdict.ok) {
    return (
      <section
        id="add-task"
        className={`${c.surface} p-4 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)]`}
      >
        <p className={c.muted}>{verdict.reason}</p>
      </section>
    );
  }

  async function suggest() {
    if (!doc.text.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(`Break down this task into 3 concrete subtasks: "${doc.text}"`, {
        schema: { properties: { subtasks: { type: "array", items: { type: "string" } } } },
      });
      const parsed = JSON.parse(res);
      setSuggestions(parsed.subtasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function acceptSuggestion(text) {
    try {
      await database.put({ text, type: "task", done: false, createdAt: Date.now() });
      setSuggestions(suggestions.filter((s) => s !== text));
    } catch (e) {
      console.error(e);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!doc.text.trim()) return;
    submit();
    setSuggestions([]);
  }

  return (
    <section
      id="add-task"
      className={`${c.surface} p-4 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)]`}
    >
      <h2 className={`text-sm font-semibold mb-2 ${c.muted}`}>New task</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className={c.input}
          placeholder="What needs to get done?"
          value={doc.text}
          onChange={(e) => merge({ text: e.target.value })}
        />
        <div className="flex gap-2">
          <button type="submit" className={c.btn} disabled={!doc.text.trim()}>
            Add
          </button>
          <button type="button" onClick={suggest} disabled={isLoading || !doc.text.trim()} className={c.btnGhost}>
            {isLoading ? (
              <svg
                className="animate-spin inline"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            ) : (
              "Suggest"
            )}
          </button>
        </div>
      </form>
      {suggestions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <button onClick={() => acceptSuggestion(s)} className={`${c.btnGhost} flex-1 text-left`}>
                <span className={c.text}>+ {s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskList({ c, tasks, database, can }) {
  const [saving, setSaving] = React.useState(new Set());

  async function toggle(task) {
    const id = task._id;
    setSaving((prev) => new Set(prev).add(id));
    try {
      await database.put({ ...task, done: !task.done });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  async function remove(task) {
    const id = task._id;
    setSaving((prev) => new Set(prev).add(id));
    try {
      await database.del(id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <section
      id="task-list"
      className={`${c.surface} p-4 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)]`}
    >
      <h2 className={`text-sm font-semibold mb-3 ${c.muted}`}>Tasks</h2>
      {tasks.length === 0 ? (
        <p className={c.muted}>No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const isSaving = saving.has(task._id);
            const canEdit = can.edit(task).ok;
            const canDelete = can.delete(task).ok;
            return (
              <li
                key={task._id}
                className={`flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] ${isSaving ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => canEdit && toggle(task)}
                  disabled={!canEdit || isSaving}
                  className="w-5 h-5"
                />
                <span className={`flex-1 ${c.text} ${task.done ? "line-through opacity-60" : ""}`}>{task.text}</span>
                {isSaving && <span className={`text-xs ${c.muted}`}>Saving…</span>}
                {canDelete && (
                  <button onClick={() => remove(task)} disabled={isSaving} className={c.btnGhost} aria-label="Delete">
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
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
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
  const { ViewerTag } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("todos");
  const { can, ready, me } = useVibe("todos");
  const { docs: tasks } = useLiveQuery("createdAt", { descending: true });

  const c = {
    page: "bg-[var(--background)] min-h-screen font-[var(--font-family)]",
    headerBg: "bg-[var(--surface)]",
    surface: "bg-[var(--surface)]",
    text: "text-[var(--text-primary)]",
    muted: "text-[var(--text-secondary)]",
    accent: "bg-[var(--accent)] text-[var(--accent-text)]",
    input:
      "bg-[var(--background)] text-[var(--text-primary)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 w-full min-h-[44px]",
    btn: "bg-[var(--primary)] text-[var(--accent-text)] rounded-[var(--radius-sm)] px-4 py-3 min-h-[44px] font-medium disabled:opacity-50",
    btnGhost:
      "bg-transparent text-[var(--text-secondary)] rounded-[var(--radius-sm)] px-3 py-2 min-h-[44px] border-[length:var(--border-width)] border-[var(--border)]",
  };

  return (
    <div className={c.page}>
      <style>{`
:root {
  --background: oklch(0.97 0.01 80);
  --surface: oklch(1.00 0 0);
  --accent: oklch(0.62 0.18 65);
  --accent-text: oklch(1.00 0 0);
  --text-primary: oklch(0.20 0.02 60);
  --text-secondary: oklch(0.50 0.02 60);
  --border: oklch(0.88 0.01 70);
  --primary: oklch(0.62 0.18 65);
  --radius: 14px;
  --radius-sm: 8px;
  --spacing: 1rem;
  --border-width: 1px;
  --font-family: 'Inter', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.18 0.04 60);
    --surface: oklch(0.22 0.04 60);
    --accent: oklch(0.72 0.18 70);
    --accent-text: oklch(0.12 0.04 60);
    --text-primary: oklch(0.95 0.01 80);
    --text-secondary: oklch(0.55 0.03 60);
    --border: oklch(0.35 0.04 60);
    --primary: oklch(0.72 0.18 70);
  }
}
      `}</style>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app" className="max-w-2xl mx-auto p-4 space-y-4">
        <AddTaskForm c={c} database={database} useDocument={useDocument} can={can} ready={ready} />
        <TaskList c={c} tasks={tasks} database={database} can={can} />
      </main>
    </div>
  );
}
