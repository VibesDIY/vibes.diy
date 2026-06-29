import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CONCEPTS = [
  "Prospect Theory","Loss Aversion","Present Bias","Hyperbolic Discounting",
  "Bounded Rationality","Framing Effects","Reference-Dependent Preferences",
  "Heuristics & Biases","Social Preferences","Endowment Effect","Intertemporal Choice"
]

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("beh-econ-journal")
  const { doc, merge, submit } = useDocument({
    type: "entry", story: "", concept: "", defense: "",
    createdAt: Date.now(), feedback: null, authorSlug: "", authorName: "",
  })
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!doc.story.trim() || !doc.concept || !doc.defense.trim()) return
    setIsLoading(true)
    try {
      const res = await callAI(
        `A behavioral econ student logged this story: "${doc.story}". They chose the concept "${doc.concept}" and defended it: "${doc.defense}". As a Socratic tutor, respond with: (1) what ${doc.concept} actually predicts, (2) a probing clarifying question that challenges whether their pick is the best fit or just the most famous one, (3) an alternative concept they should consider with rationale.`,
        { schema: { properties: {
          explanation: { type: "string" },
          clarifyingQuestion: { type: "string" },
          alternativeConcept: { type: "string" },
          alternativeRationale: { type: "string" },
        } } }
      )
      const feedback = JSON.parse(res)
      await database.put({
        ...doc, feedback,
        authorSlug: viewer?.userSlug || "anon",
        authorName: viewer?.displayName || viewer?.userSlug || "Anonymous",
        avatarUrl: viewer?.avatarUrl || "",
      })
      merge({ story: "", concept: "", defense: "", feedback: null })
    } finally { setIsLoading(false) }
  }

  async function suggestExample() {
    setIsSuggesting(true)
    try {
      const res = await callAI(
        "Generate a short, casual real-world behavioral economics story (2-3 sentences) a college student might observe, plus the most fitting concept from this list: " + CONCEPTS.join(", ") + ", plus a one-paragraph defense.",
        { schema: { properties: { story: { type: "string" }, concept: { type: "string" }, defense: { type: "string" } } } }
      )
      const s = JSON.parse(res)
      merge({ story: s.story, concept: s.concept, defense: s.defense })
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1f4a] to-[#1a1230] text-white font-['Nunito',sans-serif] pb-24",
    header: "sticky top-0 z-10 bg-[#1a1230]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3",
    title: "font-['Fredoka',sans-serif] text-xl font-bold text-[#f5d76e]",
    tagline: "text-xs text-white/60 ml-auto",
    main: "max-w-2xl mx-auto px-4 py-4 space-y-4",
    section: "bg-[#3a2870]/40 border border-white/10 rounded-2xl p-4 shadow-lg",
    h2: "font-['Fredoka',sans-serif] text-lg font-semibold text-[#a8e6cf] mb-3",
    input: "w-full bg-[#1a1230]/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#f5d76e]",
    textarea: "w-full bg-[#1a1230]/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 min-h-[80px] focus:outline-none focus:border-[#f5d76e]",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#6b4ec7] hover:bg-[#7d5dd6] active:bg-[#5a3fb0] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2",
    btnGold: "min-h-[44px] px-4 py-3 rounded-xl bg-[#f5d76e] hover:bg-[#f7e08a] text-[#2a1f4a] font-bold transition disabled:opacity-50",
    chip: "px-2 py-1 rounded-full text-xs font-semibold",
    row: "bg-[#1a1230]/40 border border-white/5 rounded-xl p-3",
    label: "block text-sm font-semibold text-white/80 mb-1",
    hint: "text-xs text-white/50",
  }

  const { docs: allEntries } = useLiveQuery("type", { key: "entry" })
  const conceptCounts = {}
  allEntries.forEach(d => { if (d.concept) conceptCounts[d.concept] = (conceptCounts[d.concept]||0)+1 })
  const maxCount = Math.max(1, ...Object.values(conceptCounts))

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <span className="text-2xl">🧠</span>
        <h1 className={c.title}>BehavioralEcon Journal</h1>
        <span className={c.tagline}>build intuition, not flashcards</span>
      </header>
      <main id="app" className={c.main}>
        <section id="new-entry" className={c.section}>
          <h2 className={c.h2}>Log a behavior</h2>
          {!can("write") ? (
            <p className="text-white/60 text-sm">Read-only view — contact the owner for write access.</p>
          ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className={c.label}>What happened?</label>
              <textarea className={c.textarea} value={doc.story} onChange={e=>merge({story:e.target.value})} placeholder="My roommate refused to sell her hoodie for $40 but wouldn't pay $40 to replace it..." />
            </div>
            <div>
              <label className={c.label}>Which concept explains it?</label>
              <select className={c.input} value={doc.concept} onChange={e=>merge({concept:e.target.value})}>
                <option value="">Pick a concept...</option>
                {CONCEPTS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className={c.label}>Why does it fit? <span className={c.hint}>(one paragraph)</span></label>
              <textarea className={c.textarea} value={doc.defense} onChange={e=>merge({defense:e.target.value})} placeholder="Because she values what she owns more than identical items she doesn't..." />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="submit" className={c.btnGold} disabled={isLoading}>
                {isLoading && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>}
                {isLoading ? "Asking tutor..." : "Save & ask the tutor"}
              </button>
              <button type="button" className={c.btn} onClick={suggestExample} disabled={isSuggesting}>
                {isSuggesting && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>}
                Suggest example
              </button>
            </div>
          </form>
          )}
        </section>
        <section id="dashboard" className={c.section}>
          <h2 className={c.h2}>Your concept pattern</h2>
          <p className={c.hint + " mb-2"}>Which concepts you reach for — and which you haven't tried yet.</p>
          <div className="flex flex-wrap gap-2">
            {CONCEPTS.map(k => {
              const n = conceptCounts[k] || 0
              const tone = n === 0 ? "bg-white/5 text-white/40 border border-dashed border-white/20"
                        : n === maxCount && n > 1 ? "bg-[#f5d76e] text-[#2a1f4a]"
                        : "bg-[#6b4ec7]/60 text-white"
              return <span key={k} className={"px-2 py-1 rounded-full text-xs font-semibold " + tone}>{k} · {n}</span>
            })}
          </div>
        </section>
        <section id="journal" className={c.section}>
          <h2 className={c.h2}>Your journal</h2>
          <div className="space-y-3">
            {allEntries.length === 0 && (
              <p className={c.hint}>No entries yet. Log your first behavior above.</p>
            )}
            {allEntries.slice().sort((a,b)=>b.createdAt-a.createdAt).map(d => (
              <div key={d._id} className={c.row}>
                <div className="flex items-center gap-2 mb-2">
                  {d.avatarUrl && <img src={d.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-xs text-white/60">{d.authorName || "Anon"}</span>
                  <span className={c.chip + " bg-[#6b4ec7] text-white ml-auto"}>{d.concept}</span>
                </div>
                <p className="text-white mb-2">"{d.story}"</p>
                <p className="text-xs text-white/70 italic mb-2">Defense: {d.defense}</p>
                {d.feedback && (
                  <div className="bg-[#1a1230]/60 rounded-lg p-3 mt-2 border-l-2 border-[#a8e6cf] space-y-2">
                    <p className="text-sm text-[#a8e6cf] font-semibold">Tutor:</p>
                    <p className="text-sm text-white/90">{d.feedback.explanation}</p>
                    <p className="text-sm text-[#f5d76e]">❓ {d.feedback.clarifyingQuestion}</p>
                    {d.feedback.alternativeConcept && (
                      <p className="text-xs text-white/70">Also consider <strong>{d.feedback.alternativeConcept}</strong>: {d.feedback.alternativeRationale}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}