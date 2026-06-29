import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("capstone-dossier")

  const { doc: brief, merge: mergeBrief, save: saveBrief } = useDocument({ _id: "project-brief", statement: "" })
  const { doc: newStake, merge: mergeStake, submit: submitStake } = useDocument({ type: "stakeholder", name: "", interest: "", createdAt: Date.now() })
  const { docs: stakeholders } = useLiveQuery("type", { key: "stakeholder" })

  const { doc: newAlt, merge: mergeAlt, submit: submitAlt } = useDocument({ type: "alternative", label: "", description: "", createdAt: Date.now() })
  const { docs: alternatives } = useLiveQuery("type", { key: "alternative" })

  const COMPONENTS = [
    { id: "cba", label: "Cost-Benefit" },
    { id: "risk", label: "Risk" },
    { id: "mce", label: "MCE" },
    { id: "opt", label: "Optimization" },
  ]
  const [activeComp, setActiveComp] = React.useState("cba")
  const { doc: newAssump, merge: mergeAssump, submit: submitAssump } = useDocument({ type: "assumption", component: activeComp, statement: "", rationale: "", createdAt: Date.now() })
  const { docs: assumptions } = useLiveQuery("type", { key: "assumption" })
  const activeAssumptions = assumptions.filter((a) => a.component === activeComp)

  const { doc: newComment, merge: mergeComment, submit: submitComment } = useDocument({ type: "comment", component: activeComp, body: "", author: viewer?.userSlug || "anon", authorName: viewer?.displayName || "Anonymous", authorAvatar: viewer?.avatarUrl, createdAt: Date.now() })
  const { docs: comments } = useLiveQuery("type", { key: "comment" })
  const activeComments = comments.filter((cm) => cm.component === activeComp).sort((a, b) => a.createdAt - b.createdAt)

  const [critique, setCritique] = React.useState(null)
  const [isCritiquing, setIsCritiquing] = React.useState(false)
  async function critiqueSection() {
    setIsCritiquing(true)
    setCritique(null)
    try {
      const compLabel = COMPONENTS.find((x) => x.id === activeComp)?.label
      const assumpList = activeAssumptions.map((a) => `- ${a.statement} (${a.rationale})`).join("\n") || "(none logged)"
      const r = await callAI(
        `Critique this ${compLabel} analysis section of a graduate policy memo. Problem: ${brief.statement || 'unspecified'}. Assumptions:\n${assumpList}\n\nReturn a defensibility score 1-5, flag inconsistencies, and suggest missing perspectives.`,
        { schema: { properties: {
          defensibilityScore: { type: "number" },
          flags: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        } } }
      )
      const parsed = JSON.parse(r)
      setCritique(parsed)
      await database.put({ type: "critique", component: activeComp, ...parsed, createdAt: Date.now() })
    } finally { setIsCritiquing(false) }
  }

  const { doc: newDraft, merge: mergeDraft, submit: submitDraft } = useDocument({ type: "draft", label: "", body: "", author: viewer?.displayName || "anon", createdAt: Date.now() })
  const { docs: drafts } = useLiveQuery("type", { key: "draft", descending: true })
  const sortedDrafts = [...drafts].sort((a, b) => b.createdAt - a.createdAt)

  const { doc: newReview, merge: mergeReview, submit: submitReview } = useDocument({ type: "review", body: "", reviewer: viewer?.displayName || "anon", createdAt: Date.now() })
  const { docs: reviews } = useLiveQuery("type", { key: "review" })

  const [isSuggestingAlt, setIsSuggestingAlt] = React.useState(false)
  async function suggestAlt() {
    setIsSuggestingAlt(true)
    try {
      const r = await callAI(`Given this policy problem: "${brief.statement || 'a public policy challenge'}", suggest one concrete policy alternative.`, {
        schema: { properties: { label: { type: "string" }, description: { type: "string" } } }
      })
      const p = JSON.parse(r)
      mergeAlt({ label: p.label, description: p.description })
    } finally { setIsSuggestingAlt(false) }
  }

  const [isSuggestingStake, setIsSuggestingStake] = React.useState(false)
  async function suggestStakeholder() {
    setIsSuggestingStake(true)
    try {
      const r = await callAI(`Given this policy problem: "${brief.statement || 'a general public policy challenge'}", suggest one stakeholder name and their interest.`, {
        schema: { properties: { name: { type: "string" }, interest: { type: "string" } } }
      })
      const p = JSON.parse(r)
      mergeStake({ name: p.name, interest: p.interest })
    } finally { setIsSuggestingStake(false) }
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-[#fafafa] font-mono",
    header: "border-b border-[#3a4a5e] bg-black px-5 py-6 sticky top-0 z-10",
    title: "text-2xl font-black tracking-tight uppercase",
    titleFont: { fontFamily: "'Archivo Black', sans-serif" },
    tagline: "text-xs text-[#8a9aae] mt-1 uppercase tracking-widest",
    viewerChip: "flex items-center gap-2 text-xs text-[#8a9aae] mt-3",
    avatar: "w-6 h-6 rounded-full border border-[#3a4a5e]",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a5e] bg-black rounded-sm p-5",
    h2: "text-sm font-bold uppercase tracking-widest text-[#fafafa] mb-4 pb-2 border-b border-[#3a4a5e]",
    h2Font: { fontFamily: "'Archivo Black', sans-serif" },
    input: "w-full bg-[#1a1a1a] border border-[#3a4a5e] text-[#fafafa] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-[#fafafa] min-h-[44px]",
    textarea: "w-full bg-[#1a1a1a] border border-[#3a4a5e] text-[#fafafa] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-[#fafafa] min-h-[88px]",
    btn: "bg-[#fafafa] text-black px-4 py-3 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-[#8a9aae] disabled:opacity-50 min-h-[44px]",
    btnGhost: "border border-[#3a4a5e] text-[#fafafa] px-3 py-2 text-xs uppercase tracking-widest rounded-sm hover:border-[#fafafa] min-h-[36px]",
    btnAI: "border border-[#fafafa] text-[#fafafa] px-3 py-2 text-xs uppercase tracking-widest rounded-sm hover:bg-[#fafafa] hover:text-black min-h-[36px] inline-flex items-center gap-2",
    row: "border border-[#3a4a5e] bg-[#1a1a1a] p-3 rounded-sm text-sm",
    label: "text-[10px] uppercase tracking-widest text-[#8a9aae] mb-1 block",
    meta: "text-[10px] uppercase tracking-widest text-[#8a9aae]",
    readonly: "text-xs text-[#8a9aae] italic",
    tabRow: "flex gap-2 overflow-x-auto pb-2 mb-4",
    tab: "px-3 py-2 text-[10px] uppercase tracking-widest border rounded-sm whitespace-nowrap min-h-[36px]",
    tabActive: "border-[#fafafa] bg-[#fafafa] text-black",
    tabIdle: "border-[#3a4a5e] text-[#8a9aae]",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={c.titleFont}>Capstone Dossier</h1>
        <p className={c.tagline}>Policy Workshop // Team Coordination</p>
        {viewer && (
          <div className={c.viewerChip}>
            <img src={viewer.avatarUrl} alt="" className={c.avatar} />
            <span>{viewer.displayName ?? viewer.userSlug}</span>
            {!can("write") && <span className="text-[#8a9aae]">// read-only</span>}
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="brief" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Project Brief</h2>
          <div className="space-y-4">
            <div>
              <span className={c.label}>Client Problem Statement</span>
              {can("write") ? (
                <>
                  <textarea className={c.textarea} placeholder="What is the client agency asking this team to analyze?"
                    value={brief.statement} onChange={(e) => mergeBrief({ statement: e.target.value })} />
                  <button className={c.btn + " mt-2"} onClick={saveBrief}>Save Brief</button>
                </>
              ) : (
                <div className={c.row}>{brief.statement || <span className={c.readonly}>No problem statement recorded.</span>}</div>
              )}
            </div>
            <div>
              <span className={c.label}>Stakeholders ({stakeholders.length})</span>
              <div className="space-y-2">
                {stakeholders.map((s) => (
                  <div key={s._id} className={c.row}>
                    <div className="font-bold">{s.name}</div>
                    <div className={c.meta}>Interest: {s.interest}</div>
                  </div>
                ))}
                {stakeholders.length === 0 && <div className={c.readonly}>No stakeholders mapped yet.</div>}
              </div>
              {can("write") && (
                <form onSubmit={submitStake} className="mt-3 space-y-2">
                  <input className={c.input} placeholder="Stakeholder name" value={newStake.name} onChange={(e) => mergeStake({ name: e.target.value })} />
                  <input className={c.input} placeholder="Their interest at stake" value={newStake.interest} onChange={(e) => mergeStake({ interest: e.target.value })} />
                  <div className="flex gap-2">
                    <button type="submit" className={c.btn} disabled={!newStake.name}>Add</button>
                    <button type="button" className={c.btnAI} onClick={suggestStakeholder} disabled={isSuggestingStake}>
                      {isSuggestingStake ? (
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4 12H2M22 12h-2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>
                      )}
                      Suggest
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        <section id="alternatives" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Policy Alternatives ({alternatives.length})</h2>
          <div className="space-y-2 mb-4">
            {alternatives.map((a) => (
              <div key={a._id} className={c.row}>
                <div className="font-bold">{a.label}</div>
                <div className={c.meta}>{a.description}</div>
              </div>
            ))}
            {alternatives.length === 0 && <div className={c.readonly}>No alternatives defined yet.</div>}
          </div>
          {can("write") ? (
            <form onSubmit={submitAlt} className="space-y-2">
              <input className={c.input} placeholder="Alternative label (e.g. Alt C: Direct subsidy)" value={newAlt.label} onChange={(e) => mergeAlt({ label: e.target.value })} />
              <textarea className={c.textarea} placeholder="Brief description" value={newAlt.description} onChange={(e) => mergeAlt({ description: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" className={c.btn} disabled={!newAlt.label}>Add Alternative</button>
                <button type="button" className={c.btnAI} onClick={suggestAlt} disabled={isSuggestingAlt}>
                  {isSuggestingAlt ? (
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4 12H2M22 12h-2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>
                  )}
                  Suggest
                </button>
              </div>
            </form>
          ) : (
            <p className={c.readonly}>Read-only — contact the team owner for write access.</p>
          )}
        </section>

        <section id="sections" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Analytic Components</h2>
          <div className={c.tabRow}>
            {COMPONENTS.map((cp) => (
              <button key={cp.id} className={c.tab + " " + (activeComp === cp.id ? c.tabActive : c.tabIdle)} onClick={() => { setActiveComp(cp.id); mergeAssump({ component: cp.id }); mergeComment({ component: cp.id }) }}>
                {cp.label}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <span className={c.label}>Assumptions ({activeAssumptions.length})</span>
              <div className="space-y-2">
                {activeAssumptions.map((a) => (
                  <div key={a._id} className={c.row}>
                    <div className="font-bold">{a.statement}</div>
                    <div className={c.meta}>{a.rationale}</div>
                  </div>
                ))}
                {activeAssumptions.length === 0 && <div className={c.readonly}>No assumptions logged for this component.</div>}
              </div>
              {can("write") && (
                <form onSubmit={submitAssump} className="mt-2 space-y-2">
                  <input className={c.input} placeholder="State an assumption" value={newAssump.statement} onChange={(e) => mergeAssump({ statement: e.target.value })} />
                  <input className={c.input} placeholder="Rationale" value={newAssump.rationale} onChange={(e) => mergeAssump({ rationale: e.target.value })} />
                  <button type="submit" className={c.btn} disabled={!newAssump.statement}>Log Assumption</button>
                </form>
              )}
            </div>
            <div>
              <span className={c.label}>Thread ({activeComments.length})</span>
              <div className="space-y-2">
                {activeComments.map((cm) => (
                  <div key={cm._id} className={c.row}>
                    <div className="text-sm">{cm.body}</div>
                    <div className={c.meta + " mt-1 flex items-center gap-2"}>
                      {cm.authorAvatar && <img src={cm.authorAvatar} alt="" className="w-4 h-4 rounded-full" />}
                      — {cm.authorName}
                    </div>
                  </div>
                ))}
                {activeComments.length === 0 && <div className={c.readonly}>No discussion yet.</div>}
              </div>
              {can("write") && viewer && (
                <form onSubmit={submitComment} className="mt-2 space-y-2">
                  <input className={c.input} placeholder="Add to thread" value={newComment.body} onChange={(e) => mergeComment({ body: e.target.value, author: viewer.userSlug, authorName: viewer.displayName || viewer.userSlug, authorAvatar: viewer.avatarUrl })} />
                  <button type="submit" className={c.btn} disabled={!newComment.body}>Post</button>
                </form>
              )}
            </div>
            {can("write") && (
              <button className={c.btnAI} onClick={critiqueSection} disabled={isCritiquing}>
                {isCritiquing ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2"/></svg>
                )}
                AI Critique This Section
              </button>
            )}
            {critique && (
              <div className={c.row}>
                <div className="font-bold mb-2">Defensibility: {critique.defensibilityScore}/5</div>
                {critique.flags?.length > 0 && (
                  <div className="mb-2">
                    <div className={c.label}>Flags</div>
                    <ul className="text-xs space-y-1">{critique.flags.map((f, i) => <li key={i}>• {f}</li>)}</ul>
                  </div>
                )}
                {critique.suggestions?.length > 0 && (
                  <div>
                    <div className={c.label}>Suggestions</div>
                    <ul className="text-xs space-y-1">{critique.suggestions.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section id="assumptions" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Consolidated Assumptions ({assumptions.length})</h2>
          <p className={c.meta + " mb-3"}>Every assumption underlying the analysis, for client agency audit.</p>
          {assumptions.length === 0 ? (
            <div className={c.readonly}>No assumptions logged across the project yet.</div>
          ) : (
            <div className="space-y-3">
              {COMPONENTS.map((cp) => {
                const rows = assumptions.filter((a) => a.component === cp.id)
                if (rows.length === 0) return null
                return (
                  <div key={cp.id}>
                    <div className={c.label}>{cp.label}</div>
                    <div className="space-y-1">
                      {rows.map((a) => (
                        <div key={a._id} className={c.row}>
                          <div className="font-bold text-xs">{a.statement}</div>
                          <div className={c.meta}>{a.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section id="memo" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Memo Drafts ({sortedDrafts.length})</h2>
          <div className="space-y-2 mb-4">
            {sortedDrafts.map((d) => (
              <details key={d._id} className={c.row}>
                <summary className="cursor-pointer">
                  <span className="font-bold">{d.label}</span>
                  <div className={c.meta}>Saved by {d.author} // {new Date(d.createdAt).toLocaleString()}</div>
                </summary>
                <pre className="text-xs whitespace-pre-wrap mt-2 text-[#fafafa]">{d.body}</pre>
              </details>
            ))}
            {sortedDrafts.length === 0 && <div className={c.readonly}>No drafts saved yet.</div>}
          </div>
          {can("write") ? (
            <form onSubmit={submitDraft} className="space-y-2">
              <input className={c.input} placeholder="Version label (e.g. v3 Pre-final)" value={newDraft.label} onChange={(e) => mergeDraft({ label: e.target.value })} />
              <textarea className={c.textarea} placeholder="Draft body" value={newDraft.body} onChange={(e) => mergeDraft({ body: e.target.value })} />
              <button type="submit" className={c.btn} disabled={!newDraft.label}>Save Draft</button>
            </form>
          ) : (
            <p className={c.readonly}>Read-only portfolio view.</p>
          )}
          <div className="mt-6">
            <span className={c.label}>Faculty Milestone Reviews ({reviews.length})</span>
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r._id} className={c.row}>
                  <div className="text-sm">{r.body}</div>
                  <div className={c.meta + " mt-1"}>— {r.reviewer} // {new Date(r.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
              {reviews.length === 0 && <div className={c.readonly}>No milestone reviews yet.</div>}
            </div>
            {can("write") && (
              <form onSubmit={submitReview} className="mt-2 space-y-2">
                <textarea className={c.textarea} placeholder="Add a milestone review" value={newReview.body} onChange={(e) => mergeReview({ body: e.target.value })} />
                <button type="submit" className={c.btn} disabled={!newReview.body}>Post Review</button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}