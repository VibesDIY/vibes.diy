import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ConventionsReview({ c, database, useDocument, useLiveQuery, projects, selectedId, can, viewer }) {
  const { docs: convDocs } = useLiveQuery("type", { key: "conventions" })
  const conv = convDocs[0]
  const [convText, setConvText] = React.useState("")
  const [target, setTarget] = React.useState("analyticPlan")
  const [review, setReview] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => { if (conv) setConvText(conv.body || "") }, [conv?._id])

  const saveConv = () => {
    if (conv) database.put({ ...conv, body: convText })
    else database.put({ type: "conventions", body: convText, createdAt: Date.now() })
  }

  const selectedProject = projects.find(p => p._id === selectedId)

  async function runCheck() {
    if (!selectedProject) return
    setLoading(true); setReview(null)
    try {
      const targetText = selectedProject[target] || ""
      const prompt = `Lab conventions:\n${convText}\n\nProject section (${target}):\n${targetText}\n\nCritique alignment with the lab conventions. Score 0-100. Give 3 specific recommendations and one suggested revision passage.`
      const r = await callAI(prompt, {
        schema: {
          properties: {
            score: { type: "number" },
            recommendations: { type: "array", items: { type: "string" } },
            suggestedRevision: { type: "string" },
          }
        }
      })
      const parsed = JSON.parse(r)
      setReview(parsed)
      database.put({ type: "review", projectId: selectedId, section: target, ...parsed, createdAt: Date.now(),
        createdBy: viewer?.userSlug || "anonymous" })
    } finally { setLoading(false) }
  }

  const readOnly = !can("write")
  const targets = [["analyticPlan","Analytic Plan"],["robustness","Robustness"],["results","Results"],["manuscriptLog","Manuscript Log"],["researchQuestion","Research Question"]]

  return (
    <section id="conventions-review" className={c.section}>
      <div className={c.sectionHead}>
        <h2 className={c.h2}>Conventions & Review</h2>
        <span className={c.muted}>Lab standards</span>
      </div>
      <div className={c.sectionBody}>
        <div>
          <label className={c.tag}>Lab Conventions Document</label>
          <textarea className={c.textarea} rows={5} value={convText}
            onChange={(e) => setConvText(e.target.value)} disabled={readOnly}
            placeholder="When to prefer MLM over FE, diagnostic standards, missing data conventions..." />
          {can("write") && (
            <button className={c.btnGhost} onClick={saveConv}>Save Conventions</button>
          )}
        </div>
        <div className="pt-2">
          <label className={c.tag}>Review Target {selectedProject ? `· ${selectedProject.title}` : "(select a project)"}</label>
          <select className={c.input} value={target} onChange={(e) => setTarget(e.target.value)} disabled={readOnly}>
            {targets.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {can("write") && (
          <button className={c.btn} onClick={runCheck} disabled={loading || !selectedProject || !convText}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
                Checking...
              </span>
            ) : "Run Conventions Check"}
          </button>
        )}
        <div className={c.row}>
          <div className={c.tag}>Alignment Score</div>
          <div className="text-2xl font-black">{review ? `${review.score}/100` : "—"}</div>
          {review ? (
            <div className="space-y-2 pt-2">
              <div>
                <div className={c.tag}>Recommendations</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {review.recommendations?.map((r,i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              {review.suggestedRevision && (
                <div>
                  <div className={c.tag}>Suggested Revision</div>
                  <p className="text-sm italic border-l-2 border-[#3a4a6a] pl-3">{review.suggestedRevision}</p>
                </div>
              )}
            </div>
          ) : (
            <div className={c.muted}>Run a check to see specific recommendations.</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("lab-bench")
  const { docs: projects } = useLiveQuery("type", { key: "project", descending: true })
  const { doc: newProject, merge: mergeNew, submit: submitNew } = useDocument({
    type: "project", title: "", stage: "Intake", unit: "", dataSources: "", analyticPlan: "",
    robustness: "", results: "", manuscriptLog: "", createdAt: Date.now(),
    createdBy: viewer?.userSlug || "anonymous",
  })
  const [filter, setFilter] = React.useState("All")
  const [selectedId, setSelectedId] = React.useState(null)
  const [suggesting, setSuggesting] = React.useState(false)
  const stages = ["All", "Intake", "Extraction", "Analysis", "Manuscript", "Revision", "Blocked"]
  const filtered = filter === "All" ? projects : projects.filter(p => p.stage === filter)

  async function suggestProject() {
    setSuggesting(true)
    try {
      const r = await callAI("Suggest one realistic education research project title for a district-partner lab studying student outcomes. Be specific.", {
        schema: { properties: { title: { type: "string" }, unit: { type: "string" } } }
      })
      const { title, unit } = JSON.parse(r)
      mergeNew({ title, unit })
    } finally { setSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-[#fafafa] font-mono",
    header: "sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#3a4a6a] px-4 py-4 flex items-center justify-between",
    title: "text-lg font-black tracking-[0.2em] uppercase",
    tag: "text-[10px] text-[#8a9ab0] tracking-widest uppercase",
    avatar: "w-8 h-8 rounded-full border border-[#3a4a6a]",
    main: "px-4 py-5 space-y-5 max-w-2xl mx-auto pb-24",
    section: "border border-[#3a4a6a] bg-black/40 rounded-sm",
    sectionHead: "px-4 py-3 border-b border-[#3a4a6a] flex items-center justify-between",
    h2: "text-xs font-black tracking-[0.2em] uppercase",
    sectionBody: "p-4 space-y-3",
    btn: "min-h-[44px] px-4 py-2 bg-[#fafafa] text-black text-xs font-black tracking-widest uppercase rounded-sm disabled:opacity-40",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a4a6a] text-[#fafafa] text-xs tracking-widest uppercase rounded-sm hover:bg-[#3a4a6a]/30",
    input: "w-full bg-black border border-[#3a4a6a] text-[#fafafa] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-[#fafafa]",
    textarea: "w-full bg-black border border-[#3a4a6a] text-[#fafafa] px-3 py-3 text-sm rounded-sm font-mono focus:outline-none focus:border-[#fafafa]",
    row: "border border-[#3a4a6a] bg-black/60 p-3 rounded-sm",
    badge: "inline-block text-[10px] tracking-widest uppercase px-2 py-1 border border-[#3a4a6a] rounded-sm",
    muted: "text-xs text-[#8a9ab0] tracking-wide",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>Lab Bench</div>
          <div className={c.tag}>Research Operations · Dossier</div>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>

      <main id="app" className={c.main}>
        <section id="project-board" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.h2}>Project Board</h2>
            <span className={c.muted}>{projects.length} total</span>
          </div>
          <div className={c.sectionBody}>
            {can("write") ? (
              <form onSubmit={submitNew} className="space-y-2">
                <input className={c.input} placeholder="New project title" value={newProject.title}
                  onChange={(e) => mergeNew({ title: e.target.value })} required />
                <div className="flex gap-2">
                  <button type="submit" className={c.btn} disabled={!newProject.title}>+ Project</button>
                  <button type="button" className={c.btnGhost} onClick={suggestProject} disabled={suggesting}>
                    {suggesting ? (
                      <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                      </svg>
                    ) : "Suggest"}
                  </button>
                </div>
              </form>
            ) : (
              <p className={c.muted}>Read-only view — contact the lab PI for write access.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {stages.map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`${c.badge} ${filter === s ? "bg-[#fafafa] text-black" : ""}`}>{s}</button>
              ))}
            </div>
            <ul className="space-y-2 pt-1">
              {filtered.length === 0 && <li className={c.muted}>No projects in this stage yet.</li>}
              {filtered.map(p => (
                <li key={p._id} className={`${c.row} cursor-pointer ${selectedId === p._id ? "border-[#fafafa]" : ""}`}
                  onClick={() => setSelectedId(p._id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{p.title}</span>
                    <span className={c.badge}>{p.stage}</span>
                  </div>
                  {p.unit && <div className={c.muted}>{p.unit}</div>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="project-dossier" className={c.section}>
          <div className={c.sectionHead}>
            <h2 className={c.h2}>Project Dossier</h2>
            <span className={c.muted}>{selectedId ? "Editing" : "Select a project"}</span>
          </div>
          <div className={c.sectionBody}>
            {!selectedId ? (
              <p className={c.muted}>Tap a project on the board to open its dossier.</p>
            ) : (() => {
              const proj = projects.find(p => p._id === selectedId)
              if (!proj) return <p className={c.muted}>Project not found.</p>
              const stageOrder = ["Intake", "Extraction", "Analysis", "Manuscript", "Revision", "Blocked"]
              const update = (patch) => database.put({ ...proj, ...patch })
              const readOnly = !can("write")
              const Field = ({ label, value, rows, onChange, ph }) => (
                <div>
                  <label className={c.tag}>{label}</label>
                  {rows ? (
                    <textarea className={c.textarea} rows={rows} value={value || ""} placeholder={ph}
                      onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
                  ) : (
                    <input className={c.input} value={value || ""} placeholder={ph}
                      onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
                  )}
                </div>
              )
              return (
                <div className="space-y-3">
                  <Field label="Title" value={proj.title} onChange={(v) => update({ title: v })} />
                  <Field label="Research Question" rows={2} value={proj.researchQuestion}
                    ph="Causal or descriptive question" onChange={(v) => update({ researchQuestion: v })} />
                  <Field label="Unit of Analysis" value={proj.unit}
                    ph="Student-year, classroom, school..." onChange={(v) => update({ unit: v })} />
                  <Field label="Data Sources" rows={2} value={proj.dataSources}
                    ph="Extraction request, file IDs..." onChange={(v) => update({ dataSources: v })} />
                  <Field label="Analytic Plan" rows={3} value={proj.analyticPlan}
                    ph="Primary spec, MLM levels, FE..." onChange={(v) => update({ analyticPlan: v })} />
                  <Field label="Robustness & Sensitivity" rows={2} value={proj.robustness}
                    onChange={(v) => update({ robustness: v })} />
                  <Field label="Results" rows={2} value={proj.results} onChange={(v) => update({ results: v })} />
                  <Field label="Manuscript & Reviewer Log" rows={2} value={proj.manuscriptLog}
                    onChange={(v) => update({ manuscriptLog: v })} />
                  <div>
                    <label className={c.tag}>Stage</label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stageOrder.map(s => (
                        <button key={s} disabled={readOnly}
                          onClick={() => update({ stage: s })}
                          className={`${c.badge} ${proj.stage === s ? "bg-[#fafafa] text-black" : ""}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {can("write") && (
                    <button className={c.btnGhost} onClick={() => { database.del(proj._id); setSelectedId(null) }}>
                      Delete Project
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </section>

        <ConventionsReview c={c} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery}
          projects={projects} selectedId={selectedId} can={can} viewer={viewer} />
      </main>
    </div>
  )
}