import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function TripHeader() {
  const { database, useDocument } = useFireproof("wanderlist")
  const { can, ready } = useVibe("wanderlist")
  const { doc: trip, merge, save } = useDocument({ _id: "trip:current", type: "trip", destination: "", startDate: "", endDate: "" })
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const canEdit = ready && can.create({ type: "trip" }).ok

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    try { await save(); setEditing(false) } finally { setSaving(false) }
  }

  return (
    <section id="trip-header" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)] mb-4">
      <h2 className="text-sm uppercase tracking-wide text-[var(--text-secondary)] mb-2">Destination</h2>
      {!editing ? (
        <>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{trip.destination || "Set up your trip…"}</p>
          {(trip.startDate || trip.endDate) && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{trip.startDate} → {trip.endDate}</p>
          )}
          {canEdit && (
            <button onClick={() => setEditing(true)} className="mt-3 min-h-[44px] px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius)] font-medium">
              {trip.destination ? "Edit" : "Set up trip"}
            </button>
          )}
        </>
      ) : (
        <form onSubmit={onSave} className="space-y-2">
          <input value={trip.destination} onChange={e => merge({ destination: e.target.value })} placeholder="Where to?" className="w-full min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
          <div className="flex gap-2">
            <input type="date" value={trip.startDate} onChange={e => merge({ startDate: e.target.value })} className="flex-1 min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
            <input type="date" value={trip.endDate} onChange={e => merge({ endDate: e.target.value })} className="flex-1 min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
          </div>
          <button type="submit" disabled={saving} className="min-h-[44px] px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius)] font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </section>
  )
}

function Itinerary() {
  const { database, useLiveQuery, useDocument } = useFireproof("wanderlist")
  const { can, ready, me } = useVibe("wanderlist")
  const { ViewerTag } = useViewer()
  const { docs: days } = useLiveQuery("type", { key: "day" })
  const { docs: tripDocs } = useLiveQuery("_id", { key: "trip:current" })
  const trip = tripDocs[0]
  const { doc: draft, merge, submit, reset } = useDocument({ type: "day", dayLabel: "", activity: "", createdAt: Date.now(), authorHandle: me?.userHandle })
  const [suggesting, setSuggesting] = React.useState(false)

  React.useEffect(() => { merge({ authorHandle: me?.userHandle }) }, [me?.userHandle])

  const sortedDays = [...days].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const canAdd = ready && can.create({ type: "day", authorHandle: me?.userHandle }).ok

  async function onSuggest() {
    if (!trip?.destination) return
    setSuggesting(true)
    try {
      const res = await callAI(`Suggest one short activity (under 8 words) for a trip to ${trip.destination}. Pick something distinctive.`, {
        schema: { properties: { dayLabel: { type: "string" }, activity: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      merge({ dayLabel: parsed.dayLabel || "Day 1", activity: parsed.activity || "" })
    } finally { setSuggesting(false) }
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!draft.activity.trim()) return
    submit()
  }

  return (
    <section id="itinerary" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)] mb-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Itinerary</h2>
      <ul className="space-y-2 mb-4">
        {sortedDays.length === 0 && <p className="text-[var(--text-secondary)]">No days planned yet.</p>}
        {sortedDays.map(d => (
          <li key={d._id} className="p-3 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{d.dayLabel}</p>
                <p className="text-[var(--text-primary)]">{d.activity}</p>
              </div>
              <ViewerTag userHandle={d.authorHandle} />
              {can.delete(d).ok && (
                <button onClick={() => database.del(d._id)} className="text-[var(--error)] text-sm px-2 min-h-[44px]" aria-label="Delete">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canAdd ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <input value={draft.dayLabel} onChange={e => merge({ dayLabel: e.target.value })} placeholder="Day 1" className="w-full min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
          <input value={draft.activity} onChange={e => merge({ activity: e.target.value })} placeholder="Activity…" className="w-full min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 min-h-[44px] px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius)] font-medium">Add</button>
            <button type="button" onClick={onSuggest} disabled={suggesting || !trip?.destination} className="min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] disabled:opacity-50 flex items-center gap-1">
              {suggesting ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              )}
              Suggest
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{ready ? can.create({ type: "day", authorHandle: me?.userHandle }).reason : "Loading…"}</p>
      )}
    </section>
  )
}

function PackingList() {
  const { database, useLiveQuery, useDocument } = useFireproof("wanderlist")
  const { can, ready, me } = useVibe("wanderlist")
  const { docs: items } = useLiveQuery("type", { key: "packItem" })
  const { docs: tripDocs } = useLiveQuery("_id", { key: "trip:current" })
  const trip = tripDocs[0]
  const { doc: draft, merge, submit } = useDocument({ type: "packItem", label: "", packed: false, createdAt: Date.now(), authorHandle: me?.userHandle })
  const [saving, setSaving] = React.useState(() => new Set())
  const [suggesting, setSuggesting] = React.useState(false)

  React.useEffect(() => { merge({ authorHandle: me?.userHandle }) }, [me?.userHandle])

  const canAdd = ready && can.create({ type: "packItem", authorHandle: me?.userHandle }).ok

  async function toggle(item) {
    setSaving(s => { const n = new Set(s); n.add(item._id); return n })
    try {
      await database.put({ ...item, packed: !item.packed })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(item._id); return n })
    }
  }

  async function onSuggest() {
    if (!trip?.destination) return
    setSuggesting(true)
    try {
      const res = await callAI(`List 5 essential packing items for a trip to ${trip.destination}. Short labels only.`, {
        schema: { properties: { items: { type: "array", items: { type: "string" } } } }
      })
      const parsed = JSON.parse(res)
      for (const label of (parsed.items || [])) {
        await database.put({ type: "packItem", label, packed: false, createdAt: Date.now(), authorHandle: me?.userHandle })
      }
    } finally { setSuggesting(false) }
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!draft.label.trim()) return
    submit()
  }

  return (
    <section id="packing" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)] mb-20">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Packing List</h2>
      <ul className="space-y-2 mb-4">
        {items.length === 0 && <p className="text-[var(--text-secondary)]">Nothing packed yet.</p>}
        {items.map(item => {
          const isSaving = saving.has(item._id)
          return (
            <li key={item._id} className={`flex items-center gap-3 p-3 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] ${isSaving ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={!!item.packed} onChange={() => toggle(item)} disabled={isSaving} className="w-5 h-5 accent-[var(--primary)]" />
              <span className={`flex-1 ${item.packed ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>{item.label}</span>
              {isSaving && <span className="text-xs text-[var(--text-secondary)]">Saving…</span>}
              {can.delete(item).ok && (
                <button onClick={() => database.del(item._id)} className="text-[var(--error)] min-h-[44px] px-2" aria-label="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {canAdd ? (
        <form onSubmit={onSubmit} className="flex gap-2">
          <input value={draft.label} onChange={e => merge({ label: e.target.value })} placeholder="Add an item…" className="flex-1 min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)]" />
          <button type="submit" className="min-h-[44px] px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius)] font-medium">Add</button>
          <button type="button" onClick={onSuggest} disabled={suggesting || !trip?.destination} className="min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] disabled:opacity-50">
            {suggesting ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg>
            ) : "Suggest"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{ready ? can.create({ type: "packItem", authorHandle: me?.userHandle }).reason : "Loading…"}</p>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready } = useVibe("wanderlist")

  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto px-4 py-4",
  }

  return (
    <div className={c.page}>
      <style>{`:root { --background: oklch(1.00 0 0); --surface: rgba(255,255,255,0.85); --primary: oklch(0.62 0.24 25); --text-primary: rgba(20,20,20,0.92); --text-secondary: rgba(20,20,20,0.5); --border: rgba(20,20,20,0.14); --accent: oklch(0.62 0.24 25); --secondary: oklch(0.62 0.24 25); --warning: #f59e0b; --success: #22c55e; --error: #ef4444; --neutral: #6b7280; --font-family: system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; --radius: 0.5rem; --radius-sm: 0.25rem; --radius-lg: 1rem; --spacing: 1rem; --border-width: 1px; }
      @media (prefers-color-scheme: dark) { :root { --background: oklch(0.06 0 0); --surface: rgba(255,255,255,0.04); --primary: oklch(0.38 0.24 25); --text-primary: rgba(255,255,255,0.92); --text-secondary: rgba(255,255,255,0.55); --border: rgba(255,255,255,0.18); --accent: oklch(0.38 0.24 25); --secondary: oklch(0.38 0.24 25); } }`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Wanderlist</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <TripHeader />
        <Itinerary />
        <PackingList />
      </main>
    </div>
  )
}