import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("slotted-dates")
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  const initialSlot = {
    type: "slot",
    activity: "",
    neighborhood: "",
    day: "Tonight",
    time: "",
    signal: "",
    status: "open",
    createdAt: 0,
  }
  const { doc, merge, submit } = useDocument(initialSlot)

  const { docs: openSlots } = useLiveQuery("status", { key: "open", descending: true })
  const { docs: myClaimed } = useLiveQuery("status", { key: "claimed", descending: true })

  function handlePostSlot(e) {
    e.preventDefault()
    if (!doc.activity.trim()) return
    merge({ createdAt: Date.now() })
    submit()
  }

  function handleClaim(slot) {
    database.put({ ...slot, status: "claimed", claimedAt: Date.now() })
  }

  function handleVote(slot, vote) {
    database.put({ ...slot, status: "voted", vote, votedAt: Date.now() })
  }

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI(
        "Invent one specific, concrete first-date slot. Pick a fun activity, a real-feeling neighborhood, a day (Tonight/Tomorrow/This week), a time like '9:00 PM', and a quirky way they'll be spotted (a clothing item or object). Keep each field short.",
        { schema: { properties: {
          activity: { type: "string" },
          neighborhood: { type: "string" },
          day: { type: "string" },
          time: { type: "string" },
          signal: { type: "string" },
        }}}
      )
      const parsed = JSON.parse(res)
      merge(parsed)
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen pb-24 bg-[#14141E] text-[#F0EDFF]",
    header: "sticky top-0 z-20 px-4 py-4 border-b border-[#2A2A3E] bg-[#14141E]",
    headerInner: "max-w-[920px] mx-auto flex items-center justify-between",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-2 h-2 rounded-full",
    brand: "text-lg tracking-tight font-bold uppercase text-[#F0EDFF]",
    nav: "flex gap-2",
    navLink: "px-3 py-2 border border-[#2A2A3E] bg-[#1E1E2E] text-[#F0EDFF] text-xs uppercase tracking-wider font-bold hover:border-[#FF5B5B] hover:text-[#FF5B5B] transition-colors",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    hero: "relative bg-[#1E1E2E] p-6 overflow-hidden border-l-4 border-[#FF5B5B]",
    heroTitle: "text-4xl md:text-5xl uppercase font-bold tracking-tight leading-none mb-3",
    heroSub: "text-sm uppercase tracking-widest font-medium text-[#8888AA]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-3 text-[#FF5B5B]",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-4",
    stat: "bg-[#1E1E2E] overflow-hidden border-b-2",
    statHead: "px-3 py-2 text-[0.6rem] uppercase tracking-widest font-bold text-[#14141E]",
    statBody: "px-3 py-4",
    statNum: "text-3xl font-bold font-mono text-[#F0EDFF]",
    statUnit: "text-[0.6rem] uppercase tracking-widest mt-1 text-[#8888AA]",
    card: "bg-[#1E1E2E] p-5 border border-[#2A2A3E]",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-4",
    field: "block",
    label: "block text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-2 text-[#8888AA]",
    input: "w-full px-3 py-3 border border-[#2A2A3E] bg-[#14141E] text-[#F0EDFF] text-sm font-medium min-h-[44px] focus:outline-none focus:border-[#FF5B5B]",
    select: "w-full px-3 py-3 border border-[#2A2A3E] bg-[#14141E] text-[#F0EDFF] text-sm font-medium min-h-[44px]",
    suggestBtn: "px-3 py-2 border border-[#F7C948] text-[#F7C948] text-[0.65rem] uppercase tracking-widest font-bold hover:bg-[#F7C948] hover:text-[#14141E] transition-colors",
    btnPrimary: "px-5 py-3 bg-[#FF5B5B] text-[#F0EDFF] text-sm uppercase tracking-wider font-bold min-h-[44px] hover:bg-[#FF7A7A] transition-colors",
    btnSecondary: "px-5 py-3 border border-[#F7C948] text-[#F7C948] text-sm uppercase tracking-wider font-bold min-h-[44px] hover:bg-[#F7C948] hover:text-[#14141E] transition-colors",
    btnGhost: "px-5 py-3 border border-[#2A2A3E] text-[#8888AA] text-sm uppercase tracking-wider font-bold min-h-[44px] hover:border-[#FF5B5B] hover:text-[#FF5B5B] transition-colors",
    slotList: "space-y-3",
    slot: "bg-[#1E1E2E] p-4 flex items-start justify-between gap-3 border-l-2 border-[#FF5B5B]",
    slotMain: "flex-1 min-w-0",
    slotTitle: "text-base font-bold uppercase tracking-tight mb-1 text-[#F0EDFF]",
    slotMeta: "text-xs font-mono text-[#8888AA]",
    slotSignal: "text-xs mt-2 italic text-[#F7C948]",
    badge: "inline-block mt-2 px-2 py-1 text-[0.6rem] uppercase tracking-widest font-bold border border-[#3DCC7E] text-[#3DCC7E]",
    claimBtn: "px-4 py-2 border border-[#F7C948] text-[#F7C948] text-xs uppercase tracking-wider font-bold whitespace-nowrap hover:bg-[#F7C948] hover:text-[#14141E] transition-colors",
    voteRow: "flex gap-2 mt-3",
    voteBtn: "flex-1 px-3 py-2 border border-[#2A2A3E] text-[#8888AA] text-xs uppercase tracking-wider font-bold hover:border-[#FF5B5B] hover:text-[#FF5B5B] transition-colors",
    empty: "text-center py-8 text-sm uppercase tracking-widest text-[#8888AA]",
    bottomBar: "fixed bottom-0 left-0 right-0 border-t border-[#2A2A3E] bg-[#14141E] px-4 py-3 z-20",
    bottomInner: "max-w-[920px] mx-auto flex gap-2",
    fab: "flex-1 px-4 py-3 text-sm uppercase tracking-wider font-bold min-h-[48px] text-center",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div className={c.logo}>
            <div className={c.logoDots}>
              <span className={`${c.dot} bg-[#FF5B5B]`}></span>
              <span className={`${c.dot} bg-[#F7C948]`}></span>
              <span className={`${c.dot} bg-[#3DCC7E]`}></span>
            </div>
            <span className={c.brand}>Slotted</span>
          </div>
          <nav className={c.nav}>
            <a className={c.navLink} href="#board">Board</a>
            <a className={c.navLink} href="#mine">Mine</a>
          </nav>
        </div>
      </header>

      <main id="app">
        <div className={c.main}>
          <section id="hero" className={c.hero}>
            <h1 className={c.heroTitle}>Claim the plan,<br/>not the person</h1>
            <p className={c.heroSub}>Post a date · Someone claims it · Decide after</p>
          </section>

          <section id="stats">
            <div className={c.sectionLabel}>This week</div>
            <div className={c.statRow}>
              <div className={`${c.stat} border-[#FF5B5B]`}>
                <div className={`${c.statHead} bg-[#FF5B5B]`}>Open</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{openSlots.length}</div>
                  <div className={c.statUnit}>slots live</div>
                </div>
              </div>
              <div className={`${c.stat} border-[#F7C948]`}>
                <div className={`${c.statHead} bg-[#F7C948]`}>Claimed</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{myClaimed.length}</div>
                  <div className={c.statUnit}>locked in</div>
                </div>
              </div>
              <div className={`${c.stat} border-[#5B8AF5]`}>
                <div className={`${c.statHead} bg-[#5B8AF5] text-[#F0EDFF]`}>Tonight</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{openSlots.filter(s => s.day === "Tonight").length}</div>
                  <div className={c.statUnit}>happening</div>
                </div>
              </div>
              <div className={`${c.stat} border-[#3DCC7E]`}>
                <div className={`${c.statHead} bg-[#3DCC7E]`}>Matches</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{myClaimed.filter(s => s.vote === "yes").length}</div>
                  <div className={c.statUnit}>round two</div>
                </div>
              </div>
            </div>
          </section>

          <section id="post" className={c.card}>
            <div className={c.sectionLabel}>Post a slot</div>
            <form onSubmit={handlePostSlot} className="space-y-4">
              <div className={c.formGrid}>
                <label className={c.field}>
                  <span className={c.label}>Activity</span>
                  <input className={c.input} value={doc.activity} onChange={(e) => merge({ activity: e.target.value })} placeholder="Ramen, gallery walk, arcade..." />
                </label>
                <label className={c.field}>
                  <span className={c.label}>Neighborhood</span>
                  <input className={c.input} value={doc.neighborhood} onChange={(e) => merge({ neighborhood: e.target.value })} placeholder="Mission, Lower East Side..." />
                </label>
                <label className={c.field}>
                  <span className={c.label}>Day</span>
                  <select className={c.select} value={doc.day} onChange={(e) => merge({ day: e.target.value })}>
                    <option>Tonight</option>
                    <option>Tomorrow</option>
                    <option>This week</option>
                  </select>
                </label>
                <label className={c.field}>
                  <span className={c.label}>Time</span>
                  <input className={c.input} value={doc.time} onChange={(e) => merge({ time: e.target.value })} placeholder="9:00 PM" />
                </label>
              </div>
              <label className={c.field}>
                <span className={c.label}>How they'll spot you</span>
                <input className={c.input} value={doc.signal} onChange={(e) => merge({ signal: e.target.value })} placeholder="Wearing red, carrying a paperback..." />
              </label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={handleSuggest} disabled={isSuggesting} className={c.suggestBtn}>
                  {isSuggesting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
                        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                      </svg>
                      Cooking...
                    </span>
                  ) : "Suggest a fun one"}
                </button>
                <button type="submit" className={c.btnPrimary}>Post slot</button>
              </div>
            </form>
          </section>

          <section id="board">
            <div className={c.sectionLabel}>Open this week</div>
            {openSlots.length === 0 ? (
              <div className={c.empty}>No open slots — post one</div>
            ) : (
              <ul className={c.slotList}>
                {openSlots.map((s) => (
                  <li key={s._id} className={c.slot}>
                    <div className={c.slotMain}>
                      <div className={c.slotTitle}>{s.activity} — {s.neighborhood}</div>
                      <div className={c.slotMeta}>{(s.day || "").toUpperCase()} {s.time}</div>
                      {s.signal && <div className={c.slotSignal}>{s.signal}</div>}
                      <div><span className={c.badge}>Open</span></div>
                    </div>
                    <button onClick={() => handleClaim(s)} className={c.claimBtn}>Claim</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="mine">
            <div className={c.sectionLabel}>My dates</div>
            {myClaimed.length === 0 ? (
              <div className={c.empty}>No claimed dates yet</div>
            ) : (
              <ul className={c.slotList}>
                {myClaimed.map((s) => (
                  <li key={s._id} className={c.slot}>
                    <div className={c.slotMain}>
                      <div className={c.slotTitle}>{s.activity} — {s.neighborhood}</div>
                      <div className={c.slotMeta}>{(s.day || "").toUpperCase()} {s.time}</div>
                      <div><span className={`${c.badge} border-[#F7C948] text-[#F7C948]`}>Claimed</span></div>
                      <div className={c.voteRow}>
                        <button onClick={() => handleVote(s, "yes")} className={c.voteBtn}>Round two — yes</button>
                        <button onClick={() => handleVote(s, "no")} className={c.voteBtn}>Pass</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <div className={c.bottomBar}>
        <div className={c.bottomInner}>
          <a href="#post" className={`${c.fab} bg-[#FF5B5B] text-[#F0EDFF]`}>Post slot</a>
          <a href="#board" className={`${c.fab} border border-[#F7C948] text-[#F7C948]`}>Browse</a>
        </div>
      </div>
    </div>
  )
}
