import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const TRIP_ID = "trip:current"

function useTrip() {
  const { database, useDocument } = useFireproof("shotgun-shuffle")
  const { doc, merge, save } = useDocument({
    _id: TRIP_ID,
    type: "trip",
    name: "Our Road Trip",
    roster: [],
    legs: [],
    createdAt: Date.now(),
  })
  return { database, doc, merge, save }
}

function suggestNext(roster, legs) {
  if (!roster.length) return null
  const counts = Object.fromEntries(roster.map(n => [n, 0]))
  legs.forEach(l => { if (counts[l.shotgun] != null) counts[l.shotgun]++ })
  const lastSg = legs.length ? legs[legs.length - 1].shotgun : null
  let best = null
  roster.forEach(n => {
    if (n === lastSg && roster.length > 1) return
    if (!best || counts[n] < counts[best]) best = n
  })
  return best || roster[0]
}

const c = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-6 font-['Space_Grotesk',sans-serif]",
  shell: "max-w-[920px] mx-auto relative z-10",
  header: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-4 mb-6 shadow-[4px_4px_0px_oklch(0.15_0.02_280)] flex items-center justify-between",
  title: "text-2xl font-bold uppercase tracking-tight",
  feature: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-5 mb-6 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-3",
}

function TripSetup({ trip }) {
  const { database, doc } = trip
  const [name, setName] = useState("")
  const addRider = async () => {
    const n = name.trim()
    if (!n || doc.roster.includes(n)) return
    await database.put({ ...doc, roster: [...doc.roster, n] })
    setName("")
  }
  const removeRider = async (n) => {
    await database.put({ ...doc, roster: doc.roster.filter(r => r !== n) })
  }
  const suggestNames = async () => {
    const picks = ["Mara","Theo","Jules","Cass","Rin","Dev"].filter(x => !doc.roster.includes(x)).slice(0,4)
    if (picks.length) await database.put({ ...doc, roster: [...doc.roster, ...picks] })
  }
  return (
    <section id="trip-setup" className={c.feature}>
      <h2 className={c.featureTitle}>Trip & Roster</h2>
      <input
        value={doc.name}
        onChange={e => database.put({ ...doc, name: e.target.value })}
        placeholder="Trip name"
        className="w-full mb-3 p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-lg font-bold uppercase tracking-tight focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all"
      />
      <div className="flex gap-2 mb-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRider()}
          placeholder="Add a rider"
          className="flex-1 p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] focus:outline-none"
        />
        <button onClick={addRider} className="px-4 py-2 bg-[oklch(0.55_0.24_28)] text-white font-bold uppercase text-xs tracking-[0.08em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">Add</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {doc.roster.map((n, i) => {
          const colors = ["bg-[oklch(0.55_0.24_28)] text-white","bg-[oklch(0.85_0.18_85)]","bg-[oklch(0.62_0.19_145)]","bg-[oklch(0.52_0.18_255)] text-white"]
          return (
            <span key={n} className={`${colors[i%4]} px-3 py-1 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-sm font-bold uppercase tracking-[0.05em] flex items-center gap-2`}>
              {n}
              <button onClick={() => removeRider(n)} className="text-xs hover:underline">×</button>
            </span>
          )
        })}
        {!doc.roster.length && <span className="text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)]">No riders yet</span>}
      </div>
      {!doc.roster.length && (
        <button onClick={suggestNames} className="text-[0.7rem] uppercase tracking-[0.08em] font-bold px-3 py-1 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:bg-[oklch(0.85_0.18_85)] transition-all">
          ✨ Suggest sample riders
        </button>
      )}
    </section>
  )
}

function NextLeg({ trip }) {
  const { database, doc } = trip
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [override, setOverride] = useState("")
  const [showOverride, setShowOverride] = useState(false)
  const suggested = suggestNext(doc.roster, doc.legs)

  const logLeg = async (shotgun) => {
    if (!shotgun) return
    const leg = {
      from: from.trim() || "—",
      to: to.trim() || "—",
      shotgun,
      timestamp: Date.now(),
    }
    await database.put({ ...doc, legs: [...doc.legs, leg] })
    setFrom(""); setTo(""); setOverride(""); setShowOverride(false)
  }

  if (!doc.roster.length) {
    return (
      <section id="next-leg" className={c.feature}>
        <h2 className={c.featureTitle}>Next Leg</h2>
        <p className="text-sm text-[oklch(0.50_0.02_280)]">Add some riders above to start rotating shotgun.</p>
      </section>
    )
  }

  return (
    <section id="next-leg" className={c.feature}>
      <h2 className={c.featureTitle}>Next Leg — Suggested Shotgun</h2>
      <div className="bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-6 mb-4 shadow-[4px_4px_0px_oklch(0.15_0.02_280)] text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-2">Up front next</div>
        <div className="text-4xl font-bold uppercase tracking-tight">{suggested}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input value={from} onChange={e=>setFrom(e.target.value)} placeholder="From" className="p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-mono text-sm focus:outline-none"/>
        <input value={to} onChange={e=>setTo(e.target.value)} placeholder="To" className="p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-mono text-sm focus:outline-none"/>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => logLeg(suggested)} className="px-4 py-2 bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] font-bold uppercase text-xs tracking-[0.08em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          They Accept
        </button>
        <button onClick={() => setShowOverride(v => !v)} className="px-4 py-2 bg-white font-bold uppercase text-xs tracking-[0.08em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] transition-all">
          Override
        </button>
      </div>
      {showOverride && (
        <div className="mt-3 p-3 bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px]">
          <div className="text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-2">Pick someone else</div>
          <div className="flex flex-wrap gap-2">
            {doc.roster.map(n => (
              <button key={n} onClick={() => logLeg(n)} className={`px-3 py-1 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-sm font-bold uppercase ${n===suggested ? "bg-[oklch(0.85_0.18_85)]" : "bg-white"} hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] transition-all`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function History({ trip }) {
  const { database, doc } = trip
  const legs = [...doc.legs].reverse()
  const undo = async () => {
    if (!doc.legs.length) return
    await database.put({ ...doc, legs: doc.legs.slice(0, -1) })
  }
  return (
    <section id="history" className={c.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={c.featureTitle + " mb-0"}>Leg History</h2>
        {doc.legs.length > 0 && (
          <button onClick={undo} className="text-[0.65rem] uppercase tracking-[0.08em] font-bold px-2 py-1 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:bg-[oklch(0.85_0.18_85)] transition-all">Undo last</button>
        )}
      </div>
      {!legs.length ? (
        <p className="text-sm text-[oklch(0.50_0.02_280)]">No legs logged yet. The first shotgun is still up for grabs.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[oklch(0.15_0.02_280)]">
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] font-bold py-2">#</th>
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] font-bold py-2">Route</th>
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] font-bold py-2">Shotgun</th>
              <th className="text-left text-[0.6rem] uppercase tracking-[0.15em] font-bold py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((l, i) => (
              <tr key={l.timestamp} className="border-b border-[oklch(0.15_0.02_280)]/20 hover:bg-[oklch(0.85_0.18_85)] transition-colors">
                <td className="py-2 font-mono text-sm">{legs.length - i}</td>
                <td className="py-2 text-sm font-mono">{l.from} → {l.to}</td>
                <td className="py-2"><span className="bg-[oklch(0.62_0.19_145)] px-2 py-0.5 border-2 border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs font-bold uppercase">{l.shotgun}</span></td>
                <td className="py-2 font-mono text-xs text-[oklch(0.50_0.02_280)]">{new Date(l.timestamp).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Tally({ trip }) {
  const { doc } = trip
  const total = doc.legs.length
  const fair = doc.roster.length ? total / doc.roster.length : 0
  const rows = doc.roster.map(n => {
    const taken = doc.legs.filter(l => l.shotgun === n).length
    const owed = Math.max(0, Math.round((fair - taken) * 10) / 10)
    return { name: n, taken, owed }
  }).sort((a,b) => b.taken - a.taken)
  const max = Math.max(1, ...rows.map(r => r.taken))
  if (!doc.roster.length) return null
  return (
    <section id="tally" className={c.feature}>
      <h2 className={c.featureTitle}>Tally Board — Fair Share {fair.toFixed(1)}</h2>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const colors = ["bg-[oklch(0.55_0.24_28)]","bg-[oklch(0.85_0.18_85)]","bg-[oklch(0.62_0.19_145)]","bg-[oklch(0.52_0.18_255)]"]
          const textColor = i%4===0 || i%4===3 ? "text-white" : "text-[oklch(0.15_0.02_280)]"
          return (
            <div key={r.name} className="flex items-center gap-3">
              <div className="w-6 font-mono font-bold text-sm">#{i+1}</div>
              <div className="flex-1 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden bg-white relative h-9">
                <div className={`${colors[i%4]} h-full flex items-center px-3`} style={{width: `${(r.taken/max)*100}%`, minWidth: "2.5rem"}}>
                  <span className={`${textColor} font-bold uppercase text-xs tracking-[0.05em] truncate`}>{r.name}</span>
                </div>
              </div>
              <div className="font-mono text-sm w-24 text-right">
                <span className="font-bold">{r.taken}</span>
                <span className="text-[oklch(0.50_0.02_280)] text-xs"> taken</span>
              </div>
              <div className="font-mono text-xs w-16 text-right">
                {r.owed > 0 ? <span className="bg-[oklch(0.55_0.24_28)] text-white px-2 py-0.5 border-2 border-[oklch(0.15_0.02_280)] rounded-[4px] font-bold">+{r.owed}</span> : <span className="text-[oklch(0.50_0.02_280)]">even</span>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function App() {
  const trip = useTrip()
  return (
    <main id="app" className={c.page}>
      <div className={c.shell}>

        <TripSetup trip={trip} />
        <NextLeg trip={trip} />
        <History trip={trip} />
        <Tally trip={trip} />
      </div>
    </main>
  )
}