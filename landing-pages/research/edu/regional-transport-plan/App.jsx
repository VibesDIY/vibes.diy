import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function CommentsPanel({ database, useDocument, useLiveQuery, can, viewer, c }) {
  const { doc, merge, submit } = useDocument({ type: "comment", artifact: "scenario", artifactRef: "", body: "", response: "", authorSlug: "", authorName: "", authorAvatar: "", createdAt: 0 })
  const { docs: comments } = useLiveQuery("createdAt", { descending: true })
  const commentList = comments.filter(x => x.type === "comment")

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.body) return
    submit({ ...doc, authorSlug: viewer?.userSlug || "anonymous", authorName: viewer?.displayName || viewer?.userSlug || "Anonymous", authorAvatar: viewer?.avatarUrl || "", createdAt: Date.now() })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={c.label}>Concerns</label>
            <select className={c.input} value={doc.artifact} onChange={e => merge({ artifact: e.target.value })}>
              <option value="scenario">Scenario</option><option value="project">Project</option><option value="plan">Overall plan</option>
            </select>
          </div>
          <div><label className={c.label}>Reference (name)</label><input className={c.input} value={doc.artifactRef} onChange={e => merge({ artifactRef: e.target.value })} placeholder="Smart Growth scenario" /></div>
          <div className="md:col-span-2"><label className={c.label}>Public Comment</label><textarea className={c.input} rows="2" value={doc.body} onChange={e => merge({ body: e.target.value })} placeholder="Verbatim comment from the public record…"></textarea></div>
          <div className="md:col-span-2"><label className={c.label}>Official Response</label><textarea className={c.input} rows="2" value={doc.response} onChange={e => merge({ response: e.target.value })} placeholder="MPO staff response…"></textarea></div>
          <div className="md:col-span-2"><button type="submit" className={c.btn}>Record Comment</button></div>
        </form>
      ) : (
        <div className={`${c.readonly} mb-4`}>Read-only view — contact the owner for write access.</div>
      )}
      <ul className="space-y-2">
        {commentList.length === 0 && <li className="text-sm text-[#6b6b6b]">No comments recorded yet.</li>}
        {commentList.map(x => (
          <li key={x._id} className="border border-[#e5e2dc] rounded p-3 bg-[#fafaf7]">
            <div className="flex items-center gap-2 mb-1">
              {x.authorAvatar && <img src={x.authorAvatar} alt={x.authorSlug} className="w-5 h-5 rounded-full" />}
              <span className="text-xs font-semibold text-[#0c1f2e]">{x.authorName}</span>
              <span className="text-xs text-[#4a5d6c]">· re: {x.artifact} {x.artifactRef && `(${x.artifactRef})`}</span>
            </div>
            <div className="text-sm">{x.body}</div>
            {x.response && <div className="text-sm mt-2 pl-3 border-l-2 border-[#c8412a]"><span className="text-xs font-semibold text-[#c8412a] uppercase">Response: </span>{x.response}</div>}
            {can("write") && <button className={`${c.btnGhost} mt-2`} onClick={() => database.del(x._id)}>Remove</button>}
          </li>
        ))}
      </ul>
    </>
  )
}

function GoalsPanel({ database, useDocument, useLiveQuery, can, c }) {
  const weightsDoc = useDocument({ _id: "goal-weights", type: "weights", ghg: 30, housing: 25, equity: 25, congestion: 20 })
  const { docs: projects } = useLiveQuery("type", { key: "project" })
  const { docs: scores } = useLiveQuery("type", { key: "score" })
  const [loading, setLoading] = React.useState(null)
  const svgRef = React.useRef()

  const w = weightsDoc.doc

  const ranked = React.useMemo(() => {
    return projects.map(p => {
      const s = scores.find(x => x.projectId === p._id)
      if (!s) return { p, total: null }
      const total = (s.ghg * w.ghg + s.housing * w.housing + s.equity * w.equity + s.congestion * w.congestion) / 100
      return { p, total, s }
    }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
  }, [projects, scores, w])

  React.useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    const data = ranked.filter(r => r.total !== null)
    if (!data.length) return
    const W = 560, H = 200, m = { t: 20, r: 10, b: 50, l: 40 }
    const x = d3.scaleBand().domain(data.map(d => d.p.name)).range([m.l, W - m.r]).padding(0.2)
    const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t])
    svg.attr("viewBox", `0 0 ${W} ${H}`).style("width", "100%").style("height", "auto")
    svg.append("g").selectAll("rect").data(data).enter().append("rect")
      .attr("x", d => x(d.p.name)).attr("y", d => y(d.total))
      .attr("width", x.bandwidth()).attr("height", d => H - m.b - y(d.total))
      .attr("fill", "#0c1f2e")
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x)).selectAll("text").style("font-size", "10px").attr("transform", "rotate(-15)").style("text-anchor", "end")
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5)).selectAll("text").style("font-size", "10px")
    svg.append("text").attr("x", m.l).attr("y", 14).style("font-size", "11px").style("fill", "#4a5d6c").text("Weighted score (0–100)")
  }, [ranked])

  async function scoreProject(p) {
    setLoading(p._id)
    try {
      const r = await callAI(`Assess transportation project for MPO long-range plan. Score each goal 0-100. Project: ${p.name}, mode: ${p.mode}, capital $${p.capital}M, GHG ${p.ghg} tCO2e/yr, equity: ${p.equity}.`, {
        schema: { properties: { ghg: { type: "number" }, housing: { type: "number" }, equity: { type: "number" }, congestion: { type: "number" }, narrative: { type: "string" }, flags: { type: "string" } } }
      })
      const s = JSON.parse(r)
      const existing = scores.find(x => x.projectId === p._id)
      await database.put({ ...(existing || {}), type: "score", projectId: p._id, ...s, updatedAt: Date.now() })
    } finally { setLoading(null) }
  }

  return (
    <>
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        {["ghg", "housing", "equity", "congestion"].map(k => (
          <div key={k}>
            <label className={c.label}>{k === "ghg" ? "GHG Reduction" : k === "housing" ? "Housing Access" : k === "equity" ? "Equity" : "Congestion Relief"} ({w[k]}%)</label>
            <input type="range" min="0" max="100" value={w[k]} onChange={e => can("write") && weightsDoc.merge({ [k]: +e.target.value })} className="w-full" disabled={!can("write")} />
          </div>
        ))}
      </div>
      {can("write") && <button className={c.btnGhost} onClick={() => weightsDoc.save()}>Save weights</button>}
      <svg ref={svgRef} className="mt-4"></svg>
      <ul className="mt-3 space-y-2">
        {projects.length === 0 && <li className="text-sm text-[#6b6b6b]">Add projects to begin scoring.</li>}
        {ranked.map(({ p, total, s }) => (
          <li key={p._id} className="border border-[#e5e2dc] rounded p-3 bg-[#fafaf7]">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#0c1f2e]">{p.name}</div>
                {s ? (
                  <>
                    <div className="text-xs mt-1">GHG {s.ghg} · Housing {s.housing} · Equity {s.equity} · Congestion {s.congestion}</div>
                    <div className="text-xs text-[#4a5d6c] mt-1 italic">{s.narrative}</div>
                    {s.flags && <div className="text-xs text-[#c8412a] mt-1">⚑ {s.flags}</div>}
                  </>
                ) : <div className="text-xs text-[#6b6b6b]">Not yet evaluated</div>}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[#c8412a]">{total !== null ? total.toFixed(1) : "—"}</div>
                {can("write") && (
                  <button className={c.btnGhost} onClick={() => scoreProject(p)} disabled={loading === p._id}>
                    {loading === p._id ? (<><svg className="animate-spin inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>Evaluating</>) : "Evaluate"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function ProjectsPanel({ database, useDocument, useLiveQuery, can, c }) {
  const { doc, merge, submit } = useDocument({ type: "project", name: "", mode: "Light Rail", capital: "", om: "", ghg: "", equity: "", createdAt: 0 })
  const { docs: projects } = useLiveQuery("type", { key: "project" })

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name) return
    submit({ ...doc, createdAt: Date.now() })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3 mb-4">
          <div><label className={c.label}>Project Name</label><input className={c.input} value={doc.name} onChange={e => merge({ name: e.target.value })} placeholder="Eastside Rail Extension" /></div>
          <div>
            <label className={c.label}>Mode</label>
            <select className={c.input} value={doc.mode} onChange={e => merge({ mode: e.target.value })}>
              <option>Light Rail</option><option>Bus Rapid Transit</option><option>Highway Widening</option><option>Bike/Ped Network</option>
            </select>
          </div>
          <div><label className={c.label}>Capital Cost ($M)</label><input className={c.input} value={doc.capital} onChange={e => merge({ capital: e.target.value })} placeholder="1850" /></div>
          <div><label className={c.label}>Annual O&amp;M ($M)</label><input className={c.input} value={doc.om} onChange={e => merge({ om: e.target.value })} placeholder="42" /></div>
          <div><label className={c.label}>GHG Impact (tCO₂e/yr)</label><input className={c.input} value={doc.ghg} onChange={e => merge({ ghg: e.target.value })} placeholder="-95000" /></div>
          <div><label className={c.label}>Equity Impact Note</label><input className={c.input} value={doc.equity} onChange={e => merge({ equity: e.target.value })} placeholder="Serves 3 EJ communities" /></div>
          <div className="md:col-span-2"><button type="submit" className={c.btn}>Add Project</button></div>
        </form>
      ) : (
        <div className={`${c.readonly} mb-4`}>Read-only view — contact the owner for write access.</div>
      )}
      <ul className="space-y-2">
        {projects.length === 0 && <li className="text-sm text-[#6b6b6b]">No projects yet.</li>}
        {projects.map(p => (
          <li key={p._id} className="border border-[#e5e2dc] rounded p-3 bg-[#fafaf7]">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-[#0c1f2e]">{p.name} <span className="text-xs text-[#4a5d6c] font-normal">· {p.mode}</span></div>
                <div className="text-xs mt-1">Capital: ${p.capital || "—"}M · O&amp;M: ${p.om || "—"}M/yr · GHG: {p.ghg || "—"} tCO₂e</div>
                <div className="text-xs text-[#4a5d6c] mt-1 italic">{p.equity}</div>
              </div>
              {can("write") && <button className={c.btnGhost} onClick={() => database.del(p._id)}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function ScenariosPanel({ database, useDocument, useLiveQuery, can, c }) {
  const { doc, merge, submit } = useDocument({ type: "scenario", name: "", strategy: "Smart Growth (Centers)", hhCenters: "", jobsCenters: "", vmt: "", transit: "", activeShare: "", createdAt: 0 })
  const { docs: scenarios } = useLiveQuery("type", { key: "scenario" })
  const svgRef = React.useRef()

  React.useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    if (!scenarios.length) return
    const w = 560, h = 180, m = { t: 20, r: 10, b: 40, l: 40 }
    const x = d3.scaleBand().domain(scenarios.map(s => s.name || "—")).range([m.l, w - m.r]).padding(0.2)
    const y = d3.scaleLinear().domain([0, d3.max(scenarios, s => +s.vmt) || 30]).range([h - m.b, m.t])
    svg.attr("viewBox", `0 0 ${w} ${h}`).style("width", "100%").style("height", "auto")
    svg.append("g").selectAll("rect").data(scenarios).enter().append("rect")
      .attr("x", s => x(s.name || "—")).attr("y", s => y(+s.vmt || 0))
      .attr("width", x.bandwidth()).attr("height", s => h - m.b - y(+s.vmt || 0))
      .attr("fill", "#c8412a")
    svg.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x)).selectAll("text").style("font-size", "10px")
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4)).selectAll("text").style("font-size", "10px")
    svg.append("text").attr("x", m.l).attr("y", 14).style("font-size", "11px").style("fill", "#4a5d6c").text("VMT per capita by scenario")
  }, [scenarios])

  function handleSubmit(e) {
    e.preventDefault()
    if (!doc.name) return
    submit({ ...doc, createdAt: Date.now() })
  }

  return (
    <>
      {can("write") ? (
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={c.label}>Scenario Name</label>
            <input className={c.input} value={doc.name} onChange={e => merge({ name: e.target.value })} placeholder="Smart Growth — Centers" />
          </div>
          <div>
            <label className={c.label}>Strategy Type</label>
            <select className={c.input} value={doc.strategy} onChange={e => merge({ strategy: e.target.value })}>
              <option>Smart Growth (Centers)</option>
              <option>Urban Growth Management</option>
              <option>Trend Continuation</option>
              <option>Sustainable / Transit-Infill</option>
            </select>
          </div>
          <div><label className={c.label}>Households in Centers (%)</label><input className={c.input} value={doc.hhCenters} onChange={e => merge({ hhCenters: e.target.value })} placeholder="55" /></div>
          <div><label className={c.label}>Jobs in Centers (%)</label><input className={c.input} value={doc.jobsCenters} onChange={e => merge({ jobsCenters: e.target.value })} placeholder="68" /></div>
          <div><label className={c.label}>VMT per capita</label><input className={c.input} value={doc.vmt} onChange={e => merge({ vmt: e.target.value })} placeholder="18.2" /></div>
          <div><label className={c.label}>Transit Ridership (daily, K)</label><input className={c.input} value={doc.transit} onChange={e => merge({ transit: e.target.value })} placeholder="420" /></div>
          <div><label className={c.label}>Walk/Bike mode share (%)</label><input className={c.input} value={doc.activeShare} onChange={e => merge({ activeShare: e.target.value })} placeholder="14" /></div>
          <div className="md:col-span-2"><button type="submit" className={c.btn}>Add Scenario</button></div>
        </form>
      ) : (
        <div className={`${c.readonly} mb-4`}>Read-only view — contact the owner for write access.</div>
      )}
      <svg ref={svgRef}></svg>
      <ul className="mt-3 space-y-2">
        {scenarios.length === 0 && <li className="text-sm text-[#6b6b6b]">No scenarios yet.</li>}
        {scenarios.map(s => (
          <li key={s._id} className="border border-[#e5e2dc] rounded p-3 bg-[#fafaf7]">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-[#0c1f2e]">{s.name}</div>
                <div className="text-xs text-[#4a5d6c]">{s.strategy}</div>
                <div className="text-xs mt-1">VMT/cap: {s.vmt || "—"} · Transit: {s.transit || "—"}K · Active: {s.activeShare || "—"}%</div>
              </div>
              {can("write") && <button className={c.btnGhost} onClick={() => database.del(s._id)}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("regional-horizon")

  const horizonDoc = useDocument({ _id: "horizon-config", type: "horizon", baseYear: "", horizonYear: "", popGrowth: "", empGrowth: "", notes: "" })
  const [horizonLoading, setHorizonLoading] = React.useState(false)

  async function suggestHorizon() {
    setHorizonLoading(true)
    try {
      const r = await callAI("Suggest realistic 25-year MPO planning horizon assumptions for a US metro of several million residents.", {
        schema: { properties: { baseYear: { type: "string" }, horizonYear: { type: "string" }, popGrowth: { type: "string" }, empGrowth: { type: "string" }, notes: { type: "string" } } }
      })
      const s = JSON.parse(r)
      horizonDoc.merge(s)
    } finally { setHorizonLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[#f7f7f5] text-[#171717]",
    header: "sticky top-0 z-10 bg-[#0c1f2e] text-[#f7f7f5] border-b-2 border-[#c8412a]",
    headerInner: "max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3",
    title: "text-lg md:text-xl font-bold tracking-tight",
    tagline: "text-xs text-[#9fb4c4] hidden md:block",
    viewer: "flex items-center gap-2 text-xs",
    avatar: "w-7 h-7 rounded-full border border-[#9fb4c4]",
    main: "max-w-6xl mx-auto px-4 py-5 space-y-5",
    section: "bg-white border border-[#e5e2dc] rounded-lg shadow-sm p-4 md:p-5",
    sectionTitle: "text-base md:text-lg font-semibold text-[#0c1f2e] mb-3 flex items-center gap-2 border-b border-[#e5e2dc] pb-2",
    accent: "w-1.5 h-5 bg-[#c8412a] rounded-sm",
    btn: "min-h-[44px] px-4 py-2 bg-[#c8412a] text-white font-medium rounded hover:bg-[#a8351f] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 bg-[#f0ede7] text-[#0c1f2e] font-medium rounded hover:bg-[#e5e2dc] disabled:opacity-50 text-sm",
    input: "w-full min-h-[44px] px-3 py-2 border border-[#cbc7bf] rounded bg-white focus:outline-none focus:border-[#0c1f2e]",
    label: "block text-xs font-semibold text-[#4a5d6c] mb-1 uppercase tracking-wide",
    readonly: "text-sm text-[#6b6b6b] italic bg-[#f0ede7] border border-[#e5e2dc] rounded p-3",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <div className={c.title}>Regional Horizon</div>
            <div className={c.tagline}>Long-range transportation planning</div>
          </div>
          {viewer ? (
            <div className={c.viewer}>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          ) : (
            <div className={c.viewer}>Anonymous</div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="horizon" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accent}></span>Planning Horizon & Growth Assumptions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={c.label}>Base Year</label>
              <input className={c.input} value={horizonDoc.doc.baseYear} onChange={e => horizonDoc.merge({ baseYear: e.target.value })} disabled={!can("write")} placeholder="2025" />
            </div>
            <div>
              <label className={c.label}>Horizon Year</label>
              <input className={c.input} value={horizonDoc.doc.horizonYear} onChange={e => horizonDoc.merge({ horizonYear: e.target.value })} disabled={!can("write")} placeholder="2050" />
            </div>
            <div>
              <label className={c.label}>Population Growth %</label>
              <input className={c.input} value={horizonDoc.doc.popGrowth} onChange={e => horizonDoc.merge({ popGrowth: e.target.value })} disabled={!can("write")} placeholder="22" />
            </div>
            <div>
              <label className={c.label}>Employment Growth %</label>
              <input className={c.input} value={horizonDoc.doc.empGrowth} onChange={e => horizonDoc.merge({ empGrowth: e.target.value })} disabled={!can("write")} placeholder="18" />
            </div>
          </div>
          <div className="mt-3">
            <label className={c.label}>Regional Notes</label>
            <textarea className={c.input} rows="2" value={horizonDoc.doc.notes} onChange={e => horizonDoc.merge({ notes: e.target.value })} disabled={!can("write")} placeholder="Federal funding context, board priorities, key constraints…"></textarea>
          </div>
          {can("write") ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={c.btn} onClick={() => horizonDoc.save()}>Save Horizon</button>
              <button className={c.btnGhost} onClick={suggestHorizon} disabled={horizonLoading}>
                {horizonLoading ? (<><svg className="animate-spin inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>Suggesting…</>) : "Suggest assumptions"}
              </button>
            </div>
          ) : (
            <div className={`${c.readonly} mt-3`}>Read-only view — contact the owner for write access.</div>
          )}
        </section>

        <section id="scenarios" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accent}></span>Scenarios</h2>
          <ScenariosPanel database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} can={can} c={c} />
        </section>

        <section id="projects" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accent}></span>Proposed Projects</h2>
          <ProjectsPanel database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} can={can} c={c} />
        </section>

        <section id="goals" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accent}></span>Goal Weighting & Project Scoring</h2>
          <GoalsPanel database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} can={can} c={c} />
        </section>

        <section id="comments" className={c.section}>
          <h2 className={c.sectionTitle}><span className={c.accent}></span>Public Comments & Responses</h2>
          <CommentsPanel database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} can={can} viewer={viewer} c={c} />
        </section>
      </main>
    </div>
  )
}