import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const CATS = [
  { k: "ones", label: "Ones", sec: "upper" },
  { k: "twos", label: "Twos", sec: "upper" },
  { k: "threes", label: "Threes", sec: "upper" },
  { k: "fours", label: "Fours", sec: "upper" },
  { k: "fives", label: "Fives", sec: "upper" },
  { k: "sixes", label: "Sixes", sec: "upper" },
  { k: "three_kind", label: "3 of a Kind", sec: "lower" },
  { k: "four_kind", label: "4 of a Kind", sec: "lower" },
  { k: "full_house", label: "Full House", sec: "lower" },
  { k: "sm_straight", label: "Sm Straight", sec: "lower" },
  { k: "lg_straight", label: "Lg Straight", sec: "lower" },
  { k: "yahtzee", label: "Yahtzee", sec: "lower" },
  { k: "chance", label: "Chance", sec: "lower" },
]

const c = {
  page: "min-h-screen bg-[#f5f2ea] text-[#15151f] font-['Space_Grotesk',sans-serif] pb-20",
  header: "sticky top-0 z-20 bg-[#f5f2ea] border-b-[3px] border-[#15151f] px-4 py-3 flex items-center justify-between shadow-[0_4px_0_0_#15151f]",
  title: "text-xl md:text-2xl font-bold uppercase tracking-tight",
  round: "font-['JetBrains_Mono',monospace] text-xs uppercase tracking-widest bg-[#d94a2b] text-white border-[3px] border-[#15151f] px-3 py-1 shadow-[3px_3px_0_0_#15151f]",
  wrap: "max-w-6xl mx-auto p-4 grid md:grid-cols-[1fr_280px] gap-4",
  card: "bg-white border-[3px] border-[#15151f] shadow-[4px_4px_0_0_#15151f] p-3",
  secLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b78] mb-2 font-semibold",
  cell: "border-[3px] border-[#15151f] p-2 min-h-[52px] text-left w-full font-['JetBrains_Mono',monospace] text-base hover:bg-[#f0d53d] active:translate-x-[2px] active:translate-y-[2px] transition-transform",
  cellFilled: "bg-[#6bbf59] text-[#15151f]",
  cellEmpty: "bg-white",
  btn: "border-[3px] border-[#15151f] bg-[#d94a2b] text-white px-4 py-2 uppercase tracking-wider text-sm font-bold shadow-[4px_4px_0_0_#15151f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  btnY: "border-[3px] border-[#15151f] bg-[#f0d53d] text-[#15151f] px-4 py-2 uppercase tracking-wider text-sm font-bold shadow-[3px_3px_0_0_#15151f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  btnGhost: "border-[3px] border-[#15151f] bg-white text-[#15151f] px-3 py-1 uppercase text-xs font-bold hover:shadow-[3px_3px_0_0_#15151f] transition-all",
  input: "border-[3px] border-[#15151f] px-2 py-2 w-full bg-white font-['JetBrains_Mono',monospace] focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_0_#15151f] transition-all",
  toggle: "flex items-center justify-between border-[3px] border-[#15151f] bg-white p-2 mb-2",
  chip: "font-['JetBrains_Mono',monospace] text-xs border-[3px] border-[#15151f] px-2 py-1",
  winner: "bg-[#3a78d9] text-white border-[3px] border-[#15151f] shadow-[4px_4px_0_0_#15151f] p-3 uppercase font-bold tracking-wider",
  bar: "h-[6px] flex border-b-[3px] border-[#15151f]",
  heroBar: "h-[6px] flex",
}

const DEFAULTS = {
  players: ["Player 1", "Player 2"],
  rules: { jokers: true, fhThirty: false, fiveKind: false, smStraightChance: false },
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("yahtzee-cousin-setup")
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULTS
}

function calcTotals(scores, playerIdx, rules) {
  let upper = 0, lower = 0
  for (const cat of CATS) {
    const v = scores[`${playerIdx}_${cat.k}`]
    if (typeof v === "number") {
      if (cat.sec === "upper") upper += v
      else lower += v
    }
  }
  const bonus = upper >= 63 ? 35 : 0
  return { upper, lower, bonus, total: upper + bonus + lower }
}

export default function App() {
  const { useDocument, database } = useFireproof("yahtzee-cousin-v1")
  const [local, setLocal] = useState(loadLocal)
  const [setupOpen, setSetupOpen] = useState(false)

  const { doc, merge } = useDocument({ _id: "game", scores: {}, round: 1 })

  useEffect(() => {
    localStorage.setItem("yahtzee-cousin-setup", JSON.stringify(local))
  }, [local])

  const players = local.players
  const rules = local.rules
  const scores = doc.scores || {}

  const setCell = (pIdx, key, raw) => {
    if (raw === null || raw === "") {
      const ns = { ...scores }
      delete ns[`${pIdx}_${key}`]
      database.put({ ...doc, scores: ns })
      return
    }
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0) return
    database.put({ ...doc, scores: { ...scores, [`${pIdx}_${key}`]: n } })
  }

  const promptCell = (pIdx, key, label) => {
    const cur = scores[`${pIdx}_${key}`]
    const v = window.prompt(`${players[pIdx]} — ${label}\n(blank to clear, 0 to scratch)`, cur ?? "")
    if (v === null) return
    setCell(pIdx, key, v === "" ? null : v)
  }

  const resetGame = () => {
    if (!window.confirm("Wipe the scorecard?")) return
    database.put({ ...doc, scores: {}, round: 1 })
  }

  const totals = players.map((_, i) => calcTotals(scores, i, rules))
  const maxTotal = Math.max(...totals.map(t => t.total), 0)
  const allDone = players.every((_, i) => CATS.every(cat => typeof scores[`${i}_${cat.k}`] === "number"))
  const winners = allDone ? players.filter((_, i) => totals[i].total === maxTotal) : []

  const filledCount = Object.keys(scores).filter(k => k.startsWith("0_")).length
  const currentRound = Math.min(13, filledCount + 1)

  const updatePlayer = (i, name) => {
    const ps = [...local.players]
    ps[i] = name
    setLocal({ ...local, players: ps })
  }
  const addPlayer = () => {
    if (local.players.length >= 6) return
    setLocal({ ...local, players: [...local.players, `Player ${local.players.length + 1}`] })
  }
  const removePlayer = () => {
    if (local.players.length <= 2) return
    setLocal({ ...local, players: local.players.slice(0, -1) })
  }
  const toggleRule = (k) => setLocal({ ...local, rules: { ...local.rules, [k]: !local.rules[k] } })

  return (
    <main className={c.page}>
      <div className={c.heroBar}>
        <div className="flex-1 bg-[#d94a2b]" />
        <div className="flex-1 bg-[#f0d53d]" />
        <div className="flex-1 bg-[#6bbf59]" />
        <div className="flex-1 bg-[#3a78d9]" />
      </div>
      <header className={c.header}>
        <h1 className={c.title}>Yahtzee · Cousin Edition</h1>
        <div className="flex gap-2 items-center">
          <span className={c.round}>Round {currentRound}/13</span>
          <button className={c.btnGhost} onClick={() => setSetupOpen(o => !o)}>Setup</button>
        </div>
      </header>

      <div className={c.wrap}>
        <div>
          {winners.length > 0 && (
            <div className={c.winner + " mb-3"}>
              Winner{winners.length > 1 ? "s (tie)" : ""}: {winners.join(", ")} — {maxTotal} pts
            </div>
          )}

          <div className={c.card + " overflow-x-auto"}>
            <div className={c.secLabel}>Scorecard</div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b-[3px] border-[#15151f] text-xs uppercase tracking-wider min-w-[110px]">Category</th>
                  {players.map((p, i) => (
                    <th key={i} className="p-2 border-b-[3px] border-[#15151f] text-xs uppercase tracking-wider min-w-[90px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATS.filter(x => x.sec === "upper").map(cat => (
                  <tr key={cat.k}>
                    <td className="p-1 text-xs font-semibold uppercase tracking-wide">{cat.label}</td>
                    {players.map((_, i) => {
                      const v = scores[`${i}_${cat.k}`]
                      const filled = typeof v === "number"
                      return (
                        <td key={i} className="p-1">
                          <button className={`${c.cell} ${filled ? c.cellFilled : c.cellEmpty}`} onClick={() => promptCell(i, cat.k, cat.label)}>
                            {filled ? v : "—"}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-[#f0d53d]">
                  <td className="p-2 text-xs font-bold uppercase">Upper / Bonus @ 63</td>
                  {players.map((_, i) => (
                    <td key={i} className="p-2 font-['JetBrains_Mono',monospace] text-xs">
                      {totals[i].upper}/63 {totals[i].bonus ? "+35" : ""}
                    </td>
                  ))}
                </tr>
                {CATS.filter(x => x.sec === "lower").map(cat => (
                  <tr key={cat.k}>
                    <td className="p-1 text-xs font-semibold uppercase tracking-wide">
                      {cat.label}
                      {cat.k === "full_house" && rules.fhThirty && <span className="ml-1 text-[0.6rem] text-[#d94a2b]">(30)</span>}
                      {cat.k === "yahtzee" && rules.jokers && <span className="ml-1 text-[0.6rem] text-[#3a78d9]">(jokers)</span>}
                    </td>
                    {players.map((_, i) => {
                      const v = scores[`${i}_${cat.k}`]
                      const filled = typeof v === "number"
                      return (
                        <td key={i} className="p-1">
                          <button className={`${c.cell} ${filled ? c.cellFilled : c.cellEmpty}`} onClick={() => promptCell(i, cat.k, cat.label)}>
                            {filled ? v : "—"}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-[#6bbf59]">
                  <td className="p-2 text-xs font-bold uppercase">Total</td>
                  {players.map((_, i) => (
                    <td key={i} className="p-2 font-['JetBrains_Mono',monospace] font-bold">{totals[i].total}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <button className={c.btn} onClick={resetGame}>Reset Game</button>
            <span className={c.chip + " bg-white"}>Synced live via Fireproof</span>
          </div>
        </div>

        <aside>
          {setupOpen && (
            <div className={c.card + " mb-3"}>
              <div className={c.secLabel}>Players ({players.length})</div>
              {players.map((p, i) => (
                <input key={i} className={c.input + " mb-2"} value={p} onChange={e => updatePlayer(i, e.target.value)} />
              ))}
              <div className="flex gap-2">
                <button className={c.btnY} onClick={addPlayer} disabled={players.length >= 6}>+ Add</button>
                <button className={c.btnGhost} onClick={removePlayer} disabled={players.length <= 2}>− Remove</button>
              </div>
            </div>
          )}

          <div className={c.card}>
            <div className={c.secLabel}>House Rules</div>
            <div className={c.toggle}>
              <span className="text-xs uppercase font-semibold">Joker Rules (bonus Yahtzee)</span>
              <input type="checkbox" checked={rules.jokers} onChange={() => toggleRule("jokers")} className="w-5 h-5 accent-[#6bbf59]" />
            </div>
            <div className={c.toggle}>
              <span className="text-xs uppercase font-semibold">Full House = 30</span>
              <input type="checkbox" checked={rules.fhThirty} onChange={() => toggleRule("fhThirty")} className="w-5 h-5 accent-[#6bbf59]" />
            </div>
            <div className={c.toggle}>
              <span className="text-xs uppercase font-semibold">5-of-a-Kind Bonus (+50)</span>
              <input type="checkbox" checked={rules.fiveKind} onChange={() => toggleRule("fiveKind")} className="w-5 h-5 accent-[#6bbf59]" />
            </div>
            <div className={c.toggle}>
              <span className="text-xs uppercase font-semibold">Sm Straight on Chance</span>
              <input type="checkbox" checked={rules.smStraightChance} onChange={() => toggleRule("smStraightChance")} className="w-5 h-5 accent-[#6bbf59]" />
            </div>
            <p className="text-[0.65rem] text-[#6b6b78] mt-2 leading-relaxed">
              Rules are reminders the table agrees on — enter scores accordingly. Saved per browser.
            </p>
          </div>

          <div className={c.card + " mt-3"}>
            <div className={c.secLabel}>Standings</div>
            {players.map((p, i) => (
              <div key={i} className="flex justify-between border-b border-[#15151f]/20 py-1 text-sm">
                <span className="font-semibold uppercase text-xs tracking-wide">{p}</span>
                <span className="font-['JetBrains_Mono',monospace]">{totals[i].total}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  )
}