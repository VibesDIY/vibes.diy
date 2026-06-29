import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("recon-grid")

  const { doc: newIncident, merge: mergeIncident, submit: submitIncident } = useDocument({
    type: "incident",
    name: "",
    hazard: "Hurricane",
    mode: "Live Ops",
    status: "active",
    createdAt: 0,
    createdBy: "",
  })

  const { docs: incidents } = useLiveQuery("type", { key: "incident", descending: true })
  const activeIncident = incidents.find((i) => i.status === "active")
  const { docs: analyses } = useLiveQuery("incidentId", { key: activeIncident?._id || "__none__", descending: true })
  const { docs: auditLog } = useLiveQuery("type", { key: "audit", descending: true, limit: 30 })

  const [analysisType, setAnalysisType] = React.useState("shelter-suitability")
  const [analysisZone, setAnalysisZone] = React.useState("")
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [visibleLayers, setVisibleLayers] = React.useState({ population: true, shelters: true, hazard: true, infrastructure: true })
  const mapRef = React.useRef(null)

  function logAudit(action, detail) {
    if (!viewer) return
    database.put({
      type: "audit",
      action,
      detail,
      analyst: viewer.userSlug,
      analystName: viewer.displayName || viewer.userSlug,
      avatarUrl: viewer.avatarUrl,
      incidentId: activeIncident?._id || null,
      createdAt: Date.now(),
    })
  }

  function handleActivate(e) {
    e.preventDefault()
    if (!newIncident.name.trim() || !viewer) return
    const payload = { ...newIncident, createdAt: Date.now(), createdBy: viewer.userSlug }
    database.put(payload).then((r) => {
      database.put({
        type: "audit",
        action: "INCIDENT_ACTIVATED",
        detail: `${payload.name} (${payload.hazard}, ${payload.mode})`,
        analyst: viewer.userSlug,
        analystName: viewer.displayName || viewer.userSlug,
        avatarUrl: viewer.avatarUrl,
        incidentId: r.id,
        createdAt: Date.now(),
      })
    })
    submitIncident()
  }

  function handleSuggestIncident() {
    const samples = [
      { name: "Hurricane Cassia Landfall", hazard: "Hurricane" },
      { name: "Pine Ridge Wildfire Complex", hazard: "Wildfire" },
      { name: "Lower Delta Flood Event", hazard: "Flood" },
    ]
    const pick = samples[Math.floor(Math.random() * samples.length)]
    mergeIncident(pick)
  }

  async function runAnalysis() {
    if (!activeIncident || !viewer || !can("write")) return
    setIsAnalyzing(true)
    try {
      const prompt = `Run a ${analysisType} spatial analysis for incident "${activeIncident.name}" (${activeIncident.hazard}) in zone "${analysisZone || "affected area"}". Return realistic scored results.`
      const schema = {
        properties: {
          summary: { type: "string", description: "One-sentence operational summary" },
          exposurePopulation: { type: "number", description: "Estimated population exposed" },
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                site: { type: "string", description: "Site or zone name" },
                score: { type: "number", description: "Suitability or risk score 0-100" },
                lat: { type: "number", description: "Latitude offset -40 to 40" },
                lng: { type: "number", description: "Longitude offset -40 to 40" },
                note: { type: "string", description: "Short operational note" },
              },
            },
          },
        },
      }
      const raw = await callAI(prompt, { schema })
      const parsed = JSON.parse(raw)
      const doc = {
        type: "analysis",
        incidentId: activeIncident._id,
        analysisType,
        zone: analysisZone,
        summary: parsed.summary,
        exposurePopulation: parsed.exposurePopulation,
        results: parsed.results || [],
        analyst: viewer.userSlug,
        analystName: viewer.displayName || viewer.userSlug,
        avatarUrl: viewer.avatarUrl,
        version: 1,
        createdAt: Date.now(),
      }
      await database.put(doc)
      logAudit("ANALYSIS_RUN", `${analysisType} → ${parsed.results?.length || 0} sites, ${parsed.exposurePopulation || 0} exposed`)
      setAnalysisZone("")
    } finally {
      setIsAnalyzing(false)
    }
  }

  function toggleLayer(name) {
    setVisibleLayers((s) => ({ ...s, [name]: !s[name] }))
    logAudit("LAYER_TOGGLE", `${name} → ${!visibleLayers[name] ? "ON" : "OFF"}`)
  }

  React.useEffect(() => {
    if (!mapRef.current) return
    const w = mapRef.current.clientWidth
    const h = 320
    const svg = d3.select(mapRef.current).select("svg")
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${w} ${h}`).attr("width", "100%").attr("height", h)

    // grid background
    const g = svg.append("g")
    for (let x = 0; x < w; x += 40) g.append("line").attr("x1", x).attr("x2", x).attr("y1", 0).attr("y2", h).attr("stroke", "oklch(0.28 0.03 257)").attr("stroke-width", 0.5)
    for (let y = 0; y < h; y += 40) g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y).attr("y2", y).attr("stroke", "oklch(0.28 0.03 257)").attr("stroke-width", 0.5)

    const cx = w / 2, cy = h / 2
    const project = (lat, lng) => [cx + lng * 5, cy + lat * 4]

    if (visibleLayers.hazard && activeIncident) {
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 100).attr("fill", "oklch(0.64 0.24 25 / 0.15)").attr("stroke", "oklch(0.64 0.24 25)").attr("stroke-dasharray", "4 4")
      svg.append("text").attr("x", cx).attr("y", cy - 105).attr("text-anchor", "middle").attr("fill", "oklch(0.64 0.24 25)").attr("font-size", 10).attr("font-family", "monospace").text("HAZARD FOOTPRINT")
    }
    if (visibleLayers.population) {
      const seed = activeIncident?._id?.charCodeAt(0) || 42
      for (let i = 0; i < 30; i++) {
        const x = ((seed * (i + 1) * 13) % w)
        const y = ((seed * (i + 1) * 17) % h)
        svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 2).attr("fill", "oklch(0.55 0.03 264)").attr("opacity", 0.6)
      }
    }
    if (visibleLayers.infrastructure) {
      const infra = [{ x: cx - 80, y: cy - 40, t: "HOSP" }, { x: cx + 60, y: cy + 50, t: "DIAL" }, { x: cx - 30, y: cy + 70, t: "SCHL" }]
      infra.forEach((p) => {
        svg.append("rect").attr("x", p.x - 4).attr("y", p.y - 4).attr("width", 8).attr("height", 8).attr("fill", "none").attr("stroke", "oklch(0.97 0.003 265)").attr("stroke-width", 1.5)
        svg.append("text").attr("x", p.x + 8).attr("y", p.y + 3).attr("fill", "oklch(0.97 0.003 265)").attr("font-size", 8).attr("font-family", "monospace").text(p.t)
      })
    }
    if (visibleLayers.shelters && analyses[0]?.results) {
      analyses[0].results.forEach((r) => {
        const [px, py] = project(r.lat || 0, r.lng || 0)
        svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 6).attr("fill", "oklch(0.64 0.24 25)").attr("opacity", 0.8)
        svg.append("text").attr("x", px + 10).attr("y", py + 3).attr("fill", "oklch(0.97 0.003 265)").attr("font-size", 9).attr("font-family", "monospace").text(`${r.site} [${Math.round(r.score)}]`)
      })
    }
    if (!activeIncident) {
      svg.append("text").attr("x", cx).attr("y", cy).attr("text-anchor", "middle").attr("fill", "oklch(0.55 0.03 264)").attr("font-size", 12).attr("font-family", "monospace").text("◇ STANDBY — NO ACTIVE INCIDENT ◇")
    }
  }, [activeIncident, analyses, visibleLayers])

  const c = {
    page: "min-h-screen bg-black text-[oklch(0.97_0.003_265)] font-mono",
    header: "sticky top-0 z-20 border-b border-[oklch(0.28_0.03_257)] bg-black/90 backdrop-blur px-4 py-3 flex items-center justify-between",
    title: "text-lg font-bold tracking-wider text-[oklch(0.97_0.003_265)]",
    tag: "text-[10px] uppercase tracking-[0.2em] text-[oklch(0.64_0.24_25)]",
    main: "px-3 py-4 space-y-4 max-w-5xl mx-auto pb-24",
    section: "border border-[oklch(0.28_0.03_257)] bg-[oklch(0.21_0.03_265/0.5)] rounded-sm p-3",
    sectionTitle: "text-xs uppercase tracking-[0.2em] text-[oklch(0.55_0.03_264)] mb-3 flex items-center gap-2",
    sectionDot: "inline-block w-2 h-2 rounded-full bg-[oklch(0.64_0.24_25)]",
    btn: "min-h-[44px] px-4 py-2 bg-[oklch(0.64_0.24_25)] text-black font-bold text-xs uppercase tracking-wider rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[oklch(0.28_0.03_257)] text-[oklch(0.97_0.003_265)] text-xs uppercase tracking-wider rounded-sm hover:border-[oklch(0.64_0.24_25)]",
    input: "w-full bg-black border border-[oklch(0.28_0.03_257)] text-[oklch(0.97_0.003_265)] px-3 py-2 rounded-sm text-sm focus:border-[oklch(0.64_0.24_25)] focus:outline-none min-h-[44px]",
    select: "w-full bg-black border border-[oklch(0.28_0.03_257)] text-[oklch(0.97_0.003_265)] px-3 py-2 rounded-sm text-sm min-h-[44px]",
    row: "border border-[oklch(0.28_0.03_257)] bg-black/40 p-2 rounded-sm text-xs",
    label: "block text-[10px] uppercase tracking-[0.15em] text-[oklch(0.55_0.03_264)] mb-1",
    accent: "text-[oklch(0.64_0.24_25)]",
    dim: "text-[oklch(0.55_0.03_264)]",
    avatar: "w-7 h-7 rounded-sm border border-[oklch(0.28_0.03_257)]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>RECON GRID</div>
          <div className={c.tag}>State EM // Spatial Ops Console</div>
        </div>
        <div className="flex items-center gap-2">
          {viewer ? (
            <>
              <span className={`text-[10px] uppercase tracking-wider ${can("write") ? c.accent : c.dim}`}>
                {can("write") ? "● OPS" : "○ VIEW"}
              </span>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            </>
          ) : (
            <span className={`text-[10px] ${c.dim} uppercase tracking-wider`}>○ Anonymous</span>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="incident" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.sectionDot}></span>Active Incident</h2>
          <div className="space-y-3">
            <div className={c.row}>
              {activeIncident ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`${c.accent} font-bold uppercase`}>● {activeIncident.name}</span>
                    <span className={c.dim}>{activeIncident.mode}</span>
                  </div>
                  <div className={c.dim}>
                    {activeIncident.hazard} // Activated {new Date(activeIncident.createdAt).toLocaleString()}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`${c.accent} font-bold`}>NO ACTIVE INCIDENT</span>
                    <span className={c.dim}>STATUS: STANDBY</span>
                  </div>
                  <div className={c.dim}>Activate an incident to begin spatial operations.</div>
                </>
              )}
            </div>
            {can("write") ? (
              <form onSubmit={handleActivate} className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={c.label}>Incident Name</label>
                    <button type="button" onClick={handleSuggestIncident} className="text-[10px] uppercase tracking-wider text-[oklch(0.64_0.24_25)] hover:underline">◇ Suggest</button>
                  </div>
                  <input className={c.input} placeholder="e.g. Hurricane Delta Landfall" value={newIncident.name} onChange={(e) => mergeIncident({ name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={c.label}>Hazard Type</label>
                    <select className={c.select} value={newIncident.hazard} onChange={(e) => mergeIncident({ hazard: e.target.value })}>
                      <option>Hurricane</option>
                      <option>Wildfire</option>
                      <option>Flood</option>
                      <option>Evacuation</option>
                    </select>
                  </div>
                  <div>
                    <label className={c.label}>Mode</label>
                    <select className={c.select} value={newIncident.mode} onChange={(e) => mergeIncident({ mode: e.target.value })}>
                      <option>Live Ops</option>
                      <option>Exercise</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className={c.btn} disabled={!newIncident.name.trim()}>Activate Incident</button>
              </form>
            ) : (
              <div className={`${c.row} ${c.dim}`}>◇ Read-only view — contact ops lead for write access.</div>
            )}
          </div>
        </section>

        <section id="map" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.sectionDot}></span>Operational Map</h2>
          <div ref={mapRef} className="border border-[oklch(0.28_0.03_257)] bg-black rounded-sm overflow-hidden">
            <svg></svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(visibleLayers).map(([k, v]) => (
              <button
                key={k}
                onClick={() => can("write") && toggleLayer(k)}
                disabled={!can("write")}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm min-h-[32px] ${v ? "border-[oklch(0.64_0.24_25)] text-[oklch(0.64_0.24_25)]" : "border-[oklch(0.28_0.03_257)] text-[oklch(0.55_0.03_264)]"} disabled:cursor-not-allowed`}
              >
                {v ? "●" : "○"} {k}
              </button>
            ))}
          </div>
        </section>

        <section id="analysis" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.sectionDot}></span>Spatial Analysis</h2>
          {!activeIncident ? (
            <div className={`${c.row} ${c.dim}`}>◇ Activate an incident to enable spatial analysis.</div>
          ) : can("write") ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className={c.label}>Analysis Type</label>
                  <select className={c.select} value={analysisType} onChange={(e) => setAnalysisType(e.target.value)}>
                    <option value="shelter-suitability">Shelter Suitability</option>
                    <option value="hazard-exposure">Hazard Exposure Overlay</option>
                    <option value="evacuation-routing">Evacuation Routing</option>
                    <option value="vulnerable-population">Vulnerable Population Proximity</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Affected Zone</label>
                  <input className={c.input} placeholder="e.g. Coastal Zone A, Census Tract 1042" value={analysisZone} onChange={(e) => setAnalysisZone(e.target.value)} />
                </div>
              </div>
              <button onClick={runAnalysis} disabled={isAnalyzing} className={c.btn}>
                {isAnalyzing ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    Computing…
                  </span>
                ) : "▸ Execute Analysis"}
              </button>
              <div className="space-y-2">
                <div className={c.label}>Recent Results ({analyses.length})</div>
                {analyses.length === 0 ? (
                  <div className={`${c.row} ${c.dim}`}>No analyses logged yet for this incident.</div>
                ) : (
                  analyses.slice(0, 5).map((a) => (
                    <div key={a._id} className={c.row}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`${c.accent} uppercase font-bold`}>{a.analysisType}</span>
                        <span className={c.dim}>v{a.version} // {new Date(a.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[oklch(0.97_0.003_265)] mb-1">{a.summary}</div>
                      <div className={c.dim}>
                        {a.results?.length || 0} sites // {a.exposurePopulation?.toLocaleString() || 0} exposed // by {a.analystName}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className={`${c.row} ${c.dim}`}>◇ Read-only situational view. Analyses computed by ops team appear here.</div>
          )}
        </section>

        <section id="audit" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.sectionDot}></span>Audit Log</h2>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {auditLog.length === 0 ? (
              <div className={`${c.row} ${c.dim}`}>No actions logged yet.</div>
            ) : (
              auditLog.map((a) => (
                <div key={a._id} className="flex items-start gap-2 text-[11px] border-b border-[oklch(0.28_0.03_257)] py-1.5">
                  <img src={a.avatarUrl} alt={a.analyst} className="w-5 h-5 rounded-sm border border-[oklch(0.28_0.03_257)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`${c.accent} font-bold uppercase tracking-wider`}>{a.action}</span>
                      <span className={c.dim}>{new Date(a.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="truncate text-[oklch(0.97_0.003_265)]">{a.detail}</div>
                    <div className={`${c.dim} text-[10px]`}>{a.analystName}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}