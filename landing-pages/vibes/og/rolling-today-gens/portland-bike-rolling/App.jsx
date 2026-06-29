import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js"
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css"
const TILE_STYLE = "https://tiles.openfreemap.org/styles/positron"
const PDX_CENTER = [-122.6765, 45.5231]

function loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.maplibregl) return Promise.resolve(window.maplibregl)
  if (window.__maplibreLoading) return window.__maplibreLoading
  if (!document.querySelector("link[data-maplibre]")) {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = MAPLIBRE_CSS
    link.setAttribute("data-maplibre", "")
    document.head.appendChild(link)
  }
  window.__maplibreLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = MAPLIBRE_JS
    script.async = true
    script.setAttribute("data-maplibre", "")
    script.onload = () => resolve(window.maplibregl)
    script.onerror = () => reject(new Error("maplibre load failed"))
    document.head.appendChild(script)
  })
  return window.__maplibreLoading
}

function MapView({ rides, accent = "#e76f9a", borderColor = "#1a1a2e", wrapperClass = "" }) {
  const containerRef = React.useRef(null)
  const mapRef = React.useRef(null)
  const markersRef = React.useRef([])
  const [mlib, setMlib] = React.useState(null)
  const { useLiveQuery, database } = useFireproof("rolling-today")
  const { docs: geocodes } = useLiveQuery("type", { key: "geocode" })
  const geoByAddr = React.useMemo(() => {
    const m = {}; for (const g of geocodes) if (g.address) m[g.address] = g; return m
  }, [geocodes])
  React.useEffect(() => {
    let cancelled = false
    loadMapLibre().then(lib => { if (!cancelled) setMlib(lib) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  React.useEffect(() => {
    if (!mlib || !containerRef.current || mapRef.current) return
    const map = new mlib.Map({ container: containerRef.current, style: TILE_STYLE, center: PDX_CENTER, zoom: 10 })
    map.addControl(new mlib.NavigationControl({ showCompass: false }))
    mapRef.current = map
    return () => { try { map.remove() } catch (_) {} mapRef.current = null }
  }, [mlib])
  React.useEffect(() => {
    if (!rides.length) return
    const seen = new Set(); const needed = []
    for (const r of rides) {
      if (!r.address || seen.has(r.address)) continue
      seen.add(r.address)
      const cached = geoByAddr[r.address]
      if (!cached || cached.lat == null) needed.push(r)
    }
    if (!needed.length) return
    let cancelled = false
    const lookup = async (q) => {
      if (!q) return null
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } })
        if (!res.ok) return null
        const arr = await res.json()
        if (!arr[0]) return null
        return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
      } catch (_) { return null }
    }
    ;(async () => {
      for (const ride of needed) {
        if (cancelled) return
        let hit = await lookup(ride.address)
        if (!hit) {
          await new Promise(res => setTimeout(res, 1100))
          if (cancelled) return
          if (ride.venue) hit = await lookup(`${ride.venue}, Portland, OR`)
        }
        if (hit) await database.put({ type: "geocode", address: ride.address, lat: hit.lat, lng: hit.lng, ts: Date.now() })
        await new Promise(res => setTimeout(res, 1100))
      }
    })()
    return () => { cancelled = true }
  }, [rides, geoByAddr, database])
  React.useEffect(() => {
    if (!mlib || !mapRef.current) return
    for (const m of markersRef.current) m.remove()
    markersRef.current = []
    const bounds = new mlib.LngLatBounds()
    let any = false
    for (const r of rides) {
      const g = r.address && geoByAddr[r.address]
      if (!g || g.lat == null) continue
      const el = document.createElement("div")
      el.title = r.title || ""
      el.style.cssText = `width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:3px solid ${borderColor};box-shadow:2px 2px 0 ${borderColor};cursor:pointer;`
      const popup = new mlib.Popup({ offset: 18, closeButton: false }).setHTML(
        `<strong style="font-family:system-ui">${(r.title || "").replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</strong>`
      )
      const marker = new mlib.Marker({ element: el, anchor: "bottom" }).setLngLat([g.lng, g.lat]).setPopup(popup).addTo(mapRef.current)
      markersRef.current.push(marker)
      bounds.extend([g.lng, g.lat]); any = true
    }
    if (any && !bounds.isEmpty()) { try { mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 }) } catch (_) {} }
  }, [mlib, rides, geoByAddr, accent, borderColor])
  const placedCount = rides.filter(r => r.address && geoByAddr[r.address] && geoByAddr[r.address].lat != null).length
  const pendingCount = rides.filter(r => r.address && !geoByAddr[r.address]).length
  return (
    <div className={wrapperClass}>
      <div ref={containerRef} style={{ width: "100%", height: 300 }} />
      <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, borderTop: `3px solid ${borderColor}`, display: "flex", justifyContent: "space-between" }}>
        <span>{placedCount} of {rides.length} on the map</span>
        {pendingCount > 0 && <span style={{ opacity: 0.7 }}>geocoding {pendingCount}…</span>}
      </div>
    </div>
  )
}

function NoteEditor({ selectedId, events, database, useLiveQuery, c, formatTime }) {
  const { docs: notes } = useLiveQuery("type", { key: "note" })
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const ev = events.find(e => String(e.id) === selectedId)
  const existing = notes.find(n => n.eventId === selectedId)

  React.useEffect(() => { setText(existing?.text || "") }, [selectedId, existing?._id])

  async function save() {
    if (!selectedId) return
    setSaving(true)
    try {
      if (existing) await database.put({ ...existing, text, updatedAt: Date.now() })
      else await database.put({ type: "note", eventId: selectedId, title: ev?.title || "", text, updatedAt: Date.now() })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {selectedId && ev ? (
        <div>
          <div className="text-xs uppercase tracking-wider mb-1">Note for:</div>
          <div className="font-bold mb-2">{ev.title} · {formatTime(ev.time)}</div>
          <textarea className={c.input} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="who you're going with, what to bring…" />
          <button className={c.navBtn + " mt-2"} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      ) : (
        <p className="text-sm italic mb-3">Tap "Add Note" on any ride above to jot something down.</p>
      )}
      {notes.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.2em] mb-2">All Notes</div>
          <ul className="space-y-2">
            {notes.map(n => (
              <li key={n._id} className="border-[2px] border-[#1a1a2e] p-2">
                <div className="font-bold text-sm">{n.title}</div>
                <div className="text-sm whitespace-pre-wrap">{n.text}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("rolling-today")
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [events, setEvents] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [skippedTo, setSkippedTo] = React.useState(null)
  const [selectedId, setSelectedId] = React.useState(null)

  function addDays(d, n) {
    const dt = new Date(d + "T12:00:00")
    dt.setDate(dt.getDate() + n)
    return dt.toISOString().slice(0, 10)
  }

  function formatDate(d) {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  }

  function formatTime(t) {
    if (!t) return ""
    const [h, m] = t.split(":").map(Number)
    const ampm = h >= 12 ? "PM" : "AM"
    const hh = h % 12 || 12
    return `${hh}:${String(m).padStart(2, "0")} ${ampm}`
  }

  async function fetchDay(d) {
    const url = `https://www.shift2bikes.org/api/events.php?startdate=${d}&enddate=${d}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    const data = await res.json()
    return (data.events || []).filter(e => !e.cancelled).sort((a, b) => (a.time || "").localeCompare(b.time || ""))
  }

  async function loadFrom(startDate, direction = 1) {
    setLoading(true)
    setSkippedTo(null)
    let d = startDate
    let evts = []
    for (let i = 0; i < 30; i++) {
      evts = await fetchDay(d)
      if (evts.length > 0) break
      d = addDays(d, direction)
    }
    if (d !== startDate) setSkippedTo(d)
    setDate(d)
    setEvents(evts)
    setLoading(false)
  }

  React.useEffect(() => { loadFrom(date, 1) }, [])

  const audienceLabel = { G: "General", F: "Family-Friendly", A: "21+ Only" }
  const areaLabel = { P: "Portland", V: "Vancouver", W: "Westside", E: "East PDX", C: "Clackamas" }

  const { docs: savedDocs } = useLiveQuery("type", { key: "saved" })
  const savedIds = new Set(savedDocs.map(d => d.eventId))

  async function toggleSave(ev) {
    const existing = savedDocs.find(d => d.eventId === String(ev.id))
    if (existing) await database.del(existing._id)
    else await database.put({ type: "saved", eventId: String(ev.id), title: ev.title, date: ev.date, time: ev.time, venue: ev.venue, savedAt: Date.now() })
  }

  const c = {
    page: "min-h-screen bg-[#fdf6e9] text-[#1a1a2e] font-serif",
    header: "bg-[#ff5c8a] text-[#fdf6e9] border-b-[3px] border-[#1a1a2e] px-4 py-5",
    title: "text-3xl font-black uppercase tracking-tight leading-none",
    tagline: "text-xs uppercase tracking-[0.2em] mt-1 text-[#fdf6e9]/90",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section: "bg-[#fdf6e9] border-[3px] border-[#1a1a2e] shadow-[6px_6px_0_#00b4d8] p-4",
    sectionAlt: "bg-[#fdf6e9] border-[3px] border-[#1a1a2e] shadow-[6px_6px_0_#ff5c8a] p-4",
    h2: "text-2xl font-black uppercase tracking-tight mb-3",
    navRow: "flex items-center justify-between gap-2 mb-4",
    navBtn: "px-3 py-2 bg-[#1a1a2e] text-[#fdf6e9] font-bold uppercase text-sm tracking-wider border-[2px] border-[#1a1a2e] hover:bg-[#ff5c8a] active:translate-y-[2px] min-h-[44px]",
    dateBig: "text-center font-black uppercase",
    rideCard: "bg-[#fdf6e9] border-[3px] border-[#1a1a2e] shadow-[5px_5px_0_#ff5c8a] p-4 relative",
    rideTime: "text-4xl font-black text-[#ff5c8a] leading-none tracking-tight",
    rideTitle: "text-xl font-black uppercase leading-tight mt-2",
    badge: "inline-block px-2 py-1 text-xs font-bold uppercase tracking-wider border-[2px] border-[#1a1a2e] mr-2",
    link: "underline decoration-[#00b4d8] decoration-[3px] underline-offset-2 font-bold",
    input: "w-full px-3 py-2 bg-[#fdf6e9] border-[3px] border-[#1a1a2e] font-serif text-base min-h-[44px] focus:outline-none focus:shadow-[3px_3px_0_#00b4d8]",
    star: "absolute top-3 right-3 text-3xl min-h-[44px] min-w-[44px] flex items-center justify-center",
    notice: "bg-[#00b4d8] text-[#fdf6e9] border-[3px] border-[#1a1a2e] px-3 py-2 text-sm font-bold uppercase tracking-wider mb-4",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <img src="https://www.shift2bikes.org/images/pp/pp2026-banner.jpg" alt="Pedalpalooza Bike Summer 2026" className="w-full max-w-3xl mx-auto mb-3 border-[3px] border-[#1a1a2e]" style={{filter:'sepia(0.15) saturate(1.1)'}} />
        <h1 className={c.title}>Rolling Today</h1>
        <p className={c.tagline}>★ Portland Bike Summer Daily Zine ★</p>
      </header>
      <main id="app" className={c.main}>
        {events.length > 0 && (
          <section id="map" className="mb-4">
            <MapView rides={events} accent="#e76f9a" borderColor="#1a1a2e" wrapperClass="bg-[#fffaf0] border-[3px] border-[#1a1a2e] overflow-hidden" />
          </section>
        )}
        <section id="today-feed" className={c.section}>
          <div className={c.navRow}>
            <button className={c.navBtn} disabled={loading} onClick={() => loadFrom(addDays(date, -1), -1)}>← Prev</button>
            <div className={c.dateBig}>
              <div className="text-xs tracking-[0.3em]">Rolling</div>
              <div className="text-2xl">{formatDate(date)}</div>
            </div>
            <button className={c.navBtn} disabled={loading} onClick={() => loadFrom(addDays(date, 1), 1)}>Next →</button>
          </div>
          {skippedTo && <div className={c.notice}>↪ Skipped to {formatDate(skippedTo)} — nearest day with rides</div>}
          {loading && (
            <div className="text-center py-8">
              <svg className="animate-spin inline-block" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round">
                <path d="M12 2 A10 10 0 0 1 22 12" />
              </svg>
              <div className="text-sm uppercase tracking-wider mt-2">Loading rides…</div>
            </div>
          )}
          {!loading && events.length === 0 && <p className="text-center py-6">No rides found.</p>}
          <div className="space-y-4">
            {events.map(ev => {
              const saved = savedIds.has(String(ev.id))
              return (
                <article key={ev.id} className={c.rideCard}>
                  <button className={c.star} aria-label="save" onClick={() => toggleSave(ev)}>{saved ? "★" : "☆"}</button>
                  <div className={c.rideTime}>{formatTime(ev.time)}</div>
                  {ev.endtime && <div className="text-xs uppercase tracking-wider text-[#1a1a2e]/60">until {formatTime(ev.endtime)}</div>}
                  <h3 className={c.rideTitle}>{ev.title}</h3>
                  {ev.image && <img src={`https://www.shift2bikes.org${ev.image}`} alt="" className="mt-3 border-[3px] border-[#1a1a2e] w-full" style={{filter:'sepia(0.2) contrast(1.1)'}} />}
                  {ev.newsflash && <div className={c.notice + " mt-3"}>⚡ {ev.newsflash}</div>}
                  {ev.venue && <p className="text-sm mt-2"><strong>Venue:</strong> {ev.venue}</p>}
                  {ev.address && <p className="text-sm"><a className={c.link} href={`https://maps.google.com/?q=${encodeURIComponent(ev.address)}`} target="_blank" rel="noreferrer">{ev.address} ↗</a></p>}
                  {ev.organizer && <p className="text-sm"><strong>Host:</strong> {ev.organizer}</p>}
                  {ev.ridelength && <p className="text-sm"><strong>Length:</strong> {ev.ridelength}</p>}
                  {ev.details && <p className="text-sm mt-2">{ev.details}</p>}
                  <div className="mt-3">
                    {ev.audience && <span className={c.badge} style={{background:'#00b4d8',color:'#fdf6e9'}}>{ev.audience} · {audienceLabel[ev.audience] || ev.audience}</span>}
                    {ev.area && <span className={c.badge} style={{background:'#ff5c8a',color:'#fdf6e9'}}>{ev.area} · {areaLabel[ev.area] || ev.area}</span>}
                  </div>
                  <div className="mt-3 flex gap-3 text-sm flex-wrap">
                    {ev.exportable && <a className={c.link} href={ev.exportable} target="_blank" rel="noreferrer">+ Calendar</a>}
                    {ev.shareable && <a className={c.link} href={ev.shareable} target="_blank" rel="noreferrer">Details ↗</a>}
                    <button className={c.link} onClick={() => setSelectedId(String(ev.id))}>Add Note</button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
        <section id="saved-rides" className={c.sectionAlt}>
          <h2 className={c.h2}>★ Your Saved Rides</h2>
          {savedDocs.length === 0 ? (
            <p className="text-sm italic">Tap ☆ on any ride to save it here for later.</p>
          ) : (
            <ul className="space-y-2">
              {savedDocs.sort((a,b) => (a.date||"").localeCompare(b.date||"") || (a.time||"").localeCompare(b.time||"")).map(s => (
                <li key={s._id} className="border-[2px] border-[#1a1a2e] p-2 flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-sm">{s.title}</div>
                    <div className="text-xs text-[#1a1a2e]/70">{s.date} · {formatTime(s.time)} · {s.venue}</div>
                  </div>
                  <button className="text-xl min-h-[44px] min-w-[44px]" onClick={() => database.del(s._id)} aria-label="remove">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="ride-notes" className={c.section}>
          <h2 className={c.h2}>✎ Ride Notes</h2>
          <NoteEditor selectedId={selectedId} events={events} database={database} useLiveQuery={useLiveQuery} c={c} formatTime={formatTime} />
        </section>
      </main>
    </div>
  )
}