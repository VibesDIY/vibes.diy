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

function MapView({ rides, database, accent = "#ff6b1a" }) {
  const containerRef = React.useRef(null)
  const mapRef = React.useRef(null)
  const markersRef = React.useRef([])
  const [mlib, setMlib] = React.useState(null)
  const { useLiveQuery } = useFireproof("rolling-today")
  const { docs: geocodes } = useLiveQuery("type", { key: "geocode" })

  const geoByAddr = React.useMemo(() => {
    const m = {}
    for (const g of geocodes) if (g.address) m[g.address] = g
    return m
  }, [geocodes])

  React.useEffect(() => {
    let cancelled = false
    loadMapLibre().then(lib => { if (!cancelled) setMlib(lib) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (!mlib || !containerRef.current || mapRef.current) return
    const map = new mlib.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: PDX_CENTER,
      zoom: 10,
    })
    map.addControl(new mlib.NavigationControl({ showCompass: false }))
    mapRef.current = map
    return () => { try { map.remove() } catch (_) {} mapRef.current = null }
  }, [mlib])

  React.useEffect(() => {
    if (!rides.length) return
    const seen = new Set()
    const needed = []
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
        if (hit) {
          await database.put({
            type: "geocode",
            address: ride.address,
            lat: hit.lat,
            lng: hit.lng,
            ts: Date.now(),
          })
        }
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
      el.style.cssText = `width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:3px solid #1a1208;box-shadow:2px 2px 0 #1a1208;cursor:pointer;`
      const popup = new mlib.Popup({ offset: 18, closeButton: false }).setHTML(
        `<strong style="font-family:system-ui">${(r.title || "").replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</strong>`
      )
      const marker = new mlib.Marker({ element: el, anchor: "bottom" })
        .setLngLat([g.lng, g.lat])
        .setPopup(popup)
        .addTo(mapRef.current)
      markersRef.current.push(marker)
      bounds.extend([g.lng, g.lat])
      any = true
    }
    if (any && !bounds.isEmpty()) {
      try { mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 }) } catch (_) {}
    }
  }, [mlib, rides, geoByAddr, accent])

  const placedCount = rides.filter(r => r.address && geoByAddr[r.address] && geoByAddr[r.address].lat != null).length
  const pendingCount = rides.filter(r => r.address && !geoByAddr[r.address]).length

  return (
    <div className="bg-[#fffaf0] border-[3px] border-[#1a1208] rounded shadow-[5px_5px_0_#1a1208] overflow-hidden">
      <div ref={containerRef} style={{ width: "100%", height: 300 }} />
      <div className="px-3 py-2 text-xs font-bold border-t-[3px] border-[#1a1208] flex justify-between gap-2">
        <span>{placedCount} of {rides.length} on the map</span>
        {pendingCount > 0 && <span className="opacity-70">geocoding {pendingCount}…</span>}
      </div>
    </div>
  )
}

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("rolling-today")
  const [currentDate, setCurrentDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [rides, setRides] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [skipNotice, setSkipNotice] = React.useState("")

  const fetchDay = React.useCallback(async (dateStr) => {
    const res = await fetch(`https://www.shift2bikes.org/api/events.php?startdate=${dateStr}&enddate=${dateStr}`, {
      headers: { "Accept": "application/json" }
    })
    const data = await res.json()
    return (data.events || []).filter(e => !e.cancelled).sort((a, b) => (a.time || "").localeCompare(b.time || ""))
  }, [])

  const loadDirection = React.useCallback(async (startDate, dir) => {
    setIsLoading(true)
    setSkipNotice("")
    let d = new Date(startDate + "T12:00:00")
    let attempts = 0
    let originalStr = startDate
    try {
      while (attempts < 30) {
        const ds = d.toISOString().slice(0, 10)
        const evs = await fetchDay(ds)
        if (evs.length > 0) {
          setCurrentDate(ds)
          setRides(evs)
          if (ds !== originalStr) setSkipNotice(`Skipped to ${ds}`)
          return
        }
        d.setDate(d.getDate() + dir)
        attempts++
      }
      setRides([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchDay])

  React.useEffect(() => { loadDirection(currentDate, 1) }, [])

  const goPrev = () => {
    const d = new Date(currentDate + "T12:00:00")
    d.setDate(d.getDate() - 1)
    loadDirection(d.toISOString().slice(0, 10), -1)
  }
  const goNext = () => {
    const d = new Date(currentDate + "T12:00:00")
    d.setDate(d.getDate() + 1)
    loadDirection(d.toISOString().slice(0, 10), 1)
  }

  const formatDate = (s) => {
    const d = new Date(s + "T12:00:00")
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
  }
  const format12h = (t) => {
    if (!t) return ""
    const [h, m] = t.split(":")
    const hr = parseInt(h)
    const ampm = hr >= 12 ? "PM" : "AM"
    const h12 = hr % 12 || 12
    return `${h12}:${m} ${ampm}`
  }
  const audienceLabel = { G: "General", F: "Family-Friendly", A: "21+ Only" }
  const areaLabel = { P: "Portland", V: "Vancouver", W: "Westside", E: "East PDX", C: "Clackamas" }

  const { docs: favs } = useLiveQuery("type", { key: "favorite" })
  const { docs: notes } = useLiveQuery("type", { key: "note", descending: true, limit: 50 })
  const { doc: noteDoc, merge: mergeNote, submit: submitNote } = useDocument({ type: "note", ride: "", text: "", createdAt: Date.now() })
  const favSet = new Set(favs.map(f => String(f.rideId)))
  const toggleFav = async (r) => {
    const existing = favs.find(f => String(f.rideId) === String(r.id))
    if (existing) await database.del(existing._id)
    else await database.put({ type: "favorite", rideId: r.id, title: r.title, time: r.time, date: r.date, venue: r.venue, shareable: r.shareable })
  }

  const c = {
    page: "min-h-screen bg-[#fdf4e3] text-[#1a1208] font-sans",
    header: "bg-[#ff6b1a] border-b-[3px] border-[#1a1208] px-4 py-5 shadow-[0_4px_0_#1a1208]",
    brand: "text-3xl md:text-4xl font-black italic tracking-tight uppercase text-[#fdf4e3] [text-shadow:3px_3px_0_#1a1208]",
    tagline: "text-xs uppercase tracking-[0.2em] text-[#1a1208] font-bold mt-1",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-[#fffaf0] border-[3px] border-[#1a1208] rounded p-4 shadow-[5px_5px_0_#1a1208]",
    dayHeader: "bg-[#0d8a8a] border-[3px] border-[#1a1208] rounded p-4 shadow-[5px_5px_0_#1a1208] text-[#fdf4e3]",
    btn: "bg-[#ff6b1a] text-[#1a1208] font-black uppercase tracking-wide px-4 py-3 border-[3px] border-[#1a1208] rounded shadow-[3px_3px_0_#1a1208] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none min-h-[44px]",
    rideCard: "bg-[#fffaf0] border-[3px] border-[#1a1208] rounded p-4 shadow-[5px_5px_0_#1a1208]",
    time: "text-3xl font-black italic text-[#ff6b1a]",
    title: "text-xl md:text-2xl font-black italic uppercase leading-tight",
    badge: "inline-block px-2 py-1 text-xs font-black uppercase border-[2px] border-[#1a1208] rounded",
    link: "underline decoration-2 underline-offset-2 font-bold text-[#0d8a8a]",
    input: "w-full px-3 py-3 bg-[#fffaf0] border-[3px] border-[#1a1208] rounded text-base min-h-[44px]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <img src="https://www.shift2bikes.org/images/pp/pp2026-banner.jpg" alt="Pedalpalooza Bike Summer 2026" className="w-full max-w-3xl mx-auto mb-3 border-[3px] border-[#1a1208] rounded shadow-[4px_4px_0_#1a1208]" />
        <h1 className={c.brand}>Rolling Today 🚴</h1>
        <p className={c.tagline}>Portland · Pedalpalooza Bike Summer</p>
      </header>
      <main id="app" className={c.main}>
        {rides.length > 0 && (
          <section id="map">
            <MapView rides={rides} database={database} accent="#ff6b1a" />
          </section>
        )}
        <section id="day-nav" className={c.dayHeader}>
          <div className="flex items-center justify-between gap-3">
            <button onClick={goPrev} disabled={isLoading} className={c.btn}>← Prev</button>
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.2em] font-bold opacity-80">Rolling</div>
              <div className="text-2xl md:text-3xl font-black italic uppercase leading-tight">
                {isLoading ? "Loading…" : formatDate(currentDate)}
              </div>
              <div className="text-sm font-bold mt-1">{currentDate}</div>
            </div>
            <button onClick={goNext} disabled={isLoading} className={c.btn}>Next →</button>
          </div>
          {skipNotice && <div className="mt-3 text-center text-sm font-bold bg-[#fdf4e3] text-[#1a1208] border-[2px] border-[#1a1208] rounded px-3 py-2 inline-block w-full">{skipNotice}</div>}
        </section>
        <section id="rides" className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tight">Today's Rides ({rides.length})</h2>
          {!isLoading && rides.length === 0 && (
            <div className={c.rideCard}><p className="font-bold">No rides found nearby. Try another day.</p></div>
          )}
          {rides.map((r, i) => (
            <div key={r.id} className={c.rideCard} style={{ transform: `rotate(${i % 2 ? 0.4 : -0.4}deg)` }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className={c.time}>{format12h(r.time)}{r.endtime ? <span className="text-base text-[#1a1208] font-bold"> – {format12h(r.endtime)}</span> : null}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {r.audience && <span className={c.badge} style={{ background: "#ffd166", transform: "rotate(-2deg)" }}>{audienceLabel[r.audience] || r.audience}</span>}
                  {r.area && <span className={c.badge} style={{ background: "#0d8a8a", color: "#fdf4e3", transform: "rotate(2deg)" }}>{areaLabel[r.area] || r.area}</span>}
                  {r.loopride && <span className={c.badge} style={{ background: "#ff6b1a", color: "#fdf4e3", transform: "rotate(-1deg)" }}>Loop</span>}
                </div>
              </div>
              <h3 className={c.title + " mt-2"}>{r.title}</h3>
              {r.image && <img src={`https://www.shift2bikes.org${r.image}`} alt="" className="mt-3 w-full max-h-64 object-cover border-[3px] border-[#1a1208] rounded" />}
              <div className="mt-3 space-y-1 text-sm font-bold">
                {r.venue && <div>📍 {r.venue}</div>}
                {r.address && <a className={c.link} href={`https://maps.google.com/?q=${encodeURIComponent(r.address)}`} target="_blank" rel="noopener">{r.address}</a>}
                {r.organizer && <div>🚴 {r.organizer}</div>}
                {r.ridelength && <div>📏 {r.ridelength}</div>}
              </div>
              {r.newsflash && (
                <div className="mt-3 bg-[#ffd166] border-[3px] border-[#1a1208] rounded p-3 font-bold text-sm">⚡ {r.newsflash}</div>
              )}
              {r.details && <p className="mt-3 text-sm">{r.details}</p>}
              <div className="mt-3 flex gap-2 flex-wrap">
                {r.exportable && <a className={c.btn} href={r.exportable} target="_blank" rel="noopener">+ Calendar</a>}
                {r.shareable && <a className={c.btn} href={r.shareable} target="_blank" rel="noopener" style={{ background: "#0d8a8a", color: "#fdf4e3" }}>Details</a>}
                <button onClick={() => toggleFav(r)} className={c.btn} style={{ background: favSet.has(String(r.id)) ? "#ffd166" : "#fffaf0" }}>
                  {favSet.has(String(r.id)) ? "★ Starred" : "☆ Star"}
                </button>
              </div>
            </div>
          ))}
        </section>
        <section id="favorites" className={c.section}>
          <h2 className="text-2xl font-black italic uppercase tracking-tight">⭐ Starred Rides ({favs.length})</h2>
          {favs.length === 0 ? (
            <p className="text-sm font-bold mt-2 opacity-70">Tap the star on any ride to save it here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {favs.map(f => (
                <li key={f._id} className="flex items-center justify-between gap-2 bg-[#ffd166] border-[2px] border-[#1a1208] rounded p-2">
                  <div className="text-sm font-bold">
                    <div>{f.title}</div>
                    <div className="text-xs opacity-70">{f.date} · {format12h(f.time)} · {f.venue}</div>
                  </div>
                  <button onClick={() => database.del(f._id)} className={c.btn} style={{ padding: "6px 10px", fontSize: "0.7rem" }}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="notes" className={c.section}>
          <h2 className="text-2xl font-black italic uppercase tracking-tight">📣 Crew Notes</h2>
          <p className="text-sm font-bold mt-2 opacity-70">Drop a quick note — visible to everyone on every device.</p>
          <form onSubmit={(e) => { e.preventDefault(); submitNote() }} className="mt-3 space-y-2">
            <input className={c.input} value={noteDoc.ride} onChange={e => mergeNote({ ride: e.target.value })} placeholder="Which ride?" />
            <input className={c.input} value={noteDoc.text} onChange={e => mergeNote({ text: e.target.value })} placeholder="Your note..." />
            <button type="submit" className={c.btn}>Post Note</button>
          </form>
          <ul className="mt-4 space-y-2">
            {notes.map(n => (
              <li key={n._id} className="bg-[#fdf4e3] border-[2px] border-[#1a1208] rounded p-3">
                <div className="text-xs font-black uppercase opacity-70">{n.ride || "general"}</div>
                <div className="font-bold">{n.text}</div>
                <button onClick={() => database.del(n._id)} className="text-xs underline mt-1 font-bold">delete</button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}