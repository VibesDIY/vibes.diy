import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
    
    :root {
      --bg: oklch(0.96 0.01 90);
      --card-bg: oklch(1.00 0 0);
      --text: oklch(0.15 0.02 280);
      --border: oklch(0.15 0.02 280);
      --muted: oklch(0.50 0.02 280);
      --red: oklch(0.55 0.24 28);
      --yellow: oklch(0.85 0.18 85);
      --green: oklch(0.62 0.19 145);
      --blue: oklch(0.52 0.18 255);
    }
    
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Space Grotesk', sans-serif;
      overflow-x: hidden;
    }
    
    .app-theme {
      background: 
        linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
        linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    
    .shadow-brutal { box-shadow: 4px 4px 0px var(--border); }
    .shadow-sm-brutal { box-shadow: 3px 3px 0px var(--border); }
    .shadow-hover { box-shadow: 6px 6px 0px var(--border); }
  `}} />
)

function getSeededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash = hash & hash;
  }
  const x = Math.sin(hash + 1.234) * 10000;
  let val = x - Math.floor(x);
  return Math.floor(val * 1000) + 1;
}

export default function App() {
  const todayStr = new Date().toISOString().split('T')[0]
  const dailyNumber = getSeededRandom(todayStr)
  const isYes = dailyNumber > 500
  
  const { useLiveQuery, useDocument, database } = useFireproof("oracle-ledger")
  const { doc, merge, submit } = useDocument({ 
    type: "question", 
    text: "", 
    date: todayStr, 
    rngValue: dailyNumber,
    verdict: isYes ? "YES" : "NO",
    createdAt: Date.now()
  })
  
  const [isAsking, setIsAsking] = React.useState(false)

  const { docs: todaysDocs } = useLiveQuery((dbDoc) => {
    if (dbDoc.type === 'question' && dbDoc.date === todayStr) {
      return dbDoc.createdAt;
    }
  }, { descending: true })

  const { docs: historyDocs } = useLiveQuery((dbDoc) => {
    if (dbDoc.type === 'question' && dbDoc.date !== todayStr) {
      return dbDoc.date;
    }
  }, { descending: true })
  
  const c = {
    page: "min-h-screen relative p-4 md:p-12 max-w-[920px] mx-auto flex flex-col gap-8 app-theme z-10",
    nav: "flex justify-between items-center px-4 py-3 rounded bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-brutal",
    navLogo: "flex gap-1 items-center font-bold text-[0.85rem] uppercase tracking-wider",
    navChip: "px-3 py-1 text-[0.7rem] font-bold uppercase tracking-widest rounded border-[3px] border-[var(--border)] shadow-sm-brutal bg-[var(--card-bg)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all",
    
    hero: "relative flex flex-col items-center justify-center py-20 px-6 rounded mt-4 text-center bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-brutal",
    heroBar: "absolute top-0 left-0 right-0 h-2 flex border-b-[3px] border-[var(--border)]",
    heroTitle: "text-7xl md:text-9xl font-black uppercase tracking-[-0.04em] relative z-10 leading-none",
    heroSub: "text-[0.65rem] uppercase tracking-[0.15em] mt-6 font-bold max-w-sm text-[var(--muted)] border-[3px] border-[var(--border)] px-4 py-2 rounded shadow-sm-brutal",
    
    statRow: "grid grid-cols-1 md:grid-cols-2 gap-6",
    statCard: "flex flex-col rounded bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-brutal",
    statHeader: "px-3 py-2 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[var(--border)]",
    statBody: "p-6 text-5xl font-bold font-mono flex items-baseline gap-3",
    statLabel: "text-base font-sans tracking-tight uppercase text-[var(--muted)]",
    
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    card: "p-6 rounded flex flex-col gap-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-brutal",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-4 text-[var(--muted)] font-bold border-b-[3px] border-[var(--border)] pb-2",
    input: "w-full p-3 text-lg rounded font-mono outline-none border-[3px] border-[var(--border)] focus:-translate-y-0.5 focus:-translate-x-0.5 focus:shadow-hover transition-all bg-[var(--bg)]",
    btnPrimary: "w-full py-4 text-[0.8rem] font-bold uppercase tracking-[0.08em] rounded bg-[var(--red)] text-white border-[3px] border-[var(--border)] shadow-brutal hover:-translate-y-1 hover:-translate-x-1 hover:shadow-hover active:translate-y-1 active:translate-x-1 active:shadow-none transition-all",
    btnGhost: "px-3 py-2 mt-2 text-[0.7rem] uppercase font-bold text-center block w-full rounded border-[3px] border-transparent hover:border-[var(--border)] hover:bg-[var(--yellow)] hover:shadow-sm-brutal transition-all",
    
    feedItem: "py-4 border-b-[3px] border-[var(--border)] flex flex-col gap-1 last:border-b-0 relative group",
    feedQuestion: "font-bold text-lg leading-tight group-hover:bg-[var(--yellow)] transition-colors inline-block pb-1",
    feedResult: "text-[0.7rem] font-mono font-bold uppercase px-2 py-1 self-start rounded border-[3px] border-[var(--border)] shadow-sm-brutal",
    
    historyTable: "w-full text-left border-collapse",
    historyTh: "text-[0.65rem] uppercase p-3 border-b-[3px] border-[var(--border)] font-bold tracking-[0.1em] text-[var(--muted)]",
    historyTd: "text-[0.82rem] p-3 border-b-[3px] border-[var(--border)] font-mono group-hover:bg-[var(--yellow)] transition-colors"
  }

  function handleAsk(e) {
    e.preventDefault()
    if (!doc.text.trim()) return;
    submit();
  }

  const [isLoadingSuggestion, setIsLoadingSuggestion] = React.useState(false)

  async function handleSuggest() {
    setIsLoadingSuggestion(true)
    try {
      const response = await callAI("Generate one highly specific, slightly absurd YES/NO question someone might ask an oracle that decides things using a random number from 1-1000. Examples: Should I legally change my name to Danger? Do I eat the entire cake? Return JSON.", {
        schema: { properties: { idea: { type: "string" } } }
      })
      const data = JSON.parse(response)
      merge({ text: data.idea })
    } finally {
      setIsLoadingSuggestion(false)
    }
  }

  return (
    <div className={c.page} id="app-root">
      <GlobalStyles />
      
      {/* Ambient decorative blocks */}
      <div className="absolute top-20 -left-6 w-12 h-12 bg-[var(--red)] border-[3px] border-[var(--border)] shadow-brutal opacity-30 -z-10 animate-pulse"></div>
      <div className="absolute bottom-40 right-4 w-8 h-8 rounded-full bg-[var(--blue)] border-[3px] border-[var(--border)] shadow-sm-brutal opacity-20 -z-10 animate-bounce"></div>
      <div className="absolute top-1/2 left-8 w-16 h-16 bg-[var(--yellow)] border-[3px] border-[var(--border)] shadow-brutal opacity-15 rotate-45 -z-10"></div>
      
      <header className={c.nav}>
        <div className={c.navLogo}>
          <div className="flex gap-0 mr-2 border border-[var(--border)] shadow-sm-brutal">
            <div className="w-3 h-3 bg-[var(--red)] border-r border-[var(--border)]"></div>
            <div className="w-3 h-3 bg-[var(--yellow)] border-r border-[var(--border)]"></div>
            <div className="w-3 h-3 bg-[var(--green)]"></div>
          </div>
          Oracle.RNG
        </div>
        <div className={c.navChip}>Today</div>
      </header>

      <section className={c.hero}>
        <div className={c.heroBar}>
          <div className="flex-1 bg-[var(--red)] border-r-[3px] border-[var(--border)]"></div>
          <div className="flex-1 bg-[var(--yellow)] border-r-[3px] border-[var(--border)]"></div>
          <div className="flex-1 bg-[var(--green)] border-r-[3px] border-[var(--border)]"></div>
          <div className="flex-1 bg-[var(--blue)]"></div>
        </div>
        <div className="relative">
          <h1 className={`${c.heroTitle} text-[var(--text)] mix-blend-multiply`} data-text={dailyNumber}>
            {dailyNumber}
          </h1>
          <h1 className={`${c.heroTitle} text-[var(--red)] opacity-50 absolute top-[6px] left-[6px] -z-10`} aria-hidden="true">
            {dailyNumber}
          </h1>
        </div>
        <p className={c.heroSub}>Shared Daily Determinant • {todayStr}</p>
      </section>

      <section className={c.statRow}>
        <div className={c.statCard}>
          <div className={`${c.statHeader} bg-[var(--red)] text-white`}>Cutoff Threshold</div>
          <div className={c.statBody}>500 <span className={c.statLabel}>Target</span></div>
        </div>
        <div className={c.statCard}>
          <div className={`${c.statHeader} ${isYes ? 'bg-[var(--green)] text-[var(--text)]' : 'bg-[var(--yellow)] text-[var(--text)]'}`}>Oracle Trajectory</div>
          <div className={c.statBody}>{isYes ? 'YES' : 'NO'} <span className={c.statLabel}>Status</span></div>
        </div>
      </section>

      <section className={c.formGrid}>
        <div className={c.card}>
          <h2 className={c.sectionLabel}>Consult The Oracle</h2>
          <form onSubmit={handleAsk} className="flex flex-col gap-4">
            <input 
              type="text" 
              className={c.input} 
              placeholder="Should I..." 
              value={doc.text}
              onChange={(e) => merge({ text: e.target.value })}
            />
            <button type="submit" className={c.btnPrimary}>
              Ask This Question To The Oracle
            </button>
            <button type="button" onClick={handleSuggest} disabled={isLoadingSuggestion} className={c.btnGhost}>
              {isLoadingSuggestion ? "Channeling Spirits..." : "Or generate an idea"}
            </button>
          </form>
        </div>

        <div className={c.card}>
          <h2 className={c.sectionLabel}>Today's Ledger ({todaysDocs.length})</h2>
          <div className="flex flex-col overflow-y-auto max-h-[300px] pr-2">
            {todaysDocs.length === 0 && <p className="text-sm font-mono text-[var(--muted)]">No queries logged today.</p>}
            {todaysDocs.map(d => (
              <div key={d._id} className={c.feedItem}>
                <div className="flex justify-between items-start gap-4">
                  <span className={c.feedQuestion}>{d.text}</span>
                  <span className={`${c.feedResult} ${d.verdict === 'YES' ? 'bg-[var(--green)]' : 'bg-[var(--red)] text-white'}`}>
                    {d.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={c.card}>
        <h2 className={c.sectionLabel}>Historical Decisions</h2>
        <div className="overflow-x-auto">
          <table className={c.historyTable}>
            <thead>
              <tr>
                <th className={c.historyTh}>Date</th>
                <th className={c.historyTh}>RNG</th>
                <th className={c.historyTh}>Question</th>
                <th className={c.historyTh}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {historyDocs.length === 0 && (
                <tr className="group">
                  <td colSpan="4" className={c.historyTd}>Archival data empty.</td>
                </tr>
              )}
              {historyDocs.map((d) => (
                <tr key={d._id} className="group">
                  <td className={c.historyTd}>{d.date}</td>
                  <td className={c.historyTd}>{d.rngValue}</td>
                  <td className={`${c.historyTd} font-sans font-bold`}>{d.text}</td>
                  <td className={c.historyTd}>
                    <span className={`px-2 py-0.5 rounded border-[2px] border-[var(--border)] text-[0.6rem] font-bold ${d.verdict === 'YES' ? 'bg-[var(--green)]' : 'bg-[var(--red)] text-white'}`}>
                      {d.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}