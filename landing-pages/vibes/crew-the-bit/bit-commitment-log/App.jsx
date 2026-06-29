import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("bit-vault")
  const { doc: newBit, merge: mergeBit, submit: submitBit } = useDocument({
    type: "bit", name: "", origin: "", retired: false, createdAt: Date.now(), deployments: 0, lastRating: 0,
  })
  const { docs: bits } = useLiveQuery("type", { key: "bit", descending: true })
  const [suggesting, setSuggesting] = React.useState(false)

  const suggestBit = async () => {
    setSuggesting(true)
    try {
      const res = await callAI("Invent a silly friend-group inside joke with a name and a 1-sentence origin story.", {
        schema: { properties: { name: { type: "string" }, origin: { type: "string" } } }
      })
      const { name, origin } = JSON.parse(res)
      mergeBit({ name, origin })
    } finally { setSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1a4a] to-[#1a0f33] text-white font-['Nunito',sans-serif] pb-24",
    header: "sticky top-0 z-10 bg-[#1a0f33]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between",
    title: "text-2xl font-bold tracking-tight",
    tag: "text-xs text-[#f5d97a] uppercase tracking-widest",
    main: "px-4 py-4 space-y-5 max-w-2xl mx-auto",
    section: "bg-[#3d2470]/40 border border-white/10 rounded-2xl p-4 shadow-lg",
    h2: "text-lg font-bold mb-3 flex items-center gap-2",
    btn: "min-h-[44px] px-4 py-3 bg-[#6b3fb8] hover:bg-[#7d4fcf] active:bg-[#5a3399] rounded-xl font-bold transition",
    btnGold: "min-h-[44px] px-4 py-3 bg-[#f5d97a] text-[#2a1a4a] hover:bg-[#fce28a] rounded-xl font-bold transition",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#1a0f33]/60 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#f5d97a]",
    row: "bg-[#1a0f33]/40 border border-white/10 rounded-xl p-3",
    muted: "text-sm text-white/60",
    gold: "text-[#f5d97a]",
    green: "text-[#7dd9a8]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.tag}>Inside Jokes, Catalogued</div>
          <h1 className={c.title}>Bit Vault</h1>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="add-bit" className={c.section}>
          <h2 className={c.h2}><span className={c.gold}>✦</span> Log a New Bit</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only view — contact the owner for write access.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (newBit.name.trim()) submitBit() }} className="space-y-3">
              <input className={c.input} placeholder="Bit name (e.g. The Pigeon Voice)" value={newBit.name} onChange={(e) => mergeBit({ name: e.target.value })} />
              <textarea className={c.input} rows="3" placeholder="Origin story — when did this start? Who said it first?" value={newBit.origin} onChange={(e) => mergeBit({ origin: e.target.value })} />
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className={c.btn}>Add Bit</button>
                <button type="button" onClick={suggestBit} disabled={suggesting} className="min-h-[44px] px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50">
                  {suggesting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg>}
                  Suggest an idea
                </button>
              </div>
            </form>
          )}
        </section>
        <section id="active-bits" className={c.section}>
          <h2 className={c.h2}><span className={c.green}>●</span> Active Bits</h2>
          {bits.filter(b => !b.retired).length === 0 ? (
            <p className={c.muted}>No bits yet — log your first one above.</p>
          ) : (
            <ul className="space-y-2">
              {bits.filter(b => !b.retired).map(b => (
                <li key={b._id} className={c.row}>
                  <div className="font-bold">{b.name}</div>
                  <div className={c.muted}>{b.origin}</div>
                  {b.critique && <div className="text-xs text-[#f5d97a] mt-1 italic">"{b.critique}" — {b.humorStyle} (peak: {b.peakScore}/10)</div>}
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <span className={c.muted}>{b.deployments} deployments{b.lastRating ? ` · last ${"★".repeat(b.lastRating)}` : ""}</span>
                    {can("write") && (
                      <div className="flex gap-1">
                        <button onClick={async () => {
                          const r = prompt("Rate this deployment 1-5:")
                          const rating = parseInt(r)
                          if (!rating || rating < 1 || rating > 5) return
                          const updated = { ...b, deployments: (b.deployments || 0) + 1, lastRating: rating }
                          await database.put(updated)
                          try {
                            const res = await callAI(`Bit: "${b.name}". Origin: ${b.origin}. It has now been deployed ${updated.deployments} times, latest rating ${rating}/5. As a comedy critic, give a humor-style tag, a witty one-liner, and a peak-eligibility score 1-10.`, {
                              schema: { properties: { humorStyle: { type: "string" }, critique: { type: "string" }, peakScore: { type: "number" } } }
                            })
                            const ai = JSON.parse(res)
                            await database.put({ ...updated, ...ai })
                          } catch {}
                        }} className="px-2 py-1 bg-white/10 rounded text-sm">Log +★</button>
                        <button onClick={() => database.put({ ...b, retired: true, retiredAt: Date.now() })} className="px-2 py-1 bg-[#f5d97a]/20 text-[#f5d97a] rounded text-sm">Retire</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="hall-of-fame" className={c.section}>
          <h2 className={c.h2}><span className={c.gold}>🏆</span> Hall of Fame</h2>
          {bits.filter(b => b.retired).length === 0 ? (
            <p className={c.muted}>No retired legends yet. Retire a bit when it's peaked.</p>
          ) : (
            <ul className="space-y-2">
              {bits.filter(b => b.retired).map(b => (
                <li key={b._id} className={c.row}>
                  <div className="font-bold text-[#f5d97a]">{b.name}</div>
                  <div className={c.muted}>{b.origin}</div>
                  <div className="text-xs mt-1 text-white/50">Retired with {b.deployments || 0} deployments {b.peakScore ? `· peak ${b.peakScore}/10` : ""}</div>
                  {can("write") && (
                    <button onClick={() => database.put({ ...b, retired: false })} className="mt-2 text-xs text-white/60 underline">Un-retire</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}