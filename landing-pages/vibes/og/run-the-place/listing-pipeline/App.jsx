import React from "react"
import { useFireproof } from "use-fireproof"

const STAGES = ["Lead", "Showing", "Offer", "Under Contract", "Closed"]

function QuickAdd({ doc, merge, submit }) {
  return (
    <form onSubmit={submit} id="quick-add" className="mb-6 p-4 bg-white border-[3px] border-[#141425] rounded shadow-[4px_4px_0_#141425]">
      <h2 className="text-sm font-bold uppercase tracking-wider mb-3">New Lead</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input required value={doc.address} onChange={e => merge({ address: e.target.value })} placeholder="Address" className="px-3 py-2 border-[3px] border-[#141425] rounded bg-[#f5f2ea] text-sm font-medium" />
        <input required value={doc.lead} onChange={e => merge({ lead: e.target.value })} placeholder="Lead Name" className="px-3 py-2 border-[3px] border-[#141425] rounded bg-[#f5f2ea] text-sm font-medium" />
        <input required value={doc.agent} onChange={e => merge({ agent: e.target.value })} placeholder="Agent" className="px-3 py-2 border-[3px] border-[#141425] rounded bg-[#f5f2ea] text-sm font-medium" />
        <button type="submit" className="px-4 py-2 bg-[#d94a3d] text-white border-[3px] border-[#141425] rounded shadow-[3px_3px_0_#141425] font-bold uppercase text-xs tracking-wider hover:bg-[#e8c547] hover:text-[#141425]">Add Lead</button>
      </div>
    </form>
  )
}

const STAGE_COLORS = ["#d94a3d", "#e8c547", "#4a7bd9", "#5cb85c", "#141425"]
const STAGE_TEXT = ["white", "#141425", "white", "#141425", "white"]

function Column({ stage, color, textColor, cards, onAdvance, isLast }) {
  return (
    <div className="bg-white border-[3px] border-[#141425] rounded shadow-[4px_4px_0_#141425] flex flex-col">
      <div className="px-3 py-2 border-b-[3px] border-[#141425] flex justify-between items-center" style={{ background: color, color: textColor }}>
        <h3 className="font-bold uppercase text-xs tracking-wider">{stage}</h3>
        <span className="font-mono text-sm font-bold px-2 bg-white text-[#141425] border-[2px] border-[#141425] rounded">{cards.length}</span>
      </div>
      <div className="p-2 flex flex-col gap-2 min-h-[120px]">
        {cards.map((card) => (
          <div key={card._id} onClick={() => !isLast && onAdvance(card)} className={`p-2 bg-[#f5f2ea] border-[3px] border-[#141425] rounded shadow-[3px_3px_0_#141425] ${isLast ? "" : "cursor-pointer hover:bg-[#e8c547] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_#141425]"} transition-all`}>
            <div className="font-bold text-sm uppercase">{card.address || "—"}</div>
            <div className="text-xs text-[#555] mt-1">{card.lead}</div>
            <div className="text-xs font-mono mt-1 uppercase tracking-wider">{card.agent}</div>
          </div>
        ))}
        {cards.length === 0 && <div className="text-xs text-[#999] uppercase tracking-wider p-2">Empty</div>}
      </div>
    </div>
  )
}

function Board({ cards = [], onAdvance }) {
  return (
    <section id="board" className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {STAGES.map((stage, i) => (
        <Column key={stage} stage={stage} color={STAGE_COLORS[i]} textColor={STAGE_TEXT[i]} cards={cards.filter(c => c.stage === stage)} onAdvance={onAdvance} isLast={i === STAGES.length - 1} />
      ))}
    </section>
  )
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("deal-flow-db")
  const { docs: cards } = useLiveQuery("type", { key: "deal" })
  const { doc, merge, submit } = useDocument({ type: "deal", address: "", lead: "", agent: "", stage: "Lead" })

  const advance = (card) => {
    const idx = STAGES.indexOf(card.stage)
    if (idx < STAGES.length - 1) database.put({ ...card, stage: STAGES[idx + 1] })
  }

  return (
    <main id="app" className="min-h-screen bg-[#f5f2ea] p-6 font-sans">
      <header id="app-header" className="max-w-7xl mx-auto mb-6">
        <h1 className="text-4xl font-bold uppercase tracking-tight">Deal Flow</h1>
      </header>
      <div className="max-w-7xl mx-auto">
        <QuickAdd doc={doc} merge={merge} submit={submit} />
        <Board cards={cards} onAdvance={advance} />
      </div>
    </main>
  )
}