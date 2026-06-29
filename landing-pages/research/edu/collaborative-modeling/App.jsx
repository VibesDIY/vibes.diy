import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function SummaryPanel({ selected, c, can, database, useLiveQuery }) {
  const { docs } = useLiveQuery("projectId", { key: selected?._id || "_none" })
  const summary = docs.find(d => d.type === "summary")
  const rewrite = docs.find(d => d.type === "rewrite")
  const [text, setText] = React.useState("")
  const [rewriting, setRewriting] = React.useState(false)
  React.useEffect(() => { setText(summary?.body || "") }, [summary?._id])
  async function save() {
    if (!selected) return
    if (summary) await database.put({ ...summary, body: text, updatedAt: Date.now() })
    else await database.put({ type: "summary", projectId: selected._id, body: text, createdAt: Date.now() })
  }
  async function rewriteAI() {
    if (!text.trim()) return
    setRewriting(true)
    try {
      const r = await callAI(`Rewrite this modeling summary for a non-technical nonprofit program director. Plain language, no jargon, score the clarity 1-10. Text: ${text}`, {
        schema: { properties: { rewrite: { type: "string" }, clarity: { type: "number" }, notes: { type: "string" } } }
      })
      const f = JSON.parse(r)
      await database.put({ type: "rewrite", projectId: selected._id, ...f, createdAt: Date.now() })
    } finally { setRewriting(false) }
  }
  if (!selected) return <p className={c.muted}>Select a project above.</p>
  return (
    <div>
      {can("write") ? (
        <>
          <textarea className={c.input} rows="5" placeholder="Draft the program-director-facing summary together…" value={text} onChange={e => setText(e.target.value)} />
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={save} className={c.btn}>Save Summary</button>
            <button onClick={rewriteAI} disabled={rewriting} className={c.btnGhost}>
              {rewriting ? (<svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>) : "AI Plain-Language Rewrite"}
            </button>
          </div>
        </>
      ) : <div className={c.row}><p className="text-sm">{summary?.body || "No summary yet."}</p></div>}
      {rewrite && (
        <div className={`${c.row} mt-3`}>
          <div className="text-xs uppercase tracking-wider text-[#9ca3af] mb-1">AI Rewrite · Clarity {rewrite.clarity}/10</div>
          <p className="text-sm">{rewrite.rewrite}</p>
          {rewrite.notes && <p className={c.muted + " mt-2"}>{rewrite.notes}</p>}
        </div>
      )}
    </div>
  )
}

function CommentsPanel({ selected, c, can, viewer, database, useDocument, useLiveQuery }) {
  const { docs: items } = useLiveQuery("projectId", { key: selected?._id || "_none" })
  const threads = items.filter(i => i.type === "thread")
  const { doc, merge, submit } = useDocument({ type: "thread", projectId: selected?._id, topic: "", body: "", author: viewer?.userSlug || "anon", createdAt: Date.now() })
  const [replyText, setReplyText] = React.useState({})
  async function postReply(threadId) {
    const text = replyText[threadId]?.trim(); if (!text) return
    await database.put({ type: "reply", threadId, projectId: selected._id, body: text, author: viewer?.userSlug || "anon", createdAt: Date.now() })
    setReplyText({ ...replyText, [threadId]: "" })
  }
  if (!selected) return <p className={c.muted}>Select a project above.</p>
  return (
    <div>
      <div className="space-y-3 mb-4">
        {threads.length === 0 && <p className={c.muted}>No threads yet.</p>}
        {threads.map(t => {
          const replies = items.filter(i => i.type === "reply" && i.threadId === t._id).sort((a,b) => a.createdAt - b.createdAt)
          return (
            <div key={t._id} className={c.row}>
              <div className="font-bold text-sm">{t.topic}</div>
              <div className={c.muted}>started by {t.author}</div>
              <p className="text-sm mt-1">{t.body}</p>
              <div className="mt-2 pl-3 border-l border-[#3a4257] text-sm space-y-1">
                {replies.map(r => <p key={r._id}><span className="text-[#9ca3af]">{r.author}:</span> {r.body}</p>)}
              </div>
              {can("write") && (
                <div className="flex gap-2 mt-2">
                  <input className={c.input} placeholder="Reply…" value={replyText[t._id] || ""} onChange={e => setReplyText({ ...replyText, [t._id]: e.target.value })} />
                  <button onClick={() => postReply(t._id)} className={c.btnGhost}>Reply</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); if (selected) { merge({ projectId: selected._id }); submit() } }} className="space-y-2">
          <input className={c.input} placeholder="Decision topic" value={doc.topic} onChange={e => merge({ topic: e.target.value })} />
          <textarea className={c.input} rows="2" placeholder="Your comment…" value={doc.body} onChange={e => merge({ body: e.target.value })} />
          <button type="submit" className={c.btn}>Post Thread</button>
        </form>
      ) : <p className={c.muted}>Read-only.</p>}
    </div>
  )
}

function ApproachesPanel({ selected, c, can, viewer, database, useDocument, useLiveQuery }) {
  const { docs: approaches } = useLiveQuery("projectId", { key: selected?._id || "_none" })
  const { doc, merge, submit } = useDocument({ type: "approach", projectId: selected?._id, algorithm: "", cvScore: "", notes: "", recommended: false, author: viewer?.userSlug || "anon", createdAt: Date.now() })
  const [critiquing, setCritiquing] = React.useState(null)
  async function critique(a) {
    setCritiquing(a._id)
    try {
      const r = await callAI(`Critique this modeling approach for a nonprofit project. Algorithm: ${a.algorithm}. CV: ${a.cvScore}. Notes: ${a.notes}. Identify methodology gaps, regularization concerns, interpretability tradeoffs.`, {
        schema: { properties: { gaps: { type: "array", items: { type: "string" } }, interpretability: { type: "string" }, suggestion: { type: "string" } } }
      })
      const f = JSON.parse(r)
      await database.put({ type: "critique", approachId: a._id, projectId: selected._id, ...f, createdAt: Date.now() })
    } finally { setCritiquing(null) }
  }
  if (!selected) return <p className={c.muted}>Select a project above.</p>
  return (
    <div>
      <div className="space-y-2 mb-4">
        {approaches.filter(a => a.type === "approach").length === 0 && <p className={c.muted}>No approaches yet.</p>}
        {approaches.filter(a => a.type === "approach").map(a => {
          const crit = approaches.find(x => x.type === "critique" && x.approachId === a._id)
          return (
            <div key={a._id} className={c.row}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-bold">{a.algorithm}</div>
                  <div className={c.muted}>by {a.author} · {a.cvScore}</div>
                </div>
                {a.recommended && <span className={c.badgeRecommended}>Recommended</span>}
              </div>
              <p className="text-sm mt-2">{a.notes}</p>
              {can("write") && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => database.put({ ...a, recommended: !a.recommended })} className={c.btnGhost}>{a.recommended ? "Unrecommend" : "Recommend"}</button>
                  <button onClick={() => critique(a)} disabled={critiquing === a._id} className={c.btnGhost}>
                    {critiquing === a._id ? (<svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>) : "AI Critique"}
                  </button>
                </div>
              )}
              {crit && (
                <div className="mt-3 border-t border-[#3a4257] pt-2 text-sm">
                  <div className="text-xs uppercase tracking-wider text-[#9ca3af] mb-1">AI Review</div>
                  {crit.gaps?.length > 0 && <ul className="list-disc ml-4">{crit.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}
                  <p className="mt-1"><span className="text-[#9ca3af]">Interpretability:</span> {crit.interpretability}</p>
                  <p className="mt-1"><span className="text-[#9ca3af]">Suggestion:</span> {crit.suggestion}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {can("write") ? (
        <form onSubmit={(e) => { e.preventDefault(); if (selected) { merge({ projectId: selected._id }); submit() } }} className="space-y-2">
          <input className={c.input} placeholder="Algorithm" value={doc.algorithm} onChange={e => merge({ algorithm: e.target.value })} />
          <input className={c.input} placeholder="CV score (e.g. AUC 0.84)" value={doc.cvScore} onChange={e => merge({ cvScore: e.target.value })} />
          <textarea className={c.input} rows="2" placeholder="Notes on regularization, features, selection…" value={doc.notes} onChange={e => merge({ notes: e.target.value })} />
          <button type="submit" className={c.btn}>Propose Approach</button>
        </form>
      ) : <p className={c.muted}>Read-only.</p>}
    </div>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("modeling-dossier")
  const { docs: projects } = useLiveQuery("type", { key: "project", descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = projects.find(p => p._id === selectedId) || projects[0]
  const { doc: newProj, merge: mergeProj, submit: submitProj } = useDocument({
    type: "project", name: "", framing: "", datasets: "", status: "active", createdAt: Date.now()
  })
  const [suggestingProj, setSuggestingProj] = React.useState(false)
  async function suggestProject() {
    setSuggestingProj(true)
    try {
      const r = await callAI("Suggest one realistic nonprofit modeling project (donor, volunteer, or program data).", {
        schema: { properties: { name: { type: "string" }, framing: { type: "string" }, datasets: { type: "string" } } }
      })
      const p = JSON.parse(r)
      mergeProj({ name: p.name, framing: p.framing, datasets: p.datasets })
    } finally { setSuggestingProj(false) }
  }

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4257] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-2xl font-black tracking-tight",
    titleAccent: "font-['Archivo_Black'] uppercase",
    tagline: "text-xs text-[#9ca3af] mt-1 uppercase tracking-widest",
    main: "max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4257] bg-black rounded-md p-4",
    sectionHeading: "font-['Archivo_Black'] uppercase text-lg tracking-wide mb-3 border-b border-[#3a4257] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-white text-black font-bold uppercase text-sm tracking-wider rounded hover:bg-[#e5e5e5] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a4257] text-white text-xs uppercase tracking-wider rounded hover:bg-[#1a1a1a]",
    input: "w-full bg-[#1a1a1a] border border-[#3a4257] rounded px-3 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-white",
    row: "border border-[#3a4257] rounded p-3 bg-[#0a0a0a]",
    muted: "text-[#9ca3af] text-sm",
    badge: "inline-block px-2 py-1 text-xs uppercase tracking-wider border border-[#3a4257] rounded",
    badgeRecommended: "inline-block px-2 py-1 text-xs uppercase tracking-wider bg-white text-black rounded font-bold",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}><span className={c.titleAccent}>Modeling</span> Dossier</h1>
        <p className={c.tagline}>Collaborative modeling workspace · nonprofit analytics</p>
      </header>
      <main id="app" className={c.main}>
        <section id="projects" className={c.section}>
          <h2 className={c.sectionHeading}>Projects</h2>
          <div className="space-y-2 mb-4">
            {projects.length === 0 && <p className={c.muted}>No projects yet. Create one below.</p>}
            {projects.map(p => (
              <div key={p._id} className={`${c.row} cursor-pointer ${selected?._id === p._id ? "border-white" : ""}`} onClick={() => setSelectedId(p._id)}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-bold">{p.name}</div>
                    <div className={c.muted}>{p.framing} · {p.datasets}</div>
                  </div>
                  <span className={p.status === "ready" ? c.badgeRecommended : c.badge}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
          {can("write") ? (
            <form onSubmit={submitProj} className="space-y-2">
              <input className={c.input} placeholder="Project name" value={newProj.name} onChange={e => mergeProj({ name: e.target.value })} />
              <input className={c.input} placeholder="Problem framing" value={newProj.framing} onChange={e => mergeProj({ framing: e.target.value })} />
              <input className={c.input} placeholder="Datasets (comma-separated)" value={newProj.datasets} onChange={e => mergeProj({ datasets: e.target.value })} />
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className={c.btn}>Create Project</button>
                <button type="button" onClick={suggestProject} disabled={suggestingProj} className={c.btnGhost}>
                  {suggestingProj ? (<svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>) : "AI Suggest"}
                </button>
                {selected && can("write") && (
                  <button type="button" onClick={() => database.put({ ...selected, status: selected.status === "ready" ? "active" : "ready" })} className={c.btnGhost}>
                    {selected.status === "ready" ? "Mark Active" : "Mark Ready"}
                  </button>
                )}
              </div>
            </form>
          ) : <p className={c.muted}>Read-only — contact owner for write access.</p>}
        </section>
        <section id="approaches" className={c.section}>
          <h2 className={c.sectionHeading}>Modeling Approaches{selected && <span className="text-xs text-[#9ca3af] ml-2 normal-case">· {selected.name}</span>}</h2>
          <ApproachesPanel selected={selected} c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />
        </section>
        <section id="comments" className={c.section}>
          <h2 className={c.sectionHeading}>Decision Threads{selected && <span className="text-xs text-[#9ca3af] ml-2 normal-case">· {selected.name}</span>}</h2>
          <CommentsPanel selected={selected} c={c} can={can} viewer={viewer} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />
        </section>
        <section id="summary" className={c.section}>
          <h2 className={c.sectionHeading}>Non-Technical Summary{selected && <span className="text-xs text-[#9ca3af] ml-2 normal-case">· {selected.name}</span>}</h2>
          <SummaryPanel selected={selected} c={c} can={can} database={database} useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}