import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"
import { useFireproof } from "use-fireproof"

const PRIO = { low: "#4aa84a", medium: "#f2c64d", high: "#e74a3a" }
const PRIO_NEXT = { low: "medium", medium: "high", high: "low" }

function Composer({ useDocument, me, can, ready }) {
  const { doc, merge, submit } = useDocument(() => ({
    type: "todo",
    text: "",
    done: false,
    priority: "medium",
    authorHandle: me?.userHandle,
    createdAt: Date.now(),
  }))
  const [sparking, setSparking] = React.useState(false)

  async function spark() {
    setSparking(true)
    try {
      const r = await callAI("Suggest one short fun todo item, max 6 words, uppercase punchy.", {
        schema: { properties: { todo: { type: "string" } } }
      })
      merge({ text: JSON.parse(r).todo })
    } finally { setSparking(false) }
  }

  const verdict = ready ? can.create({ type: "todo", authorHandle: me?.userHandle }) : { ok: false }
  if (!ready) return <section className="bg-[#ffffff] border-[3px] border-[#16161d] rounded-[4px] shadow-[4px_4px_0px_#16161d] p-4 h-32" />
  if (!verdict.ok) return <section className="bg-[#ffffff] border-[3px] border-[#16161d] rounded-[4px] shadow-[4px_4px_0px_#16161d] p-4 text-sm uppercase font-bold">{verdict.reason}</section>

  return (
    <section id="composer" className="bg-[#ffffff] border-[3px] border-[#16161d] rounded-[4px] shadow-[4px_4px_0px_#16161d] p-4">
      <h2 className="text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a85] mb-3 font-bold">New Entry</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (doc.text.trim()) submit() }} className="space-y-3">
        <input value={doc.text} onChange={(e) => merge({ text: e.target.value })} placeholder="WHAT NEEDS DOING?" className="w-full px-3 py-3 border-[3px] border-[#16161d] rounded-[4px] bg-[#fafaf5] uppercase text-sm font-medium min-h-[44px]" />
        <div className="flex gap-2 items-center">
          <button type="button" onClick={() => merge({ priority: PRIO_NEXT[doc.priority] })} className="min-h-[44px] px-3 border-[3px] border-[#16161d] rounded-[4px] shadow-[3px_3px_0px_#16161d] font-bold uppercase text-xs tracking-[0.08em]" style={{ backgroundColor: PRIO[doc.priority], color: doc.priority === "medium" ? "#16161d" : "#fff" }}>{doc.priority}</button>
          <button type="submit" className="flex-1 min-h-[44px] bg-[#e74a3a] text-white border-[3px] border-[#16161d] rounded-[4px] shadow-[3px_3px_0px_#16161d] font-bold uppercase text-xs tracking-[0.08em]">Add</button>
          <button type="button" onClick={spark} disabled={sparking} className="min-h-[44px] px-4 bg-[#f2c64d] text-[#16161d] border-[3px] border-[#16161d] rounded-[4px] shadow-[3px_3px_0px_#16161d] font-bold uppercase text-xs tracking-[0.08em]">
            {sparking ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16161d" strokeWidth="3" className="animate-spin"><path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round"/></svg> : "Spark"}
          </button>
        </div>
      </form>
    </section>
  )
}

function TodoFeed({ database, useLiveQuery }) {
  const { docs } = useLiveQuery("createdAt", { descending: true })
  const [saving, setSaving] = React.useState(() => new Set())

  async function toggle(d) {
    setSaving(s => new Set(s).add(d._id))
    try { await database.put({ ...d, done: !d.done }) }
    finally { setSaving(s => { const n = new Set(s); n.delete(d._id); return n }) }
  }
  async function remove(id) {
    setSaving(s => new Set(s).add(id))
    try { await database.del(id) } catch { setSaving(s => { const n = new Set(s); n.delete(id); return n }); }
  }
  async function cyclePrio(d) {
    setSaving(s => new Set(s).add(d._id))
    try { await database.put({ ...d, priority: PRIO_NEXT[d.priority] || "medium" }) }
    finally { setSaving(s => { const n = new Set(s); n.delete(d._id); return n }) }
  }

  return (
    <section id="feed" className="bg-[#ffffff] border-[3px] border-[#16161d] rounded-[4px] shadow-[4px_4px_0px_#16161d] p-4">
      <h2 className="text-[0.65rem] uppercase tracking-[0.15em] text-[#7a7a85] mb-3 font-bold">Your List · {docs.length}</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-[#7a7a85] italic uppercase tracking-wide">Empty. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => {
            const isSaving = saving.has(d._id)
            return (
              <li key={d._id} className={`flex items-center gap-2 p-2 border-[3px] border-[#16161d] rounded-[4px] bg-[#fafaf5] ${isSaving ? "opacity-60" : ""}`}>
                <button onClick={() => toggle(d)} className="w-[28px] h-[28px] border-[3px] border-[#16161d] rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: d.done ? "#4aa84a" : "#fff" }}>
                  {d.done && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                <button onClick={() => cyclePrio(d)} className="px-2 py-1 border-[2px] border-[#16161d] rounded-[4px] text-[0.6rem] uppercase font-bold tracking-wider flex-shrink-0" style={{ backgroundColor: PRIO[d.priority] || PRIO.medium, color: d.priority === "medium" ? "#16161d" : "#fff" }}>{d.priority || "med"}</button>
                <span className={`flex-1 text-sm font-medium uppercase ${d.done ? "line-through text-[#7a7a85]" : "text-[#16161d]"}`}>{d.text}</span>
                {isSaving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16161d" strokeWidth="3" className="animate-spin"><path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round"/></svg>}
                <button onClick={() => remove(d._id)} className="w-[32px] h-[32px] bg-[#e74a3a] border-[3px] border-[#16161d] rounded-[4px] flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("slamList")
  const { useDocument, useLiveQuery, database } = useFireproof("slamList")
  return (
    <main id="app" className="min-h-screen bg-[#faf8ef] p-4 pb-20 font-[system-ui]" style={{ backgroundImage: "linear-gradient(#16161d0a 1px,transparent 1px),linear-gradient(90deg,#16161d0a 1px,transparent 1px)", backgroundSize: "60px 60px" }}>
      <div className="max-w-[920px] mx-auto space-y-4">
        <header id="app-header" className="bg-[#ffffff] border-[3px] border-[#16161d] rounded-[4px] shadow-[4px_4px_0px_#16161d] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-3 h-3 bg-[#e74a3a] border-2 border-[#16161d]"></span>
              <span className="w-3 h-3 bg-[#f2c64d] border-2 border-[#16161d]"></span>
              <span className="w-3 h-3 bg-[#4aa84a] border-2 border-[#16161d]"></span>
            </div>
            <h1 className="text-xl font-extrabold uppercase tracking-[-0.02em] text-[#16161d]">Slam List</h1>
          </div>
          <ViewerTag />
        </header>
        <Composer useDocument={useDocument} me={me} can={can} ready={ready} />
        <TodoFeed database={database} useLiveQuery={useLiveQuery} />
      </div>
    </main>
  )
}