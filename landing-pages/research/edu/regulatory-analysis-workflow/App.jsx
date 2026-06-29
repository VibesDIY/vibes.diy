import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useLiveQuery, useDocument, database } = useFireproof("policy-dossier-v1")
  const { docs: projects } = useLiveQuery("type", { key: "project", descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = projects.find(p => p._id === selectedId)

  const initialProject = { type: "project", title: "", method: "Cost-Benefit Analysis", horizon: "", decision: "", alternatives: "", population: "", welfare: "Kaldor-Hicks compensation", status: "draft", createdAt: Date.now() }
  const { doc: projectDoc, merge: mergeProject, submit: submitProject } = useDocument(initialProject)

  const [isGenerating, setIsGenerating] = React.useState(false)
  async function generateAppendix() {
    if (!selected) return
    setIsGenerating(true)
    try {
      const prompt = `Generate a standardized analytic appendix for a federal policy analysis. Title: ${selected.title}. Method: ${selected.method}. Horizon: ${selected.horizon}. Decision: ${selected.decision}. Alternatives: ${selected.alternatives}. Affected population: ${selected.population}. Welfare framing: ${selected.welfare}. Produce a concrete impact category inventory (6-8 items), a sensitivity scaffold around load-bearing assumptions (4-6 items), and a paragraph on welfare framing implications.`
      const res = await callAI(prompt, {
        schema: { properties: { impacts: { type: "array", items: { type: "string" } }, sensitivity: { type: "array", items: { type: "string" } }, welfareNotes: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      await database.put({ ...selected, appendix: { ...parsed, generatedAt: Date.now() } })
    } finally { setIsGenerating(false) }
  }

  const { docs: assumptions } = useLiveQuery("type", { key: "assumption", descending: true })
  const { doc: assumptionDoc, merge: mergeAssumption, submit: submitAssumption } = useDocument({ type: "assumption", name: "", value: "", source: "", createdAt: Date.now() })

  const [isSuggesting, setIsSuggesting] = React.useState(false)
  async function suggestProject() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Generate one realistic federal policy analysis dossier example (regulatory CBA, decision memo, or program review). Be specific.", {
        schema: { properties: { title: { type: "string" }, method: { type: "string" }, horizon: { type: "string" }, decision: { type: "string" }, alternatives: { type: "string" }, population: { type: "string" } } }
      })
      const s = JSON.parse(res)
      mergeProject({ title: s.title, method: s.method, horizon: s.horizon, decision: s.decision, alternatives: s.alternatives, population: s.population })
    } finally { setIsSuggesting(false) }
  }

  function Spinner() { return <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" strokeLinecap="round" /></svg> }
  function Sparkle() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19"/></svg> }

  const c = {
    page: "min-h-screen bg-[#191919] text-white font-mono",
    header: "border-b border-[#2a3548] bg-black sticky top-0 z-10",
    headerInner: "max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3",
    brand: "text-xl md:text-2xl font-black tracking-wider uppercase",
    brandSub: "text-[10px] md:text-xs text-[#8a96ad] tracking-widest uppercase mt-0.5",
    viewerChip: "flex items-center gap-2 text-xs text-[#8a96ad]",
    avatar: "w-7 h-7 rounded-full border border-[#2a3548]",
    main: "max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-black border border-[#2a3548] rounded-sm p-4 md:p-5",
    h2: "text-[11px] tracking-[0.25em] uppercase text-[#8a96ad] mb-3 flex items-center justify-between",
    h2Tag: "text-white",
    input: "w-full bg-[#0a0a0a] border border-[#2a3548] text-white px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-white min-h-[44px]",
    textarea: "w-full bg-[#0a0a0a] border border-[#2a3548] text-white px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-white",
    label: "block text-[10px] tracking-[0.2em] uppercase text-[#8a96ad] mb-1.5",
    btn: "bg-white text-black px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-sm hover:bg-[#ddd] disabled:opacity-50 min-h-[44px]",
    btnGhost: "border border-[#2a3548] text-white px-3 py-2 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:border-white disabled:opacity-50",
    btnAi: "border border-[#2a3548] text-[#8a96ad] px-2 py-1 text-[9px] tracking-widest uppercase rounded-sm hover:border-white hover:text-white disabled:opacity-50 inline-flex items-center gap-1",
    row: "border border-[#2a3548] rounded-sm p-3 hover:border-white cursor-pointer",
    empty: "text-xs text-[#8a96ad] italic py-4 text-center",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-3",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <div className={c.brand}>Dossier // OPE</div>
            <div className={c.brandSub}>Office of Policy & Evaluation — Analytic Workbench</div>
          </div>
          {viewer && (
            <div className={c.viewerChip}>
              <img src={viewer.avatarUrl} alt="" className={c.avatar} />
              <span className="hidden md:inline uppercase tracking-widest">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="portfolio" className={c.section}>
          <h2 className={c.h2}><span>01 // Project Portfolio</span><span className={c.h2Tag}>{projects.length} active</span></h2>
          {projects.length === 0 ? (
            <div className={c.empty}>No dossiers yet. Open a new project below.</div>
          ) : (
            <ul className="space-y-2">
              {projects.map(p => (
                <li
                  key={p._id}
                  onClick={() => setSelectedId(selectedId === p._id ? null : p._id)}
                  className={`${c.row} ${selectedId === p._id ? "border-white bg-[#0a0a0a]" : ""}`}
                >
                  <div className="text-sm font-bold uppercase tracking-wider">{p.title || "Untitled dossier"}</div>
                  <div className="text-[10px] text-[#8a96ad] mt-1 tracking-widest uppercase">
                    {p.method || "method TBD"} · {p.horizon || "horizon TBD"} · {p.status || "draft"}
                  </div>
                  {selectedId === p._id && (
                    <div className="mt-3 pt-3 border-t border-[#2a3548] space-y-2 text-xs text-[#c5cde0]">
                      <div><span className="text-[#8a96ad] uppercase tracking-widest text-[10px]">Decision: </span>{p.decision || "—"}</div>
                      <div><span className="text-[#8a96ad] uppercase tracking-widest text-[10px]">Alternatives: </span>{p.alternatives || "—"}</div>
                      <div><span className="text-[#8a96ad] uppercase tracking-widest text-[10px]">Affected: </span>{p.population || "—"}</div>
                      <div><span className="text-[#8a96ad] uppercase tracking-widest text-[10px]">Welfare framing: </span>{p.welfare || "—"}</div>
                      {can("write") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("Archive this dossier?")) { database.del(p._id); setSelectedId(null) } }}
                          className={c.btnGhost}
                        >Archive</button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="new-project" className={c.section}>
          <h2 className={c.h2}>
            <span>02 // Open Dossier</span>
            {can("write") && (
              <button onClick={suggestProject} disabled={isSuggesting} className={c.btnAi}>
                {isSuggesting ? <Spinner /> : <Sparkle />} AI example
              </button>
            )}
          </h2>
          {!can("write") ? (
            <div className={c.empty}>Read-only view — contact the dossier owner for write access.</div>
          ) : (
            <form onSubmit={submitProject} className="space-y-3">
              <div>
                <label className={c.label}>Title / regulatory action</label>
                <input className={c.input} value={projectDoc.title} onChange={e => mergeProject({ title: e.target.value })} placeholder="e.g. Proposed Rule — Drinking Water MCL" required />
              </div>
              <div className={c.grid2}>
                <div>
                  <label className={c.label}>Method</label>
                  <select className={c.input} value={projectDoc.method} onChange={e => mergeProject({ method: e.target.value })}>
                    <option>Cost-Benefit Analysis</option>
                    <option>Decision Analysis</option>
                    <option>Multi-Criteria Evaluation</option>
                    <option>Optimization</option>
                    <option>Risk Analysis</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Time horizon</label>
                  <input className={c.input} value={projectDoc.horizon} onChange={e => mergeProject({ horizon: e.target.value })} placeholder="20 years" />
                </div>
              </div>
              <div>
                <label className={c.label}>Decision being supported</label>
                <textarea rows="2" className={c.textarea} value={projectDoc.decision} onChange={e => mergeProject({ decision: e.target.value })} placeholder="What choice does this analysis inform?" />
              </div>
              <div>
                <label className={c.label}>Alternatives under consideration</label>
                <textarea rows="2" className={c.textarea} value={projectDoc.alternatives} onChange={e => mergeProject({ alternatives: e.target.value })} placeholder="Status quo · Alt A · Alt B …" />
              </div>
              <div>
                <label className={c.label}>Affected population</label>
                <input className={c.input} value={projectDoc.population} onChange={e => mergeProject({ population: e.target.value })} placeholder="Households served by community water systems" />
              </div>
              <div>
                <label className={c.label}>Welfare framing</label>
                <select className={c.input} value={projectDoc.welfare} onChange={e => mergeProject({ welfare: e.target.value })}>
                  <option>Kaldor-Hicks compensation</option>
                  <option>Distributional weighting</option>
                  <option>Pareto improvement only</option>
                </select>
              </div>
              <button type="submit" className={c.btn}>Open Dossier</button>
            </form>
          )}
        </section>

        <section id="assumptions" className={c.section}>
          <h2 className={c.h2}>
            <span>03 // Agency Assumptions Library</span>
            <span className={c.h2Tag}>{assumptions.length} entries</span>
          </h2>
          {assumptions.length === 0 ? (
            <div className={c.empty}>Library empty. Add the canonical values your agency reuses across projects.</div>
          ) : (
            <ul className="space-y-2">
              {assumptions.map(a => (
                <li key={a._id} className={c.row}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] tracking-widest uppercase text-[#8a96ad]">{a.name}</div>
                      <div className="text-sm font-bold">{a.value}</div>
                      {a.source && <div className="text-[10px] text-[#8a96ad] mt-1">Source: {a.source}</div>}
                    </div>
                    {can("write") && (
                      <button onClick={() => database.del(a._id)} className={c.btnGhost}>Remove</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {can("write") && (
            <form onSubmit={submitAssumption} className="mt-4 space-y-2">
              <input className={c.input} value={assumptionDoc.name} onChange={e => mergeAssumption({ name: e.target.value })} placeholder="Assumption name (e.g. VSL)" required />
              <input className={c.input} value={assumptionDoc.value} onChange={e => mergeAssumption({ value: e.target.value })} placeholder="Standard value (e.g. $11.6M 2023 USD)" required />
              <input className={c.input} value={assumptionDoc.source} onChange={e => mergeAssumption({ source: e.target.value })} placeholder="Source / convention" />
              <button type="submit" className={c.btn}>Add to library</button>
            </form>
          )}
        </section>

        <section id="appendix" className={c.section}>
          <h2 className={c.h2}>
            <span>04 // Analytic Appendix</span>
            <span className={c.h2Tag}>{selected ? selected.title?.slice(0, 24) : "no dossier"}</span>
          </h2>
          <p className="text-xs text-[#8a96ad] mb-3">
            {selected ? "Generate the standardized appendix for the selected dossier — impact inventory, sensitivity scaffold, welfare framing." : "Select a dossier above to enable generation."}
          </p>
          {can("write") && (
            <button onClick={generateAppendix} disabled={!selected || isGenerating} className={c.btn}>
              {isGenerating ? <span className="inline-flex items-center gap-2"><Spinner /> Generating…</span> : "Generate Appendix"}
            </button>
          )}
          <div className="mt-4 border border-[#2a3548] rounded-sm p-4 text-xs">
            {selected?.appendix ? (
              <div className="space-y-4 text-[#c5cde0]">
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-[#8a96ad] mb-1">Impact inventory</div>
                  <ul className="list-disc pl-4 space-y-1">{(selected.appendix.impacts || []).map((i, k) => <li key={k}>{i}</li>)}</ul>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-[#8a96ad] mb-1">Sensitivity scaffold</div>
                  <ul className="list-disc pl-4 space-y-1">{(selected.appendix.sensitivity || []).map((i, k) => <li key={k}>{i}</li>)}</ul>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-[#8a96ad] mb-1">Welfare framing notes</div>
                  <p>{selected.appendix.welfareNotes}</p>
                </div>
                <div className="text-[10px] text-[#8a96ad] uppercase tracking-widest">Generated {new Date(selected.appendix.generatedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="text-[#8a96ad]">No appendix generated yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}