import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("cafe-term")
  const SESSION_MS = 25 * 60 * 1000
  React.useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=VT323&display=optional"
    document.head.appendChild(link)
    const style = document.createElement("style")
    style.textContent = `body{font-family:'VT323',monospace;font-size:18px;line-height:1.4}@keyframes sweep{0%{transform:translateY(-10px)}100%{transform:translateY(100vh)}}`
    document.head.appendChild(style)
  }, [])
  const [me, setMe] = React.useState(() => localStorage.getItem("cafe-handle") || "")
  const [task, setTask] = React.useState("")
  const [chat, setChat] = React.useState("")
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const { docs: seats } = useLiveQuery("type", { key: "seat" })
  const { docs: chatter } = useLiveQuery("type", { key: "chatter", descending: true, limit: 20 })
  const { docs: completed } = useLiveQuery("type", { key: "completed" })
  const mySeat = seats.find(s => s.name === me && s.status === "focusing")
  function handleClaim(e) {
    e.preventDefault()
    if (!me.trim() || !task.trim()) return
    localStorage.setItem("cafe-handle", me.trim())
  }
  async function handleStart() {
    if (!me.trim() || !task.trim()) return
    if (mySeat) return
    await database.put({ type: "seat", name: me.trim(), task: task.trim(), ts_start: Date.now(), status: "focusing" })
  }
  async function handlePause() {
    if (!mySeat) return
    await database.put({ ...mySeat, status: "paused", ts_pause: Date.now() })
  }
  async function handleEnd() {
    if (!mySeat) return
    await database.del(mySeat._id)
    await database.put({ type: "completed", name: mySeat.name, task: mySeat.task, ts_end: Date.now(), day: new Date().toDateString() })
  }
  const [sugTask, setSugTask] = React.useState(false)
  const [sugChat, setSugChat] = React.useState(false)
  async function suggestTask() {
    setSugTask(true)
    try {
      const r = await callAI("Suggest one short focus task a remote worker might tackle in a 25-minute pomodoro. Keep under 8 words, lowercase, no period.", { schema: { properties: { task: { type: "string" } } } })
      setTask(JSON.parse(r).task || "")
    } finally { setSugTask(false) }
  }
  async function suggestChat() {
    setSugChat(true)
    try {
      const r = await callAI("Suggest one short ambient co-working status line, like 'deep in the SQL' or 'breaking for tea'. Under 8 words, lowercase, no period.", { schema: { properties: { line: { type: "string" } } } })
      setChat(JSON.parse(r).line || "")
    } finally { setSugChat(false) }
  }
  async function handleChatter(e) {
    e.preventDefault()
    if (!chat.trim() || !me.trim()) return
    await database.put({ type: "chatter", name: me.trim(), text: chat.trim(), ts: Date.now() })
    setChat("")
  }

  const c = {
    page: "min-h-screen w-full bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)]",
    overlay: "fixed inset-0 pointer-events-none z-[99] bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0px,rgba(0,255,0,0.03)_1px,transparent_1px,transparent_3px)]",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100] bg-gradient-to-b from-transparent via-[oklch(0.87_0.30_142/0.5)] to-transparent animate-[sweep_8s_linear_infinite]",
    shell: "max-w-5xl mx-auto px-4 py-6 space-y-6",
    header: "flex flex-col gap-1 border-b border-[oklch(0.87_0.30_142/0.3)] pb-4",
    headerRow: "flex items-center justify-between gap-3 flex-wrap",
    title: "text-2xl tracking-widest uppercase [text-shadow:0_0_10px_oklch(0.87_0.30_142/0.7)]",
    sub: "text-sm uppercase tracking-[0.2em] text-[oklch(0.87_0.30_142/0.6)]",
    statusDot: "inline-block w-[6px] h-[6px] rounded-full mr-2 align-middle bg-[oklch(0.87_0.30_142)] [box-shadow:0_0_8px_oklch(0.87_0.30_142/0.9)]",
    label: "text-xs uppercase tracking-[0.15em] mb-2 text-[oklch(0.87_0.30_142/0.55)]",
    claim: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4 space-y-3",
    claimRow: "flex flex-col md:flex-row gap-3",
    input: "flex-1 bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-3 py-3 min-h-[44px] outline-none caret-[oklch(0.87_0.30_142)] focus:border-[oklch(0.87_0.30_142)]",
    timerCard: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-5 flex flex-col items-center gap-4",
    timerNum: "text-6xl tracking-widest [text-shadow:0_0_12px_oklch(0.87_0.30_142/0.8)]",
    btnRow: "flex flex-wrap gap-3 justify-center",
    btn: "px-4 py-3 min-h-[44px] border border-[oklch(0.87_0.30_142/0.5)] tracking-widest uppercase hover:bg-[oklch(0.87_0.30_142)] hover:text-black transition-colors",
    twoCol: "grid grid-cols-1 lg:grid-cols-3 gap-5",
    grid: "lg:col-span-2 border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4",
    gridInner: "grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3",
    seat: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0.87_0.30_142/0.05)] p-3 space-y-1",
    seatName: "text-lg",
    seatTask: "text-sm text-[oklch(0.87_0.30_142/0.7)]",
    seatTimer: "text-sm tracking-widest",
    feed: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4 flex flex-col",
    feedList: "mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1",
    feedItem: "border-b border-[oklch(0.87_0.30_142/0.2)] py-2 text-sm",
    feedForm: "mt-3 flex flex-col gap-2",
    textarea: "bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-3 py-2 min-h-[80px] outline-none resize-none caret-[oklch(0.87_0.30_142)] focus:border-[oklch(0.87_0.30_142)]",
    log: "border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0_0_0/0.85)] p-4",
    logTable: "w-full mt-3 text-sm",
    logRow: "flex items-center justify-between border-b border-[oklch(0.87_0.30_142/0.2)] py-2",
    suggest: "text-xs underline tracking-wider uppercase text-[oklch(0.87_0.30_142/0.6)] hover:text-[oklch(0.87_0.30_142)] self-start",
    footer: "text-center text-xs uppercase tracking-[0.2em] pt-4 pb-8 text-[oklch(0.87_0.30_142/0.5)]",
  }

  return (
    <div className={c.page}>
      <div className={c.overlay} aria-hidden="true" />
      <div className={c.sweep} aria-hidden="true" />

      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.headerRow}>
            <h1 className={c.title}>▌ CAFE.TERM</h1>
            <span className={c.sub}><span className={c.statusDot} /> SYS: ONLINE</span>
          </div>
          <p className={c.sub}>STATUS: CO-WORKING NODE // 2-8 SEATS // NO VIDEO</p>
        </header>

        <main id="app" className="space-y-6">
          <section id="claim-seat" className={c.claim}>
            <div className={c.label}>SYS: CLAIM SEAT</div>
            <form onSubmit={handleClaim} className={c.claimRow}>
              <input className={c.input} placeholder="HANDLE" value={me} onChange={e => setMe(e.target.value)} />
              <input className={c.input} placeholder="CURRENT TASK" value={task} onChange={e => setTask(e.target.value)} />
              <button type="submit" className={c.btn}>[ SAVE ]</button>
            </form>
            <button type="button" className={c.suggest} onClick={suggestTask} disabled={sugTask}>{sugTask ? "→ THINKING..." : "→ SUGGEST TASK"}</button>
          </section>

          <section id="timer" className={c.timerCard}>
            <div className={c.label}>STATUS: SHARED POMODORO</div>
            <div className={c.timerNum}>{(() => {
              if (!mySeat) return "25:00"
              const remain = Math.max(0, SESSION_MS - (now - mySeat.ts_start))
              const m = String(Math.floor(remain / 60000)).padStart(2, "0")
              const s = String(Math.floor((remain % 60000) / 1000)).padStart(2, "0")
              return `${m}:${s}`
            })()}</div>
            <div className={c.btnRow}>
              <button className={c.btn} onClick={handleStart}>[ START SESSION ]</button>
              <button className={c.btn} onClick={handlePause}>[ PAUSE ]</button>
              <button className={c.btn} onClick={handleEnd}>[ END ]</button>
            </div>
          </section>

          <div className={c.twoCol}>
            <section id="seats" className={c.grid}>
              <div className={c.label}>FEED: OCCUPIED SEATS</div>
              <div className={c.gridInner}>
                {seats.length === 0 && <div className={c.seatTask}>// NO ACTIVE SEATS</div>}
                {seats.map(s => {
                  const elapsed = now - s.ts_start
                  const remain = Math.max(0, SESSION_MS - elapsed)
                  const m = String(Math.floor(remain / 60000)).padStart(2, "0")
                  const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, "0")
                  const filled = Math.min(10, Math.floor((elapsed / SESSION_MS) * 10))
                  const bar = "▒".repeat(filled) + "░".repeat(10 - filled)
                  return (
                    <div key={s._id} className={c.seat}>
                      <div className={c.seatName}><span className={c.statusDot} />{s.name}</div>
                      <div className={c.seatTask}>→ {s.task}</div>
                      <div className={c.seatTimer}>{bar} {m}:{ss}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section id="chatter" className={c.feed}>
              <div className={c.label}>FEED: AMBIENT CHATTER</div>
              <form onSubmit={handleChatter} className={c.feedForm}>
                <textarea className={c.textarea} placeholder="one short line..." value={chat} onChange={e => setChat(e.target.value)} />
                <button type="submit" className={c.btn}>[ PING ]</button>
                <button type="button" className={c.suggest} onClick={suggestChat} disabled={sugChat}>{sugChat ? "→ THINKING..." : "→ SUGGEST LINE"}</button>
              </form>
              <ul className={c.feedList}>
                {chatter.length === 0 && <li className={c.feedItem}>// FEED EMPTY</li>}
                {chatter.map(ch => <li key={ch._id} className={c.feedItem}>{ch.name} · {ch.text}</li>)}
              </ul>
            </section>
          </div>

          <section id="log" className={c.log}>
            <div className={c.label}>SYS: SESSION LOG // TODAY</div>
            <div className={c.logTable}>
              {(() => {
                const today = new Date().toDateString()
                const counts = {}
                completed.forEach(d => { if (d.day === today) counts[d.name] = (counts[d.name] || 0) + 1 })
                const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
                if (entries.length === 0) return <div className={c.seatTask}>// NO COMPLETED SESSIONS YET</div>
                return entries.map(([name, n]) => (
                  <div key={name} className={c.logRow}>
                    <span>{name}</span>
                    <span>● {n} POMODORO{n === 1 ? "" : "S"} · STREAK {n}</span>
                  </div>
                ))
              })()}
            </div>
          </section>
        </main>

        <footer className={c.footer}>END OF TRANSMISSION ░▒█</footer>
      </div>
    </div>
  )
}