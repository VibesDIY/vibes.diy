import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AuditTrail({ c, useLiveQuery }) {
  const { docs: events } = useLiveQuery("type", { key: "audit", descending: true, limit: 50 })

  if (events.length === 0) {
    return <p className={c.dim + " mt-3"}>No actions logged yet.</p>
  }

  return (
    <ul className="mt-3 max-h-80 overflow-y-auto">
      {events.map((e) => (
        <li key={e._id} className={c.row}>
          <div className="min-w-0">
            <div className="font-medium text-sm">
              <span className={c.chip}>{e.action}</span> by {e.actorName}
            </div>
            <div className={c.dim + " text-xs truncate"}>{JSON.stringify(e.detail)}</div>
          </div>
          <span className={c.dim + " text-xs whitespace-nowrap"}>{new Date(e.at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}

function MethodologyReport({ c, can, database, useLiveQuery, logAudit }) {
  const { docs: sites } = useLiveQuery("type", { key: "site" })
  const { docs: layers } = useLiveQuery("type", { key: "layer" })
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario" })
  const { docs: reports } = useLiveQuery("type", { key: "report", descending: true })
  const [isRunning, setIsRunning] = React.useState(false)

  async function runAnalysis() {
    setIsRunning(true)
    try {
      const rankedByScenario = scenarios.map((sc) => ({
        scenario: sc.name,
        description: sc.description,
        weights: layers.map((l) => ({ layer: l.name, weight: sc.weights?.[l._id] ?? 0 })),
        ranked: sites.map((s) => ({ name: s.name, score: scoreSiteForScenario(s, layers, sc) }))
          .sort((a, b) => b.score - a.score).slice(0, 5),
      }))
      const payload = {
        layers: layers.map((l) => ({ name: l.name, field: l.field, direction: l.direction, transfer: l.transfer, threshold: l.threshold, rationale: l.rationale })),
        scenarios: rankedByScenario,
      }
      const res = await callAI(
        "You are authoring a board-ready EV charger siting methodology report for a regional transportation agency. Given this multi-criteria suitability analysis configuration and results, produce: (1) a plain-language methodology summary, (2) per-layer sensitivity impact ranking, (3) site robustness classification (robust = top-5 across all scenarios; conditional = top in only some). Analysis: " + JSON.stringify(payload),
        {
          schema: {
            properties: {
              summary: { type: "string", description: "Methodology narrative, 3-5 paragraphs" },
              sensitivity: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    layer: { type: "string" },
                    impact: { type: "string", description: "high, medium, low" },
                    note: { type: "string" },
                  },
                },
              },
              robustness: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    site: { type: "string" },
                    classification: { type: "string", description: "robust, conditional, scenario-specific" },
                    rationale: { type: "string" },
                  },
                },
              },
            },
          },
        }
      )
      const parsed = JSON.parse(res)
      await database.put({ type: "report", ...parsed, generatedAt: Date.now(), scenarioCount: scenarios.length, siteCount: sites.length })
      logAudit("report.generate", { scenarios: scenarios.length, sites: sites.length })
    } finally {
      setIsRunning(false)
    }
  }

  const latest = reports[0]
  const canRun = sites.length > 0 && layers.length > 0 && scenarios.length > 0

  return (
    <>
      {can("write") ? (
        <div className="mt-3">
          <button onClick={runAnalysis} disabled={isRunning || !canRun} className={c.btn}>
            {isRunning ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Running sensitivity analysis…
              </span>
            ) : "Generate methodology report"}
          </button>
          {!canRun && <span className={c.dim + " ml-3"}>Need sites, layers, and scenarios first.</span>}
        </div>
      ) : (
        <p className={c.dim + " mt-3"}>Read-only view — contact the analysis owner for write access.</p>
      )}

      {latest ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className={c.label}>Methodology summary</h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{latest.summary}</p>
          </div>
          <div>
            <h3 className={c.label}>Layer sensitivity</h3>
            <ul>
              {(latest.sensitivity || []).map((row, i) => (
                <li key={i} className={c.row}>
                  <div>
                    <span className="font-medium">{row.layer}</span>{" "}
                    <span className={c.chip}>{row.impact}</span>
                  </div>
                  <span className={c.dim + " text-right max-w-[60%]"}>{row.note}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className={c.label}>Site robustness</h3>
            <ul>
              {(latest.robustness || []).map((row, i) => (
                <li key={i} className={c.row}>
                  <div>
                    <span className="font-medium">{row.site}</span>{" "}
                    <span className={c.chip}>{row.classification}</span>
                  </div>
                  <span className={c.dim + " text-right max-w-[60%]"}>{row.rationale}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={c.dim + " text-xs"}>
            Generated {new Date(latest.generatedAt).toLocaleString()} from {latest.siteCount} sites × {latest.scenarioCount} scenarios.
          </div>
        </div>
      ) : (
        <p className={c.dim + " mt-3"}>No report generated yet.</p>
      )}
    </>
  )
}

function applyTransfer(value, layer) {
  const v = Number(value) || 0
  const k = Number(layer.threshold) || 1
  let s
  if (layer.transfer === "exponential") {
    s = layer.direction === "lower-better" ? Math.exp(-v / k) : 1 - Math.exp(-v / k)
  } else if (layer.transfer === "threshold") {
    s = layer.direction === "lower-better" ? (v <= k ? 1 : 0) : (v >= k ? 1 : 0)
  } else {
    const norm = Math.min(1, v / k)
    s = layer.direction === "lower-better" ? 1 - norm : norm
  }
  return Math.max(0, Math.min(1, s))
}

function scoreSiteForScenario(site, layers, scenario) {
  let totalW = 0, weighted = 0
  for (const l of layers) {
    const w = scenario.weights?.[l._id] ?? 0
    if (w <= 0) continue
    const s = applyTransfer(site[l.field], l)
    weighted += s * w
    totalW += w
  }
  return totalW > 0 ? weighted / totalW : 0
}

function RankedResults({ c, useLiveQuery }) {
  const { docs: sites } = useLiveQuery("type", { key: "site" })
  const { docs: layers } = useLiveQuery("type", { key: "layer" })
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario" })
  const svgRef = React.useRef(null)

  const ranked = React.useMemo(() => {
    if (sites.length === 0 || layers.length === 0 || scenarios.length === 0) return []
    return sites.map((site) => {
      const scores = {}
      let sum = 0
      scenarios.forEach((sc) => {
        const s = scoreSiteForScenario(site, layers, sc)
        scores[sc._id] = s
        sum += s
      })
      return { site, scores, avg: sum / scenarios.length }
    }).sort((a, b) => b.avg - a.avg)
  }, [sites, layers, scenarios])

  React.useEffect(() => {
    if (!svgRef.current || ranked.length === 0 || scenarios.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    const w = 320, h = 320, cx = w / 2, cy = h / 2, r = 110
    const top = ranked.slice(0, 5)
    const axes = scenarios.map((s, i) => {
      const angle = (i / scenarios.length) * Math.PI * 2 - Math.PI / 2
      return { name: s.name, id: s._id, angle, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    })
    // grid rings
    for (let i = 1; i <= 4; i++) {
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", (r * i) / 4)
        .attr("fill", "none").attr("stroke", "#3a3f4b").attr("stroke-dasharray", "2,3")
    }
    // axes
    axes.forEach((a) => {
      svg.append("line").attr("x1", cx).attr("y1", cy).attr("x2", a.x).attr("y2", a.y)
        .attr("stroke", "#3a3f4b")
      svg.append("text").attr("x", a.x).attr("y", a.y).attr("text-anchor", "middle")
        .attr("dy", "-0.4em").attr("fill", "#7a8194").attr("font-size", "10px").text(a.name)
    })
    // polygons
    const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]
    top.forEach((row, idx) => {
      const points = axes.map((a) => {
        const v = row.scores[a.id] ?? 0
        return [cx + Math.cos(a.angle) * r * v, cy + Math.sin(a.angle) * r * v]
      })
      svg.append("polygon").attr("points", points.map((p) => p.join(",")).join(" "))
        .attr("fill", colors[idx]).attr("fill-opacity", 0.15)
        .attr("stroke", colors[idx]).attr("stroke-width", 2)
    })
  }, [ranked, scenarios])

  if (sites.length === 0 || layers.length === 0 || scenarios.length === 0) {
    return <p className={c.dim + " mt-3"}>Add candidate sites, scoring layers, and at least one scenario to see rankings.</p>
  }

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 className={c.label}>Ranked candidates (avg across scenarios)</h3>
        <ol className="space-y-1">
          {ranked.slice(0, 8).map((row, i) => (
            <li key={row.site._id} className={c.row}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  <span className={c.accent}>#{i + 1}</span> {row.site.name}
                </div>
                <div className={c.dim}>
                  {Object.entries(row.scores).map(([scId, s]) => {
                    const sc = scenarios.find((x) => x._id === scId)
                    return <span key={scId} className="mr-2">{sc?.name}: {s.toFixed(2)}</span>
                  })}
                </div>
              </div>
              <span className={c.chip}>avg {row.avg.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex items-center justify-center">
        <svg ref={svgRef} width="320" height="320" viewBox="0 0 320 320" />
      </div>
    </div>
  )
}

function Scenarios({ c, can, database, useDocument, useLiveQuery, logAudit }) {
  const { doc, merge, submit } = useDocument({
    type: "scenario",
    name: "",
    description: "",
    weights: {},
    createdAt: Date.now(),
  })
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario", descending: true })
  const { docs: layers } = useLiveQuery("type", { key: "layer" })

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim() || layers.length === 0) return
    const initWeights = {}
    layers.forEach((l) => { initWeights[l._id] = doc.weights[l._id] ?? 1 })
    submit({ weights: initWeights })
    logAudit("scenario.create", { name: doc.name })
  }

  async function adjustWeight(scenario, layerId, value) {
    const newWeights = { ...scenario.weights, [layerId]: value }
    await database.put({ ...scenario, weights: newWeights })
    logAudit("scenario.reweight", { scenario: scenario.name, layerId, value })
  }

  async function remove(id, name) {
    await database.del(id)
    logAudit("scenario.remove", { name })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={c.label}>Scenario name</label>
            <input className={c.input} value={doc.name} onChange={(e) => merge({ name: e.target.value })} placeholder="e.g. Equity-First" />
          </div>
          <div>
            <label className={c.label}>Policy description</label>
            <input className={c.input} value={doc.description} onChange={(e) => merge({ description: e.target.value })} placeholder="Brief justification" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className={c.btn} disabled={layers.length === 0}>Create Scenario</button>
            {layers.length === 0 && <span className={c.dim + " ml-2"}>Define at least one scoring layer first.</span>}
          </div>
        </form>
      ) : (
        <p className={c.dim + " mt-3"}>Read-only view — contact the analysis owner for write access.</p>
      )}

      <div className="mt-4 space-y-4">
        {scenarios.length === 0 && <p className={c.dim}>No scenarios yet.</p>}
        {scenarios.map((s) => (
          <div key={s._id} className="border border-[#3a3f4b] rounded p-3 bg-[#000000]/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className={c.dim}>{s.description}</div>
              </div>
              {can("write") && (
                <button onClick={() => remove(s._id, s.name)} className={c.btnGhost} aria-label={`Remove ${s.name}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {layers.map((l) => {
                const w = s.weights?.[l._id] ?? 1
                return (
                  <div key={l._id}>
                    <div className="flex justify-between text-xs">
                      <span>{l.name}</span>
                      <span className={c.accent}>{w.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.05"
                      value={w}
                      disabled={!can("write")}
                      onChange={(e) => adjustWeight(s, l._id, parseFloat(e.target.value))}
                      className="w-full accent-[#e74c3c]"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ScoringLayers({ c, can, database, useDocument, useLiveQuery, logAudit }) {
  const { doc, merge, submit } = useDocument({
    type: "layer",
    name: "",
    field: "corridorMi",
    direction: "lower-better",
    transfer: "linear",
    threshold: 1.0,
    rationale: "",
    createdAt: Date.now(),
  })
  const { docs: layers } = useLiveQuery("type", { key: "layer", descending: true })
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim() || !doc.rationale.trim()) return
    submit()
    logAudit("layer.create", { name: doc.name, field: doc.field, transfer: doc.transfer })
  }

  async function suggestStandardLayers() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Propose 5 standard EV charger siting suitability layers with documented planning rationale. Each layer references one of these raw fields: corridorMi, chargerMi, gridKw, equityIdx, demandIdx. Choose direction (lower-better or higher-better) and transfer (linear, exponential, threshold). Provide a threshold/normalization constant.", {
        schema: {
          properties: {
            layers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  field: { type: "string" },
                  direction: { type: "string" },
                  transfer: { type: "string" },
                  threshold: { type: "number" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      })
      const parsed = JSON.parse(res)
      for (const l of parsed.layers || []) {
        await database.put({ type: "layer", ...l, createdAt: Date.now() })
        logAudit("layer.create", { name: l.name, field: l.field, source: "ai-suggested" })
      }
    } finally {
      setIsSuggesting(false)
    }
  }

  async function remove(id, name) {
    await database.del(id)
    logAudit("layer.remove", { name })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={c.label}>Layer Name</label>
            <input className={c.input} value={doc.name} onChange={(e) => merge({ name: e.target.value })} placeholder="e.g. Corridor Proximity" />
          </div>
          <div>
            <label className={c.label}>Source field</label>
            <select className={c.input} value={doc.field} onChange={(e) => merge({ field: e.target.value })}>
              <option value="corridorMi">corridorMi (proximity)</option>
              <option value="chargerMi">chargerMi (network distance)</option>
              <option value="gridKw">gridKw (capacity raster)</option>
              <option value="equityIdx">equityIdx (priority overlay)</option>
              <option value="demandIdx">demandIdx (travel demand)</option>
            </select>
          </div>
          <div>
            <label className={c.label}>Direction</label>
            <select className={c.input} value={doc.direction} onChange={(e) => merge({ direction: e.target.value })}>
              <option value="lower-better">lower is better</option>
              <option value="higher-better">higher is better</option>
            </select>
          </div>
          <div>
            <label className={c.label}>Transfer function</label>
            <select className={c.input} value={doc.transfer} onChange={(e) => merge({ transfer: e.target.value })}>
              <option value="linear">linear</option>
              <option value="exponential">exponential decay</option>
              <option value="threshold">threshold (step)</option>
            </select>
          </div>
          <div>
            <label className={c.label}>Threshold / scale constant</label>
            <input className={c.input} type="number" step="0.1" value={doc.threshold} onChange={(e) => merge({ threshold: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="md:col-span-2">
            <label className={c.label}>Rationale (required for defensibility)</label>
            <textarea className={c.input + " min-h-[80px]"} value={doc.rationale} onChange={(e) => merge({ rationale: e.target.value })} placeholder="Why this transfer function? Cite the policy or technical basis." />
          </div>
          <div className="md:col-span-2 flex gap-2 flex-wrap">
            <button type="submit" className={c.btn}>Define Layer</button>
            <button type="button" onClick={suggestStandardLayers} disabled={isSuggesting} className={c.btnGhost}>
              {isSuggesting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Drafting…
                </span>
              ) : "Suggest standard layer set"}
            </button>
          </div>
        </form>
      ) : (
        <p className={c.dim + " mt-3"}>Read-only view — contact the analysis owner for write access.</p>
      )}

      <ul className="mt-4">
        {layers.length === 0 && <li className={c.dim + " py-2"}>No scoring layers defined yet.</li>}
        {layers.map((l) => (
          <li key={l._id} className={c.row}>
            <div className="min-w-0">
              <div className="font-medium">{l.name} <span className={c.chip}>{l.field}</span> <span className={c.chip}>{l.transfer}</span></div>
              <div className={c.dim}>{l.direction} · k={l.threshold} · {l.rationale}</div>
            </div>
            {can("write") && (
              <button onClick={() => remove(l._id, l.name)} className={c.btnGhost} aria-label={`Remove ${l.name}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function CandidateSites({ c, can, database, useDocument, useLiveQuery, logAudit }) {
  const { doc, merge, submit } = useDocument({
    type: "site",
    name: "",
    parcelId: "",
    corridorMi: "",
    chargerMi: "",
    gridKw: "",
    equityIdx: "",
    demandIdx: "",
    envFlag: "none",
    createdAt: Date.now(),
  })
  const { docs: sites } = useLiveQuery("type", { key: "site", descending: true })
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim()) return
    submit()
    logAudit("site.register", { name: doc.name, parcelId: doc.parcelId })
  }

  async function suggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Suggest 3 realistic EV fast-charger candidate parcels for a US metro area with diverse contexts (urban core, suburban corridor, equity-priority neighborhood). Provide raw layer measurements.", {
        schema: {
          properties: {
            sites: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  parcelId: { type: "string" },
                  corridorMi: { type: "number" },
                  chargerMi: { type: "number" },
                  gridKw: { type: "number" },
                  equityIdx: { type: "number", description: "0-1, 1=highest priority" },
                  demandIdx: { type: "number", description: "EV trips/day" },
                  envFlag: { type: "string", description: "none, floodplain, wetland, contamination" },
                },
              },
            },
          },
        },
      })
      const parsed = JSON.parse(res)
      for (const s of parsed.sites || []) {
        await database.put({ type: "site", ...s, createdAt: Date.now() })
        logAudit("site.register", { name: s.name, parcelId: s.parcelId, source: "ai-suggested" })
      }
    } finally {
      setIsSuggesting(false)
    }
  }

  async function remove(id, name) {
    await database.del(id)
    logAudit("site.remove", { name })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={c.label}>Site Name</label>
            <input className={c.input} value={doc.name} onChange={(e) => merge({ name: e.target.value })} placeholder="e.g. Eastside Transit Hub" />
          </div>
          <div>
            <label className={c.label}>Parcel ID</label>
            <input className={c.input} value={doc.parcelId} onChange={(e) => merge({ parcelId: e.target.value })} placeholder="APN-000-000-000" />
          </div>
          <div>
            <label className={c.label}>Corridor distance (mi)</label>
            <input className={c.input} type="number" step="0.1" value={doc.corridorMi} onChange={(e) => merge({ corridorMi: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={c.label}>Existing charger distance (mi)</label>
            <input className={c.input} type="number" step="0.1" value={doc.chargerMi} onChange={(e) => merge({ chargerMi: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={c.label}>Grid capacity (kW)</label>
            <input className={c.input} type="number" value={doc.gridKw} onChange={(e) => merge({ gridKw: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={c.label}>Equity priority (0–1)</label>
            <input className={c.input} type="number" step="0.05" min="0" max="1" value={doc.equityIdx} onChange={(e) => merge({ equityIdx: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={c.label}>EV demand (trips/day)</label>
            <input className={c.input} type="number" value={doc.demandIdx} onChange={(e) => merge({ demandIdx: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className={c.label}>Environmental flag</label>
            <select className={c.input} value={doc.envFlag} onChange={(e) => merge({ envFlag: e.target.value })}>
              <option value="none">none</option>
              <option value="floodplain">floodplain</option>
              <option value="wetland">wetland</option>
              <option value="contamination">contamination</option>
            </select>
          </div>
          <div className="md:col-span-2 flex gap-2 flex-wrap">
            <button type="submit" className={c.btn}>Register Candidate</button>
            <button type="button" onClick={suggest} disabled={isSuggesting} className={c.btnGhost}>
              {isSuggesting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Suggesting…
                </span>
              ) : "Suggest sample sites"}
            </button>
          </div>
        </form>
      ) : (
        <p className={c.dim + " mt-3"}>Read-only view — contact the analysis owner for write access.</p>
      )}

      <ul className="mt-4">
        {sites.length === 0 && <li className={c.dim + " py-2"}>No candidate sites registered yet.</li>}
        {sites.map((s) => (
          <li key={s._id} className={c.row}>
            <div className="min-w-0">
              <div className="font-medium truncate">{s.name}</div>
              <div className={c.dim}>
                {s.parcelId} · corridor {s.corridorMi}mi · grid {s.gridKw}kW · equity {s.equityIdx} · demand {s.demandIdx}/day
                {s.envFlag && s.envFlag !== "none" && <span className={c.accent}> · {s.envFlag}</span>}
              </div>
            </div>
            {can("write") && (
              <button onClick={() => remove(s._id, s.name)} className={c.btnGhost} aria-label={`Remove ${s.name}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("ev-siting-workbench")

  function logAudit(action, detail) {
    if (!viewer) return
    database.put({
      type: "audit",
      action,
      detail,
      actor: viewer.userSlug,
      actorName: viewer.displayName ?? viewer.userSlug,
      at: Date.now(),
    })
  }

  const c = {
    page: "min-h-screen bg-[#000000] text-[#f7f7f8] font-mono",
    header: "sticky top-0 z-10 border-b border-[#3a3f4b] bg-[#000000]/95 backdrop-blur px-4 py-3",
    title: "text-lg font-semibold tracking-tight text-[#f7f7f8]",
    tagline: "text-xs text-[#7a8194] mt-0.5",
    main: "max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24",
    section: "rounded-lg border border-[#3a3f4b] bg-[#1f2330]/80 p-4",
    h2: "text-sm font-semibold uppercase tracking-wider text-[#e74c3c] mb-3",
    btn: "min-h-[44px] px-4 py-3 rounded-md bg-[#e74c3c] text-[#f7f7f8] font-medium hover:bg-[#c0392b] disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-3 py-2 rounded-md border border-[#3a3f4b] bg-transparent text-[#f7f7f8] hover:bg-[#1f2330]",
    input: "w-full min-h-[44px] px-3 py-2 rounded-md bg-[#000000] border border-[#3a3f4b] text-[#f7f7f8] placeholder:text-[#7a8194] focus:outline-none focus:border-[#e74c3c]",
    label: "block text-xs uppercase tracking-wide text-[#7a8194] mb-1",
    row: "flex items-center justify-between gap-3 py-2 border-b border-[#3a3f4b] last:border-0",
    dim: "text-[#7a8194] text-sm",
    chip: "inline-block px-2 py-0.5 rounded text-xs bg-[#1f2330] border border-[#3a3f4b] text-[#7a8194]",
    accent: "text-[#e74c3c]",
    grid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    avatar: "w-8 h-8 rounded-full border border-[#3a3f4b]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className={c.title}>EV Siting Suitability Workbench</h1>
            <p className={c.tagline}>Multi-criteria decision analysis · weighted layer composition · defensible methodology</p>
          </div>
          {viewer && (
            <div className="flex items-center gap-2">
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className={c.dim}>{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="candidate-sites" className={c.section}>
          <h2 className={c.h2}>1 · Candidate Sites</h2>
          <p className={c.dim}>Parcels meeting initial zoning and ownership eligibility. Raw layer measurements feed scoring functions.</p>
          <CandidateSites c={c} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} logAudit={logAudit} />
        </section>

        <section id="scoring-layers" className={c.section}>
          <h2 className={c.h2}>2 · Scoring Layers</h2>
          <p className={c.dim}>Each suitability layer defines how raw measurements map to a 0–1 score, with documented rationale.</p>
          <ScoringLayers c={c} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} logAudit={logAudit} />
        </section>

        <section id="scenarios" className={c.section}>
          <h2 className={c.h2}>3 · Weighting Scenarios</h2>
          <p className={c.dim}>Named scenarios reflect policy priorities. Weights normalize to 1.0 across layers.</p>
          <Scenarios c={c} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} logAudit={logAudit} />
        </section>

        <section id="ranked-results" className={c.section}>
          <h2 className={c.h2}>4 · Ranked Candidates & Radar</h2>
          <p className={c.dim}>Live composite scores per scenario. Robust sites rank high across all weighting profiles.</p>
          <RankedResults c={c} useLiveQuery={useLiveQuery} />
        </section>

        <section id="methodology-report" className={c.section}>
          <h2 className={c.h2}>5 · Methodology Report & Sensitivity</h2>
          <p className={c.dim}>AI-authored board-ready narrative with per-layer sensitivity and site robustness classifications.</p>
          <MethodologyReport c={c} can={can} database={database} useLiveQuery={useLiveQuery} logAudit={logAudit} />
        </section>

        <section id="audit-trail" className={c.section}>
          <h2 className={c.h2}>6 · Decision Audit Trail</h2>
          <p className={c.dim}>Immutable log of every configuration change. Defensible to the agency board.</p>
          <AuditTrail c={c} useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}