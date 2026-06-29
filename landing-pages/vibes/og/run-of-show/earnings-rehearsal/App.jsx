import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("ir-rehearsal-cards")
  const [sortDesc, setSortDesc] = React.useState(true)
  const [filterTag, setFilterTag] = React.useState("")
  const [session, setSession] = React.useState(null)
  const [revealed, setRevealed] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  const { doc, merge, submit } = useDocument({
    type: "card",
    question: "",
    answer: "",
    bullet1: "",
    bullet2: "",
    bullet3: "",
    tag: "",
    difficulty: 3,
    createdAt: Date.now(),
  })

  const { docs: cards } = useLiveQuery("type", { key: "card" })

  const sortedCards = [...cards].sort((a, b) =>
    sortDesc ? (b.difficulty || 0) - (a.difficulty || 0) : (a.difficulty || 0) - (b.difficulty || 0)
  )
  const visibleCards = filterTag
    ? sortedCards.filter((c) => (c.tag || "").toLowerCase() === filterTag.toLowerCase())
    : sortedCards

  const currentCard = session ? session.deck[session.index] : null
  const allTags = [...new Set(cards.map((c) => c.tag).filter(Boolean))]

  function handleSubmit(e) { e.preventDefault(); submit() }
  function handleStartRehearsal() {
    if (visibleCards.length === 0) return
    const deck = [...visibleCards].sort(() => Math.random() - 0.5)
    setSession({ deck, index: 0, outcomes: {}, startedAt: Date.now() })
    setRevealed(false)
  }
  function handleReveal() { setRevealed(true) }
  function handleOutcome(outcome) {
    if (!session || !currentCard) return
    const outcomes = { ...session.outcomes, [currentCard._id]: outcome }
    const nextIndex = session.index + 1
    if (nextIndex >= session.deck.length) {
      database.put({
        type: "session",
        outcomes,
        cardCount: session.deck.length,
        startedAt: session.startedAt,
        endedAt: Date.now(),
      })
      setSession({ ...session, outcomes, finished: true })
    } else {
      setSession({ ...session, outcomes, index: nextIndex })
      setRevealed(false)
    }
  }
  function handleExport() {
    const text = sortedCards.map((c, i) =>
      `Q${i + 1}. ${c.question}\n[${c.tag || "—"} · diff ${c.difficulty}]\nA: ${c.answer}\n• ${c.bullet1}\n• ${c.bullet2}\n• ${c.bullet3}\n`
    ).join("\n")
    navigator.clipboard?.writeText(text)
  }
  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI("Generate one realistic earnings call Q&A card for an IR team. Include a tough analyst question, a tight prepared answer (2-3 sentences), three short talking points, a topic tag, and a difficulty 1-5.", {
        schema: { properties: {
          question: { type: "string" },
          answer: { type: "string" },
          bullet1: { type: "string" },
          bullet2: { type: "string" },
          bullet3: { type: "string" },
          tag: { type: "string" },
          difficulty: { type: "number" },
        }}
      })
      const s = JSON.parse(res)
      merge(s)
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black font-sans",
    header: "border-b border-black",
    heroBand: "grid grid-cols-[200px_1fr_200px] border-b border-black",
    heroSide: "p-4 flex flex-col justify-between",
    heroSideRight: "p-4 flex flex-col justify-between border-l border-black",
    heroCenter: "p-6 border-l border-r border-black flex items-center justify-center min-h-[200px]",
    heroTitle: "text-center font-black uppercase leading-none",
    metaLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em]",
    metaValue: "text-xs mt-2",
    main: "grid grid-cols-1 md:grid-cols-[260px_1fr]",
    rail: "border-r border-black",
    railHeader: "p-3 border-b border-black flex items-center justify-between",
    railTitle: "text-[0.6rem] font-bold uppercase tracking-[0.1em]",
    railSort: "text-[0.6rem] uppercase tracking-[0.08em]",
    railList: "divide-y divide-black",
    railItem: "p-3 cursor-pointer hover:bg-black hover:text-white",
    railQ: "text-xs leading-snug",
    railMeta: "flex items-center justify-between mt-2 text-[0.55rem] uppercase tracking-[0.08em]",
    section: "border-b border-black p-5",
    sectionHeader: "flex items-center justify-between mb-4",
    sectionLabel: "text-[0.65rem] font-bold uppercase tracking-[0.12em] px-2 py-1 inline-block bg-black text-white",
    form: "grid gap-4",
    fieldLabel: "block text-[0.55rem] font-bold uppercase tracking-[0.12em] mb-1",
    input: "w-full bg-transparent border-0 border-b border-black py-2 text-sm focus:outline-none",
    textarea: "w-full bg-transparent border-0 border-b border-black py-2 text-sm min-h-[60px] focus:outline-none resize-none",
    row2: "grid grid-cols-2 gap-4",
    btn: "px-6 py-3 border border-black bg-white text-black text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px] hover:bg-black hover:text-white",
    btnPrimary: "px-6 py-3 border border-black bg-black text-white text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px] hover:bg-white hover:text-black",
    btnRow: "flex flex-wrap gap-0",
    table: "w-full border-t border-black",
    tableHead: "grid grid-cols-[1fr_80px_80px_60px] border-b border-black",
    th: "p-3 text-[0.55rem] font-bold uppercase tracking-[0.12em] border-r border-black last:border-r-0",
    tableRow: "grid grid-cols-[1fr_80px_80px_60px] border-b border-black hover:bg-black hover:text-white",
    td: "p-3 text-xs border-r border-black last:border-r-0",
    rehearseStage: "p-8 min-h-[280px] flex flex-col items-center justify-center",
    rehearseQ: "text-xl font-bold uppercase text-center max-w-prose",
    rehearseAnswer: "text-sm mt-6 max-w-prose",
    bullets: "mt-4 space-y-2 text-sm",
    bullet: "flex gap-3",
    outcomeRow: "grid grid-cols-3 border-t border-black",
    outcomeBtn: "py-4 border-r border-black last:border-r-0 text-[0.65rem] font-bold uppercase tracking-[0.08em] hover:bg-black hover:text-white",
    summaryGrid: "grid grid-cols-3 border-t border-black",
    summaryCell: "p-4 border-r border-black last:border-r-0 text-center",
    summaryNum: "text-3xl font-black",
    summaryLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mt-1",
    muted: "text-[#666]",
    suggestBtn: "text-[0.55rem] uppercase tracking-[0.08em] underline",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.heroBand}>
          <div className={c.heroSide}>
            <div>
              <div className={c.metaLabel}>Vol. I</div>
              <div className={c.metaValue}>Q4 Prep</div>
            </div>
            <div>
              <div className={c.metaLabel}>Edition</div>
              <div className={c.metaValue}>Internal Use</div>
            </div>
          </div>
          <div className={c.heroCenter}>
            <h1 className={c.heroTitle} style={{ fontSize: "clamp(2rem, 8vw, 5rem)", WebkitTextStroke: "2px #000", color: "transparent", letterSpacing: "-0.04em" }}>
              The IR<br/>Rehearsal
            </h1>
          </div>
          <div className={c.heroSideRight}>
            <div>
              <div className={c.metaLabel}>Status</div>
              <div className={c.metaValue}>Draft</div>
            </div>
            <div>
              <div className={c.metaLabel}>Section</div>
              <div className={c.metaValue}>IR / Comms</div>
            </div>
          </div>
        </div>
      </header>

      <main id="app" className={c.main}>
        <aside id="card-rail" className={c.rail}>
          <div className={c.railHeader}>
            <span className={c.railTitle}>Card Deck</span>
            <button className={c.railSort} onClick={() => setSortDesc(!sortDesc)}>
              Sort {sortDesc ? "▼" : "▲"}
            </button>
          </div>
          <div className="p-3 border-b border-black">
            <label className={c.fieldLabel}>Filter Tag</label>
            <select className={c.input} value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
              <option value="">All</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <ul className={c.railList}>
            {visibleCards.length === 0 && (
              <li className={c.railItem}><div className={c.railQ}>No cards yet.</div></li>
            )}
            {visibleCards.map((card) => (
              <li key={card._id} className={c.railItem}>
                <div className={c.railQ}>{card.question}</div>
                <div className={c.railMeta}>
                  <span>{card.tag || "—"}</span>
                  <span>Diff {card.difficulty}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div>
          <section id="rehearse" className={c.section}>
            <div className={c.sectionHeader}>
              <span className={c.sectionLabel}>Rehearsal Stage</span>
              <button className={c.btn} onClick={handleStartRehearsal} disabled={visibleCards.length === 0}>
                {session && !session.finished ? "Restart ›" : "Start ›"}
              </button>
            </div>
            <div className={c.rehearseStage}>
              {!session && <div className={c.rehearseQ}>Press Start to shuffle the deck</div>}
              {session && session.finished && <div className={c.rehearseQ}>Session complete — see summary below.</div>}
              {session && !session.finished && currentCard && (
                <>
                  <div className={c.rehearseQ}>{currentCard.question}</div>
                  {!revealed && (
                    <button className={c.btn + " mt-6"} onClick={handleReveal}>Reveal ›</button>
                  )}
                  {revealed && (
                    <>
                      <div className={c.rehearseAnswer}>{currentCard.answer}</div>
                      <ul className={c.bullets}>
                        {[currentCard.bullet1, currentCard.bullet2, currentCard.bullet3].filter(Boolean).map((b, i) => (
                          <li key={i} className={c.bullet}><span>›</span><span>{b}</span></li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className={`mt-6 ${c.muted} text-[0.6rem] uppercase tracking-[0.1em]`}>Card {session.index + 1} of {session.deck.length}</div>
                </>
              )}
            </div>
            <div className={c.outcomeRow}>
              <button className={c.outcomeBtn} disabled={!revealed} onClick={() => handleOutcome("nailed")}>Nailed It</button>
              <button className={c.outcomeBtn} disabled={!revealed} onClick={() => handleOutcome("needs-work")}>Needs Work</button>
              <button className={c.outcomeBtn} disabled={!session || session.finished} onClick={() => handleOutcome("skip")}>Skip</button>
            </div>
          </section>

          <section id="summary" className={c.section}>
            <div className={c.sectionHeader}>
              <span className={c.sectionLabel}>Session Summary</span>
            </div>
            {(() => {
              const o = session?.outcomes || {}
              const vals = Object.values(o)
              const nailed = vals.filter((v) => v === "nailed").length
              const needs = vals.filter((v) => v === "needs-work").length
              const total = vals.filter((v) => v !== "skip").length
              const avg = total > 0 ? ((nailed / total) * 5).toFixed(1) : "—"
              const needsList = session ? session.deck.filter((c) => o[c._id] === "needs-work") : []
              return (
                <>
                  <div className={c.summaryGrid}>
                    <div className={c.summaryCell}>
                      <div className={c.summaryNum}>{nailed}</div>
                      <div className={c.summaryLabel}>Nailed</div>
                    </div>
                    <div className={c.summaryCell}>
                      <div className={c.summaryNum}>{needs}</div>
                      <div className={c.summaryLabel}>Needs Work</div>
                    </div>
                    <div className={c.summaryCell}>
                      <div className={c.summaryNum}>{avg}</div>
                      <div className={c.summaryLabel}>Avg Score / 5</div>
                    </div>
                  </div>
                  {needsList.length > 0 && (
                    <div className="mt-4">
                      <div className={c.fieldLabel}>Still flagged</div>
                      <ul className="mt-2 space-y-1">
                        {needsList.map((card) => (
                          <li key={card._id} className="text-xs">› {card.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )
            })()}
          </section>

          <section id="add-card" className={c.section}>
            <div className={c.sectionHeader}>
              <span className={c.sectionLabel}>Add Card</span>
              <button type="button" className={c.suggestBtn} onClick={handleSuggest} disabled={isSuggesting}>
                {isSuggesting ? "Drafting…" : "Suggest example ›"}
              </button>
            </div>
            <form onSubmit={handleSubmit} className={c.form}>
              <div>
                <label className={c.fieldLabel}>Question</label>
                <input className={c.input} value={doc.question} onChange={(e) => merge({ question: e.target.value })} placeholder="What the analyst will ask" />
              </div>
              <div>
                <label className={c.fieldLabel}>Prepared Answer</label>
                <textarea className={c.textarea} value={doc.answer} onChange={(e) => merge({ answer: e.target.value })} placeholder="The reply, kept tight" />
              </div>
              <div>
                <label className={c.fieldLabel}>Talking Points (3)</label>
                <input className={c.input} value={doc.bullet1} onChange={(e) => merge({ bullet1: e.target.value })} placeholder="Bullet 1" />
                <input className={c.input} value={doc.bullet2} onChange={(e) => merge({ bullet2: e.target.value })} placeholder="Bullet 2" />
                <input className={c.input} value={doc.bullet3} onChange={(e) => merge({ bullet3: e.target.value })} placeholder="Bullet 3" />
              </div>
              <div className={c.row2}>
                <div>
                  <label className={c.fieldLabel}>Topic Tag</label>
                  <input className={c.input} value={doc.tag} onChange={(e) => merge({ tag: e.target.value })} placeholder="Margins / Guidance / M&A" />
                </div>
                <div>
                  <label className={c.fieldLabel}>Difficulty 1–5</label>
                  <input className={c.input} type="number" min="1" max="5" value={doc.difficulty} onChange={(e) => merge({ difficulty: Number(e.target.value) })} />
                </div>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Save Card</button>
              </div>
            </form>
          </section>

          <section id="all-cards" className={c.section}>
            <div className={c.sectionHeader}>
              <span className={c.sectionLabel}>Full Deck</span>
              <button className={c.btn} onClick={handleExport}>Export ›</button>
            </div>
            <div className={c.table}>
              <div className={c.tableHead}>
                <div className={c.th}>Question</div>
                <div className={c.th}>Topic</div>
                <div className={c.th}>Diff</div>
                <div className={c.th}>Del</div>
              </div>
              {sortedCards.length === 0 && (
                <div className={c.tableRow}>
                  <div className={c.td}>No cards yet — add one above.</div>
                  <div className={c.td}>—</div>
                  <div className={c.td}>—</div>
                  <div className={c.td}>—</div>
                </div>
              )}
              {sortedCards.map((card) => (
                <div key={card._id} className={c.tableRow}>
                  <div className={c.td}>{card.question}</div>
                  <div className={c.td}>{card.tag || "—"}</div>
                  <div className={c.td}>{card.difficulty}</div>
                  <div className={c.td}>
                    <button className="underline text-[0.6rem] uppercase" onClick={() => database.del(card._id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}