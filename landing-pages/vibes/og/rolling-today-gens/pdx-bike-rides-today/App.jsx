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

function MapView({ rides, accent = "#f4d35e", borderColor = "#1a1a2e", wrapperClass = "" }) {
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

const c = {
  page: "min-h-screen bg-[#fff4d6] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]",
  header: "bg-[#f4a261] border-b-[3px] border-[#1a1a2e] px-4 py-4 shadow-[0_4px_0_0_#1a1a2e]",
  title: "text-2xl font-bold uppercase tracking-tight",
  tagline: "text-[0.65rem] uppercase tracking-[0.15em] text-[#1a1a2e]/70 mt-1",
  main: "max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24",
  section: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_0_#1a1a2e] p-4",
  sectionAccent: "bg-[#e76f9a] border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_0_#1a1a2e] p-4 text-white",
  h2: "text-xs uppercase tracking-[0.15em] font-bold mb-3",
  btn: "px-3 py-2 bg-[#f4d35e] border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0_0_#1a1a2e] font-bold uppercase text-xs tracking-wider active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
  btnPrimary: "px-3 py-2 bg-[#e63946] text-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0_0_#1a1a2e] font-bold uppercase text-xs tracking-wider active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
  dayHeader: "bg-[#88c9e0] border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_0_#1a1a2e] p-5 text-center",
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("rolling-today")
  const { docs: favorites } = useLiveQuery("type", { key: "favorite" })
  const favIds = new Set(favorites.map((f) => String(f.rideId)))
  const toggleFav = async (r) => {
    const existing = favorites.find((f) => String(f.rideId) === String(r.id))
    if (existing) {
      await database.del(existing._id)
    } else {
      await database.put({
        type: "favorite",
        rideId: r.id,
        title: r.title,
        date: r.date,
        time: r.time,
        venue: r.venue,
        shareable: r.shareable,
        savedAt: Date.now(),
      })
    }
  }
  const [activeDate, setActiveDate] = React.useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [skippedFrom, setSkippedFrom] = React.useState(null)
  const [rides, setRides] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(false)

  const fmtDateLong = (iso) => {
    const [y, m, d] = iso.split("-").map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  }
  const addDays = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + n)
    return dt.toISOString().slice(0, 10)
  }

  const fetchDay = async (iso) => {
    const url = `https://www.shift2bikes.org/api/events.php?startdate=${iso}&enddate=${iso}`
    const r = await fetch(url, { headers: { Accept: "application/json" } })
    const j = await r.json()
    const evs = (j.events || []).filter((e) => !e.cancelled).sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    return evs
  }

  const loadFrom = async (iso, direction) => {
    setIsLoading(true)
    setSkippedFrom(null)
    let cur = iso
    let attempts = 0
    try {
      while (attempts < 14) {
        const evs = await fetchDay(cur)
        if (evs.length > 0) {
          if (cur !== iso) setSkippedFrom(iso)
          setActiveDate(cur)
          setRides(evs)
          return
        }
        cur = addDays(cur, direction)
        attempts++
      }
      setActiveDate(iso)
      setRides([])
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    loadFrom(activeDate, 1)
    // eslint-disable-next-line
  }, [])

  const goPrev = () => loadFrom(addDays(activeDate, -1), -1)
  const goNext = () => loadFrom(addDays(activeDate, 1), 1)

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <img src="https://www.shift2bikes.org/images/pp/pp2026-banner.jpg" alt="Pedalpalooza Bike Summer 2026" className="w-full max-w-3xl mx-auto mb-3 border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0_#1a1a2e]" />
        <h1 className={c.title}>Rolling Today</h1>
        <p className={c.tagline}>Portland · Pedalpalooza Bike Summer</p>
      </header>
      <main id="app" className={c.main}>
        {rides.length > 0 && (
          <section id="map">
            <MapView rides={rides} accent="#f4d35e" borderColor="#1a1a2e" wrapperClass="bg-[#fffaf0] border-[3px] border-[#1a1a2e] rounded shadow-[5px_5px_0_#1a1a2e] overflow-hidden" />
          </section>
        )}
        <section id="day-nav" className={c.dayHeader}>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-1">Riding</div>
          <div className="text-3xl font-bold uppercase tracking-tight leading-none mb-3">{fmtDateLong(activeDate)}</div>
          <div className="text-sm font-mono mb-4">{activeDate}</div>
          {skippedFrom && (
            <div className="text-[0.7rem] uppercase tracking-wider bg-[#f4d35e] border-[2px] border-[#1a1a2e] rounded px-2 py-1 mb-3 inline-block">
              Skipped to next day with rides (from {skippedFrom})
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <button className={c.btn} onClick={goPrev} disabled={isLoading}>◄ Prev</button>
            <button className={c.btn} onClick={goNext} disabled={isLoading}>Next ►</button>
          </div>
          {isLoading && <div className="mt-3 text-xs uppercase tracking-wider">Loading rides…</div>}
        </section>
        <section id="ride-list" className={c.section}>
          <h2 className={c.h2}>Rides · {rides.length}</h2>
          {!isLoading && rides.length === 0 && (
            <div className="text-sm py-6 text-center uppercase tracking-wider">No rides found nearby.</div>
          )}
          <div className="space-y-4">
            {rides.map((r) => {
              const fmtTime = (t) => {
                if (!t) return ""
                const [h, m] = t.split(":").map(Number)
                const ap = h >= 12 ? "PM" : "AM"
                const h12 = ((h + 11) % 12) + 1
                return `${h12}:${String(m).padStart(2, "0")} ${ap}`
              }
              const audMap = { G: ["General", "#88c9e0"], F: ["Family-Friendly", "#a8e6a3"], A: ["21+ Only", "#e76f9a"] }
              const areaMap = { P: ["Portland", "#f4a261"], V: ["Vancouver", "#f4d35e"], W: ["Westside", "#c9a8e6"], E: ["East PDX", "#e6a87c"], C: ["Clackamas", "#a8d8e6"] }
              const aud = audMap[r.audience]
              const area = areaMap[r.area]
              const fav = favIds.has(String(r.id))
              return (
                <article key={r.id} className="border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_0_#1a1a2e] p-4 bg-[#fffbe9]">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-2xl font-mono font-bold">
                      {fmtTime(r.time)}
                      {r.endtime && <span className="text-sm font-normal ml-1">– {fmtTime(r.endtime)}</span>}
                    </div>
                    <button
                      onClick={() => toggleFav(r)}
                      className={`text-xs uppercase tracking-wider px-2 py-1 border-[2px] border-[#1a1a2e] rounded ${fav ? "bg-[#e63946] text-white" : "bg-white"}`}
                    >
                      {fav ? "★ Saved" : "☆ Save"}
                    </button>
                  </div>
                  <div className="text-lg font-bold uppercase leading-tight mt-1">{r.title}</div>
                  {r.newsflash && (
                    <div className="mt-2 bg-[#f4d35e] border-[2px] border-[#1a1a2e] rounded p-2 text-xs font-bold">
                      📣 {r.newsflash}
                    </div>
                  )}
                  {r.image && (
                    <img src={`https://www.shift2bikes.org${r.image}`} alt="" className="mt-2 w-full border-[2px] border-[#1a1a2e] rounded" />
                  )}
                  {r.venue && <div className="text-sm mt-2"><span className="font-bold">Venue:</span> {r.venue}</div>}
                  {r.address && (
                    <div className="text-sm">
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(r.address)}`}>{r.address}</a>
                    </div>
                  )}
                  {r.organizer && <div className="text-xs mt-1"><span className="font-bold uppercase tracking-wider">By:</span> {r.organizer}</div>}
                  {r.ridelength && <div className="text-xs mt-1"><span className="font-bold uppercase tracking-wider">Length:</span> {r.ridelength}</div>}
                  {r.details && <div className="text-sm mt-2 whitespace-pre-wrap">{r.details}</div>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {aud && <span className="text-[0.65rem] uppercase tracking-wider border-2 border-[#1a1a2e] rounded px-2 py-0.5" style={{background: aud[1]}}>{aud[0]}</span>}
                    {area && <span className="text-[0.65rem] uppercase tracking-wider border-2 border-[#1a1a2e] rounded px-2 py-0.5" style={{background: area[1]}}>{area[0]}</span>}
                    {r.loopride && <span className="text-[0.65rem] uppercase tracking-wider bg-white border-2 border-[#1a1a2e] rounded px-2 py-0.5">Loop</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {r.exportable && <a className={c.btn} href={r.exportable} target="_blank" rel="noreferrer">+ Calendar</a>}
                    {r.shareable && <a className={c.btnPrimary} href={r.shareable} target="_blank" rel="noreferrer">Details ►</a>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
        <section id="favorites" className={c.sectionAccent}>
          <h2 className={c.h2}>★ Saved Rides · {favorites.length}</h2>
          {favorites.length === 0 ? (
            <div className="text-sm">Tap ☆ Save on any ride to keep track of it here.</div>
          ) : (
            <ul className="space-y-2">
              {favorites
                .slice()
                .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""))
                .map((f) => (
                  <li key={f._id} className="bg-white text-[#1a1a2e] border-[2px] border-[#1a1a2e] rounded p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono">{f.date} · {f.time}</div>
                      <div className="font-bold uppercase text-sm truncate">{f.title}</div>
                      {f.venue && <div className="text-xs truncate">{f.venue}</div>}
                    </div>
                    <button onClick={() => database.del(f._id)} className="text-xs uppercase tracking-wider px-2 py-1 border-2 border-[#1a1a2e] rounded bg-[#f4d35e]">Remove</button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}