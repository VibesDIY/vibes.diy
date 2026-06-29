import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function VocabStash({ database, c, useLiveQuery }) {
  const [term, setTerm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const { docs } = useLiveQuery("type", { key: "vocab", descending: true, limit: 10 })
  async function lookup(t) {
    if (!t.trim()) return
    setLoading(true)
    try {
      const res = await callAI(`Explain the climate term "${t}" in 2 sentences, casual tone for a teenager. Then one sentence on why it matters.`, {
        schema: { properties: { definition: { type: "string" }, whyItMatters: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      await database.put({ type: "vocab", term: t, definition: parsed.definition, whyItMatters: parsed.whyItMatters, createdAt: Date.now() })
      setTerm("")
    } finally { setLoading(false) }
  }
  const Spinner = () => <svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" /></svg>
  return (
    <>
      <div className="flex gap-2 mb-3">
        <input className={c.input} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. mitigation, carbon pricing, grid mix" />
        <button className={c.btnAlt} disabled={loading} onClick={() => lookup(term)}>{loading ? <Spinner /> : "Look up"}</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {["Mitigation vs adaptation", "Carbon pricing", "Grid mix", "Scope 3 emissions"].map(p => (
          <button key={p} className={c.btnGhost} disabled={loading} onClick={() => lookup(p)}>{p}</button>
        ))}
      </div>
      <ul className="space-y-2">
        {docs.map(d => (
          <li key={d._id} className="border-[3px] border-[#1a1a2e] rounded-[4px] p-3 bg-[#eef4fb]">
            <div className="font-bold text-sm uppercase tracking-[0.04em]">{d.term}</div>
            <p className="text-[0.78rem] mt-1 leading-relaxed">{d.definition}</p>
            <p className="text-[0.72rem] mt-2 text-[#2b6cb0] italic">Why: {d.whyItMatters}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function ScenarioRunner({ database, hh, c, useLiveQuery }) {
  const [q, setQ] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const { docs } = useLiveQuery("type", { key: "scenario", descending: true, limit: 8 })
  async function run(prompt) {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const ctx = `Household: ${hh.people} people, ${hh.carMiles} car mi/wk, ${hh.flights} flights/yr, ${hh.heating} heat, ${hh.diet} diet.`
      const res = await callAI(`${ctx} Scenario: "${prompt}". Estimate the change in annual tons CO₂e (positive = less emissions). One short explanation sentence.`, {
        schema: { properties: { deltaTons: { type: "number" }, explanation: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      await database.put({ type: "scenario", prompt, deltaTons: parsed.deltaTons, explanation: parsed.explanation, createdAt: Date.now() })
      setQ("")
    } finally { setLoading(false) }
  }
  const Spinner = () => <svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" /></svg>
  return (
    <>
      <div className="flex gap-2 mb-3">
        <input className={c.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What if I biked to school?" />
        <button className={c.btnAlt} disabled={loading} onClick={() => run(q)}>{loading ? <Spinner /> : "Run"}</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {["Vegetarian for a year", "Switch to heat pump", "Skip one transatlantic flight"].map(p => (
          <button key={p} className={c.btnGhost} disabled={loading} onClick={() => run(p)}>{p}</button>
        ))}
      </div>
      <ul className="space-y-2">
        {docs.map(d => (
          <li key={d._id} className="border-[3px] border-[#1a1a2e] rounded-[4px] p-3 bg-[#f7f4ec]">
            <div className="flex justify-between items-start gap-2">
              <span className="font-bold text-sm">{d.prompt}</span>
              <span className={`${c.pill}`} style={{ background: d.deltaTons > 0 ? "#3fa34d" : "#e34a2b", color: "white" }}>
                {d.deltaTons > 0 ? "−" : "+"}{Math.abs(d.deltaTons).toFixed(2)} t
              </span>
            </div>
            <p className="text-[0.75rem] mt-2 text-[#1a1a2e] leading-relaxed">{d.explanation}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("footprint-lab")
  const { doc: hh, merge: mergeHH, save: saveHH } = useDocument({ _id: "household", people: 3, carMiles: 120, flights: 2, heating: "Gas", diet: "Mixed", purchases: 3 })

  const c = {
    page: "min-h-screen bg-[#f7f4ec] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]",
    header: "border-b-[3px] border-[#1a1a2e] bg-[#fff] px-5 py-4 shadow-[0_4px_0_0_#1a1a2e]",
    brand: "flex items-center gap-3",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[2px] border-[#1a1a2e]",
    title: "text-xl font-bold uppercase tracking-tight",
    tagline: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b80] mt-1",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-5",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0_0_#1a1a2e] p-5",
    sectionBarRed: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#e34a2b]",
    sectionBarYellow: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#f0c419]",
    sectionBarGreen: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#3fa34d]",
    sectionBarBlue: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#2b6cb0]",
    h2: "text-lg font-bold uppercase tracking-tight mb-1",
    sublabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b80] mb-4",
    btn: "border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase text-[0.75rem] tracking-[0.06em] min-h-[44px] bg-[#e34a2b] text-white shadow-[3px_3px_0_0_#1a1a2e] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all",
    btnAlt: "border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-3 font-bold uppercase text-[0.75rem] tracking-[0.06em] min-h-[44px] bg-[#f0c419] text-[#1a1a2e] shadow-[3px_3px_0_0_#1a1a2e] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all",
    btnGhost: "border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 font-bold uppercase text-[0.7rem] tracking-[0.06em] bg-white text-[#1a1a2e] hover:shadow-[3px_3px_0_0_#1a1a2e] transition-all",
    input: "w-full border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 bg-white font-['JetBrains_Mono',monospace] text-sm",
    pill: "inline-block border-[3px] border-[#1a1a2e] rounded-[4px] px-2 py-1 text-[0.65rem] uppercase tracking-[0.1em] font-bold",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.logoDots}>
            <div className={c.dot} style={{ background: '#e34a2b' }} />
            <div className={c.dot} style={{ background: '#f0c419' }} />
            <div className={c.dot} style={{ background: '#3fa34d' }} />
          </div>
          <div>
            <div className={c.title}>Footprint Lab</div>
            <div className={c.tagline}>Order-of-magnitude · not guilt</div>
          </div>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="household" className={c.section}>
          <div className={c.sectionBarRed} />
          <h2 className={c.h2}>Your Household, Roughly</h2>
          <div className={c.sublabel}>Fill in ballparks — precision doesn't matter</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">People</span>
              <input className={c.input} type="number" value={hh.people} onChange={(e) => mergeHH({ people: +e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">Car miles / week</span>
              <input className={c.input} type="number" value={hh.carMiles} onChange={(e) => mergeHH({ carMiles: +e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">Flights / year</span>
              <input className={c.input} type="number" value={hh.flights} onChange={(e) => mergeHH({ flights: +e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">Heating fuel</span>
              <select className={c.input} value={hh.heating} onChange={(e) => mergeHH({ heating: e.target.value })}><option>Gas</option><option>Electric</option><option>Heat pump</option><option>Oil</option></select>
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">Diet</span>
              <select className={c.input} value={hh.diet} onChange={(e) => mergeHH({ diet: e.target.value })}><option>Mixed</option><option>Lots of meat</option><option>Vegetarian</option><option>Vegan</option></select>
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-bold">Big purchases / yr</span>
              <input className={c.input} type="number" value={hh.purchases} onChange={(e) => mergeHH({ purchases: +e.target.value })} />
            </label>
          </div>
          <button className={`${c.btn} mt-4 w-full`} onClick={saveHH}>Save Household</button>
        </section>
        <section id="breakdown" className={c.section}>
          <div className={c.sectionBarYellow} />
          <h2 className={c.h2}>Where It Actually Comes From</h2>
          <div className={c.sublabel}>Tons CO₂e / year · rough order of magnitude</div>
          <div className="space-y-3">
            {(() => {
              const dietFactor = { "Lots of meat": 3.3, "Mixed": 2.5, "Vegetarian": 1.7, "Vegan": 1.5 }[hh.diet] || 2.5
              const heatFactor = { "Gas": 2.8, "Oil": 3.5, "Electric": 2.0, "Heat pump": 0.8 }[hh.heating] || 2.5
              const cats = [
                { name: "Driving", tons: +(hh.carMiles * 52 * 0.00040).toFixed(2), color: "#e34a2b" },
                { name: "Flying", tons: +(hh.flights * 0.8).toFixed(2), color: "#2b6cb0" },
                { name: "Home heating", tons: heatFactor, color: "#f0c419" },
                { name: "Diet", tons: dietFactor, color: "#3fa34d" },
                { name: "Stuff bought", tons: +(hh.purchases * 0.3).toFixed(2), color: "#7c3aed" },
              ]
              const max = Math.max(...cats.map(x => x.tons), 1)
              return cats.map(cat => (
                <div key={cat.name}>
                  <div className="flex justify-between text-[0.75rem] font-bold uppercase tracking-[0.06em] mb-1">
                    <span>{cat.name}</span><span className="font-['JetBrains_Mono',monospace]">{cat.tons} t</span>
                  </div>
                  <div className="border-[3px] border-[#1a1a2e] h-5 bg-white">
                    <div style={{ width: `${(cat.tons / max) * 100}%`, background: cat.color, height: "100%" }} />
                  </div>
                </div>
              ))
            })()}
          </div>
          <p className="text-[0.75rem] mt-4 text-[#6b6b80] leading-relaxed">One transatlantic flight ≈ <b>1.6 tons</b>. A year of recycling ≈ <b>0.05 tons</b>. Scale matters.</p>
        </section>
        <section id="scenarios" className={c.section}>
          <div className={c.sectionBarGreen} />
          <h2 className={c.h2}>What If?</h2>
          <div className={c.sublabel}>Spin up a hypothetical · save it · compare later</div>
          <ScenarioRunner database={database} hh={hh} c={c} useLiveQuery={useLiveQuery} />
        </section>
        <section id="vocab" className={c.section}>
          <div className={c.sectionBarBlue} />
          <h2 className={c.h2}>Vocab Stash</h2>
          <div className={c.sublabel}>Climate words · explained casually · saved for later</div>
          <VocabStash database={database} c={c} useLiveQuery={useLiveQuery} />
        </section>
        <section id="policy" className={c.section}>
          <div className={c.sectionBarRed} />
          <h2 className={c.h2}>Bigger Than You</h2>
          <div className={c.sublabel}>Most of your footprint is downstream of systems</div>
          <p className="text-[0.82rem] leading-relaxed mb-3">
            Your home heating is shaped by <b>building codes</b>. Your car miles are shaped by <b>zoning and transit</b>.
            Your electricity emissions are shaped by your <b>grid mix</b> — and that is decided by utilities and regulators, not you.
          </p>
          <p className="text-[0.82rem] leading-relaxed mb-4">
            Individual choices are real but bounded. The bigger lever is <b>energy transition policy</b>: who builds what, who's allowed to burn what, who pays.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={c.pill} style={{ background: "#e34a2b", color: "white" }}>Vote local</span>
            <span className={c.pill} style={{ background: "#f0c419" }}>Public comment</span>
            <span className={c.pill} style={{ background: "#3fa34d", color: "white" }}>Talk to people</span>
            <span className={c.pill} style={{ background: "#2b6cb0", color: "white" }}>Join a group</span>
          </div>
        </section>
      </main>
    </div>
  )
}