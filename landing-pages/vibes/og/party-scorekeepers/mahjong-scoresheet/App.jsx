import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const SEATS = ["E", "S", "W", "N"]
const WIND_NAMES = { E: "East", S: "South", W: "West", N: "North" }

const c = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-4 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  wrap: "max-w-3xl mx-auto",
  card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] p-4 mb-4",
  h1: "text-3xl font-bold uppercase tracking-tight mb-1",
  label: "text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] font-semibold",
  btn: "px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-semibold uppercase text-[0.75rem] tracking-[0.05em] bg-white shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  btnRed: "bg-[oklch(0.55_0.24_28)] text-white",
  btnYel: "bg-[oklch(0.85_0.18_85)]",
  btnGrn: "bg-[oklch(0.62_0.19_145)]",
  btnBlu: "bg-[oklch(0.52_0.18_255)] text-white",
  input: "w-full px-2 py-1.5 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white font-semibold focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] transition-all",
  mono: "font-['JetBrains_Mono',monospace]",
}

const SEAT_COLORS = {
  E: "bg-[oklch(0.55_0.24_28)] text-white",
  S: "bg-[oklch(0.85_0.18_85)]",
  W: "bg-[oklch(0.52_0.18_255)] text-white",
  N: "bg-[oklch(0.62_0.19_145)]",
}

// Faan -> base points (simple doubling table, capped)
function faanToBase(faan) {
  const f = Math.max(0, Math.min(13, parseInt(faan) || 0))
  if (f < 3) return f + 1
  return Math.min(96, Math.pow(2, f - 2) * 2)
}

function computeDeltas(hand, eastSeat, eastDouble) {
  const { winner, loser, faan, selfDraw } = hand
  const deltas = { E: 0, S: 0, W: 0, N: 0 }
  if (winner === "draw") return deltas
  const base = faanToBase(faan)
  const mult = (s) => (eastDouble && s === eastSeat ? 2 : 1)
  if (selfDraw) {
    // each of 3 losers pays base * their-mult (or winner-mult if winner is east)
    let winTotal = 0
    SEATS.forEach((s) => {
      if (s === winner) return
      const pay = base * Math.max(mult(winner), mult(s))
      deltas[s] -= pay
      winTotal += pay
    })
    deltas[winner] = winTotal
  } else {
    // discarder pays full (tripled)
    const pay = base * 3 * Math.max(mult(winner), mult(loser))
    deltas[loser] -= pay
    deltas[winner] = pay
  }
  return deltas
}

// Dealer rotation: East stays on East win; otherwise rotates E->S->W->N
function computeSessionState(hands) {
  let eastIdx = 0 // index into SEATS for current east
  let roundWind = 0 // 0=E,1=S,2=W,3=N
  let handInRound = 0
  for (const h of hands) {
    const eastSeat = SEATS[eastIdx]
    if (h.winner !== eastSeat) {
      eastIdx = (eastIdx + 1) % 4
      handInRound++
      if (handInRound >= 4) {
        handInRound = 0
        roundWind = (roundWind + 1) % 4
      }
    }
  }
  return { eastSeat: SEATS[eastIdx], prevailingWind: SEATS[roundWind] }
}

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function Scoreboard({ names, totals, eastSeat, prevailingWind }) {
  return (
    <div className={c.card}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className={c.label}>Prevailing Wind</div>
          <div className="text-xl font-bold uppercase">{WIND_NAMES[prevailingWind]}</div>
        </div>
        <div className="text-right">
          <div className={c.label}>Dealer (East)</div>
          <div className="text-xl font-bold uppercase">{names[eastSeat] || WIND_NAMES[eastSeat]}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SEATS.map((s) => {
          const isEast = s === eastSeat
          return (
            <div key={s} className={`border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-3 ${SEAT_COLORS[s]} ${isEast ? "shadow-[4px_4px_0px_oklch(0.15_0.02_280)]" : ""}`}>
              <div className="flex justify-between items-start">
                <div className="text-xs uppercase tracking-[0.1em] font-bold opacity-80">{WIND_NAMES[s]}</div>
                {isEast && <div className="text-[0.6rem] uppercase bg-white text-[oklch(0.15_0.02_280)] px-1.5 py-0.5 rounded-[2px] border-2 border-[oklch(0.15_0.02_280)] font-bold">Dealer</div>}
              </div>
              <div className="text-sm font-semibold truncate mt-1">{names[s] || "—"}</div>
              <div className={`${c.mono} text-2xl font-bold mt-1`}>{totals[s] >= 0 ? "+" : ""}{totals[s]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NameSetup({ names, setNames, eastDouble, setEastDouble }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={c.card}>
      <button onClick={() => setOpen(!open)} className={`${c.btn} w-full`}>
        {open ? "Hide" : "Edit"} Players & Settings
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {SEATS.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`${SEAT_COLORS[s]} w-10 h-10 flex items-center justify-center rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] font-bold`}>{s}</div>
              <input className={c.input} value={names[s] || ""} onChange={(e) => setNames({ ...names, [s]: e.target.value })} placeholder={WIND_NAMES[s]} />
            </div>
          ))}
          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input type="checkbox" checked={eastDouble} onChange={(e) => setEastDouble(e.target.checked)} className="w-5 h-5 accent-[oklch(0.62_0.19_145)]" />
            <span className="font-semibold text-sm uppercase tracking-[0.05em]">East doubled (wins/pays 2×)</span>
          </label>
        </div>
      )}
    </div>
  )
}

function HandEntry({ names, eastSeat, onSubmit }) {
  const [winner, setWinner] = useState("E")
  const [faan, setFaan] = useState(3)
  const [selfDraw, setSelfDraw] = useState(false)
  const [loser, setLoser] = useState("S")

  function submit() {
    if (winner !== "draw") {
      if (!selfDraw && loser === winner) {
        alert("Discarder can't be the winner")
        return
      }
    }
    onSubmit({
      winner,
      loser: winner === "draw" ? null : (selfDraw ? null : loser),
      selfDraw: winner !== "draw" && selfDraw,
      faan: winner === "draw" ? 0 : faan,
      ts: Date.now(),
      eastSeat,
    })
  }

  return (
    <div className={c.card}>
      <div className="text-lg font-bold uppercase mb-2">New Hand</div>
      <div className={c.label + " mb-1"}>Winner</div>
      <div className="grid grid-cols-5 gap-1 mb-3">
        {SEATS.map((s) => (
          <button key={s} onClick={() => setWinner(s)} className={`${c.btn} ${winner === s ? SEAT_COLORS[s] : ""} px-1`}>{s}</button>
        ))}
        <button onClick={() => setWinner("draw")} className={`${c.btn} ${winner === "draw" ? c.btnYel : ""} px-1`}>Draw</button>
      </div>

      {winner !== "draw" && (
        <>
          <div className={c.label + " mb-1"}>Faan / Han</div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setFaan(Math.max(1, faan - 1))} className={c.btn}>−</button>
            <div className={`${c.mono} text-2xl font-bold w-16 text-center`}>{faan}</div>
            <button onClick={() => setFaan(Math.min(13, faan + 1))} className={c.btn}>+</button>
            <div className={`${c.mono} text-sm text-[oklch(0.50_0.02_280)] ml-2`}>= {faanToBase(faan)} base</div>
          </div>

          <div className={c.label + " mb-1"}>Settlement</div>
          <div className="grid grid-cols-2 gap-1 mb-3">
            <button onClick={() => setSelfDraw(true)} className={`${c.btn} ${selfDraw ? c.btnGrn : ""}`}>Self-draw (3 pay)</button>
            <button onClick={() => setSelfDraw(false)} className={`${c.btn} ${!selfDraw ? c.btnRed : ""}`}>Discard (1 pays)</button>
          </div>

          {!selfDraw && (
            <>
              <div className={c.label + " mb-1"}>Discarder</div>
              <div className="grid grid-cols-4 gap-1 mb-3">
                {SEATS.filter((s) => s !== winner).map((s) => (
                  <button key={s} onClick={() => setLoser(s)} className={`${c.btn} ${loser === s ? SEAT_COLORS[s] : ""} px-1`}>{s}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button onClick={submit} className={`${c.btn} ${c.btnRed} w-full`}>Record Hand</button>
    </div>
  )
}

function HandLog({ hands, names, eastDouble, onDelete }) {
  if (hands.length === 0) return null
  return (
    <div className={c.card}>
      <div className="text-lg font-bold uppercase mb-2">Hand Log</div>
      <div className="space-y-2">
        {[...hands].reverse().map((h, idx) => {
          const deltas = computeDeltas(h, h.eastSeat, eastDouble)
          const when = new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          return (
            <div key={h._id} className="border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-2 bg-white">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs">
                  <span className={`${c.mono} font-bold`}>#{hands.length - idx}</span>
                  <span className="ml-2 text-[oklch(0.50_0.02_280)]">{when}</span>
                  <span className="ml-2 font-semibold uppercase text-[0.7rem]">
                    {h.winner === "draw" ? "Draw" : `${names[h.winner] || h.winner} wins ${h.faan}faan ${h.selfDraw ? "(self)" : `off ${names[h.loser] || h.loser}`}`}
                  </span>
                </div>
                <button onClick={() => onDelete(h._id)} className={`${c.btn} text-[0.65rem] px-2 py-1`}>×</button>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {SEATS.map((s) => (
                  <div key={s} className={`${c.mono} text-xs font-bold px-1 py-0.5 rounded-[2px] ${deltas[s] > 0 ? "bg-[oklch(0.62_0.19_145)]" : deltas[s] < 0 ? "bg-[oklch(0.55_0.24_28)] text-white" : "bg-[oklch(0.96_0.01_90)]"}`}>
                    {s}:{deltas[s] >= 0 ? "+" : ""}{deltas[s]}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("mahjong-session-v1")
  const { docs: hands } = useLiveQuery("ts", { descending: false })

  const [names, setNames] = useState(() => loadLocal("mj-names", { E: "", S: "", W: "", N: "" }))
  const [eastDouble, setEastDouble] = useState(() => loadLocal("mj-eastDouble", true))

  useEffect(() => { localStorage.setItem("mj-names", JSON.stringify(names)) }, [names])
  useEffect(() => { localStorage.setItem("mj-eastDouble", JSON.stringify(eastDouble)) }, [eastDouble])

  const handDocs = hands.filter((d) => d.type === "hand")
  const { eastSeat, prevailingWind } = computeSessionState(handDocs)

  const totals = { E: 0, S: 0, W: 0, N: 0 }
  handDocs.forEach((h) => {
    const d = computeDeltas(h, h.eastSeat, eastDouble)
    SEATS.forEach((s) => { totals[s] += d[s] })
  })

  async function addHand(h) { await database.put({ type: "hand", ...h }) }
  async function delHand(id) { await database.del(id) }
  async function resetSession() {
    if (!confirm("Clear all hands?")) return
    for (const h of handDocs) await database.del(h._id)
  }

  return (
    <main className={c.page}>
      <div className={c.wrap}>
        <header className="mb-4">
          <h1 className={c.h1}>Mahjong Scoresheet</h1>
          <div className={c.label}>{handDocs.length} hand{handDocs.length === 1 ? "" : "s"} played · live sync</div>
        </header>

        <Scoreboard names={names} totals={totals} eastSeat={eastSeat} prevailingWind={prevailingWind} />
        <NameSetup names={names} setNames={setNames} eastDouble={eastDouble} setEastDouble={setEastDouble} />
        <HandEntry names={names} eastSeat={eastSeat} onSubmit={addHand} />
        <HandLog hands={handDocs} names={names} eastDouble={eastDouble} onDelete={delHand} />

        {handDocs.length > 0 && (
          <button onClick={resetSession} className={`${c.btn} w-full`}>Reset Session</button>
        )}
      </div>
    </main>
  )
}