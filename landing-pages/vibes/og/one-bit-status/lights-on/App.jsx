import React, { useState, useEffect, useMemo } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"
import { WebAudioAPI } from "web-audio"

const FONT_HREF = "https://fonts.googleapis.com/css2?family=VT323&display=optional"
if (typeof document !== "undefined" && !document.querySelector(`link[href="${FONT_HREF}"]`)) {
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = FONT_HREF
  document.head.appendChild(link)
}
const STYLE_ID = "lights-on-style"
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    @keyframes sweep { 0% { top: -3px } 100% { top: 100vh } }
    body { font-family: "VT323", monospace; font-size: 18px; line-height: 1.4; background: #0a0a0a; }
    h1, h2, .glow { text-shadow: 0 0 10px rgba(95,255,154,0.7); }
    input::placeholder { color: rgba(95,255,154,0.4); }
    input { caret-color: #5fff9a; }
  `
  document.head.appendChild(style)
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("lights-on-db")
  const [name, setName] = useState(() => {
    if (typeof localStorage === "undefined") return ""
    return localStorage.getItem("lights-on-name") || ""
  })
  const [draftName, setDraftName] = useState(name)

  const { docs: events } = useLiveQuery("ts", { descending: true, limit: 500 })

  const latestByName = useMemo(() => {
    const map = new Map()
    for (const doc of events) {
      if (!doc.name) continue
      if (!map.has(doc.name)) map.set(doc.name, doc)
    }
    return map
  }, [events])

  const roster = useMemo(
    () => Array.from(latestByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [latestByName]
  )

  const myState = name ? latestByName.get(name) : null
  const myOn = !!(myState && myState.on)

  function handleNameSubmit(e) {
    e.preventDefault()
    const trimmed = draftName.trim().toLowerCase()
    if (!trimmed) return
    setName(trimmed)
    if (typeof localStorage !== "undefined") localStorage.setItem("lights-on-name", trimmed)
  }

  async function handleToggle() {
    if (!name) return
    await database.put({ name, on: !myOn, ts: Date.now() })
  }

  function relTime(ts) {
    const d = Math.max(0, Date.now() - ts)
    const s = Math.floor(d / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const c = {
    page: "min-h-screen w-full bg-[#0a0a0a] text-[#5fff9a]",
    crt: "fixed inset-0 pointer-events-none z-[99] bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0,rgba(0,255,0,0.03)_1px,transparent_1px,transparent_3px)]",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100] bg-gradient-to-b from-transparent via-[#5fff9a]/40 to-transparent animate-[sweep_8s_linear_infinite]",
    shell: "relative max-w-xl mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex items-baseline justify-between pb-3 border-b border-[#5fff9a]/30",
    title: "text-3xl tracking-widest uppercase glow",
    meta: "text-sm uppercase tracking-[0.1em] text-[#5fff9a]/40",
    section: "flex flex-col gap-3 p-4 border border-[#5fff9a]/30 bg-black/85",
    label: "text-xs uppercase tracking-[0.1em] text-[#5fff9a]/40",
    nameForm: "flex items-center gap-2",
    nameInput: "flex-1 bg-transparent border border-[#5fff9a]/30 px-2 py-2 outline-none text-[#5fff9a] focus:border-[#5fff9a]",
    nameBtn: "px-3 py-2 min-h-[44px] text-[#5fff9a] hover:bg-[#5fff9a] hover:text-black",
    toggleBtn: "w-full aspect-square flex flex-col items-center justify-center gap-4 border border-[#5fff9a]/30 min-h-[240px] hover:border-[#5fff9a] transition-colors",
    toggleGlyph: "text-7xl leading-none glow",
    toggleLabel: "text-2xl uppercase tracking-[0.2em] glow",
    rosterList: "flex flex-col gap-2",
    rosterRow: "flex items-center gap-3 py-2 border-b border-[#5fff9a]/10 last:border-b-0",
    dot: "inline-block w-[6px] h-[6px] rounded-full bg-[#5fff9a]/40",
    dotActive: "inline-block w-[6px] h-[6px] rounded-full bg-[#5fff9a] shadow-[0_0_8px_#5fff9a]",
    rosterName: "flex-1 text-base",
    feedList: "flex flex-col gap-1 max-h-80 overflow-y-auto",
    feedRow: "flex items-baseline gap-2 py-1 text-sm text-[#5fff9a]/70",
    footer: "pt-4 border-t border-[#5fff9a]/30 text-xs uppercase tracking-[0.1em] text-center text-[#5fff9a]/40",
  }

  return (
    <div className={c.page}>
      <div className={c.crt} aria-hidden="true" />
      <div className={c.sweep} aria-hidden="true" />
      <main id="app" className={c.shell}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>lights.on</h1>
          <span className={c.meta}>sys: online</span>
        </header>

        <section id="identity" className={c.section}>
          <span className={c.label}>sys: identify</span>
          <form className={c.nameForm} onSubmit={handleNameSubmit}>
            <input
              className={c.nameInput}
              placeholder="enter handle_"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <button className={c.nameBtn} type="submit">[ {name ? "update" : "set"} ]</button>
          </form>
          {name && <span className={c.label}>sys: handle = {name}</span>}
        </section>

        <section id="toggle" className={c.section}>
          <span className={c.label}>status: self</span>
          <button className={c.toggleBtn} onClick={handleToggle} disabled={!name}>
            <span className={c.toggleGlyph}>{myOn ? "●" : "○"}</span>
            <span className={c.toggleLabel}>{myOn ? "light on" : "light off"}</span>
            {!name && <span className={c.label}>sys: set handle first</span>}
          </button>
        </section>

        <section id="roster" className={c.section}>
          <span className={c.label}>status: roster</span>
          <ul className={c.rosterList}>
            {roster.length === 0 && (
              <li className={c.rosterRow}><span className={c.label}>no signals yet</span></li>
            )}
            {roster.map((doc) => (
              <li key={doc.name} className={c.rosterRow}>
                <span className={doc.on ? c.dotActive : c.dot} />
                <span className={c.rosterName}>{doc.name}</span>
                <span className={c.label}>{doc.on ? "on" : "off"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="feed" className={c.section}>
          <span className={c.label}>feed: events</span>
          <ul className={c.feedList}>
            {events.length === 0 && (
              <li className={c.feedRow}><span>░</span><span>awaiting signal…</span></li>
            )}
            {events.slice(0, 30).map((doc) => (
              <li key={doc._id} className={c.feedRow}>
                <span>▌</span>
                <span>{doc.name} — light {doc.on ? "on" : "off"} {relTime(doc.ts)}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className={c.footer}>end of transmission ▼</footer>
      </main>
    </div>
  )
}