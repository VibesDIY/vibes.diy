import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { callAI } from "call-ai"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("crew-scoreboard")
  const { docs: teams } = useLiveQuery("type", { key: "team" })
  const { docs: rules } = useLiveQuery("type", { key: "rule" })
  const { docs: history } = useLiveQuery("createdAt", { descending: true, limit: 50, key: undefined })
  const { docs: historyDocs } = useLiveQuery((d) => d.type === "history" ? d.createdAt : undefined, { descending: true, limit: 50 })
  const { doc: newTeam, merge: mergeNewTeam, submit: submitNewTeam } = useDocument({ type: "team", name: "", color: "#DA291C", score: 0, createdAt: Date.now() })
  const palette = ["#DA291C", "#fedd00", "#22c55e", "#3b82f6", "#1a1a2e", "#6b6b80"]

  const adjustScore = (team, delta) => database.put({ ...team, score: (team.score || 0) + delta })
  const deleteTeam = (team) => database.del(team._id)

  const c = {
    page: "min-h-screen bg-[#f5f0e0] text-[#1a1a2e] font-['Space_Grotesk',sans-serif] pb-24",
    header: "bg-[#1a1a2e] text-[#fedd00] border-b-[3px] border-[#1a1a2e] px-4 py-5 sticky top-0 z-20",
    title: "text-3xl font-bold uppercase tracking-tight",
    tagline: "text-xs uppercase tracking-[0.15em] text-[#fedd00]/80 mt-1",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded p-5 shadow-[4px_4px_0px_#1a1a2e]",
    sectionTitle: "text-xl font-bold uppercase tracking-tight mb-4 border-b-[3px] border-[#1a1a2e] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-[#DA291C] text-white uppercase tracking-[0.08em] text-sm font-bold border-[3px] border-[#1a1a2e] rounded shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnSecondary: "min-h-[44px] px-4 py-3 bg-[#fedd00] text-[#1a1a2e] uppercase tracking-[0.08em] text-sm font-bold border-[3px] border-[#1a1a2e] rounded shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "min-h-[44px] px-4 py-3 bg-white text-[#1a1a2e] uppercase tracking-[0.08em] text-sm font-bold border-[3px] border-[#1a1a2e] rounded active:translate-x-[2px] active:translate-y-[2px]",
    input: "w-full px-3 py-3 bg-white border-[3px] border-[#1a1a2e] rounded text-base focus:outline-none focus:shadow-[3px_3px_0px_#1a1a2e]",
    muted: "text-xs uppercase tracking-[0.15em] text-[#6b6b80]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Crew Scoreboard</h1>
        <p className={c.tagline}>Big numbers. Loud rules. Live sync.</p>
      </header>
      <main id="app" className={c.main}>
        <section id="scoreboard" className={c.section}>
          <h2 className={c.sectionTitle}>Scoreboard</h2>
          {teams.length === 0 && <p className={c.muted}>No teams yet. {can("write") ? "Add one below." : "Waiting for owner."}</p>}
          <div className="space-y-4">
            {teams.map((t) => (
              <div key={t._id} className="flex items-center gap-3 border-[3px] border-[#1a1a2e] rounded p-3 shadow-[3px_3px_0px_#1a1a2e]">
                <div className="w-10 h-10 border-[3px] border-[#1a1a2e] rounded shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold uppercase tracking-tight truncate">{t.name}</div>
                  <div className="text-5xl font-bold font-['JetBrains_Mono',monospace]">{t.score || 0}</div>
                </div>
                {can("write") && (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => adjustScore(t, 1)} className={c.btnSecondary}>+1</button>
                    <button onClick={() => adjustScore(t, -1)} className={c.btnGhost}>-1</button>
                    <button onClick={() => deleteTeam(t)} className="text-xs uppercase tracking-[0.15em] text-[#DA291C] underline">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {can("write") && (
            <form onSubmit={(e) => { e.preventDefault(); if (newTeam.name.trim()) submitNewTeam() }} className="mt-4 space-y-2">
              <input className={c.input} placeholder="New team name" value={newTeam.name} onChange={(e) => mergeNewTeam({ name: e.target.value })} />
              <div className="flex gap-2 flex-wrap">
                {palette.map((p) => (
                  <button type="button" key={p} onClick={() => mergeNewTeam({ color: p })} className="w-10 h-10 border-[3px] border-[#1a1a2e] rounded" style={{ backgroundColor: p, outline: newTeam.color === p ? "3px solid #1a1a2e" : "none", outlineOffset: "2px" }} />
                ))}
              </div>
              <button type="submit" className={c.btn}>Add Team</button>
            </form>
          )}
        </section>
        <RulesSection c={c} can={can} viewer={viewer} database={database} rules={rules} />
        <section id="history" className={c.section}>
          <h2 className={c.sectionTitle}>Rule History</h2>
          {historyDocs.length === 0 && <p className={c.muted}>No rule changes yet. Argue about them later.</p>}
          <ul className="space-y-2">
            {historyDocs.map((h) => (
              <li key={h._id} className="border-[3px] border-[#1a1a2e] rounded p-3 bg-white shadow-[3px_3px_0px_#1a1a2e]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.15em] bg-[#3b82f6] text-white px-2 py-0.5 border-[2px] border-[#1a1a2e] rounded">{h.category || h.action}</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#6b6b80] font-['JetBrains_Mono',monospace]">{new Date(h.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="font-bold text-sm">{h.summary}</div>
                <div className="text-xs text-[#6b6b80] uppercase tracking-[0.1em] mt-1">— {h.author}</div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

function RulesSection({ c, can, viewer, database, rules }) {
  const { useDocument } = useFireproof("crew-scoreboard")
  const { doc: newRule, merge: mergeNewRule, submit: submitNewRule, reset } = useDocument({ type: "rule", name: "", points: 1, createdAt: Date.now() })
  const [isLoading, setIsLoading] = React.useState(false)

  const logHistory = async (action, ruleName, points) => {
    setIsLoading(true)
    try {
      const prompt = `Summarize this scoreboard rule change in one short sentence (max 12 words), uppercase tone. Action: ${action}. Rule: "${ruleName}", points: ${points}. Author: ${viewer?.displayName || "someone"}.`
      const res = await callAI(prompt, { schema: { properties: { summary: { type: "string" }, category: { type: "string" } } } })
      const { summary, category } = JSON.parse(res)
      await database.put({ type: "history", action, ruleName, points, summary, category, author: viewer?.displayName || "anon", createdAt: Date.now() })
    } catch {
      await database.put({ type: "history", action, ruleName, points, summary: `${action} ${ruleName} (${points} pt)`, category: "rule", author: viewer?.displayName || "anon", createdAt: Date.now() })
    } finally {
      setIsLoading(false)
    }
  }

  const addRule = async (e) => {
    e.preventDefault()
    if (!newRule.name.trim()) return
    await submitNewRule()
    logHistory("added", newRule.name, newRule.points)
  }

  const deleteRule = async (r) => {
    await database.del(r._id)
    logHistory("removed", r.name, r.points)
  }

  return (
    <section id="rules" className={c.section}>
      <h2 className={c.sectionTitle}>Rules</h2>
      {rules.length === 0 && <p className={c.muted}>No rules yet.</p>}
      <ul className="space-y-2 mb-4">
        {rules.map((r, i) => (
          <li key={r._id} className={`flex items-center justify-between border-[3px] border-[#1a1a2e] rounded p-3 ${i % 2 === 0 ? "bg-[#fedd00]" : "bg-white"}`}>
            <span className="font-bold uppercase">{r.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-['JetBrains_Mono',monospace] font-bold">{r.points > 0 ? "+" : ""}{r.points} pt</span>
              {can("write") && <button onClick={() => deleteRule(r)} className="text-xs uppercase tracking-[0.15em] text-[#DA291C] underline">X</button>}
            </div>
          </li>
        ))}
      </ul>
      {can("write") && (
        <form onSubmit={addRule} className="space-y-2">
          <input className={c.input} placeholder="Rule name (e.g. Bonus round)" value={newRule.name} onChange={(e) => mergeNewRule({ name: e.target.value })} />
          <input className={c.input} placeholder="Point value" type="number" value={newRule.points} onChange={(e) => mergeNewRule({ points: Number(e.target.value) })} />
          <button type="submit" disabled={isLoading} className={c.btn}>
            {isLoading ? (
              <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
            ) : "Add Rule"}
          </button>
        </form>
      )}
    </section>
  )
}