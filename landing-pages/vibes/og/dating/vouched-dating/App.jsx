import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("vouched-pool")
  const [sponsorName, setSponsorName] = useState("Maya")
  const [isSuggesting, setIsSuggesting] = useState(false)

  const { doc, merge, submit } = useDocument({
    type: "candidate",
    name: "",
    relation: "",
    statement: "",
    sponsor: sponsorName,
    interested: 0,
    createdAt: Date.now(),
  })

  const { docs: candidates } = useLiveQuery("type", { key: "candidate", descending: true })

  function sponsorVouchCount(name) {
    return candidates.filter((d) => d.sponsor === name).length
  }

  function handleNominate(e) {
    e.preventDefault()
    if (!doc.name.trim() || !doc.statement.trim()) return
    submit()
  }

  function handleInterest(candidate) {
    database.put({ ...candidate, interested: (candidate.interested || 0) + 1 })
  }

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const r = await callAI(
        "Generate a single warm, specific vouching statement (2 sentences) for a dating-app nomination. Return as JSON.",
        { schema: { properties: { statement: { type: "string" }, relation: { type: "string" } } } }
      )
      const parsed = JSON.parse(r)
      merge({ statement: parsed.statement || "", relation: parsed.relation || doc.relation })
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen pb-24 bg-[#080D18] text-[#E8DFCC]",
    header: "sticky top-0 z-20 px-4 py-3 border-b border-[#C9A84C] bg-[#080D18] flex items-center justify-between",
    brandRow: "flex items-center gap-3",
    brandSquares: "flex gap-1",
    sq: "w-2 h-2 rounded-full",
    title: "text-lg font-bold tracking-widest uppercase text-[#C9A84C]",
    nav: "flex gap-2",
    navLink: "px-3 py-1 border border-[#C9A84C] text-[#C9A84C] text-xs uppercase tracking-wider font-bold hover:bg-[#C9A84C] hover:text-[#080D18] transition-colors",
    main: "max-w-3xl mx-auto px-4 py-5 space-y-5",
    hero: "relative border border-[#C9A84C] bg-[#0D1526] p-6",
    heroBar: "absolute top-0 left-0 right-0 h-[3px] bg-[#C9A84C]",
    heroTitle: "text-3xl md:text-5xl font-bold uppercase tracking-tight mt-4 text-[#E8DFCC]",
    heroSub: "text-sm mt-3 max-w-md text-[#8B7B68]",
    section: "border border-[#1E2A45] bg-[#0D1526] p-5",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-3 text-[#C9A84C]",
    sectionTitle: "text-xl font-bold uppercase tracking-tight mb-1 text-[#E8DFCC]",
    statGrid: "grid grid-cols-2 md:grid-cols-4 gap-3",
    stat: "border border-[#1E2A45] bg-[#080D18]",
    statHead: "px-3 py-2 border-b border-[#1E2A45] text-[0.6rem] uppercase tracking-[0.12em] font-bold text-[#080D18]",
    statBody: "px-3 py-3",
    statNum: "text-2xl font-bold font-mono text-[#E8DFCC]",
    statUnit: "text-[0.6rem] uppercase tracking-[0.12em] mt-1 text-[#5A6A8A]",
    formRow: "space-y-3",
    label: "block text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-1 text-[#C9A84C]",
    input: "w-full border border-[#1E2A45] bg-[#080D18] text-[#E8DFCC] px-3 py-3 text-sm focus:outline-none focus:border-[#C9A84C]",
    textarea: "w-full border border-[#1E2A45] bg-[#080D18] text-[#E8DFCC] px-3 py-3 text-sm min-h-[110px] focus:outline-none focus:border-[#C9A84C]",
    btnRow: "flex flex-wrap gap-3 items-center",
    btnPrimary: "px-5 py-3 border border-[#C9A84C] bg-[#C9A84C] text-[#080D18] uppercase text-xs tracking-wider font-bold min-h-[44px] hover:bg-[#E8DFCC] transition-colors",
    btnSecondary: "px-4 py-3 border border-[#C9A84C] text-[#C9A84C] uppercase text-xs tracking-wider font-bold min-h-[44px] hover:bg-[#C9A84C] hover:text-[#080D18] transition-colors",
    btnGhost: "px-3 py-2 border border-[#1E2A45] text-[#8B7B68] uppercase text-[0.65rem] tracking-wider font-bold hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors",
    list: "space-y-3",
    card: "border border-[#1E2A45] bg-[#0D1526] p-4",
    cardHead: "flex items-start justify-between gap-3 mb-2",
    cardName: "text-lg font-bold uppercase tracking-tight text-[#E8DFCC]",
    cardChain: "text-xs mt-1 text-[#5A6A8A]",
    cardChainStrong: "font-bold text-[#C9A84C]",
    cardBio: "text-sm mt-3 leading-relaxed text-[#B8AD9E]",
    cardFoot: "flex items-center justify-between mt-4 pt-3 border-t border-[#1E2A45]",
    badge: "inline-block px-2 py-1 text-[0.6rem] uppercase tracking-[0.1em] font-bold border border-[#C9A84C] text-[#C9A84C]",
    bottomBar: "fixed bottom-0 left-0 right-0 px-4 py-3 border-t border-[#C9A84C] bg-[#080D18] flex justify-between items-center z-20",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brandRow}>
          <div className={c.brandSquares}>
            <span className={`${c.sq} bg-[#C9A84C]`}></span>
            <span className={`${c.sq} bg-[#8B7355]`}></span>
            <span className={`${c.sq} bg-[#C9A84C]`}></span>
          </div>
          <span className={c.title}>Vouched</span>
        </div>
        <nav className={c.nav}>
          <a className={c.navLink} href="#pool">Pool</a>
          <a className={c.navLink} href="#nominate">Nominate</a>
        </nav>
      </header>

      <main id="app" className={c.main}>
        <section id="hero" className={c.hero}>
          <div className={c.heroBar}></div>
          <h1 className={c.heroTitle}>No signups. Only invites.</h1>
          <p className={c.heroSub}>You can't join. Someone has to stake their name on you. Every match shows the chain.</p>
        </section>

        <section id="reputation">
          <div className={c.sectionLabel}>Your standing</div>
          <div className={c.statGrid}>
            <div className={c.stat}>
              <div className={`${c.statHead} bg-[#C9A84C]`}>Stake</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{100 - sponsorVouchCount(sponsorName) * 3}</div>
                <div className={c.statUnit}>points</div>
              </div>
            </div>
            <div className={c.stat}>
              <div className={`${c.statHead} bg-[#8B7355] text-[#E8DFCC]`}>Vouched</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{sponsorVouchCount(sponsorName)}</div>
                <div className={c.statUnit}>members</div>
              </div>
            </div>
            <div className={c.stat}>
              <div className={`${c.statHead} bg-[#C9A84C]`}>Active</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{sponsorVouchCount(sponsorName)}</div>
                <div className={c.statUnit}>still in</div>
              </div>
            </div>
            <div className={c.stat}>
              <div className={`${c.statHead} bg-[#8B7355] text-[#E8DFCC]`}>Drift</div>
              <div className={c.statBody}>
                <div className={c.statNum}>{candidates.reduce((s, d) => s + (d.interested || 0), 0)}</div>
                <div className={c.statUnit}>signals</div>
              </div>
            </div>
          </div>
        </section>

        <section id="nominate" className={c.section}>
          <h2 className={c.sectionTitle}>Nominate someone</h2>
          <p className="text-xs mb-4 text-[#8B7B68]">Your reputation rides on theirs. Choose carefully.</p>
          <form onSubmit={handleNominate} className={c.formRow}>
            <div>
              <label className={c.label}>You are</label>
              <input className={c.input} placeholder="Your name" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} />
            </div>
            <div>
              <label className={c.label}>Their name</label>
              <input className={c.input} placeholder="First name" value={doc.name} onChange={(e) => merge({ name: e.target.value })} />
            </div>
            <div>
              <label className={c.label}>How you know them</label>
              <input className={c.input} placeholder="Coworker, friend, ex-roommate..." value={doc.relation} onChange={(e) => merge({ relation: e.target.value })} />
            </div>
            <div>
              <label className={c.label}>Why you vouch</label>
              <textarea className={c.textarea} placeholder="Tell the pool why you're staking on this person." value={doc.statement} onChange={(e) => merge({ statement: e.target.value })} />
            </div>
            <div className={c.btnRow}>
              <button type="submit" className={c.btnPrimary}>Stake & submit</button>
              <button type="button" onClick={handleSuggest} disabled={isSuggesting} className={c.btnSecondary}>
                {isSuggesting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="3"><path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round"/></svg>
                    Thinking...
                  </span>
                ) : "Suggest words"}
              </button>
            </div>
          </form>
        </section>

        <section id="pool">
          <div className={c.sectionLabel}>The pool</div>
          <h2 className={c.sectionTitle}>Introduced this week</h2>
          <ul className={c.list}>
            {candidates.length === 0 && (
              <li className={c.card}>
                <p className={c.cardBio}>No nominations yet. Be the first to stake.</p>
              </li>
            )}
            {candidates.map((cand) => {
              const count = sponsorVouchCount(cand.sponsor)
              return (
                <li key={cand._id} className={c.card}>
                  <div className={c.cardHead}>
                    <div>
                      <div className={c.cardName}>{cand.name}</div>
                      <div className={c.cardChain}>
                        introduced by <span className={c.cardChainStrong}>{cand.sponsor}</span>, who has vouched for {count} other{count === 1 ? "" : "s"}, all still active.
                      </div>
                      {cand.relation && <div className="text-[0.65rem] uppercase tracking-[0.12em] mt-2 text-[#5A6A8A]">{cand.relation}</div>}
                    </div>
                    <span className={c.badge}>Active</span>
                  </div>
                  <p className={c.cardBio}>{cand.statement}</p>
                  <div className={c.cardFoot}>
                    <span className="font-mono text-xs text-[#5A6A8A]">{cand.interested || 0} interested</span>
                    <button onClick={() => handleInterest(cand)} className={c.btnGhost}>Express interest</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      <div className={c.bottomBar}>
        <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[#C9A84C]">Trust-graph pool</span>
        <a href="#nominate" className={c.btnPrimary}>+ Nominate</a>
      </div>
    </div>
  )
}
