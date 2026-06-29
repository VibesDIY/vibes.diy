import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ReportsPanel({ selected, can, viewer, c, database, useLiveQuery }) {
  const { docs: reports } = useLiveQuery("reportFor", { key: selected?._id || "__none__", descending: true })
  const { docs: recentObs } = useLiveQuery("monitoringFor", { key: selected?._id || "__none__", descending: true, limit: 5 })
  const [draft, setDraft] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [kind, setKind] = React.useState(null)

  async function generate(reportKind) {
    if (!selected) return
    setKind(reportKind)
    setLoading(true)
    try {
      const obsSummary = recentObs.map(o => `- ${o.featureDrift || ""} | ${o.predictionDrift || ""} | ${o.opsNotes || ""}`).join("\n")
      const prompt = reportKind === "retraining"
        ? `Draft a monthly retraining report for model "${selected.name}" (${selected.algorithm}). Current spec: features=${selected.featureSet}, regularization=${selected.regularization}, CV=${selected.cvProtocol}, metrics=${selected.metrics}. Recent observations:\n${obsSummary}`
        : `Draft a quarterly deep review for model "${selected.name}". Consider: should the algorithm family change? Should new features be engineered? Should dimensionality reduction (PCA) be considered? Current spec: ${selected.algorithm}, features=${selected.featureSet}. Observations:\n${obsSummary}`
      const res = await callAI(prompt, {
        schema: { properties: {
          summary: { type: "string", description: "comparison or assessment summary" },
          driftConcerns: { type: "string" },
          recommendation: { type: "string", description: "keep, retrain, or replace + algorithm/feature suggestions" },
          rationale: { type: "string" },
        }}
      })
      setDraft({ kind: reportKind, ...JSON.parse(res) })
    } finally { setLoading(false) }
  }

  async function saveReport() {
    if (!draft || !selected) return
    await database.put({
      type: "report",
      reportFor: selected._id,
      kind: draft.kind,
      summary: draft.summary,
      driftConcerns: draft.driftConcerns,
      recommendation: draft.recommendation,
      rationale: draft.rationale,
      author: viewer?.userSlug || "anon",
      createdAt: Date.now(),
    })
    setDraft(null)
    setKind(null)
  }

  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
    </svg>
  )

  if (!selected) return <p className={c.muted}>Select a model to file reports.</p>

  return (
    <>
      {can("write") ? (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button className={c.btn} onClick={() => generate("retraining")} disabled={loading}>
            {loading && kind === "retraining" ? <><Spinner/> Drafting...</> : "Draft retraining report"}
          </button>
          <button className={c.btnGhost} onClick={() => generate("quarterly")} disabled={loading}>
            {loading && kind === "quarterly" ? "Drafting..." : "Quarterly deep review"}
          </button>
        </div>
      ) : (
        <div className={c.readonly + " mb-4"}>Read-only — contact the owner for write access.</div>
      )}

      {draft && (
        <div className="border border-[#e84a3a] rounded p-3 mb-4 space-y-2 bg-[#11131c]">
          <div className="text-[10px] uppercase tracking-wider text-[#e84a3a]">Draft · {draft.kind} · review &amp; edit before saving</div>
          <div>
            <label className={c.label}>Summary</label>
            <textarea className={c.input} rows="2" value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Drift concerns</label>
            <textarea className={c.input} rows="2" value={draft.driftConcerns} onChange={e => setDraft({ ...draft, driftConcerns: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Recommendation</label>
            <textarea className={c.input} rows="2" value={draft.recommendation} onChange={e => setDraft({ ...draft, recommendation: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Rationale</label>
            <textarea className={c.input} rows="3" value={draft.rationale} onChange={e => setDraft({ ...draft, rationale: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className={c.btn} onClick={saveReport}>Accept &amp; save</button>
            <button className={c.btnGhost} onClick={() => setDraft(null)}>Discard</button>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className={c.muted}>No reports filed yet.</div>
      ) : (
        <ul className={c.timeline}>
          {reports.map(r => (
            <li key={r._id} className={c.event}>
              <span className={c.eventDot}></span>
              <div className="flex items-center gap-2 mb-1">
                <span className={c.pill}>{r.kind}</span>
                <span className={c.muted}>{new Date(r.createdAt).toLocaleDateString()} · {r.author}</span>
              </div>
              <div className="text-xs"><span className="text-[#e84a3a]">summary:</span> {r.summary}</div>
              {r.recommendation && <div className="text-xs"><span className="text-[#e84a3a]">rec:</span> {r.recommendation}</div>}
              {r.rationale && <div className="text-xs"><span className="text-[#e84a3a]">why:</span> {r.rationale}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function MonitoringPanel({ selected, can, viewer, c, database, useLiveQuery, useDocument }) {
  const { docs: obs } = useLiveQuery("monitoringFor", { key: selected?._id || "__none__", descending: true })
  const { doc, merge, submit } = useDocument({
    type: "monitoring",
    monitoringFor: selected?._id,
    featureDrift: "",
    predictionDrift: "",
    opsNotes: "",
    createdAt: Date.now(),
    author: viewer?.userSlug || "anon",
  })
  React.useEffect(() => { merge({ monitoringFor: selected?._id }) }, [selected?._id])

  if (!selected) return <p className={c.muted}>Select a model to log monitoring.</p>

  return (
    <>
      {can("write") ? (
        <form onSubmit={submit} className="space-y-2 mb-4">
          <div>
            <label className={c.label}>Feature drift</label>
            <input className={c.input} placeholder="e.g. session_count shifted +12%" value={doc.featureDrift} onChange={e => merge({ featureDrift: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Prediction drift</label>
            <input className={c.input} placeholder="e.g. positive rate up 3pp vs last week" value={doc.predictionDrift} onChange={e => merge({ predictionDrift: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Operational notes</label>
            <input className={c.input} placeholder="latency, errors, anomalies" value={doc.opsNotes} onChange={e => merge({ opsNotes: e.target.value })} />
          </div>
          <button type="submit" className={c.btn}>Log observation</button>
        </form>
      ) : (
        <div className={c.readonly + " mb-4"}>Read-only — contact the owner for write access.</div>
      )}
      {obs.length === 0 ? (
        <div className={c.muted}>No observations yet.</div>
      ) : (
        <ul className={c.timeline}>
          {obs.map(o => (
            <li key={o._id} className={c.event}>
              <span className={c.eventDot}></span>
              <div className={c.muted}>{new Date(o.createdAt).toLocaleDateString()} · {o.author}</div>
              {o.featureDrift && <div className="text-xs"><span className="text-[#e84a3a]">feat:</span> {o.featureDrift}</div>}
              {o.predictionDrift && <div className="text-xs"><span className="text-[#e84a3a]">pred:</span> {o.predictionDrift}</div>}
              {o.opsNotes && <div className="text-xs"><span className="text-[#e84a3a]">ops:</span> {o.opsNotes}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("recon-grid-models")
  const [selectedId, setSelectedId] = React.useState(null)
  const [suggestLoading, setSuggestLoading] = React.useState(false)

  const { docs: models } = useLiveQuery("type", { key: "model", descending: true })
  const { doc: newModel, merge: mergeModel, submit: submitModel } = useDocument({
    type: "model",
    name: "",
    algorithm: "",
    featureSet: "",
    regularization: "",
    cvProtocol: "",
    metrics: "",
    status: "active",
    createdAt: Date.now(),
  })

  const selected = models.find(m => m._id === selectedId) || null

  async function suggestModel() {
    setSuggestLoading(true)
    try {
      const res = await callAI("Suggest a realistic production ML model spec for an e-commerce company.", {
        schema: { properties: {
          name: { type: "string" },
          algorithm: { type: "string", description: "one of: logistic regression, random forest, gradient-boosted trees, SVM, neural network" },
        }}
      })
      const data = JSON.parse(res)
      mergeModel({ name: data.name, algorithm: data.algorithm })
    } finally { setSuggestLoading(false) }
  }

  const c = {
    page: "min-h-screen bg-[#000000] text-[#f5f6f8] font-mono",
    header: "sticky top-0 z-10 bg-[#000000]/95 border-b border-[#3a4258] px-4 py-3 flex items-center justify-between backdrop-blur",
    title: "text-lg font-bold tracking-widest text-[#f5f6f8]",
    tag: "text-[10px] uppercase tracking-[0.2em] text-[#8a93a8] mt-0.5",
    avatar: "w-7 h-7 rounded-full border border-[#3a4258]",
    main: "px-4 py-4 space-y-4 max-w-3xl mx-auto pb-24",
    section: "bg-[#11131c]/80 border border-[#3a4258] rounded-lg p-4",
    h2: "text-xs uppercase tracking-[0.2em] text-[#e84a3a] font-bold mb-3 flex items-center gap-2",
    h2dot: "w-2 h-2 rounded-full bg-[#e84a3a] inline-block",
    btn: "min-h-[44px] px-4 py-2 rounded bg-[#e84a3a] text-[#000000] font-bold text-sm uppercase tracking-wider hover:bg-[#ff5a48] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
    btnGhost: "min-h-[44px] px-3 py-2 rounded border border-[#3a4258] text-[#f5f6f8] text-xs uppercase tracking-wider hover:bg-[#11131c]",
    btnSm: "px-2 py-1 rounded border border-[#3a4258] text-[10px] uppercase tracking-wider text-[#8a93a8] hover:text-[#e84a3a] hover:border-[#e84a3a]",
    input: "w-full bg-[#000000] border border-[#3a4258] rounded px-3 py-2 text-sm text-[#f5f6f8] placeholder-[#5b6478] focus:outline-none focus:border-[#e84a3a]",
    label: "block text-[10px] uppercase tracking-[0.15em] text-[#8a93a8] mb-1",
    row: "border border-[#3a4258] rounded px-3 py-2 bg-[#000000]/60 hover:border-[#e84a3a] cursor-pointer transition-colors",
    rowActive: "border border-[#e84a3a] rounded px-3 py-2 bg-[#11131c]",
    pill: "inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[#3a4258] text-[#8a93a8]",
    timeline: "border-l-2 border-[#3a4258] pl-4 py-2 space-y-3",
    event: "relative",
    eventDot: "absolute -left-[22px] top-1.5 w-3 h-3 rounded-full bg-[#000000] border-2 border-[#e84a3a]",
    muted: "text-[#8a93a8] text-xs",
    readonly: "text-[#8a93a8] text-xs italic border border-dashed border-[#3a4258] rounded px-3 py-2",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>RECON·GRID</h1>
          <p className={c.tag}>Model Operations Registry</p>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <span className={c.muted}>{viewer.displayName ?? viewer.userSlug}</span>
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="registry" className={c.section}>
          <h2 className={c.h2}><span className={c.h2dot}></span>Model Registry</h2>
          {models.length === 0 ? (
            <p className={c.muted}>No models registered yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {models.map(m => (
                <li key={m._id} className={m._id === selectedId ? c.rowActive : c.row} onClick={() => setSelectedId(m._id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{m.name}</div>
                      <div className={c.muted}>{m.algorithm || "—"} {m.metrics ? `· ${m.metrics}` : ""}</div>
                    </div>
                    <span className={c.pill}>{m.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {can("write") ? (
            <form onSubmit={submitModel} className="space-y-2 border-t border-[#3a4258] pt-3">
              <div className="flex items-center justify-between">
                <label className={c.label}>Register new model</label>
                <button type="button" className={c.btnSm} onClick={suggestModel} disabled={suggestLoading}>
                  {suggestLoading ? "..." : "suggest"}
                </button>
              </div>
              <input className={c.input} placeholder="model name (e.g. lifetime-value-v1)" value={newModel.name} onChange={e => mergeModel({ name: e.target.value })} />
              <input className={c.input} placeholder="algorithm family" value={newModel.algorithm} onChange={e => mergeModel({ algorithm: e.target.value })} />
              <button type="submit" className={c.btn} disabled={!newModel.name.trim()}>Register</button>
            </form>
          ) : (
            <div className={c.readonly}>Read-only view — contact the owner for write access.</div>
          )}
        </section>

        <section id="detail" className={c.section}>
          <h2 className={c.h2}><span className={c.h2dot}></span>Model Specification</h2>
          {!selected ? (
            <p className={c.muted}>Select a model from the registry above.</p>
          ) : !can("write") ? (
            <div className="space-y-2">
              <div className="text-sm font-bold">{selected.name}</div>
              <div className={c.muted}>Algorithm: {selected.algorithm || "—"}</div>
              <div className={c.muted}>Features: {selected.featureSet || "—"}</div>
              <div className={c.muted}>Regularization: {selected.regularization || "—"}</div>
              <div className={c.muted}>CV Protocol: {selected.cvProtocol || "—"}</div>
              <div className={c.muted}>Metrics: {selected.metrics || "—"}</div>
              <div className={c.readonly}>Read-only view — contact the owner for write access.</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-bold text-[#e84a3a]">{selected.name}</div>
              <div>
                <label className={c.label}>Algorithm Family</label>
                <input className={c.input} value={selected.algorithm || ""} onChange={e => database.put({ ...selected, algorithm: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Feature Set</label>
                <textarea className={c.input} rows="2" value={selected.featureSet || ""} onChange={e => database.put({ ...selected, featureSet: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Regularization</label>
                <input className={c.input} value={selected.regularization || ""} onChange={e => database.put({ ...selected, regularization: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>CV Protocol</label>
                <input className={c.input} value={selected.cvProtocol || ""} onChange={e => database.put({ ...selected, cvProtocol: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Held-out Metrics</label>
                <input className={c.input} value={selected.metrics || ""} onChange={e => database.put({ ...selected, metrics: e.target.value })} />
              </div>
            </div>
          )}
        </section>

        <section id="monitoring" className={c.section}>
          <h2 className={c.h2}><span className={c.h2dot}></span>Weekly Monitoring</h2>
          <MonitoringPanel selected={selected} can={can} viewer={viewer} c={c} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} />
        </section>

        <section id="reports" className={c.section}>
          <h2 className={c.h2}><span className={c.h2dot}></span>Reports &amp; Decisions</h2>
          <ReportsPanel selected={selected} can={can} viewer={viewer} c={c} database={database} useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}