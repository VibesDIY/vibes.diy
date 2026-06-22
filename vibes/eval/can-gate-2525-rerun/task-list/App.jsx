import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function Header() {
  const c = {
    wrap: "px-5 py-4 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10",
    title: "text-xl font-semibold text-[var(--text-primary)] font-[var(--font-family)]",
    sub: "text-xs text-[var(--text-secondary)]",
  }
  return (
    <header id="app-header" className={c.wrap}>
      <div>
        <h1 className={c.title}>Tasks Together</h1>
        <p className={c.sub}>Shared, live, collaborative</p>
      </div>
      <ViewerSlot />
    </header>
  )
}

function ViewerSlot() {
  const { ViewerTag } = useViewer()
  return <ViewerTag />
}

function AddTask({ database, can, ready, me, tasks }) {
  const [text, setText] = React.useState("")
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState(null)

  const draft = { type: "task", authorHandle: me?.userHandle, text: text.trim(), done: false }
  const verdict = ready ? can.create(draft) : { ok: false, reason: "Loading…" }

  async function handleSuggest() {
    setIsSuggesting(true)
    setError(null)
    try {
      const existing = tasks.slice(0, 10).map((t) => t.text).join("; ") || "(none yet)"
      const res = await callAI(
        `Suggest one short, actionable task title (max 8 words) for a shared task list. Existing tasks: ${existing}. Make it different from existing ones.`,
        { schema: { properties: { task: { type: "string", description: "Short task title" } } } }
      )
      const parsed = JSON.parse(res)
      if (parsed.task) setText(parsed.task)
    } catch (e) {
      setError("Suggest failed")
    } finally {
      setIsSuggesting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || !verdict.ok) return
    setIsSaving(true)
    setError(null)
    try {
      await database.put({
        type: "task",
        text: text.trim(),
        done: false,
        authorHandle: me?.userHandle,
        createdAt: Date.now(),
      })
      setText("")
    } catch (err) {
      setError("Save failed, try again")
    } finally {
      setIsSaving(false)
    }
  }

  const c = {
    wrap: "px-5 pt-5",
    card: "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4",
    label: "text-sm font-medium text-[var(--text-secondary)] mb-3 block",
    row: "flex gap-2",
    input: "flex-1 min-h-[44px] px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]",
    btn: "min-h-[44px] px-4 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white font-medium disabled:opacity-50 flex items-center justify-center",
    suggest: "min-h-[44px] px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] disabled:opacity-50 flex items-center justify-center",
    err: "text-xs text-[var(--error)] mt-2",
    denied: "text-xs text-[var(--text-disabled)] mt-2",
  }

  return (
    <section id="add-task" className={c.wrap}>
      <div className={c.card}>
        <label className={c.label} htmlFor="task-input">Add a task</label>
        <form onSubmit={handleSubmit} className={c.row}>
          <input
            id="task-input"
            className={c.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs doing?"
            disabled={!verdict.ok || isSaving}
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={isSuggesting || !verdict.ok}
            className={c.suggest}
            aria-label="AI suggest"
            title="Suggest a task"
          >
            {isSuggesting ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
            )}
          </button>
          <button type="submit" disabled={!text.trim() || !verdict.ok || isSaving} className={c.btn}>
            {isSaving ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : "Add"}
          </button>
        </form>
        {error && <p className={c.err}>{error}</p>}
        {!verdict.ok && !error && <p className={c.denied}>{verdict.reason}</p>}
      </div>
    </section>
  )
}

function TaskRow({ task, database, can, me }) {
  const { ViewerTag } = useViewer()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(task.text)
  const [saving, setSaving] = React.useState(false)
  const [optimisticDone, setOptimisticDone] = React.useState(null)
  const [error, setError] = React.useState(null)

  const done = optimisticDone !== null ? optimisticDone : task.done
  const canEdit = can.edit(task).ok
  const canDelete = can.delete(task).ok

  async function toggle() {
    const next = !done
    setOptimisticDone(next)
    setSaving(true)
    setError(null)
    try {
      await database.put({ ...task, done: next })
    } catch {
      setOptimisticDone(!next)
      setError("Couldn't save")
    } finally {
      setSaving(false)
      setTimeout(() => setOptimisticDone(null), 300)
    }
  }

  async function saveEdit() {
    if (!draft.trim() || draft.trim() === task.text) {
      setEditing(false)
      setDraft(task.text)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await database.put({ ...task, text: draft.trim() })
      setEditing(false)
    } catch {
      setError("Edit failed")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await database.del(task._id)
    } catch {
      setError("Delete failed")
      setSaving(false)
    }
  }

  const c = {
    li: `rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 transition-opacity ${saving ? "opacity-60" : ""}`,
    row: "flex items-start gap-3",
    check: "mt-1 w-5 h-5 accent-[var(--primary)] cursor-pointer flex-shrink-0",
    body: "flex-1 min-w-0",
    text: `text-[var(--text-primary)] break-words ${done ? "line-through text-[var(--text-disabled)]" : ""}`,
    meta: "flex items-center gap-2 mt-1 text-xs text-[var(--text-secondary)]",
    actions: "flex gap-1 flex-shrink-0",
    iconBtn: "min-h-[36px] min-w-[36px] px-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--background)] disabled:opacity-50 flex items-center justify-center",
    input: "w-full px-2 py-2 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--background)] text-[var(--text-primary)] outline-none",
    savingTag: "text-xs text-[var(--text-disabled)] italic",
    err: "text-xs text-[var(--error)] mt-1",
  }

  return (
    <li className={c.li}>
      <div className={c.row}>
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          disabled={saving || !canEdit}
          className={c.check}
          aria-label={done ? "Mark not done" : "Mark done"}
        />
        <div className={c.body}>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit()
                if (e.key === "Escape") { setEditing(false); setDraft(task.text) }
              }}
              className={c.input}
            />
          ) : (
            <p
              className={c.text}
              onClick={() => canEdit && setEditing(true)}
              style={{ cursor: canEdit ? "text" : "default" }}
            >
              {task.text}
            </p>
          )}
          <div className={c.meta}>
            <ViewerTag userHandle={task.authorHandle} />
            {saving && <span className={c.savingTag}>Saving…</span>}
          </div>
          {error && <p className={c.err}>{error}</p>}
        </div>
        <div className={c.actions}>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} disabled={saving} className={c.iconBtn} aria-label="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            </button>
          )}
          {canDelete && (
            <button onClick={remove} disabled={saving} className={c.iconBtn} aria-label="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function TaskList({ database, tasks, can, me }) {
  const c = {
    wrap: "px-5 py-5",
    head: "text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center justify-between",
    empty: "text-center py-12 text-[var(--text-disabled)] text-sm",
  }
  return (
    <section id="task-list" className={c.wrap}>
      <h2 className={c.head}>
        <span>All tasks</span>
        <span className="text-xs">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className={c.empty}>No tasks yet — add one above.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t._id} task={t} database={database} can={can} me={me} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("tasks")
  const { docs: tasks } = useLiveQuery("type", { key: "task", descending: true })
  const { can, ready, me } = useVibe("tasks")
  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)] pb-20",
  }
  return (
    <>
      <style>{`
:root {
  --background: oklch(0.97 0.01 80);
  --surface: oklch(1.00 0 0);
  --accent: oklch(0.62 0.18 65);
  --text-primary: oklch(0.20 0.02 60);
  --text-secondary: oklch(0.50 0.02 60);
  --border: oklch(0.88 0.01 70);
  --primary: oklch(0.62 0.18 65);
  --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
  --error: #ef4444;
  --font-family: 'Inter', sans-serif;
  --radius: 14px;
  --radius-sm: 8px;
  --spacing: 1rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.18 0.04 60);
    --surface: oklch(0.22 0.04 60);
    --accent: oklch(0.72 0.18 70);
    --text-primary: oklch(0.95 0.01 80);
    --text-secondary: oklch(0.55 0.03 60);
    --border: oklch(0.35 0.04 60);
    --primary: oklch(0.72 0.18 70);
  }
}
`}</style>
      <main id="app" className={c.page}>
        <Header />
        <AddTask database={database} can={can} ready={ready} me={me} tasks={tasks} />
        <TaskList database={database} tasks={tasks} can={can} me={me} />
      </main>
    </>
  )
}