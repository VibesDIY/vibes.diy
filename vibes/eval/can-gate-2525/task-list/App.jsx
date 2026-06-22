import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function TaskComposer() {
  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]",
    label: "text-sm font-semibold text-[var(--text-secondary)] mb-2",
    row: "flex gap-2",
    input: "flex-1 min-h-[44px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)]",
    btn: "min-h-[44px] px-4 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text)] font-semibold disabled:opacity-50",
    suggest: "min-h-[44px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] disabled:opacity-50",
    locked: "text-sm text-[var(--text-secondary)] italic",
  }
  return (
    <section id="composer" className={c.section}>
      <p className={c.label}>Add a task</p>
      <p className={c.locked}>Loading…</p>
    </section>
  )
}

function TaskRow({ task }) {
  const { database } = useFireproof("coTask")
  const { can } = useVibe("coTask")
  const { ViewerTag } = useViewer()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(task.title)
  const [saving, setSaving] = React.useState(false)
  const [optimisticDone, setOptimisticDone] = React.useState(null)

  const done = optimisticDone !== null ? optimisticDone : task.done
  const canEdit = can.edit(task).ok
  const canDelete = can.delete(task).ok

  async function toggle() {
    const next = !done
    setOptimisticDone(next)
    setSaving(true)
    try {
      await database.put({ ...task, done: next })
    } catch (err) {
      setOptimisticDone(!next)
      alert("Could not update: " + (err.message || err))
    } finally {
      setSaving(false)
      setOptimisticDone(null)
    }
  }

  async function saveEdit() {
    const text = draft.trim()
    if (!text || text === task.title) { setEditing(false); setDraft(task.title); return }
    setSaving(true)
    try {
      await database.put({ ...task, title: text })
      setEditing(false)
    } catch (err) {
      alert("Could not save: " + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm("Delete this task?")) return
    setSaving(true)
    try {
      await database.del(task._id)
    } catch (err) {
      alert("Could not delete: " + (err.message || err))
      setSaving(false)
    }
  }

  const c = {
    li: `flex items-start gap-3 py-3 border-b-[length:var(--border-width)] border-[var(--border)] last:border-b-0 ${saving ? "opacity-60" : ""}`,
    checkbox: "mt-1 w-5 h-5 accent-[var(--primary)] cursor-pointer disabled:cursor-not-allowed",
    body: "flex-1 min-w-0",
    title: `block text-[var(--text-primary)] ${done ? "line-through text-[var(--text-secondary)]" : ""}`,
    titleBtn: "text-left w-full",
    meta: "flex items-center gap-2 mt-1 text-xs text-[var(--text-secondary)]",
    input: "flex-1 min-h-[40px] px-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)]",
    saveBtn: "min-h-[40px] px-3 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text)] text-sm font-semibold",
    cancelBtn: "min-h-[40px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-sm",
    delBtn: "p-2 text-[var(--error)] hover:opacity-70 disabled:opacity-40",
    savingTag: "text-xs italic text-[var(--text-secondary)]",
  }

  return (
    <li className={c.li}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={saving || !canEdit}
        className={c.checkbox}
      />
      <div className={c.body}>
        {editing ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { setEditing(false); setDraft(task.title) } }}
              className={c.input}
            />
            <button onClick={saveEdit} disabled={saving} className={c.saveBtn}>Save</button>
            <button onClick={() => { setEditing(false); setDraft(task.title) }} className={c.cancelBtn}>Cancel</button>
          </div>
        ) : (
          canEdit ? (
            <button className={c.titleBtn} onClick={() => setEditing(true)}>
              <span className={c.title}>{task.title}</span>
            </button>
          ) : (
            <span className={c.title}>{task.title}</span>
          )
        )}
        <div className={c.meta}>
          <ViewerTag userHandle={task.authorHandle} />
          {saving && <span className={c.savingTag}>Saving…</span>}
        </div>
      </div>
      {canDelete && !editing && (
        <button onClick={remove} disabled={saving} className={c.delBtn} aria-label="Delete">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
        </button>
      )}
    </li>
  )
}

function TaskList() {
  const { useLiveQuery } = useFireproof("coTask")
  const { docs: tasks } = useLiveQuery("createdAt", { descending: true })
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]",
    heading: "text-sm font-semibold text-[var(--text-secondary)] mb-3",
    subhead: "text-xs uppercase tracking-wide text-[var(--text-secondary)] mt-4 mb-2",
    empty: "text-sm text-[var(--text-secondary)] py-8 text-center",
    list: "list-none p-0 m-0",
  }

  if (tasks.length === 0) {
    return (
      <section id="tasks" className={c.section}>
        <h2 className={c.heading}>Tasks</h2>
        <p className={c.empty}>No tasks yet.</p>
      </section>
    )
  }

  return (
    <section id="tasks" className={c.section}>
      <h2 className={c.heading}>Tasks ({open.length} open)</h2>
      <ul className={c.list}>
        {open.map((t) => <TaskRow key={t._id} task={t} />)}
      </ul>
      {done.length > 0 && (
        <>
          <h3 className={c.subhead}>Done ({done.length})</h3>
          <ul className={c.list}>
            {done.map((t) => <TaskRow key={t._id} task={t} />)}
          </ul>
        </>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 bg-[var(--surface)] border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-24",
  }
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>CoTask</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <TaskComposer />
        <TaskList />
      </main>
    </div>
  )
}