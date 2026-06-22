import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function TripSetup({ trip, database, can, ready }) {
  const [destination, setDestination] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")

  async function createTrip(e) {
    e.preventDefault()
    if (!destination.trim() || !startDate || !endDate) return
    try {
      await database.put({ type: "trip", destination: destination.trim(), startDate, endDate, createdAt: Date.now() })
    } catch (err) { console.error(err) }
  }

  if (trip) {
    const days = Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1)
    return (
      <section id="trip-setup" className="bg-[var(--surface)] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{trip.destination}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{trip.startDate} → {trip.endDate} · {days} day{days > 1 ? "s" : ""}</p>
      </section>
    )
  }

  const verdict = ready ? can.create({ type: "trip" }) : { ok: false, reason: "Loading..." }

  return (
    <section id="trip-setup" className="bg-[var(--surface)] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Plan a new trip</h2>
      {verdict.ok ? (
        <form onSubmit={createTrip} className="space-y-3">
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination (e.g. Lisbon)" className="w-full px-3 py-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]" />
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 px-3 py-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 px-3 py-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]" />
          </div>
          <button type="submit" className="w-full px-4 py-3 rounded-[var(--radius)] bg-[var(--primary)] text-[var(--accent-text,white)] font-semibold min-h-[44px]">Start trip</button>
        </form>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{verdict.reason}</p>
      )}
    </section>
  )
}

function DayCard({ dayIndex, dayDate, trip, database, can, ready, me }) {
  const { useLiveQuery } = useFireproof("wayfarer")
  const { docs: activities } = useLiveQuery("dayIndex", { key: dayIndex })
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(new Set())

  const draft = { type: "activity", dayIndex, text: text.trim(), authorHandle: me?.userHandle }
  const verdict = ready ? can.create(draft) : { ok: false }

  async function addActivity(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await database.put({ type: "activity", dayIndex, text: text.trim(), authorHandle: me?.userHandle, createdAt: Date.now() })
      setText("")
    } catch (err) { console.error(err) }
  }

  async function suggest() {
    setLoading(true)
    try {
      const res = await callAI(`Suggest 3 short activities for day ${dayIndex + 1} of a trip to ${trip.destination}. Keep each under 8 words.`, {
        schema: { properties: { activities: { type: "array", items: { type: "string" } } } }
      })
      const { activities: items } = JSON.parse(res)
      for (const item of items) {
        await database.put({ type: "activity", dayIndex, text: item, authorHandle: me?.userHandle, createdAt: Date.now() })
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  async function removeActivity(doc) {
    setSaving(s => new Set(s).add(doc._id))
    try { await database.del(doc._id) } catch (err) { console.error(err) }
    finally { setSaving(s => { const n = new Set(s); n.delete(doc._id); return n }) }
  }

  return (
    <div className="bg-[var(--background)] rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[var(--text-primary)]">Day {dayIndex + 1} <span className="font-normal text-[var(--text-secondary)] text-sm">· {dayDate}</span></h3>
        {verdict.ok && (
          <button onClick={suggest} disabled={loading} className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50 flex items-center gap-1">
            {loading ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : null}
            Suggest
          </button>
        )}
      </div>
      <ul className="space-y-1 mb-2">
        {activities.map(a => (
          <li key={a._id} className={`flex items-center justify-between text-sm text-[var(--text-primary)] ${saving.has(a._id) ? 'opacity-50' : ''}`}>
            <span>{a.text}</span>
            {verdict.ok && <button onClick={() => removeActivity(a)} disabled={saving.has(a._id)} className="text-[var(--text-secondary)] text-xs">×</button>}
          </li>
        ))}
      </ul>
      {verdict.ok && (
        <form onSubmit={addActivity} className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Add activity" className="flex-1 px-2 py-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] text-sm min-h-[40px]" />
          <button type="submit" className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text,white)] text-sm">Add</button>
        </form>
      )}
    </div>
  )
}

function Itinerary({ trip, database, can, ready, me }) {
  if (!trip) {
    return (
      <section id="itinerary" className="bg-[var(--surface)] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Itinerary</h2>
        <p className="text-sm text-[var(--text-secondary)]">Day cards appear here once a trip is set.</p>
      </section>
    )
  }
  const days = Math.max(1, Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1)
  const dayList = Array.from({ length: days }, (_, i) => {
    const d = new Date(trip.startDate)
    d.setDate(d.getDate() + i)
    return { i, date: d.toISOString().slice(0, 10) }
  })
  return (
    <section id="itinerary" className="bg-[var(--surface)] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Itinerary</h2>
      <div className="space-y-3">
        {dayList.map(d => <DayCard key={d.i} dayIndex={d.i} dayDate={d.date} trip={trip} database={database} can={can} ready={ready} me={me} />)}
      </div>
    </section>
  )
}

function PackingList({ trip, database, can, ready, me }) {
  const { useLiveQuery } = useFireproof("wayfarer")
  const { docs: items } = useLiveQuery("type", { key: "packing" })
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(new Set())

  const draft = { type: "packing", text: text.trim(), authorHandle: me?.userHandle }
  const verdict = ready ? can.create(draft) : { ok: false, reason: "Loading..." }

  async function addItem(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await database.put({ type: "packing", text: text.trim(), checked: false, authorHandle: me?.userHandle, createdAt: Date.now() })
      setText("")
    } catch (err) { console.error(err) }
  }

  async function toggleItem(doc) {
    setSaving(s => new Set(s).add(doc._id))
    try { await database.put({ ...doc, checked: !doc.checked }) } catch (err) { console.error(err) }
    finally { setSaving(s => { const n = new Set(s); n.delete(doc._id); return n }) }
  }

  async function removeItem(doc) {
    setSaving(s => new Set(s).add(doc._id))
    try { await database.del(doc._id) } catch (err) { console.error(err) }
    finally { setSaving(s => { const n = new Set(s); n.delete(doc._id); return n }) }
  }

  async function suggest() {
    if (!trip) return
    setLoading(true)
    try {
      const res = await callAI(`Suggest 6 packing items for a trip to ${trip.destination} from ${trip.startDate} to ${trip.endDate}. Short names only.`, {
        schema: { properties: { items: { type: "array", items: { type: "string" } } } }
      })
      const { items: list } = JSON.parse(res)
      for (const item of list) {
        await database.put({ type: "packing", text: item, checked: false, authorHandle: me?.userHandle, createdAt: Date.now() })
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  return (
    <section id="packing" className="bg-[var(--surface)] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Packing list</h2>
        {verdict.ok && trip && (
          <button onClick={suggest} disabled={loading} className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] disabled:opacity-50 flex items-center gap-1">
            {loading ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : null}
            Suggest
          </button>
        )}
      </div>
      <ul className="space-y-1 mb-3">
        {items.map(it => (
          <li key={it._id} className={`flex items-center justify-between gap-2 text-sm ${saving.has(it._id) ? 'opacity-50' : ''}`}>
            <label className="flex items-center gap-2 flex-1 min-h-[40px]">
              <input type="checkbox" checked={!!it.checked} disabled={!verdict.ok || saving.has(it._id)} onChange={() => toggleItem(it)} className="w-5 h-5" />
              <span className={it.checked ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>{it.text}</span>
            </label>
            {verdict.ok && <button onClick={() => removeItem(it)} disabled={saving.has(it._id)} className="text-[var(--text-secondary)] text-xs">×</button>}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-[var(--text-secondary)]">Nothing yet.</li>}
      </ul>
      {verdict.ok ? (
        <form onSubmit={addItem} className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Add item" className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-sm min-h-[40px]" />
          <button type="submit" className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text,white)] text-sm">Add</button>
        </form>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{verdict.reason}</p>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("wayfarer")
  const { useLiveQuery, database } = useFireproof("wayfarer")
  const { docs: trips } = useLiveQuery("type", { key: "trip" })
  const trip = trips[0]

  const c = {
    page: 'min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]',
    header: 'sticky top-0 z-10 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between',
    main: 'max-w-2xl mx-auto p-4 space-y-4 pb-24',
    brand: 'text-xl font-bold tracking-tight',
  }

  return (
    <div className={c.page}>
      <style>{`:root{--background:oklch(1.00 0 0);--surface:rgba(255,255,255,0.85);--primary:oklch(0.62 0.24 25);--text-primary:rgba(20,20,20,0.92);--text-secondary:rgba(20,20,20,0.5);--border:rgba(20,20,20,0.14);--accent:oklch(0.62 0.24 25);--secondary:oklch(0.62 0.24 25);--font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--radius:0.5rem;--radius-sm:0.25rem;--radius-lg:1rem;--spacing:1rem;--border-width:1px;}@media (prefers-color-scheme:dark){:root{--background:oklch(0.06 0 0);--surface:rgba(255,255,255,0.04);--primary:oklch(0.38 0.24 25);--text-primary:rgba(255,255,255,0.92);--text-secondary:rgba(255,255,255,0.55);--border:rgba(255,255,255,0.18);--accent:oklch(0.38 0.24 25);--secondary:oklch(0.38 0.24 25);}}`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.brand}>Wayfarer</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <TripSetup trip={trip} database={database} can={can} ready={ready} />
        <Itinerary trip={trip} database={database} can={can} ready={ready} me={me} />
        <PackingList trip={trip} database={database} can={can} ready={ready} me={me} />
      </main>
    </div>
  )
}