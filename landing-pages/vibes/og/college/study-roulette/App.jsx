import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("study-roulette")

  const { doc: profile, merge: mergeProfile, save: saveProfile } = useDocument({
    _id: "my-profile",
    name: "",
    subject: "",
    mode: "silent",
    online: false,
    type: "profile",
  })

  const { docs: activeStudents } = useLiveQuery("type", { key: "active" })
  const { docs: pulses } = useLiveQuery("type", { key: "pulse", descending: true, limit: 20 })
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true, limit: 1 })
  const { docs: friends } = useLiveQuery("type", { key: "friend" })

  const currentSession = sessions[0]
  const [suggesting, setSuggesting] = React.useState(false)
  const [spinning, setSpinning] = React.useState(false)
  const [savingProfile, setSavingProfile] = React.useState(false)

  async function handleStatusSubmit(e) {
    e.preventDefault()
    if (!profile.name.trim()) return
    setSavingProfile(true)
    try {
      await saveProfile()
      await database.put({
        type: "active",
        name: profile.name,
        subject: profile.subject || "general",
        mode: profile.mode,
        joinedAt: Date.now(),
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSpin() {
    setSpinning(true)
    try {
      const partner = activeStudents.find(s => s.name !== profile.name) || { name: "Stranger" }
      await database.put({
        type: "session",
        partner: partner.name,
        subject: profile.subject || "open",
        startedAt: Date.now(),
        duration: 25 * 60,
      })
    } finally {
      setSpinning(false)
    }
  }

  async function handleJoinCircle() {
    await database.put({
      type: "session",
      partner: "Study circle",
      subject: "group",
      startedAt: Date.now(),
      duration: 45 * 60,
    })
  }

  async function handleEndSession() {
    if (!currentSession) return
    await database.put({ ...currentSession, type: "session-ended", endedAt: Date.now() })
    await database.put({
      type: "friend",
      name: currentSession.partner,
      subject: currentSession.subject,
      metAt: Date.now(),
    })
  }

  async function handlePing(label) {
    await database.put({
      type: "pulse",
      label,
      from: profile.name || "you",
      at: Date.now(),
    })
  }

  async function handleSuggest() {
    setSuggesting(true)
    try {
      const r = await callAI("Suggest one short study subject a college student might cram on tonight. Be specific and a little funny.", {
        schema: { properties: { subject: { type: "string" } } }
      })
      const { subject } = JSON.parse(r)
      mergeProfile({ subject })
    } finally {
      setSuggesting(false)
    }
  }

  function setMode(mode) { mergeProfile({ mode }) }

  const c = {
    page: "min-h-screen bg-[#f5f2e8] text-[#15151f]",
    bgDeco: "fixed inset-0 -z-10 bg-[linear-gradient(to_right,#15151f0a_1px,transparent_1px),linear-gradient(to_bottom,#15151f0a_1px,transparent_1px)] bg-[size:60px_60px]",
    shell: "max-w-[920px] mx-auto px-5 py-6 space-y-5",
    header: "flex items-center justify-between p-4 border-[3px] border-[#15151f] rounded-[4px] bg-white shadow-[4px_4px_0px_#15151f]",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3",
    brand: "uppercase tracking-tight font-bold text-base",
    streak: "px-3 py-2 border-[3px] border-[#15151f] rounded-[4px] uppercase text-xs tracking-wider font-bold bg-[#5ba84a] text-white shadow-[3px_3px_0px_#15151f]",
    hero: "relative p-6 border-[3px] border-[#15151f] rounded-[4px] overflow-hidden bg-white shadow-[4px_4px_0px_#15151f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitle: "uppercase font-bold tracking-tight text-3xl md:text-5xl mt-2 leading-none [text-shadow:5px_5px_0px_#d94a2b80]",
    heroSub: "uppercase tracking-widest text-[0.65rem] mt-3 text-[#6b6b78]",
    heroCount: "font-mono text-2xl mt-4",
    section: "p-5 border-[3px] border-[#15151f] rounded-[4px] space-y-4 bg-white shadow-[4px_4px_0px_#15151f]",
    sectionLabel: "uppercase tracking-widest text-[0.65rem] font-semibold text-[#6b6b78]",
    sectionTitle: "uppercase font-bold tracking-tight text-xl",
    formGrid: "grid gap-3",
    fieldRow: "flex flex-col gap-1",
    label: "uppercase tracking-widest text-[0.65rem] font-semibold",
    input: "px-3 py-3 border-[3px] border-[#15151f] rounded-[4px] text-sm min-h-[44px] bg-white focus:outline-none focus:shadow-[3px_3px_0px_#15151f] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all",
    select: "px-3 py-3 border-[3px] rounded-[4px] text-sm min-h-[44px]",
    modeRow: "grid grid-cols-2 gap-2",
    modeBtn: "p-3 border-[3px] border-[#15151f] rounded-[4px] uppercase text-xs tracking-wider font-bold min-h-[44px] bg-white hover:bg-[#e6c34a] transition-colors",
    primaryBtn: "px-5 py-3 border-[3px] border-[#15151f] rounded-[4px] uppercase tracking-wider font-bold text-sm min-h-[48px] bg-[#d94a2b] text-white shadow-[4px_4px_0px_#15151f] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    secondaryBtn: "px-5 py-3 border-[3px] border-[#15151f] rounded-[4px] uppercase tracking-wider font-bold text-sm min-h-[48px] bg-[#e6c34a] text-[#15151f] shadow-[3px_3px_0px_#15151f] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_#15151f] transition-all",
    ghostBtn: "px-4 py-2 border-[3px] border-[#15151f] rounded-[4px] uppercase tracking-wider text-xs font-bold bg-white hover:shadow-[3px_3px_0px_#15151f] transition-all",
    spinBar: "flex flex-wrap gap-2",
    boardGrid: "grid gap-3 sm:grid-cols-2",
    studentCard: "p-4 border-[3px] border-[#15151f] rounded-[4px] flex items-start gap-3 bg-white shadow-[3px_3px_0px_#15151f]",
    avatar: "w-10 h-10 border-[3px] border-[#15151f] rounded-[4px] flex items-center justify-center font-bold bg-[#3b6ec9] text-white",
    studentMain: "flex-1 min-w-0",
    studentName: "font-bold text-sm truncate",
    studentMeta: "text-xs mt-1",
    badgeRow: "flex flex-wrap gap-1 mt-2",
    badge: "px-2 py-0.5 border-[2px] border-[#15151f] rounded-[4px] uppercase text-[0.6rem] tracking-wider font-bold bg-[#e6c34a]",
    activeDot: "w-2 h-2 rounded-full inline-block mr-1 bg-[#5ba84a] animate-pulse",
    sessionPanel: "p-5 border-[3px] border-[#15151f] rounded-[4px] space-y-4 bg-white shadow-[4px_4px_0px_#15151f]",
    timer: "font-mono text-6xl font-bold text-center py-4 text-[#d94a2b]",
    timerLabel: "uppercase tracking-widest text-[0.65rem] text-center",
    pulseList: "space-y-2 max-h-[200px] overflow-y-auto",
    pulseItem: "flex items-center gap-2 p-2 border-[2px] border-[#15151f] rounded-[4px] text-sm bg-[#f5f2e8]",
    pulseTime: "font-mono text-[0.7rem] ml-auto",
    pingRow: "flex flex-wrap gap-2",
    pingBtn: "px-3 py-2 border-[3px] border-[#15151f] rounded-[4px] uppercase text-[0.7rem] tracking-wider font-bold bg-[#3b6ec9] text-white shadow-[3px_3px_0px_#15151f] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_#15151f] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all",
    streaksRow: "grid grid-cols-3 gap-3",
    statCard: "border-[3px] border-[#15151f] rounded-[4px] overflow-hidden bg-white shadow-[3px_3px_0px_#15151f]",
    statHeader: "px-3 py-2 uppercase text-[0.6rem] tracking-widest font-bold",
    statBody: "px-3 py-3 text-center",
    statNum: "font-mono text-2xl font-bold",
    statUnit: "uppercase text-[0.6rem] tracking-widest mt-1",
    friendsList: "space-y-2",
    friendRow: "flex items-center gap-3 p-3 border-[3px] border-[#15151f] rounded-[4px] bg-white shadow-[3px_3px_0px_#15151f]",
    empty: "p-6 text-center border-[3px] border-dashed border-[#6b6b78] rounded-[4px] text-sm text-[#6b6b78]",
    suggestBtn: "px-2 py-1 border-[2px] border-[#15151f] rounded-[4px] uppercase text-[0.6rem] tracking-wider font-bold bg-[#e6c34a] self-start",
  }

  return (
    <div className={c.page}>
      <div className={c.bgDeco} aria-hidden></div>
      <div className={c.shell}>

        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <div className={c.logoDots}>
              <span className={`${c.dot} bg-[#d94a2b]`}></span>
              <span className={`${c.dot} bg-[#e6c34a]`}></span>
              <span className={`${c.dot} bg-[#5ba84a]`}></span>
            </div>
            <span className={c.brand}>Study Roulette</span>
          </div>
          <div className={c.streak}>{friends.length} day streak</div>
        </header>

        <main id="app">

          <section id="hero" className={c.hero}>
            <div className={c.heroBar} aria-hidden>
              <span className={`${c.heroBarSeg} bg-[#d94a2b]`}></span>
              <span className={`${c.heroBarSeg} bg-[#e6c34a]`}></span>
              <span className={`${c.heroBarSeg} bg-[#5ba84a]`}></span>
              <span className={`${c.heroBarSeg} bg-[#3b6ec9]`}></span>
            </div>
            <p className={c.sectionLabel}>Right now in the library</p>
            <h1 className={c.heroTitle}>Pull up a chair</h1>
            <p className={c.heroSub}>Spin. Sprint. Survive finals.</p>
            <div className={c.heroCount}>{activeStudents.length} students ready</div>
          </section>

          <section id="status" className={c.section}>
            <p className={c.sectionLabel}>Your status</p>
            <h2 className={c.sectionTitle}>Set your vibe</h2>
            <form onSubmit={handleStatusSubmit} className={c.formGrid}>
              <div className={c.fieldRow}>
                <label className={c.label}>Display name</label>
                <input className={c.input} placeholder="Type a name" value={profile.name} onChange={e => mergeProfile({ name: e.target.value })} />
              </div>
              <div className={c.fieldRow}>
                <label className={c.label}>Subject</label>
                <input className={c.input} placeholder="Organic chem, calc 2..." value={profile.subject} onChange={e => mergeProfile({ subject: e.target.value })} />
                <button type="button" onClick={handleSuggest} disabled={suggesting} className={c.suggestBtn}>
                  {suggesting ? "Thinking..." : "Suggest ideas"}
                </button>
              </div>
              <div className={c.fieldRow}>
                <label className={c.label}>Energy mode</label>
                <div className={c.modeRow}>
                  <button type="button" onClick={() => setMode("silent")} className={`${c.modeBtn} ${profile.mode === "silent" ? "bg-[#5ba84a] text-white" : ""}`}>Silent focus</button>
                  <button type="button" onClick={() => setMode("chaos")} className={`${c.modeBtn} ${profile.mode === "chaos" ? "bg-[#d94a2b] text-white" : ""}`}>Collab chaos</button>
                </div>
              </div>
              <button type="submit" disabled={savingProfile} className={c.primaryBtn}>
                {savingProfile ? (
                  <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42" /></svg>
                ) : "Go online"}
              </button>
            </form>
          </section>

          <section id="spin" className={c.section}>
            <p className={c.sectionLabel}>Random match</p>
            <h2 className={c.sectionTitle}>Spin the wheel</h2>
            <div className={c.spinBar}>
              <button onClick={handleSpin} disabled={spinning} className={c.primaryBtn}>
                {spinning ? (
                  <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="42" /></svg>
                ) : "Pair me up"}
              </button>
              <button onClick={handleJoinCircle} className={c.secondaryBtn}>Join a circle</button>
              <button className={c.ghostBtn}>Themed: 2am cram</button>
              <button className={c.ghostBtn}>Themed: pomodoro</button>
            </div>
          </section>

          <section id="board" className={c.section}>
            <p className={c.sectionLabel}>Live board</p>
            <h2 className={c.sectionTitle}>Who's around</h2>
            <div className={c.boardGrid}>
              {activeStudents.length === 0 && (
                <div className={c.empty}>Library's empty. Be the first to log in.</div>
              )}
              {activeStudents.map(s => (
                <article key={s._id} className={c.studentCard}>
                  <div className={c.avatar}>{(s.name || "?").charAt(0).toUpperCase()}</div>
                  <div className={c.studentMain}>
                    <p className={c.studentName}>{s.name}</p>
                    <p className={c.studentMeta}><span className={c.activeDot}></span>active now</p>
                    <div className={c.badgeRow}>
                      <span className={c.badge}>{s.subject}</span>
                      <span className={`${c.badge} ${s.mode === "chaos" ? "bg-[#d94a2b] text-white" : "bg-[#5ba84a] text-white"}`}>{s.mode}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {currentSession && currentSession.type === "session" && (
            <section id="session" className={c.sessionPanel}>
              <p className={c.sectionLabel}>Current sprint</p>
              <h2 className={c.sectionTitle}>You + {currentSession.partner}</h2>
              <div className={c.timer}>{Math.floor((currentSession.duration || 1500) / 60).toString().padStart(2,"0")}:00</div>
              <p className={c.timerLabel}>Time remaining</p>
              <div className={c.pingRow}>
                <button onClick={() => handlePing("Locked in")} className={c.pingBtn}>Locked in</button>
                <button onClick={() => handlePing("Need coffee")} className={c.pingBtn}>Need coffee</button>
                <button onClick={() => handlePing("Brain fried")} className={c.pingBtn}>Brain fried</button>
                <button onClick={() => handlePing("Wave")} className={c.pingBtn}>Wave</button>
              </div>
              <ul className={c.pulseList}>
                {pulses.length === 0 && <li className={c.empty}>No pings yet. Send one.</li>}
                {pulses.map(p => (
                  <li key={p._id} className={c.pulseItem}>
                    <span><strong>{p.from}</strong> {p.label}</span>
                    <span className={c.pulseTime}>{new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleEndSession} className={c.secondaryBtn}>End session</button>
            </section>
          )}

          <section id="streaks" className={c.section}>
            <p className={c.sectionLabel}>Your stats</p>
            <h2 className={c.sectionTitle}>Streak life</h2>
            <div className={c.streaksRow}>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[#d94a2b] text-white border-b-[3px] border-[#15151f]`}>Streak</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{friends.length}</div>
                  <div className={c.statUnit}>days</div>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[#e6c34a] border-b-[3px] border-[#15151f]`}>Sessions</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{sessions.length}</div>
                  <div className={c.statUnit}>total</div>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[#5ba84a] text-white border-b-[3px] border-[#15151f]`}>Friends</div>
                <div className={c.statBody}>
                  <div className={c.statNum}>{friends.length}</div>
                  <div className={c.statUnit}>made</div>
                </div>
              </div>
            </div>
          </section>

          <section id="friends" className={c.section}>
            <p className={c.sectionLabel}>Accidental friendships</p>
            <h2 className={c.sectionTitle}>People you studied with</h2>
            <ul className={c.friendsList}>
              {friends.length === 0 && <li className={c.empty}>No connections yet. Spin to meet someone.</li>}
              {friends.map(f => (
                <li key={f._id} className={c.friendRow}>
                  <div className={c.avatar}>{(f.name || "?").charAt(0).toUpperCase()}</div>
                  <div className={c.studentMain}>
                    <p className={c.studentName}>{f.name}</p>
                    <p className={c.studentMeta}>studied {f.subject} together</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </main>
      </div>
    </div>
  )
}