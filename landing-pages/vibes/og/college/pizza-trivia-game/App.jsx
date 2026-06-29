import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("pizza-quiz-showdown")
  const [sessionCode, setSessionCode] = React.useState("friday-night")
  const [playerName, setPlayerName] = React.useState("")
  const [topic, setTopic] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("Medium")
  const [t1, setT1] = React.useState("")
  const [t2, setT2] = React.useState("")
  const [t3, setT3] = React.useState("")
  const [crust, setCrust] = React.useState("Thin")
  const [quiz, setQuiz] = React.useState(null)
  const [qIndex, setQIndex] = React.useState(0)
  const [score, setScore] = React.useState(0)
  const [answered, setAnswered] = React.useState(false)
  const [reveal, setReveal] = React.useState(null)
  const [loadingQuiz, setLoadingQuiz] = React.useState(false)
  const [loadingReveal, setLoadingReveal] = React.useState(false)
  const [loadingSuggest, setLoadingSuggest] = React.useState(false)
  const [loadingTopic, setLoadingTopic] = React.useState(false)
  const [loadingName, setLoadingName] = React.useState(false)

  const { docs: players } = useLiveQuery("type", { key: `player:${sessionCode}` })
  const { docs: orders } = useLiveQuery("type", { key: `order:${sessionCode}` })
  const { docs: scores } = useLiveQuery("type", { key: `score:${sessionCode}` })
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true, limit: 10 })

  const topScore = scores.reduce((m, s) => Math.max(m, s.points || 0), 0)

  async function handleJoin(e) {
    e.preventDefault()
    if (!playerName.trim()) return
    await database.put({ type: `player:${sessionCode}`, name: playerName, joinedAt: Date.now() })
  }

  async function handleSubmitOrder(e) {
    e.preventDefault()
    if (!playerName.trim() || !t1.trim()) return
    await database.put({ type: `order:${sessionCode}`, player: playerName, toppings: [t1, t2, t3].filter(Boolean), crust, at: Date.now() })
    setT1(""); setT2(""); setT3("")
  }

  async function handleStartQuiz(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoadingQuiz(true)
    try {
      const r = await callAI(`Generate 5 ${difficulty} multiple choice questions about: ${topic}. Each has 4 options and a correctIndex 0-3.`, {
        schema: { properties: { questions: { type: "array", items: { type: "object", properties: {
          q: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctIndex: { type: "number" }
        }}}}}
      })
      const data = JSON.parse(r)
      setQuiz(data.questions); setQIndex(0); setScore(0); setAnswered(false)
    } finally { setLoadingQuiz(false) }
  }

  async function handleAnswer(idx) {
    if (answered || !quiz) return
    setAnswered(true)
    const correct = quiz[qIndex].correctIndex === idx
    const newScore = correct ? score + 1 : score
    setScore(newScore)
    setTimeout(async () => {
      if (qIndex + 1 >= quiz.length) {
        await database.put({ type: `score:${sessionCode}`, player: playerName || "Anon", points: newScore, topic, at: Date.now() })
        setQuiz(null)
      } else {
        setQIndex(qIndex + 1); setAnswered(false)
      }
    }, 700)
  }

  async function handleReveal() {
    setLoadingReveal(true)
    try {
      const tally = {}
      for (const s of scores) {
        const weight = (s.points || 0) + 1
        const o = orders.find(x => x.player === s.player)
        if (!o) continue
        o.toppings.forEach((t, i) => {
          const k = t.toLowerCase().trim()
          tally[k] = (tally[k] || 0) + weight * (3 - i)
        })
      }
      const ranked = Object.entries(tally).sort((a,b) => b[1]-a[1]).slice(0,3).map(x => x[0])
      const r = await callAI(`Write a 2-sentence dramatic boxing-announcer reveal of the winning pizza with toppings: ${ranked.join(", ")}. ALL CAPS energy.`, {
        schema: { properties: { announcement: { type: "string" } } }
      })
      const { announcement } = JSON.parse(r)
      const champion = scores.slice().sort((a,b) => b.points - a.points)[0]
      const session = { type: "session", code: sessionCode, topic, toppings: ranked, announcement, champion: champion?.player || "—", at: Date.now() }
      await database.put(session)
      setReveal(session)
    } finally { setLoadingReveal(false) }
  }

  async function suggestToppings() {
    setLoadingSuggest(true)
    try {
      const r = await callAI("Suggest 3 creative pizza toppings as single short words.", {
        schema: { properties: { toppings: { type: "array", items: { type: "string" } } } }
      })
      const { toppings } = JSON.parse(r)
      setT1(toppings[0] || ""); setT2(toppings[1] || ""); setT3(toppings[2] || "")
    } finally { setLoadingSuggest(false) }
  }

  async function suggestTopic() {
    setLoadingTopic(true)
    try {
      const r = await callAI("Suggest one fun study quiz topic, 1-3 words.", {
        schema: { properties: { topic: { type: "string" } } }
      })
      setTopic(JSON.parse(r).topic)
    } finally { setLoadingTopic(false) }
  }

  async function suggestName() {
    setLoadingName(true)
    try {
      const r = await callAI("Suggest one playful pizza-themed player nickname, 1-2 words.", {
        schema: { properties: { name: { type: "string" } } }
      })
      setPlayerName(JSON.parse(r).name)
    } finally { setLoadingName(false) }
  }

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ee] text-[#16161d]",
    shell: "max-w-[920px] mx-auto px-5 py-8 space-y-6",
    header: "flex items-center justify-between p-4 rounded bg-white border-[3px] border-[#16161d] shadow-[4px_4px_0px_#16161d]",
    logo: "flex items-center gap-2",
    logoDot: "w-3 h-3 inline-block",
    brand: "font-bold tracking-tight uppercase text-sm",
    nav: "flex gap-2",
    navLink: "px-3 py-2 text-xs uppercase tracking-wider rounded bg-white border-[3px] border-[#16161d] font-bold hover:bg-[#e8c547]",
    hero: "relative p-6 pt-8 rounded overflow-hidden bg-white border-[3px] border-[#16161d] shadow-[4px_4px_0px_#16161d]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1 h-full",
    heroTitle: "text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mt-3 text-[#16161d] [text-shadow:4px_4px_0px_#d63b1f]",
    heroSub: "mt-3 text-sm",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-2 text-[#6b6b78] font-bold",
    section: "p-5 rounded space-y-3 bg-white border-[3px] border-[#16161d] shadow-[4px_4px_0px_#16161d]",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-5",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3",
    stat: "rounded overflow-hidden bg-white border-[3px] border-[#16161d] shadow-[3px_3px_0px_#16161d]",
    statHead: "px-3 py-2 text-[0.6rem] uppercase tracking-widest font-bold",
    statBody: "p-3 font-mono text-2xl",
    formRow: "flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-[0.15em]",
    input: "px-3 py-3 rounded text-sm min-h-[44px] bg-white border-[3px] border-[#16161d] focus:outline-none focus:shadow-[3px_3px_0px_#16161d]",
    select: "px-3 py-3 rounded text-sm min-h-[44px] bg-white border-[3px] border-[#16161d] focus:outline-none",
    btnPrimary: "px-4 py-3 rounded text-xs uppercase tracking-wider font-bold min-h-[44px] bg-[#d63b1f] text-white border-[3px] border-[#16161d] shadow-[4px_4px_0px_#16161d] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50",
    btnSecondary: "px-4 py-3 rounded text-xs uppercase tracking-wider font-bold min-h-[44px] bg-[#e8c547] text-[#16161d] border-[3px] border-[#16161d] shadow-[3px_3px_0px_#16161d] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50",
    btnGhost: "px-4 py-3 rounded text-xs uppercase tracking-wider font-bold min-h-[44px] bg-white text-[#16161d] border-[3px] border-[#16161d] hover:shadow-[3px_3px_0px_#16161d] disabled:opacity-50",
    actions: "flex flex-wrap gap-3",
    list: "space-y-2",
    row: "flex items-center justify-between gap-3 p-3 rounded bg-white border-[3px] border-[#16161d] hover:bg-[#fff8e0]",
    rank: "font-mono text-lg font-bold w-8 text-[#d63b1f]",
    badge: "px-2 py-1 text-[0.6rem] uppercase tracking-widest font-bold rounded border-[2px] border-[#16161d] bg-[#4a9d5f] text-[#16161d] whitespace-nowrap",
    quizCard: "p-5 rounded space-y-4 bg-[#fff8e0] border-[3px] border-[#16161d] shadow-[3px_3px_0px_#16161d]",
    qText: "font-bold text-lg",
    optList: "space-y-2",
    opt: "w-full text-left p-3 rounded text-sm min-h-[44px] bg-white border-[3px] border-[#16161d] hover:bg-[#e8c547] active:translate-x-[2px] active:translate-y-[2px] font-medium",
    revealBox: "p-6 rounded text-center space-y-3 bg-[#3a6dd1] text-white border-[3px] border-[#16161d] shadow-[4px_4px_0px_#16161d]",
    revealTitle: "text-2xl font-bold uppercase tracking-tight",
    spinner: "inline-block w-4 h-4 animate-spin border-[3px] border-current border-t-transparent rounded-full align-middle",
  }

  return (
    <div className={c.page}>
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <span className={c.logoDot + " bg-[#d63b1f]"}></span>
            <span className={c.logoDot + " bg-[#e8c547]"}></span>
            <span className={c.logoDot + " bg-[#4a9d5f]"}></span>
            <span className={c.brand}>Pizza Quiz</span>
          </div>
          <nav className={c.nav}>
            <a className={c.navLink} href="#lobby">Lobby</a>
            <a className={c.navLink} href="#quiz">Quiz</a>
            <a className={c.navLink} href="#reveal">Reveal</a>
          </nav>
        </header>

        <main id="app">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar}>
              <span className={c.heroSeg + " bg-[#d63b1f]"}></span>
              <span className={c.heroSeg + " bg-[#e8c547]"}></span>
              <span className={c.heroSeg + " bg-[#4a9d5f]"}></span>
              <span className={c.heroSeg + " bg-[#3a6dd1]"}></span>
            </div>
            <div className={c.sectionLabel}>Round 01</div>
            <h1 className={c.heroTitle}>Slice Showdown</h1>
            <p className={c.heroSub}>Smartest brain picks the toppings. Loud announcer included.</p>
          </section>

          <section id="stats" className={c.statRow}>
            <div className={c.stat}>
              <div className={c.statHead + " bg-[#d63b1f] text-white border-b-[3px] border-[#16161d]"}>Players</div>
              <div className={c.statBody}>{players.length}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statHead + " bg-[#e8c547] text-[#16161d] border-b-[3px] border-[#16161d]"}>Orders</div>
              <div className={c.statBody}>{orders.length}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statHead + " bg-[#3a6dd1] text-white border-b-[3px] border-[#16161d]"}>Topic</div>
              <div className={c.statBody + " text-base truncate"}>{topic || "—"}</div>
            </div>
            <div className={c.stat}>
              <div className={c.statHead + " bg-[#4a9d5f] text-[#16161d] border-b-[3px] border-[#16161d]"}>Top Score</div>
              <div className={c.statBody}>{topScore}</div>
            </div>
          </section>

          <section id="lobby" className={c.section}>
            <div className={c.sectionLabel}>Join the Table</div>
            <form onSubmit={handleJoin} className={c.grid2}>
              <div className={c.formRow}>
                <label className={c.label}>Player Name</label>
                <input className={c.input} placeholder="Your name" value={playerName} onChange={e => setPlayerName(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Session</label>
                <input className={c.input} placeholder="Session code" value={sessionCode} onChange={e => setSessionCode(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className={c.actions}>
                  <button type="submit" className={c.btnPrimary}>Sit Down</button>
                  <button type="button" className={c.btnGhost} onClick={suggestName} disabled={loadingName}>
                    {loadingName ? <span className={c.spinner}></span> : "Suggest Name"}
                  </button>
                </div>
              </div>
            </form>
            <ul className={c.list}>
              {players.map(p => (
                <li key={p._id} className={c.row}>
                  <span>{p.name}</span>
                  <span className={c.badge}>Seated</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="order" className={c.section}>
            <div className={c.sectionLabel}>Your Pizza Order</div>
            <form onSubmit={handleSubmitOrder} className="space-y-3">
              <div className={c.formRow}>
                <label className={c.label}>Top Topping</label>
                <input className={c.input} placeholder="#1 Pick" value={t1} onChange={e => setT1(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Second Topping</label>
                <input className={c.input} placeholder="#2 Pick" value={t2} onChange={e => setT2(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Third Topping</label>
                <input className={c.input} placeholder="#3 Pick" value={t3} onChange={e => setT3(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Crust</label>
                <select className={c.select} value={crust} onChange={e => setCrust(e.target.value)}>
                  <option>Thin</option>
                  <option>Thick</option>
                  <option>Stuffed</option>
                </select>
              </div>
              <div className={c.actions}>
                <button type="submit" className={c.btnPrimary}>Lock In Order</button>
                <button type="button" className={c.btnSecondary} onClick={suggestToppings} disabled={loadingSuggest}>
                  {loadingSuggest ? <span className={c.spinner}></span> : "Suggest Toppings"}
                </button>
              </div>
            </form>
            <ul className={c.list}>
              {orders.length === 0 && <li className={c.row}><span>No orders locked in yet.</span></li>}
              {orders.map((o, i) => (
                <li key={o._id} className={c.row}>
                  <span className={c.rank}>{String(i+1).padStart(2,"0")}</span>
                  <span className="flex-1 truncate">{o.player} — {o.toppings.join(", ")} ({o.crust})</span>
                  <span className={c.badge}>Locked</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="quiz" className={c.section}>
            <div className={c.sectionLabel}>Brain Battle</div>
            <form onSubmit={handleStartQuiz} className={c.grid2}>
              <div className={c.formRow}>
                <label className={c.label}>Study Topic</label>
                <input className={c.input} placeholder="e.g. Cell Biology" value={topic} onChange={e => setTopic(e.target.value)} />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Difficulty</label>
                <select className={c.select} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <div className={c.actions}>
                  <button type="submit" className={c.btnPrimary} disabled={loadingQuiz}>
                    {loadingQuiz ? <><span className={c.spinner}></span> Generating</> : "Start Quiz"}
                  </button>
                  <button type="button" className={c.btnGhost} onClick={suggestTopic} disabled={loadingTopic}>
                    {loadingTopic ? <span className={c.spinner}></span> : "Suggest Topic"}
                  </button>
                </div>
              </div>
            </form>

            {quiz && quiz[qIndex] && (
              <div className={c.quizCard}>
                <div className={c.sectionLabel}>Question {qIndex+1} of {quiz.length} — Score {score}</div>
                <div className={c.qText}>{quiz[qIndex].q}</div>
                <ul className={c.optList}>
                  {quiz[qIndex].options.map((o, i) => (
                    <li key={i}><button onClick={() => handleAnswer(i)} className={c.opt} disabled={answered}>{o}</button></li>
                  ))}
                </ul>
              </div>
            )}

            <div className={c.sectionLabel}>Live Scoreboard</div>
            <ul className={c.list}>
              {scores.length === 0 && <li className={c.row}><span>No finished quizzes yet.</span></li>}
              {scores.slice().sort((a,b) => b.points - a.points).map((s, i) => (
                <li key={s._id} className={c.row}>
                  <span className={c.rank}>{String(i+1).padStart(2,"0")}</span>
                  <span className="flex-1 truncate">{s.player}</span>
                  <span className={c.badge}>{s.points} pts</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="reveal" className={c.section}>
            <div className={c.sectionLabel}>The Verdict</div>
            <div className={c.revealBox}>
              <div className={c.revealTitle}>{reveal ? `Champion: ${reveal.champion}` : "Awaiting Champion"}</div>
              <p className="font-mono text-sm">{reveal ? reveal.announcement : "The announcer is warming up the microphone."}</p>
              {reveal && <p className="font-bold uppercase tracking-wider">Toppings: {reveal.toppings.join(" / ")}</p>}
              <button onClick={handleReveal} className={c.btnPrimary} disabled={loadingReveal || scores.length === 0}>
                {loadingReveal ? <><span className={c.spinner}></span> Revealing</> : "Reveal Winning Pizza"}
              </button>
            </div>
          </section>

          <section id="history" className={c.section}>
            <div className={c.sectionLabel}>Past Showdowns</div>
            <ul className={c.list}>
              {sessions.length === 0 && <li className={c.row}><span>No past showdowns saved.</span></li>}
              {sessions.map(s => (
                <li key={s._id} className={c.row}>
                  <span className="flex-1 truncate">{s.code} — {s.topic}</span>
                  <span className={c.badge}>{(s.toppings||[])[0] || "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  )
}