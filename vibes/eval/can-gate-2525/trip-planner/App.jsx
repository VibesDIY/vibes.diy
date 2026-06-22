import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function TripHeader({ c, database, trip, can }) {
  const tripDoc = trip || { _id: "trip:main", type: "trip", destination: "", startDate: "", endDate: "" }
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(tripDoc)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => { if (trip) setDraft(trip) }, [trip])

  const canEdit = can.edit(tripDoc).ok || can.create({ ...tripDoc, type: "trip" }).ok

  async function save() {
    setSaving(true)
    try {
      await database.put({ ...draft, _id: "trip:main", type: "trip" })
      setEditing(false)
    } catch (e) { alert(e.message || "Save failed") }
    finally { setSaving(false) }
  }

  return (
    <section id="trip-header" className={`${c.surface} ${c.border} border rounded-[var(--radius)] p-[var(--spacing)] mb-4`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-lg font-semibold ${c.textPrimary}`}>Trip details</h2>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className={`text-sm ${c.accent} min-h-[44px] px-2`}>Edit</button>
        )}
      </div>
      {!editing ? (
        tripDoc.destination ? (
          <div className={`text-sm ${c.textPrimary}`}>
            <div className="text-lg font-medium">{tripDoc.destination}</div>
            <div className={c.textSecondary}>{tripDoc.startDate} → {tripDoc.endDate}</div>
          </div>
        ) : (
          <p className={`text-sm ${c.textSecondary}`}>{canEdit ? "Tap Edit to set destination and dates." : "Trip not yet set up."}</p>
        )
      ) : (
        <div className="space-y-2">
          <input className={c.input} placeholder="Destination" value={draft.destination || ""} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
          <input className={c.input} type="date" value={draft.startDate || ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          <input className={c.input} type="date" value={draft.endDate || ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          <div className="flex gap-2">
            <button disabled={saving} onClick={save} className={c.primary}>
              {saving ? (<svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50" /></svg>) : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className={`${c.input} min-h-[44px] px-3`}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

function getDays(trip) {
  if (!trip?.startDate || !trip?.endDate) return []
  const days = []
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function Itinerary({ c, database, activities, trip, can, me }) {
  const [newFor, setNewFor] = React.useState(null)
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(new Set())
  const [suggesting, setSuggesting] = React.useState(null)
  const days = getDays(trip)

  async function addActivity(day) {
    if (!text.trim()) return
    const id = `act:${Date.now()}`
    setSaving(s => new Set(s).add(id))
    try {
      await database.put({ _id: id, type: "activity", day, text: text.trim(), authorHandle: me?.userHandle, createdAt: Date.now() })
      setText(""); setNewFor(null)
    } catch (e) { alert(e.message) }
    finally { setSaving(s => { const n = new Set(s); n.delete(id); return n }) }
  }

  async function suggest(day) {
    setSuggesting(day)
    try {
      const resp = await callAI(`Suggest 3 short activity ideas for a day trip in ${trip?.destination || "the destination"} on ${day}. Keep each under 8 words.`, {
        schema: { properties: { activities: { type: "array", items: { type: "string" } } } }
      })
      const parsed = JSON.parse(resp)
      for (const a of parsed.activities || []) {
        await database.put({ type: "activity", day, text: a, authorHandle: me?.userHandle, createdAt: Date.now() })
      }
    } catch (e) { alert("Suggest failed") }
    finally { setSuggesting(null) }
  }

  const canAdd = can.create({ type: "activity", authorHandle: me?.userHandle }).ok

  return (
    <section id="itinerary" className={`${c.surface} ${c.border} border rounded-[var(--radius)] p-[var(--spacing)] mb-4`}>
      <h2 className={`text-lg font-semibold ${c.textPrimary} mb-3`}>Itinerary</h2>
      {days.length === 0 && <p className={`text-sm ${c.textSecondary}`}>Set trip dates to see your days.</p>}
      <div className="space-y-3">
        {days.map(day => {
          const dayActs = activities.filter(a => a.day === day).sort((a, b) => a.createdAt - b.createdAt)
          return (
            <div key={day} className={`${c.border} border rounded-[var(--radius-sm)] p-3`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`font-medium ${c.textPrimary}`}>{day}</div>
                {canAdd && dayActs.length === 0 && (
                  <button disabled={suggesting === day} onClick={() => suggest(day)} className={`text-xs ${c.accent} min-h-[44px] px-2`}>
                    {suggesting === day ? (<svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50" /></svg>) : "✨ Suggest"}
                  </button>
                )}
              </div>
              <ul className="space-y-1 mb-2">
                {dayActs.map(a => (
                  <li key={a._id} className={`text-sm ${c.textPrimary} flex items-center justify-between`}>
                    <span>{a.text}</span>
                    {can.delete(a).ok && <button onClick={() => database.del(a._id)} className={`text-xs ${c.textSecondary} px-2`}>×</button>}
                  </li>
                ))}
              </ul>
              {canAdd && (newFor === day ? (
                <div className="flex gap-2">
                  <input autoFocus className={c.input} value={text} onChange={e => setText(e.target.value)} placeholder="Activity" onKeyDown={e => e.key === "Enter" && addActivity(day)} />
                  <button onClick={() => addActivity(day)} className={c.primary}>Add</button>
                </div>
              ) : (
                <button onClick={() => { setNewFor(day); setText("") }} className={`text-sm ${c.accent} min-h-[44px]`}>+ Add activity</button>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PackingList({ c, database, packing, trip, can, me }) {
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(new Set())
  const [suggesting, setSuggesting] = React.useState(false)

  const canAdd = can.create({ type: "packing", authorHandle: me?.userHandle }).ok

  async function add() {
    if (!text.trim()) return
    try {
      await database.put({ type: "packing", text: text.trim(), checked: false, authorHandle: me?.userHandle, createdAt: Date.now() })
      setText("")
    } catch (e) { alert(e.message) }
  }

  async function toggle(item) {
    setSaving(s => new Set(s).add(item._id))
    try {
      await database.put({ ...item, checked: !item.checked })
    } catch (e) { alert(e.message) }
    finally { setSaving(s => { const n = new Set(s); n.delete(item._id); return n }) }
  }

  async function suggest() {
    setSuggesting(true)
    try {
      const resp = await callAI(`Suggest 6 essential packing items for a trip to ${trip?.destination || "anywhere"} from ${trip?.startDate || ""} to ${trip?.endDate || ""}. Keep each item short (1-3 words).`, {
        schema: { properties: { items: { type: "array", items: { type: "string" } } } }
      })
      const parsed = JSON.parse(resp)
      for (const it of parsed.items || []) {
        await database.put({ type: "packing", text: it, checked: false, authorHandle: me?.userHandle, createdAt: Date.now() })
      }
    } catch (e) { alert("Suggest failed") }
    finally { setSuggesting(false) }
  }

  return (
    <section id="packing" className={`${c.surface} ${c.border} border rounded-[var(--radius)] p-[var(--spacing)] mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-lg font-semibold ${c.textPrimary}`}>Packing list</h2>
        {canAdd && (
          <button disabled={suggesting} onClick={suggest} className={`text-xs ${c.accent} min-h-[44px] px-2`}>
            {suggesting ? (<svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50" /></svg>) : "✨ Suggest"}
          </button>
        )}
      </div>
      <ul className="space-y-1 mb-3">
        {packing.sort((a, b) => a.createdAt - b.createdAt).map(item => {
          const isSaving = saving.has(item._id)
          return (
            <li key={item._id} className={`flex items-center gap-2 text-sm ${isSaving ? 'opacity-60' : ''}`}>
              <input type="checkbox" checked={!!item.checked} disabled={isSaving || !can.edit(item).ok} onChange={() => toggle(item)} className="w-5 h-5" />
              <span className={`flex-1 ${item.checked ? 'line-through ' + c.textSecondary : c.textPrimary}`}>{item.text}</span>
              {isSaving && <span className={`text-xs ${c.textSecondary}`}>Saving…</span>}
              {can.delete(item).ok && <button onClick={() => database.del(item._id)} className={`text-xs ${c.textSecondary} px-2`}>×</button>}
            </li>
          )
        })}
      </ul>
      {canAdd && (
        <div className="flex gap-2">
          <input className={c.input} value={text} onChange={e => setText(e.target.value)} placeholder="Add item" onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} className={c.primary}>Add</button>
        </div>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag, viewer } = useViewer()
  const { can, ready, me } = useVibe("wayfare")
  const { database, useLiveQuery, useDocument } = useFireproof("wayfare")
  const { docs: tripDocs } = useLiveQuery("type", { key: "trip" })
  const trip = tripDocs[0]
  const { docs: activities } = useLiveQuery("type", { key: "activity" })
  const { docs: packing } = useLiveQuery("type", { key: "packing" })

  const c = {
    page: 'bg-[var(--background)] min-h-screen font-[var(--font-family)] text-[length:var(--font-size-base)]',
    surface: 'bg-[var(--surface)]',
    border: 'border-[var(--border)] border-[length:var(--border-width)]',
    textPrimary: 'text-[var(--text-primary)]',
    textSecondary: 'text-[var(--text-secondary)]',
    primary: 'bg-[var(--primary)] text-[var(--accent-text,#fafafa)] rounded-[var(--radius-sm)] px-3 py-2 min-h-[44px]',
    accent: 'text-[var(--accent)]',
    input: 'w-full bg-[var(--background)] border-[var(--border)] border-[length:var(--border-width)] rounded-[var(--radius-sm)] px-3 py-2 min-h-[44px] text-[var(--text-primary)]',
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={`${c.surface} ${c.border} border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between`}>
        <h1 className={`text-xl font-bold ${c.textPrimary}`}>Wayfare</h1>
        <ViewerTag />
      </header>
      <main id="app" className="max-w-2xl mx-auto p-4">
        <TripHeader c={c} database={database} trip={trip} can={can} />
        <Itinerary c={c} database={database} activities={activities} trip={trip} can={can} me={me} />
        <PackingList c={c} database={database} packing={packing} trip={trip} can={can} me={me} />
      </main>
    </div>
  )
}