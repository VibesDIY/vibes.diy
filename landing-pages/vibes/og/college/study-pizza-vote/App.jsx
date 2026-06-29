import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("pizza-quiz")
  const [sessionName, setSessionName] = React.useState("")
  const [topic, setTopic] = React.useState("")
  const [activeSessionId, setActiveSessionId] = React.useState(null)
  const [playerName, setPlayerName] = React.useState("")
  const [toppingInput, setToppingInput] = React.useState("")
  const [myToppings, setMyToppings] = React.useState([])
  const [myPlayerId, setMyPlayerId] = React.useState(null)
  const [quiz, setQuiz] = React.useState([])
  const [qIndex, setQIndex] = React.useState(0)
  const [myScore, setMyScore] = React.useState(0)
  const [announcement, setAnnouncement] = React.useState("")
  const [loadingTopic, setLoadingTopic] = React.useState(false)
  const [loadingToppings, setLoadingToppings] = React.useState(false)
  const [loadingQuiz, setLoadingQuiz] = React.useState(false)
  const [loadingReveal, setLoadingReveal] = React.useState(false)

  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true })
  const { docs: players } = useLiveQuery("sessionId", { key: activeSessionId || "__none__" })
  const activeSession = sessions.find(s => s._id === activeSessionId)

  async function handleCreateSession(e) {
    e.preventDefault()
    if (!sessionName.trim() || !topic.trim()) return
    const r = await database.put({ type: "session", name: sessionName, topic, createdAt: Date.now(), revealed: false })
    setActiveSessionId(r.id)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!playerName.trim() || !activeSessionId) return
    const r = await database.put({ type: "player", sessionId: activeSessionId, name: playerName, toppings: myToppings, score: 0, createdAt: Date.now() })
    setMyPlayerId(r.id)
  }

  function addTopping() {
    if (!toppingInput.trim()) return
    setMyToppings([...myToppings, toppingInput.trim()])
    setToppingInput("")
    if (myPlayerId) {
      database.get(myPlayerId).then(p => database.put({ ...p, toppings: [...myToppings, toppingInput.trim()] }))
    }
  }

  async function suggestTopic() {
    setLoadingTopic(true)
    try {
      const r = await callAI("Suggest one fun study topic for a trivia quiz. Just the topic name.", { schema: { properties: { topic: { type: "string" } } } })
      setTopic(JSON.parse(r).topic)
    } finally { setLoadingTopic(false) }
  }

  async function suggestToppings() {
    setLoadingToppings(true)
    try {
      const r = await callAI("Suggest 3 creative pizza toppings as a JSON array of strings.", { schema: { properties: { toppings: { type: "array", items: { type: "string" } } } } })
      const next = [...myToppings, ...JSON.parse(r).toppings]
      setMyToppings(next)
      if (myPlayerId) {
        const p = await database.get(myPlayerId)
        await database.put({ ...p, toppings: next })
      }
    } finally { setLoadingToppings(false) }
  }

  async function handleGenerateQuiz(e) {
    e.preventDefault()
    if (!activeSession) return
    setLoadingQuiz(true)
    try {
      const r = await callAI(`Make a 5-question multiple-choice quiz about "${activeSession.topic}". Each question has 4 options. Mark the correctIndex (0-3).`, {
        schema: { properties: { questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctIndex: { type: "number" } } } } } }
      })
      setQuiz(JSON.parse(r).questions || [])
      setQIndex(0)
      setMyScore(0)
    } finally { setLoadingQuiz(false) }
  }

  async function handleSubmitAnswer(idx) {
    const q = quiz[qIndex]
    if (!q) return
    const correct = idx === q.correctIndex
    const newScore = myScore + (correct ? 1 : 0)
    setMyScore(newScore)
    setQIndex(qIndex + 1)
    if (myPlayerId) {
      const p = await database.get(myPlayerId)
      await database.put({ ...p, score: newScore })
    }
  }

  async function handleReveal() {
    if (!activeSession || players.length === 0) return
    setLoadingReveal(true)
    try {
      const tally = {}
      players.forEach(p => {
        const weight = (p.score || 0) + 1
        ;(p.toppings || []).forEach((t, i) => {
          const w = weight * Math.max(1, 5 - i)
          tally[t] = (tally[t] || 0) + w
        })
      })
      const ranked = Object.entries(tally).sort((a,b) => b[1]-a[1]).slice(0,4).map(x => x[0])
      const winning = ranked.join(", ") || "Plain Cheese"
      const r = await callAI(`Write a dramatic announcer line revealing this winning pizza order: ${winning}. Two sentences max, all caps optional, theatrical.`, { schema: { properties: { line: { type: "string" } } } })
      const line = JSON.parse(r).line
      setAnnouncement(line)
      await database.put({ ...activeSession, revealed: true, winningOrder: winning, announcement: line })
    } finally { setLoadingReveal(false) }
  }

  const c = {
    page: "min-h-screen pb-32 bg-[#f5f1e8] text-[#1a1a2e]",
    header: "sticky top-0 z-20 bg-white px-5 py-4 border-b-[3px] border-[#1a1a2e] flex items-center justify-between gap-3",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[2px]",
    brand: "text-sm font-bold tracking-wider uppercase",
    navPill: "px-3 py-1 border-[2px] border-[#1a1a2e] bg-white text-[0.7rem] uppercase tracking-wider font-semibold shadow-[3px_3px_0px_#1a1a2e]",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    hero: "relative border-[3px] border-[#1a1a2e] bg-[#1a1a2e] p-6 overflow-hidden shadow-[6px_6px_0px_#d62828]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1",
    heroTitle: "text-4xl md:text-5xl font-bold uppercase tracking-tight leading-none mt-2 text-[#f4c542]",
    heroSub: "mt-3 text-sm uppercase tracking-widest font-semibold text-[#cccdc8]",
    section: "border-[3px] border-[#1a1a2e] bg-white p-5 shadow-[4px_4px_0px_#1a1a2e]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold mb-3 text-[#666]",
    sectionTitle: "text-xl font-bold uppercase tracking-tight mb-4",
    formRow: "flex flex-col gap-2 mb-3",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold",
    input: "w-full px-3 py-3 border-[3px] border-[#1a1a2e] bg-white text-base min-h-[44px] focus:outline-none focus:shadow-[3px_3px_0px_#1a1a2e]",
    select: "w-full px-3 py-3 border-[3px] text-base min-h-[44px]",
    btnRow: "flex flex-wrap gap-3 mt-4",
    btnPrimary: "px-5 py-3 border-[3px] border-[#1a1a2e] bg-[#d62828] text-white uppercase tracking-wider text-sm font-bold min-h-[44px] shadow-[4px_4px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnSecondary: "px-5 py-3 border-[3px] border-[#1a1a2e] bg-[#f4c542] text-[#1a1a2e] uppercase tracking-wider text-sm font-bold min-h-[44px] shadow-[3px_3px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGhost: "px-5 py-3 border-[3px] border-[#1a1a2e] bg-white text-[#1a1a2e] uppercase tracking-wider text-sm font-bold min-h-[44px] hover:shadow-[3px_3px_0px_#1a1a2e]",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-5",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3",
    statCard: "border-[3px] border-[#1a1a2e] bg-white overflow-hidden shadow-[3px_3px_0px_#1a1a2e]",
    statHead: "px-3 py-2 text-[0.6rem] uppercase tracking-widest font-bold border-b-[3px] border-[#1a1a2e]",
    statBody: "px-3 py-4",
    statNum: "font-mono text-3xl font-bold",
    statUnit: "text-[0.6rem] uppercase tracking-widest font-semibold mt-1",
    list: "divide-y-[2px] divide-[#1a1a2e]",
    listRow: "flex items-center justify-between gap-3 py-3 px-2 min-h-[44px] hover:bg-[#f4c542]",
    badge: "px-2 py-1 border-[2px] border-[#1a1a2e] bg-white text-[0.6rem] uppercase tracking-wider font-bold",
    toppingRow: "flex items-center justify-between gap-2 py-2",
    rankBtn: "w-9 h-9 border-[3px] border-[#1a1a2e] bg-[#d62828] text-white font-mono font-bold text-sm flex items-center justify-center",
    quizQ: "border-[3px] border-[#1a1a2e] bg-[#fff8dc] p-4 mb-3 shadow-[3px_3px_0px_#1a1a2e]",
    quizQText: "font-semibold mb-3",
    optionBtn: "w-full text-left px-3 py-3 border-[3px] border-[#1a1a2e] bg-white mb-2 text-sm min-h-[44px] hover:bg-[#2563b8] hover:text-white font-semibold",
    bottomBar: "fixed bottom-0 left-0 right-0 z-20 bg-white border-t-[3px] border-[#1a1a2e] px-4 py-3 flex gap-3 items-center justify-between shadow-[0_-4px_0px_#1a1a2e]",
    announcer: "border-[3px] border-[#1a1a2e] bg-[#2563b8] text-white p-5 italic text-base leading-relaxed shadow-[4px_4px_0px_#1a1a2e]",
    empty: "text-sm py-6 text-center uppercase tracking-wider text-[#888]",
    spinner: "inline-block w-4 h-4 border-[3px] border-white border-t-transparent rounded-full animate-spin align-middle"
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.logo}>
          <div className={c.logoDots}>
            <span className={c.dot} style={{background:"#d62828",borderColor:"#1a1a2e"}}></span>
            <span className={c.dot} style={{background:"#f4c542",borderColor:"#1a1a2e"}}></span>
            <span className={c.dot} style={{background:"#3a9b5c",borderColor:"#1a1a2e"}}></span>
          </div>
          <span className={c.brand}>Pizza Quiz</span>
        </div>
        <nav className="flex gap-2">
          <a href="#session" className={c.navPill}>Session</a>
          <a href="#quiz" className={c.navPill}>Quiz</a>
          <a href="#reveal" className={c.navPill}>Reveal</a>
        </nav>
      </header>

      <main id="app" className={c.main}>
        <section id="hero" className={c.hero}>
          <div className={c.heroBar}>
            <div className={c.heroSeg} style={{background:"#d62828"}}></div>
            <div className={c.heroSeg} style={{background:"#f4c542"}}></div>
            <div className={c.heroSeg} style={{background:"#3a9b5c"}}></div>
            <div className={c.heroSeg} style={{background:"#2563b8"}}></div>
          </div>
          <div className={c.heroSub}>Cram. Compete. Crust.</div>
          <h1 className={c.heroTitle}>Pizza Quiz Showdown</h1>
        </section>

        <section className={c.statRow}>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#d62828",color:"#fff"}}>Players</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{players.length}</div>
              <div className={c.statUnit}>Joined</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#f4c542",color:"#1a1a2e"}}>Round</div>
            <div className={c.statBody}>
              <div className={c.statNum}>1</div>
              <div className={c.statUnit}>Of 5</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#2563b8",color:"#fff"}}>Top Score</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{players.length ? Math.max(...players.map(p => p.score || 0)) : "—"}</div>
              <div className={c.statUnit}>Points</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHead} style={{background:"#3a9b5c",color:"#1a1a2e"}}>Status</div>
            <div className={c.statBody}>
              <div className={c.statNum}>·</div>
              <div className={c.statUnit}>Idle</div>
            </div>
          </div>
        </section>

        <section id="session" className={c.section}>
          <div className={c.sectionLabel}>Session</div>
          <h2 className={c.sectionTitle}>Start a Showdown</h2>
          <form onSubmit={handleCreateSession}>
            <div className={c.formRow}>
              <label className={c.label}>Session Name</label>
              <input className={c.input} placeholder="Friday Night Crew" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>Study Topic</label>
              <input className={c.input} placeholder="World Capitals" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div className={c.btnRow}>
              <button type="submit" className={c.btnPrimary}>Create</button>
              <button type="button" className={c.btnGhost} onClick={suggestTopic} disabled={loadingTopic}>
                {loadingTopic ? <span className={c.spinner} style={{borderColor:"#1a1a2e",borderTopColor:"transparent"}}></span> : "Suggest Topic"}
              </button>
            </div>
          </form>
          {sessions.length > 0 && (
            <div style={{marginTop:"1rem"}}>
              <div className={c.sectionLabel}>Past Sessions</div>
              <ul className={c.list}>
                {sessions.slice(0,5).map(s => (
                  <li key={s._id} className={c.listRow} onClick={() => setActiveSessionId(s._id)} style={{cursor:"pointer"}}>
                    <span className="font-semibold">{s.name}</span>
                    <span className={c.badge}>{s.topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section id="join" className={c.section}>
          <div className={c.sectionLabel}>Players</div>
          <h2 className={c.sectionTitle}>Join + Rank Toppings</h2>
          <div className={c.grid2}>
            <form onSubmit={handleJoin}>
              <div className={c.formRow}>
                <label className={c.label}>Your Name</label>
                <input className={c.input} placeholder="Alex" value={playerName} onChange={e => setPlayerName(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Add Topping</label>
                <div className="flex gap-2">
                  <input className={c.input} placeholder="Pepperoni" value={toppingInput} onChange={e => setToppingInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTopping() } }} />
                  <button type="button" className={c.btnSecondary} onClick={addTopping}>Add</button>
                </div>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary} disabled={!activeSessionId}>Join</button>
                <button type="button" className={c.btnSecondary} onClick={suggestToppings} disabled={loadingToppings}>
                  {loadingToppings ? <span className={c.spinner} style={{borderColor:"#1a1a2e",borderTopColor:"transparent"}}></span> : "Suggest Toppings"}
                </button>
              </div>
            </form>
            <div>
              <div className={c.sectionLabel}>Your Ranked Toppings</div>
              <ul className={c.list}>
                {myToppings.length === 0 && <li className={c.empty}>No toppings yet</li>}
                {myToppings.map((t, i) => (
                  <li key={i} className={c.toppingRow}>
                    <div className="flex items-center gap-2">
                      <span className={c.rankBtn}>{i+1}</span>
                      <span>{t}</span>
                    </div>
                    {i === 0 && <span className={c.badge}>Top</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={c.sectionLabel} style={{marginTop: "1.25rem"}}>Roster</div>
          <ul className={c.list}>
            {players.length === 0 && <li className={c.empty}>No players yet</li>}
            {players.map(p => (
              <li key={p._id} className={c.listRow}>
                <span className="font-semibold">{p.name}</span>
                <span className={c.badge}>{(p.toppings || []).length} toppings</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="quiz" className={c.section}>
          <div className={c.sectionLabel}>Quiz</div>
          <h2 className={c.sectionTitle}>Answer + Score</h2>
          <form onSubmit={handleGenerateQuiz}>
            <div className={c.btnRow}>
              <button type="submit" className={c.btnPrimary} disabled={loadingQuiz || !activeSession}>
                {loadingQuiz ? <><span className={c.spinner}></span> Loading...</> : "Generate Quiz"}
              </button>
              <button type="button" className={c.btnGhost} onClick={() => { setQuiz([]); setQIndex(0); setMyScore(0) }}>Reset</button>
            </div>
          </form>

          <div style={{marginTop: "1rem"}}>
            {quiz.length === 0 && <div className={c.empty}>Generate a quiz to begin</div>}
            {quiz.length > 0 && qIndex < quiz.length && (
              <div className={c.quizQ}>
                <div className={c.quizQText}>{qIndex + 1}. {quiz[qIndex].question}</div>
                {quiz[qIndex].options.map((opt, i) => (
                  <button key={i} type="button" className={c.optionBtn} onClick={() => handleSubmitAnswer(i)}>{opt}</button>
                ))}
              </div>
            )}
            {quiz.length > 0 && qIndex >= quiz.length && (
              <div className={c.quizQ}>
                <div className={c.quizQText}>Quiz complete! Your score: {myScore} / {quiz.length}</div>
              </div>
            )}
          </div>

          <div className={c.sectionLabel} style={{marginTop: "1rem"}}>Live Scoreboard</div>
          <ul className={c.list}>
            {players.length === 0 && <li className={c.empty}>No players yet</li>}
            {[...players].sort((a,b) => (b.score||0) - (a.score||0)).map(p => (
              <li key={p._id} className={c.listRow}>
                <span className="font-semibold">{p.name}</span>
                <span className="font-mono font-bold">{p.score || 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="reveal" className={c.section}>
          <div className={c.sectionLabel}>Reveal</div>
          <h2 className={c.sectionTitle}>The Winning Pie</h2>
          <div className={c.announcer}>
            {announcement || activeSession?.announcement || '"And the votes are in... the people have spoken... the pizza shall be..."'}
          </div>
          {activeSession?.winningOrder && (
            <div style={{marginTop:"0.75rem"}} className="font-mono font-bold text-lg uppercase">
              {activeSession.winningOrder}
            </div>
          )}
          <div className={c.btnRow}>
            <button type="button" className={c.btnPrimary} onClick={handleReveal} disabled={loadingReveal || !activeSessionId}>
              {loadingReveal ? <><span className={c.spinner}></span> Loading...</> : "Reveal Winner"}
            </button>
          </div>
          <div className={c.sectionLabel} style={{marginTop: "1.25rem"}}>Revealed Sessions</div>
          <ul className={c.list}>
            {sessions.filter(s => s.revealed).length === 0 && <li className={c.empty}>No saved sessions yet</li>}
            {sessions.filter(s => s.revealed).map(s => (
              <li key={s._id} className={c.listRow} onClick={() => setActiveSessionId(s._id)} style={{cursor:"pointer"}}>
                <span className="font-semibold">{s.name}</span>
                <span className={c.badge}>{s.winningOrder}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div className={c.bottomBar}>
        <span className="text-[0.7rem] uppercase tracking-wider font-bold">
          {activeSession ? `${activeSession.name} · ${players.length} Players` : "No Session"}
        </span>
        <a href="#quiz" className={c.btnPrimary} style={{textDecoration:"none",display:"inline-block"}}>Quiz</a>
      </div>
    </div>
  )
}