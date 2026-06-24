import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function Toolbar({ c, can, ready, onAddNote, onAddStroke, me }) {
  const noteOk = ready && me && can?.create({ type: "note", authorHandle: me.userHandle }).ok
  const strokeOk = ready && me && can?.create({ type: "stroke", authorHandle: me.userHandle }).ok
  const noteReason = ready && me && can?.create({ type: "note", authorHandle: me.userHandle }).reason
  return (
    <section id="toolbar" className={`${c.surface} ${c.border} border-[length:var(--border-width)] rounded-[var(--radius)] p-[var(--spacing)] flex gap-2 items-center flex-wrap`}>
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] mr-auto">Tools</h2>
      {noteOk ? (
        <>
          <button onClick={onAddNote} className={`${c.primaryBtn} min-h-[44px] px-4 rounded-[var(--radius-sm)]`}>+ Note</button>
          <button onClick={onAddStroke} disabled={!strokeOk} className={`${c.secondaryBtn} min-h-[44px] px-4 rounded-[var(--radius-sm)] disabled:opacity-40`}>✎ Sketch</button>
        </>
      ) : (
        <span className="text-xs text-[var(--text-secondary)] italic">{noteReason || "read-only view"}</span>
      )}
    </section>
  )
}

const COLORS = {
  yellow: "oklch(0.93 0.12 95)",
  pink: "oklch(0.90 0.06 10)",
  blue: "oklch(0.90 0.05 240)",
}

function Note({ note, c, database, can, me, onAI, aiLoading, savingIds, setSavingIds }) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(note.text)
  const canEdit = me && can?.edit(note).ok
  const canDel = me && can?.delete(note).ok
  const saving = savingIds.has(note._id)

  async function saveText() {
    setEditing(false)
    if (text === note.text) return
    setSavingIds(s => new Set(s).add(note._id))
    try {
      await database.put({ ...note, text })
    } catch (err) {
      setText(note.text)
    } finally {
      setSavingIds(s => { const n = new Set(s); n.delete(note._id); return n })
    }
  }

  async function move() {
    if (!canEdit) return
    setSavingIds(s => new Set(s).add(note._id))
    try {
      await database.put({ ...note, x: Math.round(Math.random() * 280), y: Math.round(Math.random() * 360) })
    } finally {
      setSavingIds(s => { const n = new Set(s); n.delete(note._id); return n })
    }
  }

  return (
    <div
      className="absolute shadow-md rounded-[var(--radius-sm)] p-2 w-40 text-sm"
      style={{ left: note.x, top: note.y, background: COLORS[note.color] || COLORS.yellow, opacity: saving ? 0.6 : 1, transform: "rotate(-1deg)" }}
    >
      {editing && canEdit ? (
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={saveText}
          className="w-full bg-transparent resize-none outline-none text-[var(--text-primary)]"
          rows={3}
        />
      ) : (
        <div onClick={() => canEdit && setEditing(true)} className="text-[var(--text-primary)] min-h-[3rem] whitespace-pre-wrap break-words cursor-text">
          {note.text}
        </div>
      )}
      <div className="flex justify-between items-center mt-1 text-xs">
        <button onClick={() => onAI(note)} disabled={aiLoading === note._id} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
          {aiLoading === note._id ? (
            <svg className="animate-spin w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg>
          ) : "✨ idea"}
        </button>
        {canEdit && <button onClick={move} className="text-[var(--text-secondary)]">↔</button>}
        {canDel && <button onClick={() => database.del(note._id)} className="text-[var(--text-secondary)]">×</button>}
      </div>
      {saving && <span className="text-[10px] text-[var(--text-secondary)] italic">Saving…</span>}
    </div>
  )
}

function Canvas({ c, notes, strokes, database, can, me, onAI, aiLoading, savingIds, setSavingIds }) {
  return (
    <section id="canvas" className={`${c.canvas} ${c.border} border-[length:var(--border-width)] rounded-[var(--radius)] relative overflow-hidden`} style={{ minHeight: "65vh" }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {strokes.map(s => (
          <polyline
            key={s._id}
            points={(s.points || []).map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        ))}
      </svg>
      {notes.map(n => (
        <Note key={n._id} note={n} c={c} database={database} can={can} me={me} onAI={onAI} aiLoading={aiLoading} savingIds={savingIds} setSavingIds={setSavingIds} />
      ))}
      {notes.length === 0 && strokes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] text-sm italic pointer-events-none">
          Tap + Note to begin
        </div>
      )}
    </section>
  )
}

function PresenceBar({ c, ViewerTag }) {
  return (
    <section id="presence" className={`${c.surface} ${c.border} border-[length:var(--border-width)] rounded-[var(--radius)] p-3 flex items-center gap-3`}>
      <span className="text-xs text-[var(--text-secondary)]">You're here as</span>
      <ViewerTag />
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("whiteboard")
  const { database, useLiveQuery } = useFireproof("whiteboard")
  const { docs: notes } = useLiveQuery("type", { key: "note" })
  const { docs: strokes } = useLiveQuery("type", { key: "stroke" })

  React.useEffect(() => {
    if (!ready || !me?.isOwner) return
    database.get("board").catch(() => database.put({ _id: "board", type: "board" }))
  }, [ready, me?.isOwner])

  const [aiLoading, setAiLoading] = React.useState(null)
  const [savingIds, setSavingIds] = React.useState(new Set())

  async function addNote() {
    if (!me) return
    await database.put({
      type: "note",
      text: "New idea",
      x: Math.round(40 + Math.random() * 200),
      y: Math.round(40 + Math.random() * 300),
      color: ["yellow", "pink", "blue"][Math.floor(Math.random() * 3)],
      authorHandle: me.userHandle,
      createdAt: Date.now(),
    }).catch(err => console.error("add note failed", err))
  }

  async function addStroke() {
    if (!me) return
    // demo stroke
    const pts = Array.from({ length: 8 }, (_, i) => ({ x: 60 + i * 25, y: 100 + Math.sin(i) * 30 }))
    await database.put({
      type: "stroke",
      points: pts,
      authorHandle: me.userHandle,
      createdAt: Date.now(),
    }).catch(err => console.error("add stroke failed", err))
  }

  async function askAI(note) {
    setAiLoading(note._id)
    try {
      const { callAI } = await import("call-ai")
      const context = notes.map(n => n.text).join("; ")
      const res = JSON.parse(await callAI(
        `Board notes: ${context}. Suggest one short related idea (max 8 words) building on: "${note.text}"`,
        { schema: { properties: { idea: { type: "string" } } } }
      ))
      await database.put({
        type: "note",
        text: res.idea,
        x: (note.x || 0) + 180,
        y: (note.y || 0) + 20,
        color: "blue",
        authorHandle: me.userHandle,
        createdAt: Date.now(),
      })
    } catch (err) {
      console.error("AI failed", err)
    } finally {
      setAiLoading(null)
    }
  }

  const c = {
    page: "bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    surface: "bg-[var(--surface)]",
    canvas: "bg-[color-mix(in_srgb,var(--accent)_30%,var(--background))]",
    border: "border-[var(--border)]",
    primaryBtn: "bg-[var(--primary)] text-[var(--text-primary)] font-medium",
    secondaryBtn: "bg-[var(--surface)] text-[var(--text-primary)] border-[length:var(--border-width)] border-[var(--border)]",
    headline: "font-['Caveat'] text-3xl",
  }

  return (
    <>
      <style>{`
:root {
  --text-primary: rgba(20,20,20,0.92);
  --text-secondary: rgba(20,20,20,0.5);
  --accent: oklch(0.93 0.03 130);
  --border: rgba(20,20,20,0.14);
  --background: #fff;
  --surface: rgba(255,255,255,0.85);
  --primary: oklch(0.93 0.03 130);
  --secondary: oklch(0.93 0.03 130);
  --font-family: 'Inter', sans-serif;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --accent: oklch(0.25 0.03 130);
    --border: rgba(255,255,255,0.18);
    --background: #0f0f0f;
    --text-primary: rgba(255,255,255,0.92);
    --text-secondary: rgba(255,255,255,0.55);
    --surface: rgba(255,255,255,0.04);
    --primary: oklch(0.4 0.05 130);
  }
}
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <main id="app" className={`${c.page} min-h-screen p-[var(--spacing)] max-w-5xl mx-auto space-y-3`}>
        <header id="app-header" className="flex items-center justify-between gap-3">
          <h1 className={c.headline}>Live Whiteboard</h1>
          <ViewerTag />
        </header>
        <Toolbar c={c} can={can} ready={ready} onAddNote={addNote} onAddStroke={addStroke} me={me} />
        <Canvas c={c} notes={notes} strokes={strokes} database={database} can={can} me={me} onAI={askAI} aiLoading={aiLoading} savingIds={savingIds} setSavingIds={setSavingIds} />
        <PresenceBar c={c} ViewerTag={ViewerTag} />
      </main>
    </>
  )
}