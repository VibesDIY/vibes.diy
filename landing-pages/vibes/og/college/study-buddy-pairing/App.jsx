import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("studymatch")
  const [meId] = React.useState(() => {
    const k = "studymatch-me"
    let v = localStorage.getItem(k)
    if (!v) { v = "u-" + Math.random().toString(36).slice(2, 9); localStorage.setItem(k, v) }
    return v
  })
  const { doc: form, merge: mergeForm, reset: resetForm } = useDocument({
    type: "ready", userId: meId, name: "", subject: "", mode: "silent", createdAt: 0
  })
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [isPairing, setIsPairing] = React.useState(false)
  const [tick, setTick] = React.useState(0)

  const { docs: readyDocs } = useLiveQuery("type", { key: "ready", descending: true })
  const { docs: sessionDocs } = useLiveQuery("type", { key: "session", descending: true })
  const activeSession = sessionDocs.find(s => !s.endedAt && (s.userA === meId || s.userB === meId))

  React.useEffect(() => {
    if (!activeSession) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeSession])

  async function handleReadySubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.subject.trim()) return
    const existing = readyDocs.find(d => d.userId === meId)
    await database.put({
      ...(existing || {}),
      _id: existing?._id,
      type: "ready", userId: meId, name: form.name, subject: form.subject,
      mode: form.mode, createdAt: Date.now()
    })
  }

  async function handlePair() {
    setIsPairing(true)
    try {
      const me = readyDocs.find(d => d.userId === meId)
      if (!me) return
      const candidates = readyDocs.filter(d => d.userId !== meId && !sessionDocs.some(s => !s.endedAt && (s.userA === d.userId || s.userB === d.userId)))
      if (candidates.length === 0) return
      const partner = candidates[Math.floor(Math.random() * candidates.length)]
      await database.put({
        type: "session", userA: meId, userB: partner.userId,
        nameA: me.name, nameB: partner.name,
        subjectA: me.subject, subjectB: partner.subject,
        startedAt: Date.now(), endedAt: null, durationMs: 25 * 60 * 1000
      })
    } finally { setIsPairing(false) }
  }

  async function handleFinish() {
    if (!activeSession) return
    await database.put({ ...activeSession, endedAt: Date.now() })
  }

  async function handleSuggestSubject() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Suggest one specific, concrete study topic a college student might tackle in a 25-minute focused sprint. Be playful and specific.", {
        schema: { properties: { subject: { type: "string" } } }
      })
      const { subject } = JSON.parse(r)
      mergeForm({ subject })
    } finally { setIsSuggesting(false) }
  }

  function fmtTime(ms) {
    if (ms < 0) ms = 0
    const s = Math.floor(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  }

  const remaining = activeSession ? (activeSession.startedAt + activeSession.durationMs) - Date.now() : 25 * 60 * 1000
  const partnerName = activeSession ? (activeSession.userA === meId ? activeSession.nameB : activeSession.nameA) : null

  const streaks = {}
  sessionDocs.filter(s => s.endedAt && (s.userA === meId || s.userB === meId)).forEach(s => {
    const partner = s.userA === meId ? s.nameB : s.nameA
    streaks[partner] = (streaks[partner] || 0) + 1
  })
  const streakList = Object.entries(streaks).sort((a, b) => b[1] - a[1])

  const c = {
    page: "min-h-screen pb-32 bg-[#f5f3ee] text-[#15151f]",
    header: "px-5 pt-6 pb-4 border-b-[3px] border-[#15151f] bg-[#f4d35e]",
    brandRow: "flex items-center gap-2 mb-3",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    brandText: "text-sm font-bold tracking-widest uppercase",
    title: "text-3xl font-bold uppercase tracking-tight leading-none",
    subtitle: "text-xs uppercase tracking-widest mt-2",
    main: "px-5 py-5 space-y-5 max-w-[920px] mx-auto",
    section: "border-[3px] border-[#15151f] bg-white p-4 shadow-[4px_4px_0px_#15151f]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-3 font-semibold text-[#6b6b78]",
    sectionTitle: "text-xl font-bold uppercase tracking-tight mb-3",
    formRow: "flex flex-col gap-2 mb-3",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold",
    input: "border-[3px] border-[#15151f] bg-white px-3 py-3 text-base min-h-[44px] focus:outline-none focus:shadow-[3px_3px_0px_#15151f] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all",
    select: "border-[3px] border-[#15151f] bg-white px-3 py-3 text-base min-h-[44px]",
    energyRow: "grid grid-cols-2 gap-2",
    energyChip: "border-[3px] border-[#15151f] bg-white text-[#15151f] px-3 py-3 text-xs uppercase tracking-widest font-bold min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    suggestBtn: "text-[0.65rem] uppercase tracking-widest underline self-start text-[#e63946] font-bold",
    primaryBtn: "w-full border-[3px] border-[#15151f] bg-[#e63946] text-white px-4 py-4 font-bold uppercase tracking-widest min-h-[52px] shadow-[4px_4px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60",
    boardGrid: "grid grid-cols-1 md:grid-cols-2 gap-3",
    studentCard: "border-[3px] border-[#15151f] bg-white p-3 flex flex-col gap-1 shadow-[3px_3px_0px_#15151f]",
    studentName: "font-bold uppercase tracking-tight",
    studentMeta: "text-xs text-[#6b6b78]",
    badgeRow: "flex gap-2 flex-wrap mt-1",
    badge: "text-[0.6rem] uppercase tracking-widest px-2 py-1 border-[3px] border-[#15151f] font-bold bg-[#f4d35e]",
    pairCard: "border-[3px] border-[#15151f] bg-[#3a86ff] text-white p-5 text-center shadow-[4px_4px_0px_#15151f]",
    timer: "text-6xl font-bold tabular-nums my-3",
    pairBtnRow: "flex gap-2 mt-3",
    secondaryBtn: "flex-1 border-[3px] border-[#15151f] bg-white text-[#15151f] px-3 py-3 font-bold uppercase tracking-widest text-xs min-h-[44px] shadow-[3px_3px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    streakRow: "flex items-center justify-between border-[3px] border-[#15151f] bg-white p-3 mb-2 shadow-[3px_3px_0px_#15151f]",
    streakName: "font-bold uppercase",
    streakCount: "font-bold tabular-nums text-lg text-[#2a9d3f]",
    bottomBar: "fixed bottom-0 left-0 right-0 border-t-[3px] border-[#15151f] p-3 bg-white shadow-[0_-4px_0_#15151f]"
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brandRow}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#e63946] border-[#15151f]`}></span>
            <span className={`${c.dot} bg-[#3a86ff] border-[#15151f]`}></span>
            <span className={`${c.dot} bg-[#2a9d3f] border-[#15151f]`}></span>
          </div>
          <span className={c.brandText}>StudyMatch</span>
        </div>
        <h1 className={c.title}>Pair Up. Lock In.</h1>
        <p className={c.subtitle}>Random study sprints with nearby brains</p>
      </header>

      <main id="app" className={c.main}>
        <section id="ready-form" className={c.section}>
          <div className={c.sectionLabel}>Your status</div>
          <h2 className={c.sectionTitle}>Mark Yourself Ready</h2>
          <form onSubmit={handleReadySubmit}>
            <div className={c.formRow}>
              <label className={c.label}>Your name</label>
              <input className={c.input} placeholder="e.g. Alex K." value={form.name} onChange={e => mergeForm({ name: e.target.value })} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>Studying</label>
              <input className={c.input} placeholder="e.g. Linear algebra ch.4" value={form.subject} onChange={e => mergeForm({ subject: e.target.value })} />
              <button type="button" className={c.suggestBtn} onClick={handleSuggestSubject} disabled={isSuggesting}>
                {isSuggesting ? "✦ Thinking..." : "✦ Suggest a subject"}
              </button>
            </div>
            <div className={c.formRow}>
              <label className={c.label}>Energy mode</label>
              <div className={c.energyRow}>
                <button type="button" onClick={() => mergeForm({ mode: "silent" })} className={c.energyChip} style={form.mode === "silent" ? {background:"#2a9d3f",color:"white"} : {color:"#15151f"}}>Silent focus</button>
                <button type="button" onClick={() => mergeForm({ mode: "chaos" })} className={c.energyChip} style={form.mode === "chaos" ? {background:"#e63946",color:"white"} : {color:"#15151f"}}>Collab chaos</button>
              </div>
            </div>
            <button type="submit" className={c.primaryBtn}>I'm Ready →</button>
          </form>
        </section>

        <section id="pair-sprint" className={c.section}>
          <div className={c.sectionLabel}>Active sprint</div>
          <h2 className={c.sectionTitle}>Sprint Timer</h2>
          <div className={c.pairCard}>
            <p className="text-xs uppercase tracking-widest font-bold">
              {activeSession ? `Paired with ${partnerName}` : "No active pair"}
            </p>
            <div className={c.timer}>{fmtTime(remaining)}</div>
            <p className="text-xs uppercase tracking-widest">
              {activeSession ? "Lock in. You got this." : "Tap pair me to find a partner"}
            </p>
            <div className={c.pairBtnRow}>
              <button className={c.secondaryBtn} onClick={handlePair} disabled={isPairing || !!activeSession}>
                {isPairing ? "Matching..." : "Pair Me"}
              </button>
              <button className={c.secondaryBtn} onClick={handleFinish} disabled={!activeSession}>Finish</button>
            </div>
          </div>
        </section>

        <section id="ready-board" className={c.section}>
          <div className={c.sectionLabel}>Live now</div>
          <h2 className={c.sectionTitle}>Who's Ready</h2>
          <div className={c.boardGrid}>
            {readyDocs.length === 0 && (
              <p className={c.studentMeta}>Nobody's ready yet. Be the first ✦</p>
            )}
            {readyDocs.map(d => {
              const inSession = sessionDocs.some(s => !s.endedAt && (s.userA === d.userId || s.userB === d.userId))
              return (
                <div key={d._id} className={c.studentCard}>
                  <div className={c.studentName}>{d.name}{d.userId === meId ? " (you)" : ""}</div>
                  <div className={c.studentMeta}>{d.subject}</div>
                  <div className={c.badgeRow}>
                    <span className={`${c.badge} ${d.mode === "silent" ? "bg-[#3a86ff] text-white" : "bg-[#e63946] text-white"}`}>
                      {d.mode === "silent" ? "Silent" : "Chaos"}
                    </span>
                    <span className={`${c.badge} ${inSession ? "bg-[#6b6b78] text-white" : "bg-[#2a9d3f] text-white"}`}>
                      {inSession ? "Pairing" : "Ready"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section id="streaks" className={c.section}>
          <div className={c.sectionLabel}>Friendships</div>
          <h2 className={c.sectionTitle}>Study Streaks</h2>
          {streakList.length === 0 ? (
            <p className={c.studentMeta}>Finish a sprint to start a streak ✦</p>
          ) : (
            <ul>
              {streakList.map(([name, count]) => (
                <li key={name} className={c.streakRow}>
                  <span className={c.streakName}>{name}</span>
                  <span className={c.streakCount}>{count}× {count >= 3 ? "🔥" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <div className={c.bottomBar}>
        <button className={c.primaryBtn} onClick={handlePair} disabled={isPairing || !!activeSession}>
          {isPairing ? "Matching..." : activeSession ? `⚡ In sprint with ${partnerName}` : "⚡ Pair Me Now"}
        </button>
      </div>
    </div>
  )
}