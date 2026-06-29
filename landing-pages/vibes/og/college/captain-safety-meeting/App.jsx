import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("captain-safety-meeting")
  const [me, setMe] = React.useState(() => localStorage.getItem("csm-me") || "")
  const [day, setDay] = React.useState("Today")
  const [orders, setOrders] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  const { doc: joinDoc, merge: mergeJoin, submit: submitJoin } = useDocument({
    type: "crew",
    name: "",
    vibe: "Down for whatever",
    createdAt: Date.now()
  })

  const { docs: crew } = useLiveQuery("type", { key: "crew" })
  const { docs: votes } = useLiveQuery("type", { key: "vote" })

  const slots = ["6 PM","7 PM","8 PM","9 PM","10 PM","11 PM","12 AM","1 AM"]

  function countFor(slot) {
    return votes.filter(v => v.day === day && v.slot === slot).length
  }
  function iAmIn(slot) {
    return votes.some(v => v.day === day && v.slot === slot && v.who === me)
  }
  const best = slots.map(s => ({ slot: s, n: countFor(s) })).sort((a,b)=>b.n-a.n)[0]

  function handleJoin(e) {
    e.preventDefault()
    if (!joinDoc.name.trim()) return
    localStorage.setItem("csm-me", joinDoc.name)
    setMe(joinDoc.name)
    submitJoin()
  }
  async function handleToggleSlot(slot) {
    if (!me) return
    const existing = votes.find(v => v.day === day && v.slot === slot && v.who === me)
    if (existing) await database.del(existing._id)
    else await database.put({ type: "vote", who: me, day, slot, createdAt: Date.now() })
  }
  async function handleSummon() {
    if (!best || best.n < 1) return
    setIsLoading(true)
    try {
      const res = await callAI(`Write a chaotic, funny, slightly conspiratorial rallying cry for a friend group meeting at ${best.slot} ${day}. Pirate captain energy meets dorm chaos. One short paragraph, no emojis.`, {
        schema: { properties: { cry: { type: "string" } } }
      })
      setOrders(JSON.parse(res).cry)
    } finally { setIsLoading(false) }
  }

  const c = {
    page: "min-h-screen pb-32 bg-[#f5f3ec] text-[#16151f]",
    header: "px-5 py-6 border-b-[3px] border-[#16151f] bg-white",
    headerInner: "max-w-[920px] mx-auto flex items-center justify-between gap-3",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px] border-[#16151f]",
    brand: "text-lg font-bold uppercase tracking-tight",
    headerMeta: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6878] font-bold",
    main: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-6",
    hero: "relative border-[3px] border-[#16151f] bg-[#16151f] p-6 md:p-8 shadow-[6px_6px_0_#d33a2c]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitle: "text-3xl md:text-5xl font-bold uppercase tracking-tight leading-none text-[#e8c547] [text-shadow:5px_5px_0_rgba(211,58,44,0.8)]",
    heroSub: "mt-3 text-sm md:text-base text-[#cccdc8]",
    heroRow: "mt-5 flex flex-wrap gap-3",
    pill: "px-3 py-2 border-[3px] border-[#16151f] text-[0.7rem] uppercase tracking-[0.08em] font-bold bg-[#e8c547] shadow-[3px_3px_0_#16151f]",
    section: "border-[3px] border-[#16151f] bg-white p-5 shadow-[4px_4px_0_#16151f]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold mb-2 text-[#6b6878]",
    sectionTitle: "text-xl font-bold uppercase tracking-tight mb-4",
    joinForm: "flex flex-col sm:flex-row gap-3",
    input: "flex-1 px-4 py-3 border-[3px] border-[#16151f] bg-white text-base min-h-[44px] focus:outline-none focus:shadow-[3px_3px_0_#16151f] focus:-translate-x-[2px] focus:-translate-y-[2px] transition",
    select: "px-4 py-3 border-[3px] border-[#16151f] bg-white text-base min-h-[44px]",
    btnPrimary: "px-5 py-3 border-[3px] border-[#16151f] bg-[#d33a2c] text-white font-bold uppercase tracking-[0.08em] text-sm min-h-[44px] shadow-[4px_4px_0_#16151f] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#16151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition",
    btnSecondary: "px-5 py-3 border-[3px] border-[#16151f] bg-[#e8c547] text-[#16151f] font-bold uppercase tracking-[0.08em] text-sm min-h-[44px] shadow-[3px_3px_0_#16151f]",
    btnGhost: "px-4 py-2 border-[3px] border-[#16151f] bg-white font-bold uppercase tracking-[0.05em] text-xs hover:shadow-[3px_3px_0_#16151f]",
    crewGrid: "grid grid-cols-2 md:grid-cols-3 gap-3",
    crewCard: "border-[3px] border-[#16151f] bg-white p-3 flex items-center gap-3 shadow-[3px_3px_0_#16151f]",
    avatar: "w-10 h-10 border-[3px] border-[#16151f] bg-[#3a6dd3] text-white flex items-center justify-center font-bold",
    crewMeta: "flex flex-col",
    crewName: "text-sm font-bold uppercase tracking-tight",
    crewVibe: "text-[0.65rem] uppercase tracking-[0.1em] text-[#6b6878]",
    slotsHeader: "flex items-center justify-between mb-4 flex-wrap gap-2",
    dayTabs: "flex gap-2 overflow-x-auto",
    dayTab: "px-3 py-2 border-[3px] border-[#16151f] bg-white text-[0.7rem] uppercase tracking-[0.08em] font-bold whitespace-nowrap shadow-[3px_3px_0_#16151f]",
    slotsGrid: "grid grid-cols-3 sm:grid-cols-4 gap-2",
    slot: "border-[3px] border-[#16151f] bg-white p-3 text-center min-h-[64px] flex flex-col items-center justify-center gap-1 shadow-[3px_3px_0_#16151f] hover:bg-[#e8c547] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_#16151f] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition",
    slotTime: "text-sm font-bold",
    slotCount: "text-[0.6rem] uppercase tracking-[0.1em] text-[#6b6878]",
    overlapCard: "border-[3px] border-[#16151f] bg-white p-5 shadow-[6px_6px_0_#16151f]",
    overlapBar: "h-2 mb-4 bg-gradient-to-r from-[#d33a2c] via-[#e8c547] to-[#3aa856]",
    overlapTime: "text-2xl md:text-3xl font-bold uppercase tracking-tight",
    overlapMeta: "text-[0.7rem] uppercase tracking-[0.1em] mt-1 text-[#6b6878]",
    callout: "mt-4 border-[3px] border-[#16151f] bg-[#3a6dd3] text-white p-4 text-sm shadow-[3px_3px_0_#16151f]",
    actionBar: "fixed bottom-0 left-0 right-0 border-t-[3px] border-[#16151f] bg-white px-4 py-3 shadow-[0_-4px_0_#16151f]",
    actionBarInner: "max-w-[920px] mx-auto flex gap-3 items-center justify-between",
    footer: "text-center text-[0.65rem] uppercase tracking-[0.15em] py-4"
  }

  return (
    <div id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div className={c.logo}>
            <div className={c.logoDots}>
              <span className={`${c.dot} bg-[#d33a2c]`} />
              <span className={`${c.dot} bg-[#e8c547]`} />
              <span className={`${c.dot} bg-[#3aa856]`} />
            </div>
            <span className={c.brand}>Captain Safety Meeting</span>
          </div>
          <span className={c.headerMeta}>Crew · {crew.length} aboard</span>
        </div>
      </header>

      <main className={c.main}>
        <section id="hero" className={c.hero}>
          <div className={c.heroBar}>
            <span className={`${c.heroBarSeg} bg-[#d33a2c]`} />
            <span className={`${c.heroBarSeg} bg-[#e8c547]`} />
            <span className={`${c.heroBarSeg} bg-[#3aa856]`} />
            <span className={`${c.heroBarSeg} bg-[#3a6dd3]`} />
          </div>
          <h1 className={c.heroTitle}>Assemble The Crew</h1>
          <p className={c.heroSub}>Tap when you're around. We'll find the sacred overlap before someone falls asleep.</p>
          <div className={c.heroRow}>
            <span className={c.pill}>No Calendars</span>
            <span className={c.pill}>No Pressure</span>
            <span className={c.pill}>Just Vibes</span>
          </div>
        </section>

        <section id="join">
          <div className={c.section}>
            <div className={c.sectionLabel}>Step One</div>
            <h2 className={c.sectionTitle}>Board The Ship</h2>
            <form className={c.joinForm} onSubmit={handleJoin}>
              <input className={c.input} placeholder="Your name, captain" value={joinDoc.name} onChange={e => mergeJoin({ name: e.target.value })} />
              <select className={c.select} value={joinDoc.vibe} onChange={e => mergeJoin({ vibe: e.target.value })}>
                <option>Down for whatever</option>
                <option>Maybe, ping me</option>
                <option>Need convincing</option>
              </select>
              <button type="submit" className={c.btnPrimary}>{me ? "Update" : "Hop Aboard"}</button>
            </form>
          </div>
        </section>

        <section id="crew">
          <div className={c.section}>
            <div className={c.sectionLabel}>Roll Call</div>
            <h2 className={c.sectionTitle}>Who's Aboard</h2>
            <div className={c.crewGrid}>
              {crew.length === 0 && (
                <div className={c.crewCard}>
                  <div className={c.avatar}>?</div>
                  <div className={c.crewMeta}>
                    <span className={c.crewName}>Nobody yet</span>
                    <span className={c.crewVibe}>The deck is empty</span>
                  </div>
                </div>
              )}
              {crew.map(p => (
                <div key={p._id} className={c.crewCard}>
                  <div className={c.avatar}>{(p.name||"?").charAt(0).toUpperCase()}</div>
                  <div className={c.crewMeta}>
                    <span className={c.crewName}>{p.name}</span>
                    <span className={c.crewVibe}>{p.vibe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="slots">
          <div className={c.section}>
            <div className={c.slotsHeader}>
              <div>
                <div className={c.sectionLabel}>Step Two</div>
                <h2 className={c.sectionTitle}>Tap When You're Around</h2>
              </div>
              <div className={c.dayTabs}>
                {["Today","Tomorrow","Friday","Saturday"].map(d => (
                  <button key={d} onClick={() => setDay(d)} className={c.dayTab} style={day===d?{background:"#e8c547"}:{}}>{d}</button>
                ))}
              </div>
            </div>
            <div className={c.slotsGrid}>
              {slots.map(s => {
                const n = countFor(s)
                const mine = iAmIn(s)
                return (
                  <button key={s} className={c.slot} onClick={() => handleToggleSlot(s)} style={mine?{background:"#3aa856",color:"white"}:{}}>
                    <span className={c.slotTime}>{s}</span>
                    <span className={c.slotCount} style={mine?{color:"white"}:{}}>{n} in</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section id="overlap">
          <div className={c.overlapCard}>
            <div className={c.overlapBar} />
            <div className={c.sectionLabel}>The Sacred Overlap</div>
            <div className={c.overlapTime}>{best && best.n > 0 ? `${best.slot} · ${day}` : "Awaiting Crew"}</div>
            <div className={c.overlapMeta}>{best && best.n > 0 ? `${best.n} soul${best.n>1?"s":""} locked in` : "Tap some hours to start the magic"}</div>
            <div className={c.callout}>{orders || "The captain has not yet spoken. Get a few people aboard and the orders will arrive."}</div>
          </div>
        </section>
      </main>

      <div id="action-bar" className={c.actionBar}>
        <div className={c.actionBarInner}>
          <span className={c.headerMeta}>{me ? `Aboard as ${me}` : "Hop aboard first"}</span>
          <button className={c.btnPrimary} onClick={handleSummon} disabled={isLoading}>
            {isLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{animation:"spin 0.8s linear infinite"}}><circle cx="12" cy="12" r="9" strokeDasharray="42 60" strokeLinecap="round"/></svg>
            ) : "Summon The Crew"}
          </button>
        </div>
      </div>

      <footer className={c.footer}>Stay safe out there</footer>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}