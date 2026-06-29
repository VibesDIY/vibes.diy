import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const LS_ROSTER = "farkle.roster.v1"
const LS_RULES = "farkle.rules.v1"
const TARGET = 10000

const DEFAULT_RULES = {
  threePairs1500: true,
  straight1500: true,
  fourKindDouble: false,
  zeroWipes: false,
  mustEnter500: false,
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-[system-ui]",
  header: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0_#1a1625]",
  title: "text-3xl font-black uppercase tracking-tight text-[#1a1625]",
  feature: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0_#1a1625]",
  featureTitle: "text-xs font-bold uppercase tracking-widest text-[#1a1625] mb-3",
}

const RULE_LABELS = {
  threePairs1500: "3 pairs = 1500",
  straight1500: "Straight 1-6 = 1500",
  fourKindDouble: "4-of-a-kind ×2 (else ×4)",
  zeroWipes: "Zero turn wipes total",
  mustEnter500: "Must enter at 500",
}

function Setup({ roster, setRoster, rules, setRules, totals, winner }) {
  const updateName = (i, v) => setRoster(roster.map((n, idx) => idx === i ? v : n))
  const addPlayer = () => roster.length < 6 && setRoster([...roster, `Player ${roster.length + 1}`])
  const removePlayer = (i) => roster.length > 1 && setRoster(roster.filter((_, idx) => idx !== i))
  const toggleRule = (k) => setRules({ ...rules, [k]: !rules[k] })

  return (
    <section className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Roster & Rules</h2>
      <div className="space-y-2 mb-4">
        {roster.map((name, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className={`w-8 h-8 flex items-center justify-center border-[3px] border-[#1a1625] rounded font-mono font-bold ${winner === i ? "bg-[#7cb342] text-white" : "bg-[#ffd23f]"}`}>{i + 1}</div>
            <input value={name} onChange={e => updateName(i, e.target.value)} className="flex-1 border-[3px] border-[#1a1625] rounded px-2 py-1 font-semibold" />
            <div className="font-mono font-bold text-lg w-20 text-right">{totals[i] || 0}</div>
            {roster.length > 1 && <button onClick={() => removePlayer(i)} className="w-8 h-8 border-[3px] border-[#1a1625] rounded bg-[#e63946] text-white font-bold">×</button>}
          </div>
        ))}
        {roster.length < 6 && <button onClick={addPlayer} className="w-full border-[3px] border-[#1a1625] rounded py-2 bg-[#ffd23f] font-bold uppercase text-sm tracking-wider shadow-[3px_3px_0_#1a1625]">+ Add Player</button>}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[#6b6478] font-bold mb-2">House Rules</div>
      <div className="grid grid-cols-1 gap-1">
        {Object.keys(RULE_LABELS).map(k => (
          <label key={k} className="flex items-center gap-2 p-2 border-[3px] border-[#1a1625] rounded cursor-pointer bg-[#f5f1e8]">
            <div className={`w-5 h-5 border-[3px] border-[#1a1625] rounded ${rules[k] ? "bg-[#7cb342]" : "bg-white"}`} />
            <input type="checkbox" checked={rules[k]} onChange={() => toggleRule(k)} className="hidden" />
            <span className="text-sm font-semibold">{RULE_LABELS[k]}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function scoreChips(rules) {
  const fourMult = rules.fourKindDouble ? 2 : 4
  return [
    { label: "Single 1", pts: 100 },
    { label: "Single 5", pts: 50 },
    { label: "Three 1s", pts: 1000 },
    { label: "Three 2s", pts: 200 },
    { label: "Three 3s", pts: 300 },
    { label: "Three 4s", pts: 400 },
    { label: "Three 5s", pts: 500 },
    { label: "Three 6s", pts: 600 },
    { label: `4-of-kind ×${fourMult}`, pts: null, mult: fourMult },
    { label: "5-of-kind ×6", pts: null, mult: 6 },
    { label: "6-of-kind ×8", pts: null, mult: 8 },
    ...(rules.threePairs1500 ? [{ label: "3 Pairs", pts: 1500 }] : []),
    ...(rules.straight1500 ? [{ label: "Straight", pts: 1500 }] : []),
  ]
}

function Turn({ roster, rules, turn, mergeTurn, saveTurn, database, totals, winner }) {
  const [multPending, setMultPending] = useState(null)
  const player = roster[turn.playerIdx] || roster[0]
  const chips = scoreChips(rules)

  const addPoints = (pts) => { mergeTurn({ tally: turn.tally + pts }); setTimeout(saveTurn, 0) }
  const applyMult = (face) => { if (multPending) { addPoints(face * 100 * multPending); setMultPending(null) } }

  const bank = async () => {
    if (turn.tally <= 0) return
    if (rules.mustEnter500 && totals[turn.playerIdx] === 0 && turn.tally < 500) { alert("Need 500 to enter"); return }
    await database.put({ type: "entry", playerIdx: turn.playerIdx, points: turn.tally, ts: Date.now() })
    mergeTurn({ playerIdx: (turn.playerIdx + 1) % roster.length, tally: 0, hotDice: false })
    setTimeout(saveTurn, 0)
  }

  const farkle = async () => {
    const penalty = rules.zeroWipes ? -(totals[turn.playerIdx]) : 0
    await database.put({ type: "entry", playerIdx: turn.playerIdx, points: penalty, farkle: true, ts: Date.now() })
    mergeTurn({ playerIdx: (turn.playerIdx + 1) % roster.length, tally: 0, hotDice: false })
    setTimeout(saveTurn, 0)
  }

  const clearTally = () => { mergeTurn({ tally: 0, hotDice: false }); setTimeout(saveTurn, 0) }
  const toggleHot = () => { mergeTurn({ hotDice: !turn.hotDice }); setTimeout(saveTurn, 0) }

  if (winner >= 0) {
    return (
      <section className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Winner</h2>
        <div className="bg-[#7cb342] border-[3px] border-[#1a1625] rounded p-6 text-center shadow-[4px_4px_0_#1a1625]">
          <div className="text-xs uppercase tracking-widest text-white font-bold">Champion</div>
          <div className="text-4xl font-black uppercase text-white mt-1">{roster[winner]}</div>
          <div className="font-mono text-2xl text-white mt-2">{totals[winner]}</div>
        </div>
      </section>
    )
  }

  return (
    <section className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Current Turn</h2>
      <div className="bg-[#1a1625] border-[3px] border-[#1a1625] rounded p-4 mb-3">
        <div className="text-[10px] uppercase tracking-widest text-[#ffd23f] font-bold">On Deck</div>
        <div className="text-2xl font-black uppercase text-white">{player}</div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#6b6478]">Running Tally</div>
            <div className="text-5xl font-black font-mono text-[#ffd23f]">{turn.tally}</div>
          </div>
          <button onClick={toggleHot} className={`px-3 py-2 border-[3px] rounded font-black uppercase text-xs tracking-widest ${turn.hotDice ? "bg-[#e63946] text-white border-[#ffd23f] animate-pulse" : "bg-[#3a3548] text-[#6b6478] border-[#6b6478]"}`}>🔥 Hot Dice</button>
        </div>
      </div>

      {multPending && (
        <div className="mb-2 p-2 bg-[#ffd23f] border-[3px] border-[#1a1625] rounded">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-1">Pick face for ×{multPending}</div>
          <div className="grid grid-cols-6 gap-1">
            {[1,2,3,4,5,6].map(f => <button key={f} onClick={() => applyMult(f)} className="py-2 border-[3px] border-[#1a1625] rounded bg-white font-mono font-bold">{f}</button>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        {chips.map((c, i) => (
          <button key={i} onClick={() => c.mult ? setMultPending(c.mult) : addPoints(c.pts)} className="py-3 px-2 border-[3px] border-[#1a1625] rounded bg-white font-bold text-sm shadow-[3px_3px_0_#1a1625] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]">
            <div>{c.label}</div>
            {c.pts && <div className="font-mono text-[#e63946] text-lg">{c.pts}</div>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={clearTally} className="py-4 border-[3px] border-[#1a1625] rounded bg-[#f5f1e8] font-black uppercase text-sm tracking-widest shadow-[3px_3px_0_#1a1625] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]">Clear</button>
        <button onClick={farkle} className="py-4 border-[3px] border-[#1a1625] rounded bg-[#e63946] text-white font-black uppercase text-sm tracking-widest shadow-[3px_3px_0_#1a1625] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]">Farkle</button>
        <button onClick={bank} disabled={turn.tally <= 0} className="py-4 border-[3px] border-[#1a1625] rounded bg-[#7cb342] text-white font-black uppercase text-sm tracking-widest shadow-[3px_3px_0_#1a1625] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] disabled:opacity-40">Bank</button>
      </div>
    </section>
  )
}

function Log({ entries, roster, database }) {
  const undo = async (doc) => { await database.del(doc._id) }
  const reset = async () => {
    if (!confirm("Reset entire game?")) return
    for (const e of entries) await database.del(e._id)
    await database.put({ _id: "active-turn", playerIdx: 0, tally: 0, hotDice: false })
  }

  return (
    <section className={classNames.feature}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={classNames.featureTitle}>Round Log</h2>
        {entries.length > 0 && <button onClick={reset} className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 border-[3px] border-[#1a1625] rounded bg-[#e63946] text-white">Reset Game</button>}
      </div>
      {entries.length === 0 && <div className="text-center py-6 text-[#6b6478] text-sm font-bold uppercase tracking-widest">No turns yet</div>}
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {entries.map(e => (
          <div key={e._id} className="flex items-center gap-2 p-2 border-[3px] border-[#1a1625] rounded bg-[#f5f1e8]">
            <div className="w-6 h-6 flex items-center justify-center border-[3px] border-[#1a1625] rounded bg-[#ffd23f] font-mono font-bold text-xs">{e.playerIdx + 1}</div>
            <div className="flex-1 font-bold text-sm truncate">{roster[e.playerIdx] || `P${e.playerIdx + 1}`}</div>
            {e.farkle && <div className="text-[10px] uppercase tracking-widest font-black text-[#e63946]">Farkle</div>}
            <div className={`font-mono font-black text-lg ${e.points < 0 ? "text-[#e63946]" : e.points === 0 ? "text-[#6b6478]" : "text-[#1a1625]"}`}>{e.points > 0 ? "+" : ""}{e.points}</div>
            <button onClick={() => undo(e)} className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 border-[3px] border-[#1a1625] rounded bg-white">Undo</button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("farkle-game-v1")

  const [roster, setRoster] = useState(() => loadLS(LS_ROSTER, ["Player 1", "Player 2"]))
  const [rules, setRules] = useState(() => ({ ...DEFAULT_RULES, ...loadLS(LS_RULES, {}) }))

  useEffect(() => { localStorage.setItem(LS_ROSTER, JSON.stringify(roster)) }, [roster])
  useEffect(() => { localStorage.setItem(LS_RULES, JSON.stringify(rules)) }, [rules])

  const { doc: turn, merge: mergeTurn, save: saveTurn } = useDocument({ _id: "active-turn", playerIdx: 0, tally: 0, hotDice: false })
  const { docs: entries } = useLiveQuery("type", { key: "entry", descending: true })

  const totals = roster.map((_, i) => entries.filter(e => e.playerIdx === i).reduce((s, e) => s + e.points, 0))
  const winner = totals.findIndex(t => t >= TARGET)

  return (
    <main className={classNames.page}>
      <header className={classNames.header}>
        <h1 className={classNames.title}>FARKLE</h1>
        <div className="text-xs uppercase tracking-widest text-[#6b6478] mt-1 font-mono">Target {TARGET}</div>
      </header>
      <Setup roster={roster} setRoster={setRoster} rules={rules} setRules={setRules} totals={totals} winner={winner} />
      <Turn roster={roster} rules={rules} turn={turn} mergeTurn={mergeTurn} saveTurn={saveTurn} database={database} totals={totals} winner={winner} />
      <Log entries={entries} roster={roster} database={database} />
    </main>
  )
}