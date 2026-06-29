import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function PacketSection({ c, useLiveQuery }) {
  const { docs: pins } = useLiveQuery("type", { key: "pin" })
  const { docs: analyses } = useLiveQuery("type", { key: "analysis", descending: true })
  const { docs: narratives } = useLiveQuery("type", { key: "narrative" })
  const [expanded, setExpanded] = React.useState(false)
  const narrative = narratives[0]

  return (
    <section id="packet" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Council Hearing Packet</span>
        <button onClick={() => setExpanded(!expanded)} className={c.btnGhost}>{expanded ? "Hide" : "Preview"}</button>
      </div>
      {expanded && (
        <div className={c.sectionBody + " bg-white"}>
          <div className="border-b-2 border-[#171717] pb-2 mb-3">
            <h3 className="font-bold text-lg">Transit Equity Atlas — Hearing Packet</h3>
            <p className="text-xs text-[#78716c]">Compiled from {pins.length} community observations</p>
          </div>
          {narrative?.body && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-1">Committee Statement</h4>
              <p className="text-sm whitespace-pre-wrap">{narrative.body}</p>
            </div>
          )}
          {analyses.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-1">Access Comparisons</h4>
              {analyses.map(a => (
                <div key={a._id} className="text-sm border-l-2 border-[#dc2626] pl-2 mb-2">
                  <div className="font-medium">{a.destination}</div>
                  <div className="text-xs text-[#44403c]">Walk: {a.walkMinutesToday}→{a.walkMinutesProposal} min · Transfers: {a.transfersToday}→{a.transfersProposal} · Coverage: {a.blockCoverageToday}%→{a.blockCoverageProposal}%</div>
                  <div className="text-xs italic mt-1">{a.summary}</div>
                </div>
              ))}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-sm mb-1">Field Observations</h4>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              {pins.map(p => (
                <li key={p._id}>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-[#78716c]"> ({(p.tags || []).join(", ")})</span>
                  <div className="text-xs ml-4 italic">"{p.narrative}" — {p.authorName || "committee member"}</div>
                </li>
              ))}
            </ol>
          </div>
          <button onClick={() => window.print()} className={c.btn + " mt-4"}>Print packet</button>
        </div>
      )}
    </section>
  )
}

function NarrativeSection({ c, viewer, can, useLiveQuery, database }) {
  const { docs } = useLiveQuery("type", { key: "narrative" })
  const narrative = docs[0]
  const [draft, setDraft] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const { docs: pins } = useLiveQuery("type", { key: "pin" })

  React.useEffect(() => { if (narrative && !editing) setDraft(narrative.body || "") }, [narrative, editing])

  async function save() {
    if (narrative) await database.put({ ...narrative, body: draft, lastEditor: viewer?.displayName, updatedAt: Date.now() })
    else await database.put({ type: "narrative", body: draft, lastEditor: viewer?.displayName, updatedAt: Date.now() })
    setEditing(false)
  }

  async function aiDraft() {
    setIsLoading(true)
    try {
      const pinSummary = pins.map(p => `${p.label}: ${p.narrative}`).join("; ")
      const res = await callAI(`Draft a 3-paragraph equity narrative for a city council hearing about a proposed bus route restructuring. Use these observations: ${pinSummary || "(general transit equity concerns)"}. Focus on who is affected and why the council should weigh equity implications.`, {
        schema: { properties: { narrative: { type: "string" } } }
      })
      setDraft(JSON.parse(res).narrative)
      setEditing(true)
    } finally { setIsLoading(false) }
  }

  return (
    <section id="narrative" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Equity Narrative</span>
        {narrative?.lastEditor && <span className="text-xs text-[#78716c]">last edit: {narrative.lastEditor}</span>}
      </div>
      <div className={c.sectionBody}>
        {editing && can("write") ? (
          <>
            <textarea className={c.textarea + " min-h-[200px]"} value={draft} onChange={e => setDraft(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={save} className={c.btn}>Save draft</button>
              <button onClick={() => setEditing(false)} className={c.btnGhost}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="prose prose-sm whitespace-pre-wrap text-[#171717]">{narrative?.body || <span className={c.readonly}>No narrative drafted yet.</span>}</div>
            {can("write") && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(true)} className={c.btnGhost}>Edit</button>
                <button onClick={aiDraft} disabled={isLoading} className={c.btnGhost}>
                  {isLoading ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg> : "AI draft from pins"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function AccessSection({ c, can, useLiveQuery, database }) {
  const { docs: pins } = useLiveQuery("type", { key: "pin" })
  const { docs: analyses } = useLiveQuery("type", { key: "analysis", descending: true, limit: 5 })
  const [destination, setDestination] = React.useState("Lincoln Elementary School")
  const [isLoading, setIsLoading] = React.useState(false)
  const chartRef = React.useRef()
  const [activeAnalysis, setActiveAnalysis] = React.useState(null)

  const current = activeAnalysis || analyses[0]

  React.useEffect(() => {
    if (!chartRef.current || !current) return
    const svg = d3.select(chartRef.current)
    svg.selectAll("*").remove()
    const w = chartRef.current.clientWidth, h = 200, m = { top: 20, right: 20, bottom: 60, left: 40 }
    const metrics = [
      { name: "Walk min", today: current.walkMinutesToday, proposal: current.walkMinutesProposal },
      { name: "Transfers", today: current.transfersToday, proposal: current.transfersProposal },
      { name: "% block coverage", today: current.blockCoverageToday, proposal: current.blockCoverageProposal },
    ]
    const x0 = d3.scaleBand().domain(metrics.map(d => d.name)).range([m.left, w - m.right]).padding(0.2)
    const x1 = d3.scaleBand().domain(["today", "proposal"]).range([0, x0.bandwidth()]).padding(0.1)
    const y = d3.scaleLinear().domain([0, d3.max(metrics, d => Math.max(d.today, d.proposal)) * 1.1]).range([h - m.bottom, m.top])
    svg.attr("width", w).attr("height", h)
    metrics.forEach(metric => {
      const g = svg.append("g").attr("transform", `translate(${x0(metric.name)},0)`)
      g.append("rect").attr("x", x1("today")).attr("y", y(metric.today)).attr("width", x1.bandwidth()).attr("height", h - m.bottom - y(metric.today)).attr("fill", "#16a34a")
      g.append("rect").attr("x", x1("proposal")).attr("y", y(metric.proposal)).attr("width", x1.bandwidth()).attr("height", h - m.bottom - y(metric.proposal)).attr("fill", "#dc2626")
    })
    svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x0)).selectAll("text").style("font-size", "10px")
    svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4))
  }, [current])

  async function runAnalysis() {
    setIsLoading(true)
    try {
      const pinSummary = pins.map(p => `${p.label} [${(p.tags || []).join(",")}]: ${p.narrative}`).join("; ")
      const res = await callAI(`Given these neighborhood transit observations: ${pinSummary || "(no pins yet, use plausible estimates)"}. Estimate equity metrics for accessing "${destination}" under current bus route vs proposed restructuring. Return realistic numbers.`, {
        schema: { properties: { walkMinutesToday: { type: "number" }, walkMinutesProposal: { type: "number" }, transfersToday: { type: "number" }, transfersProposal: { type: "number" }, blockCoverageToday: { type: "number" }, blockCoverageProposal: { type: "number" }, summary: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      await database.put({ type: "analysis", destination, ...parsed, createdAt: Date.now() })
    } finally { setIsLoading(false) }
  }

  return (
    <section id="access-analysis" className={c.section}>
      <div className={c.sectionHead}><span className={c.sectionTitle}>Equity Access Analysis</span></div>
      <div className={c.sectionBody}>
        <div className="flex gap-2 mb-3">
          <input className={c.input} value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination" />
          {can("write") && (
            <button onClick={runAnalysis} disabled={isLoading} className={c.btn}>
              {isLoading ? <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg> : "Compare"}
            </button>
          )}
        </div>
        {current ? (
          <>
            <div className="flex gap-4 text-xs mb-2">
              <span><span className="inline-block w-3 h-3 bg-[#16a34a] mr-1 rounded"></span>Today</span>
              <span><span className="inline-block w-3 h-3 bg-[#dc2626] mr-1 rounded"></span>Proposal</span>
            </div>
            <svg ref={chartRef} className="w-full" />
            <p className="text-sm mt-2 text-[#44403c]">{current.summary}</p>
            {analyses.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {analyses.map(a => (
                  <button key={a._id} onClick={() => setActiveAnalysis(a)} className={c.btnGhost}>{a.destination}</button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className={c.readonly}>No analysis yet. Pick a destination and run a comparison.</p>
        )}
      </div>
    </section>
  )
}

function PinMapSection({ c, viewer, can, useLiveQuery, database }) {
  const { docs: pins } = useLiveQuery("type", { key: "pin", descending: true })
  const { docs: comments } = useLiveQuery("type", { key: "comment" })
  const [openPin, setOpenPin] = React.useState(null)
  const [commentText, setCommentText] = React.useState("")
  const svgRef = React.useRef()

  React.useEffect(() => {
    if (!svgRef.current || pins.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    const w = svgRef.current.clientWidth, h = 180
    const lats = pins.map(p => p.lat), lngs = pins.map(p => p.lng)
    const x = d3.scaleLinear().domain(d3.extent(lngs)).range([20, w - 20])
    const y = d3.scaleLinear().domain(d3.extent(lats)).range([h - 20, 20])
    svg.append("rect").attr("width", w).attr("height", h).attr("fill", "#f5f5f4")
    svg.selectAll("circle").data(pins).enter().append("circle")
      .attr("cx", d => x(d.lng)).attr("cy", d => y(d.lat)).attr("r", 6)
      .attr("fill", "#dc2626").attr("stroke", "white").attr("stroke-width", 2)
      .style("cursor", "pointer").on("click", (e, d) => setOpenPin(d._id))
  }, [pins])

  async function addComment(pinId) {
    if (!commentText.trim()) return
    await database.put({ type: "comment", pinId, body: commentText, author: viewer?.userSlug, authorName: viewer?.displayName, createdAt: Date.now() })
    setCommentText("")
  }

  return (
    <section id="pin-map" className={c.section}>
      <div className={c.sectionHead}><span className={c.sectionTitle}>Pin Map ({pins.length})</span></div>
      <div className={c.sectionBody}>
        <svg ref={svgRef} className="w-full rounded-lg border border-[#e7e5e4] mb-3" height="180" />
        {pins.length === 0 && <p className={c.readonly}>No observations yet — drop the first pin above.</p>}
        <ul className="space-y-2">
          {pins.map(p => {
            const pinComments = comments.filter(co => co.pinId === p._id)
            const isOpen = openPin === p._id
            return (
              <li key={p._id} className="border border-[#e7e5e4] rounded-lg p-3">
                <button onClick={() => setOpenPin(isOpen ? null : p._id)} className="w-full text-left">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-[#78716c]">{p.authorName || "anon"} · {(p.tags || []).join(", ")}</div>
                </button>
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-[#e7e5e4] space-y-2">
                    <p className="text-sm">{p.narrative}</p>
                    <div className="text-xs text-[#78716c]">📍 {p.lat?.toFixed?.(4)}, {p.lng?.toFixed?.(4)}</div>
                    <div className="space-y-1">
                      {pinComments.map(co => (
                        <div key={co._id} className="text-sm bg-[#f5f5f4] rounded px-2 py-1">
                          <span className="font-medium text-xs">{co.authorName || "anon"}: </span>{co.body}
                        </div>
                      ))}
                    </div>
                    {can("write") && (
                      <div className="flex gap-2">
                        <input className={c.input} placeholder="Add comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                        <button onClick={() => addComment(p._id)} className={c.btnGhost}>Post</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

const TAG_OPTIONS = ["shelter", "sidewalk gap", "school access", "transfer burden", "frequency", "ADA", "lighting", "safety"]

function PinDropSection({ c, viewer, can, useDocument }) {
  const { doc, merge, submit } = useDocument({
    type: "pin",
    lat: "",
    lng: "",
    label: "",
    narrative: "",
    tags: [],
    createdAt: Date.now(),
  })
  const [isLoading, setIsLoading] = React.useState(false)

  function toggleTag(tag) {
    const next = doc.tags?.includes(tag) ? doc.tags.filter(t => t !== tag) : [...(doc.tags || []), tag]
    merge({ tags: next })
  }

  async function suggest() {
    setIsLoading(true)
    try {
      const res = await callAI("Suggest one realistic transit observation a neighborhood committee member might log about a proposed bus route change. Include label, narrative, and 2-3 relevant tags from: " + TAG_OPTIONS.join(", "), {
        schema: { properties: { label: { type: "string" }, narrative: { type: "string" }, tags: { type: "array", items: { type: "string" } } } }
      })
      const parsed = JSON.parse(res)
      merge({ label: parsed.label, narrative: parsed.narrative, tags: parsed.tags?.filter(t => TAG_OPTIONS.includes(t)) || [] })
    } finally { setIsLoading(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.label || !doc.lat) return
    merge({ lat: parseFloat(doc.lat), lng: parseFloat(doc.lng), author: viewer?.userSlug, authorName: viewer?.displayName, createdAt: Date.now() })
    submit()
  }

  if (!can("write")) {
    return (
      <section id="pin-drop" className={c.section}>
        <div className={c.sectionHead}><span className={c.sectionTitle}>Drop an Observation</span></div>
        <div className={c.sectionBody}><p className={c.readonly}>Read-only view — contact the committee owner for write access.</p></div>
      </section>
    )
  }

  return (
    <section id="pin-drop" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Drop an Observation</span>
        <button type="button" onClick={suggest} disabled={isLoading} className={c.btnGhost}>
          {isLoading ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20" /></svg> : "Suggest example"}
        </button>
      </div>
      <div className={c.sectionBody}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input className={c.input} placeholder="Latitude" value={doc.lat} onChange={e => merge({ lat: e.target.value })} />
            <input className={c.input} placeholder="Longitude" value={doc.lng} onChange={e => merge({ lng: e.target.value })} />
          </div>
          <input className={c.input} placeholder="Location name" value={doc.label} onChange={e => merge({ label: e.target.value })} />
          <textarea className={c.textarea} placeholder="What did you observe?" value={doc.narrative} onChange={e => merge({ narrative: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map(tag => (
              <button type="button" key={tag} onClick={() => toggleTag(tag)} className={doc.tags?.includes(tag) ? "px-2 py-1 rounded-full text-xs bg-[#dc2626] text-white" : c.chip}>{tag}</button>
            ))}
          </div>
          <button type="submit" className={c.btn}>Drop pin</button>
        </form>
      </div>
    </section>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("transit-equity-atlas")

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#171717] pb-24",
    header: "sticky top-0 z-10 bg-[#171717] text-[#fafaf9] px-4 py-3 shadow-md",
    title: "text-lg font-bold tracking-tight",
    tagline: "text-xs text-[#a3a3a3] mt-0.5",
    viewerRow: "flex items-center gap-2 mt-2 text-xs",
    avatar: "w-6 h-6 rounded-full border border-[#525252]",
    main: "max-w-3xl mx-auto px-4 py-4 space-y-4",
    section: "bg-white rounded-xl border border-[#e7e5e4] shadow-sm overflow-hidden",
    sectionHead: "px-4 py-3 border-b border-[#e7e5e4] bg-[#f5f5f4] flex items-center justify-between",
    sectionTitle: "text-sm font-semibold uppercase tracking-wide text-[#44403c]",
    sectionBody: "p-4",
    btn: "min-h-[44px] px-4 rounded-lg bg-[#dc2626] text-white font-medium hover:bg-[#b91c1c] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 rounded-lg border border-[#d6d3d1] text-[#44403c] hover:bg-[#f5f5f4] text-sm",
    input: "w-full min-h-[44px] px-3 rounded-lg border border-[#d6d3d1] focus:border-[#dc2626] focus:outline-none",
    textarea: "w-full px-3 py-2 rounded-lg border border-[#d6d3d1] focus:border-[#dc2626] focus:outline-none min-h-[80px]",
    chip: "inline-flex items-center px-2 py-1 rounded-full text-xs bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]",
    readonly: "text-sm text-[#78716c] italic py-2",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.title}>Transit Equity Atlas</div>
        <div className={c.tagline}>Neighborhood evidence for the council hearing</div>
        {viewer && (
          <div className={c.viewerRow}>
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            <span>{viewer.displayName ?? viewer.userSlug}</span>
            {!can("write") && <span className="ml-auto text-[#a3a3a3]">read-only</span>}
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <PinDropSection c={c} viewer={viewer} can={can} useDocument={useDocument} />

        <PinMapSection c={c} viewer={viewer} can={can} useLiveQuery={useLiveQuery} database={database} />

        <AccessSection c={c} can={can} useLiveQuery={useLiveQuery} database={database} />

        <NarrativeSection c={c} viewer={viewer} can={can} useLiveQuery={useLiveQuery} database={database} />

        <PacketSection c={c} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  )
}