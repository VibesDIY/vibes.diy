import React, { useState, useRef, useEffect } from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function seeded(seed) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

function MapCanvas({ settings }) {
  const ref = useRef(null)
  useEffect(() => {
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    const W = 400, H = 400
    const rng = seeded((settings.neighborhood || "x").length * 137 + 7)

    // density background
    if (settings.layers?.density) {
      const g = svg.append("g")
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
        g.append("rect").attr("x", i*40).attr("y", j*40).attr("width",40).attr("height",40)
          .attr("fill", `oklch(0.85 ${rng()*0.15} 85)`).attr("opacity", rng())
      }
    }
    // street grid
    const grid = svg.append("g").attr("stroke", "oklch(0.50 0.02 280)").attr("stroke-width", 0.5).attr("opacity", 0.4)
    for (let i = 0; i <= 10; i++) {
      grid.append("line").attr("x1", i*40).attr("y1", 0).attr("x2", i*40).attr("y2", H)
      grid.append("line").attr("x1", 0).attr("y1", i*40).attr("x2", W).attr("y2", i*40)
    }
    // helper to scatter points
    const scatter = (n, color, r=6) => {
      const pts = d3.range(n).map(() => ({ x: rng()*W, y: rng()*H }))
      svg.append("g").selectAll("circle").data(pts).enter().append("circle")
        .attr("cx", d=>d.x).attr("cy", d=>d.y).attr("r", r).attr("fill", color)
        .attr("stroke", "oklch(0.15 0.02 280)").attr("stroke-width", 1)
      return pts
    }
    let parkPts = []
    if (settings.layers?.parks) parkPts = scatter(5, "oklch(0.62 0.19 145)", 10)
    if (settings.layers?.transit) scatter(8, "oklch(0.52 0.18 255)")
    if (settings.layers?.grocery) scatter(4, "oklch(0.85 0.18 85)")
    if (settings.layers?.schools) scatter(3, "oklch(0.55 0.24 28)", 8)

    // buffer circles around parks
    if (settings.layers?.parks && settings.buffer) {
      const radius = settings.buffer * 8
      svg.append("g").selectAll("circle.buf").data(parkPts).enter().append("circle")
        .attr("cx",d=>d.x).attr("cy",d=>d.y).attr("r", radius)
        .attr("fill", "oklch(0.62 0.19 145 / 0.15)").attr("stroke", "oklch(0.62 0.19 145)").attr("stroke-dasharray","4 3")
    }
  }, [settings])
  return (
    <svg ref={ref} viewBox="0 0 400 400" className="w-full aspect-square bg-[oklch(0.96_0.01_90)] border-2 border-[oklch(0.15_0.02_280)] rounded" />
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("citylens")
  const { doc: settings, merge: mergeSettings } = useDocument({ _id: "active", neighborhood: "", layers: {}, buffer: 10 })
  const [suggestLoading, setSuggestLoading] = useState(false)

  const exampleNbhds = ["Mission District, SF", "Brooklyn Heights, NYC", "Pilsen, Chicago", "Capitol Hill, Seattle"]

  const LAYERS = [
    { key: "parks", label: "Parks", desc: "Green spaces and recreational areas" },
    { key: "transit", label: "Transit", desc: "Bus and rail stops" },
    { key: "grocery", label: "Grocery", desc: "Food access points" },
    { key: "schools", label: "Schools", desc: "Educational facilities" },
    { key: "density", label: "Density", desc: "Population per area" },
  ]

  const { docs: glossary } = useLiveQuery("type", { key: "glossary", descending: true })
  const { docs: stories } = useLiveQuery("type", { key: "story", descending: true })
  const [storyTitle, setStoryTitle] = useState("")

  async function saveStory() {
    if (!storyTitle.trim()) return
    await database.put({
      type: "story",
      title: storyTitle.trim(),
      neighborhood: settings.neighborhood,
      layers: settings.layers,
      buffer: settings.buffer,
      createdAt: Date.now(),
      authorSlug: viewer?.userSlug,
      authorName: viewer?.displayName ?? viewer?.userSlug,
      authorAvatar: viewer?.avatarUrl,
    })
    setStoryTitle("")
  }

  function loadStory(s) {
    mergeSettings({ neighborhood: s.neighborhood, layers: s.layers, buffer: s.buffer })
  }

  const [tutorMsg, setTutorMsg] = useState("Toggle a layer to learn what it represents.")
  const [tutorLoading, setTutorLoading] = useState(false)

  async function toggleLayer(key) {
    const newLayers = { ...(settings.layers || {}), [key]: !settings.layers?.[key] }
    mergeSettings({ layers: newLayers })
    const isOn = newLayers[key]
    if (!isOn) return
    setTutorLoading(true)
    try {
      const r = await callAI(
        `A student just turned on the "${key}" layer on a neighborhood map. Explain in 2 sentences what this layer represents spatially, define 2 key terms, and note one pattern to look for.`,
        { schema: { properties: {
          explanation: { type: "string" },
          terms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, definition: { type: "string" } } } },
          observation: { type: "string" }
        } } }
      )
      const data = JSON.parse(r)
      setTutorMsg(`${data.explanation} 🔍 ${data.observation}`)
      for (const t of (data.terms || [])) {
        await database.put({ type: "glossary", term: t.term, definition: t.definition, layer: key, createdAt: Date.now() })
      }
    } finally { setTutorLoading(false) }
  }

  async function suggestNeighborhoods() {
    setSuggestLoading(true)
    try {
      const r = await callAI("Suggest 4 interesting US neighborhoods for a student exploring walkability and spatial patterns. Vary by city.", {
        schema: { properties: { ideas: { type: "array", items: { type: "string" } } } }
      })
      const { ideas } = JSON.parse(r)
      if (ideas?.[0]) mergeSettings({ neighborhood: ideas[0] })
    } finally { setSuggestLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)] font-['Space_Grotesk',sans-serif]",
    header: "sticky top-0 z-10 bg-[oklch(0.55_0.24_28)] text-white border-b-2 border-[oklch(0.15_0.02_280)] px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs opacity-90 hidden sm:block",
    main: "max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24",
    section: "bg-white border-2 border-[oklch(0.15_0.02_280)] rounded p-4 shadow-[3px_3px_0_oklch(0.15_0.02_280)]",
    h2: "text-lg font-bold mb-3 flex items-center gap-2",
    btn: "min-h-[44px] px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white border-2 border-[oklch(0.15_0.02_280)] rounded font-semibold shadow-[2px_2px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnAlt: "min-h-[44px] px-3 py-2 bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-2 border-[oklch(0.15_0.02_280)] rounded font-semibold shadow-[2px_2px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    input: "w-full min-h-[44px] px-3 py-2 bg-white border-2 border-[oklch(0.15_0.02_280)] rounded font-['Space_Grotesk']",
    chip: "px-3 py-1 text-sm border-2 border-[oklch(0.15_0.02_280)] rounded cursor-pointer select-none",
    chipOn: "bg-[oklch(0.62_0.19_145)] text-white",
    chipOff: "bg-white text-[oklch(0.15_0.02_280)]",
    muted: "text-[oklch(0.50_0.02_280)] text-sm",
    avatar: "w-8 h-8 rounded-full border-2 border-white",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>CityLens</div>
          <div className={c.tagline}>Stack layers · See spatial patterns</div>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>

      <main id="app" className={c.main}>
        <section id="neighborhood-picker" className={c.section}>
          <h2 className={c.h2}>
            <span className="inline-block w-3 h-3 bg-[oklch(0.55_0.24_28)] border-2 border-[oklch(0.15_0.02_280)]"></span>
            Pick a neighborhood
          </h2>
          {can("write") ? (
            <>
              <input
                className={c.input}
                placeholder="e.g. Mission District, San Francisco"
                value={settings.neighborhood}
                onChange={(e) => mergeSettings({ neighborhood: e.target.value })}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {exampleNbhds.map(n => (
                  <button key={n} className={c.chip + " " + c.chipOff} onClick={() => mergeSettings({ neighborhood: n })}>{n}</button>
                ))}
                <button className={c.btnAlt} onClick={suggestNeighborhoods} disabled={suggestLoading}>
                  {suggestLoading ? (
                    <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                    </svg>
                  ) : "Suggest"}
                </button>
              </div>
            </>
          ) : (
            <p className={c.muted}>Read-only view.</p>
          )}
          <p className={c.muted + " mt-2"}>Active: <strong>{settings.neighborhood || "(none yet)"}</strong></p>
        </section>

        <section id="map-canvas" className={c.section}>
          <h2 className={c.h2}>
            <span className="inline-block w-3 h-3 bg-[oklch(0.52_0.18_255)] border-2 border-[oklch(0.15_0.02_280)]"></span>
            Map view
          </h2>
          <MapCanvas settings={settings} />
          <p className={c.muted + " mt-2"}>Buffer: {settings.buffer} min walk · Active layers: {Object.entries(settings.layers || {}).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}</p>
        </section>

        <section id="layer-controls" className={c.section}>
          <h2 className={c.h2}>
            <span className="inline-block w-3 h-3 bg-[oklch(0.62_0.19_145)] border-2 border-[oklch(0.15_0.02_280)]"></span>
            Layers & buffer
          </h2>
          {can("write") ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {LAYERS.map(l => (
                  <button key={l.key}
                    className={c.chip + " " + (settings.layers?.[l.key] ? c.chipOn : c.chipOff)}
                    onClick={() => toggleLayer(l.key)}
                    title={l.desc}>
                    {l.label}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-semibold mb-1">Walking buffer: {settings.buffer} min</label>
              <input type="range" min="2" max="20" value={settings.buffer}
                onChange={(e)=>mergeSettings({ buffer: +e.target.value })} className="w-full" />
            </>
          ) : <p className={c.muted}>Read-only — layers locked.</p>}
          <div className="mt-3 p-3 bg-[oklch(0.55_0.24_28_/_0.1)] border-2 border-[oklch(0.55_0.24_28)] rounded text-sm">
            {tutorLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
                Thinking…
              </span>
            ) : tutorMsg}
          </div>
        </section>

        <section id="glossary" className={c.section}>
          <h2 className={c.h2}>
            <span className="inline-block w-3 h-3 bg-[oklch(0.85_0.18_85)] border-2 border-[oklch(0.15_0.02_280)]"></span>
            Glossary ({glossary.length})
          </h2>
          {glossary.length === 0 ? (
            <p className={c.muted}>Toggle layers to grow your glossary.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {glossary.map(g => (
                <li key={g._id} className="border-l-4 border-[oklch(0.55_0.24_28)] pl-2">
                  <strong>{g.term}</strong> — <span className="text-sm">{g.definition}</span>
                  {g.layer && <span className={c.muted + " ml-2 text-xs"}>via {g.layer}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="saved-stories" className={c.section}>
          <h2 className={c.h2}>
            <span className="inline-block w-3 h-3 bg-[oklch(0.55_0.24_28)] border-2 border-[oklch(0.15_0.02_280)]"></span>
            Saved map stories
          </h2>
          {can("write") ? (
            <div className="flex gap-2 mb-3">
              <input
                className={c.input}
                placeholder="Name this map story…"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
              />
              <button className={c.btn} onClick={saveStory} disabled={!storyTitle.trim()}>Save</button>
            </div>
          ) : (
            <p className={c.muted + " mb-2"}>Read-only view — saved stories below.</p>
          )}
          {stories.length === 0 ? (
            <p className={c.muted}>No stories yet. Build a layered map and save it.</p>
          ) : (
            <ul className="space-y-2">
              {stories.map(s => (
                <li key={s._id} className="border-2 border-[oklch(0.15_0.02_280)] rounded p-2 bg-[oklch(0.96_0.01_90)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.authorAvatar && <img src={s.authorAvatar} alt="" className="w-6 h-6 rounded-full border border-[oklch(0.15_0.02_280)]" />}
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className={c.muted + " text-xs truncate"}>
                        {s.neighborhood || "—"} · buffer {s.buffer}min · by {s.authorName || "anon"}
                      </div>
                    </div>
                  </div>
                  <button className={c.btnAlt} onClick={() => loadStory(s)}>Load</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}