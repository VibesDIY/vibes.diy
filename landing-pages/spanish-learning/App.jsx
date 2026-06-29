import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const TOPICS = [
  { id: "ir", title: "IR — to go", kind: "table", emoji: "→",
    table: { headers: ["Person","Form"], rows: [["Yo","voy"],["Tú","vas"],["Él/Ella/Usted","va"],["Nosotros/as","vamos"],["Vosotros/as","vais"],["Ellos/Ellas/Ustedes","van"]] } },
  { id: "tener", title: "TENER — to have", kind: "table", emoji: "✋",
    table: { headers: ["Person","Form"], rows: [["Yo","tengo"],["Tú","tienes"],["Él/Ella/Usted","tiene"],["Nosotros/as","tenemos"],["Vosotros/as","tenéis"],["Ellos/Ellas/Ustedes","tienen"]] } },
  { id: "ser", title: "SER — to be", kind: "table", emoji: "★",
    table: { headers: ["Person","Present","Preterite"], rows: [["Yo","soy","fui"],["Tú","eres","fuiste"],["Él/Ella","es","fue"],["Nosotros","somos","fuimos"],["Vosotros","sois","fuisteis"],["Ellos","son","fueron"]] } },
  { id: "estar", title: "ESTAR — state/location", kind: "table", emoji: "📍",
    table: { headers: ["Person","Present","Preterite"], rows: [["Yo","estoy","estuve"],["Tú","estás","estuviste"],["Él/Ella","está","estuvo"],["Nosotros","estamos","estuvimos"],["Vosotros","estáis","estuvisteis"],["Ellos","están","estuvieron"]] } },
  { id: "iraInf", title: "IR + A + Infinitive", kind: "cards", emoji: "🚶",
    cards: [
      ["Are you going to run later?","¿Vas a correr más tarde?"],
      ["He is going to eat later in the afternoon","Él va a comer en la tarde"],
      ["They are going to walk at 3:00 p.m.","Van a caminar a las tres de la tarde"],
      ["We are going to drink coffee","Vamos a beber café"],
      ["I am going to do my Spanish homework","Voy a hacer mi tarea de español"],
      ["We are going to read the book","Nosotros vamos a leer el libro"],
      ["I am going to buy a car","Voy a comprar un coche"],
      ["They are going to watch a movie","Ellos van a ver una película"],
    ] },
  { id: "clothing", title: "Clothing", kind: "cards", emoji: "👗",
    cards: [
      ["The shirt (button-down)","la camisa"],
      ["Short-sleeved shirt","la camisa de manga corta"],
      ["The short pants","los pantalones cortos"],
      ["The sweater","el suéter"],
      ["The dress","el vestido"],
      ["The slippers","las pantuflas"],
      ["The suit","el traje"],
      ["The pants","los pantalones"],
      ["The blouse","la blusa"],
      ["The belt","el cinturón"],
      ["The skirt","la falda"],
      ["The raincoat","el impermeable"],
    ] },
  { id: "routine", title: "Bathroom & Routine", kind: "cards", emoji: "🪞",
    cards: [
      ["The routine","la rutina"],
      ["The bathroom","el cuarto de baño"],
      ["The alarm clock","el despertador"],
      ["The mirror","el espejo"],
      ["The soap","el jabón"],
      ["The toilet","el inodoro"],
      ["The makeup","el maquillaje"],
    ] },
  { id: "greetings", title: "Greetings & Goodbyes", kind: "cards", emoji: "👋",
    cards: [
      ["Good morning","Buenos días"],
      ["Good afternoon","Buenas tardes"],
      ["Good evening","Buenas noches"],
      ["Hello, hi","Hola"],
      ["Goodbye","Adiós"],
      ["Until later","Hasta luego"],
      ["How are you?","¿Cómo estás?"],
      ["I'm fine/okay","Estoy bien"],
      ["Thank you","Gracias"],
      ["What's your name?","¿Cómo se llama?"],
    ] },
  { id: "time", title: "Telling Time", kind: "cards", emoji: "⏰",
    cards: [
      ["11:15 pm","Son las once y quince de la noche"],
      ["12:00 am","Son las doce de la mañana"],
      ["8:30 pm","Son las ocho y treinta de la noche"],
      ["7:00 am","Son las siete de la mañana"],
      ["12:20 pm","Son las doce y veinte de la tarde"],
      ["5:00 am","Son las cinco de la mañana"],
      ["1:10 pm","Es la una y diez de la tarde"],
      ["10:45 am","Son las diez y cuarenta y cinco de la mañana"],
      ["3:15 pm","Son las tres y quince de la tarde"],
      ["12:00 pm","Son las doce de la tarde / Es mediodía"],
    ] },
  { id: "estarSentences", title: "Estar Sentences (Preterite)", kind: "cards", emoji: "📝",
    cards: [
      ["I was happy because the day was beautiful","Estuve feliz porque el día fue precioso"],
      ["You had the flu","Estuviste enfermo/a de la gripe"],
      ["My family and I were in Colorado last winter","Mi familia y yo estuvimos en Colorado el invierno pasado"],
      ["Ana was in Colombia with her sister","Ana estuvo en Colombia con su hermana"],
      ["Jaime and Peter were on the first floor of the school","Jaime y Peter estuvieron en el primer piso de la escuela"],
    ] },
  { id: "clothingSentences", title: "Clothing Sentences", kind: "cards", emoji: "✏️",
    cards: [
      ["He does not wear a shirt with his suit","Él no viste una camisa con su traje"],
      ["Juan wore a short-sleeved shirt on an autumn afternoon","Juan vistió una camisa de manga corta en una tarde de otoño"],
      ["Last summer, I didn't wear shorts","El verano pasado, no llevé pantalones cortos"],
      ["In the spring, John wore a green sweater every day","En la primavera, John llevó un suéter verde todos los días"],
      ["She wears large and comfortable pajamas in winter","Ella lleva pijamas grandes y cómodos en invierno"],
      ["Jaime wore some bear slippers during the cold nights in winter","Jaime llevó unas pantuflas de oso durante las noches frías en invierno"],
      ["Peter and I wore a suit with a tie and a vest last Friday","Peter y yo llevamos un traje con corbata y chaleco el viernes pasado"],
      ["On rainy days, I wore a raincoat every time","En los días lluviosos, llevé un impermeable cada vez"],
      ["I don't like to wear a belt on my pants","No me gusta llevar un cinturón en mis pantalones"],
      ["They (F) wear a blue, red, and white jacket in July","Ellas llevan una chaqueta azul, roja y blanca en julio"],
    ] },
  { id: "serVsIr", title: "Ser vs Ir (Preterite)", kind: "cards", emoji: "⚡",
    cards: [
      ["Yo ___ a la escuela ayer (ir)","Yo fui a la escuela ayer"],
      ["El martes Luis ___ a la feria (ir)","El martes Luis fue a la feria de Apple Blossom"],
      ["La prueba ___ fácil (ser)","La prueba fue fácil"],
      ["La muchacha ___ inocente del crimen (ser)","La muchacha fue inocente del crimen"],
      ["Los exámenes ___ muy importantes (ser)","Los exámenes fueron muy importantes para la clase"],
      ["¿___ tú al gimnasio anoche? (ir)","¿Fuiste tú al gimnasio anoche?"],
      ["Mi equipo ___ al partido de fútbol ayer (ir)","Mi equipo fue al partido de fútbol ayer"],
      ["Los gatos ___ traviesos (ser)","Los gatos fueron traviesos"],
      ["Anteayer yo ___ al carnaval (ir)","Anteayer yo fui al carnaval"],
      ["Carlos, Ana, y yo ___ actores en la película (ser)","Carlos, Ana, y yo fuimos actores en la película"],
    ] },
  { id: "future", title: "Future Tense", kind: "cards", emoji: "🔮",
    cards: [
      ["VER (he/she will see) — Tomorrow she will see a unique meteor shower","verá — Mañana verá una lluvia de estrellas única"],
      ["BAILAR (she will dance) — Marta will dance in the next competition","bailará — Marta bailará en la próxima competencia"],
      ["PENSAR (I will think) — I will think about your proposal","pensaré — Yo pensaré en tu propuesta"],
      ["ABRIR (you all will open) — You all will open a new shop","abriréis — Vosotros abriréis una nueva tienda"],
      ["REÍR (you will laugh) — You will laugh watching this video","reirás — Tú te reirás al ver este video"],
      ["LEER (he will read) — Carlos will read the welcome words","leerá — Carlos leerá las palabras de bienvenida"],
    ] },
]

function TopicGrid({ topics, progress, onPick, c }) {
  return (
    <section id="topic-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {topics.map(t => {
        const p = progress[t.id] || { studied: 0, total: t.kind === "cards" ? t.cards.length : t.table.rows.length }
        const pct = Math.min(100, Math.round((p.studied / p.total) * 100))
        return (
          <button key={t.id} onClick={() => onPick(t.id)} className={`text-left ${c.card} rounded-2xl p-4 min-h-[44px] active:scale-[0.98] transition`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{t.emoji}</span>
              <span className={`text-xs ${c.muted}`}>{pct}%</span>
            </div>
            <h3 className="font-bold text-lg mb-2">{t.title}</h3>
            <div className={`h-2 ${c.barTrack} rounded-full overflow-hidden`}>
              <div className={`h-full ${c.barFill} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </button>
        )
      })}
    </section>
  )
}

function ModePicker({ topic, onMode, onBack, c }) {
  const modes = [
    { id: "cards", label: "Flashcards", desc: "Tap to flip" },
    ...(topic.kind === "table" ? [{ id: "table", label: "Conjugation Table", desc: "Tap cells to reveal" }] : []),
    { id: "quiz", label: "Quiz", desc: "Multiple choice" },
  ]
  return (
    <section id="mode-picker">
      <button onClick={onBack} className={`mb-4 ${c.muted} text-sm`}>← All topics</button>
      <h2 className="text-2xl font-bold mb-4">{topic.title}</h2>
      <ul className="space-y-3">
        {modes.map(m => (
          <li key={m.id}>
            <button onClick={() => onMode(m.id)} className={`w-full text-left ${c.card} rounded-2xl p-4 min-h-[44px] active:scale-[0.98] transition`}>
              <div className="font-bold text-lg">{m.label}</div>
              <div className={`text-sm ${c.muted}`}>{m.desc}</div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Flashcards({ topic, onFlip, onBack, c, canWrite }) {
  const cards = topic.kind === "cards" ? topic.cards : topic.table.rows.map(r => [r[0], r.slice(1).join(" / ")])
  const [i, setI] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)
  const [seen, setSeen] = React.useState(new Set())

  const handleFlip = () => {
    if (!flipped && !seen.has(i)) {
      setSeen(prev => new Set(prev).add(i))
      if (canWrite) onFlip(topic.id, cards.length)
    }
    setFlipped(f => !f)
  }
  const next = () => { setFlipped(false); setI((i + 1) % cards.length) }
  const prev = () => { setFlipped(false); setI((i - 1 + cards.length) % cards.length) }

  const [front, back] = cards[i]

  return (
    <section id="flashcards">
      <button onClick={onBack} className={`mb-4 ${c.muted} text-sm`}>← Back</button>
      <div className="flex items-center justify-between mb-3">
        <span className={`${c.muted} text-sm`}>{i + 1} / {cards.length}</span>
        <span className={`${c.muted} text-sm`}>{seen.size} studied</span>
      </div>
      <button onClick={handleFlip} className={`w-full min-h-[280px] ${c.cardFlip} rounded-3xl p-6 flex items-center justify-center text-center transition-transform active:scale-[0.98]`} style={{ transform: flipped ? "rotateY(0deg)" : "rotateY(0deg)" }}>
        <div>
          <div className={`text-xs ${c.muted} mb-2`}>{flipped ? "Spanish" : "English"}</div>
          <div className="text-2xl font-bold">{flipped ? back : front}</div>
          <div className={`text-xs ${c.muted} mt-4`}>Tap to {flipped ? "see English" : "reveal Spanish"}</div>
        </div>
      </button>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={prev} className={`${c.btnSecondary} rounded-xl py-3 min-h-[44px] font-semibold`}>← Prev</button>
        <button onClick={next} className={`${c.btnPrimary} rounded-xl py-3 min-h-[44px] font-semibold`}>Next →</button>
      </div>
    </section>
  )
}

function ConjugationTable({ topic, onBack, c }) {
  const { headers, rows } = topic.table
  const [revealed, setRevealed] = React.useState({})
  const toggle = (r, col) => setRevealed(s => ({ ...s, [`${r}-${col}`]: !s[`${r}-${col}`] }))
  const revealAll = () => {
    const all = {}
    rows.forEach((row, r) => row.forEach((_, col) => { if (col > 0) all[`${r}-${col}`] = true }))
    setRevealed(all)
  }
  const hideAll = () => setRevealed({})

  return (
    <section id="conj-table">
      <button onClick={onBack} className={`mb-4 ${c.muted} text-sm`}>← Back</button>
      <h2 className="text-2xl font-bold mb-3">{topic.title}</h2>
      <div className="flex gap-2 mb-3">
        <button onClick={revealAll} className={`${c.btnSecondary} rounded-lg px-3 py-2 text-sm font-semibold`}>Show all</button>
        <button onClick={hideAll} className={`${c.btnSecondary} rounded-lg px-3 py-2 text-sm font-semibold`}>Hide all</button>
      </div>
      <div className={`${c.card} rounded-2xl overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className={c.tableHead}>
              {headers.map(h => <th key={h} className="p-3 text-left text-sm font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r % 2 ? c.tableRowAlt : ""}>
                {row.map((cell, col) => {
                  if (col === 0) return <td key={col} className="p-3 font-semibold">{cell}</td>
                  const key = `${r}-${col}`
                  const shown = revealed[key]
                  return (
                    <td key={col} className="p-2">
                      <button onClick={() => toggle(r, col)} className={`w-full min-h-[44px] rounded-lg px-2 py-2 ${shown ? c.cellRevealed : c.cellHidden} text-left font-semibold`}>
                        {shown ? cell : "Tap to reveal"}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Quiz({ topic, onAnswer, onBack, c, canWrite }) {
  const cards = topic.kind === "cards" ? topic.cards : topic.table.rows.map(r => [r[0], r.slice(1).join(" / ")])
  const [i, setI] = React.useState(0)
  const [options, setOptions] = React.useState(null)
  const [picked, setPicked] = React.useState(null)
  const [score, setScore] = React.useState({ right: 0, total: 0 })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const [front, back] = cards[i]

  const loadOptions = React.useCallback(async () => {
    setLoading(true); setError(null); setPicked(null); setOptions(null)
    try {
      const otherAnswers = cards.filter((_, idx) => idx !== i).map(c => c[1])
      const prompt = `Spanish learning quiz. The correct Spanish translation for "${front}" is "${back}". Generate 3 plausible but INCORRECT Spanish distractors that a beginner might confuse. Topic: ${topic.title}. Avoid these existing answers: ${otherAnswers.slice(0,5).join(", ")}. Return JSON.`
      const res = await callAI(prompt, {
        schema: { properties: { distractors: { type: "array", items: { type: "string" } } } }
      })
      const { distractors } = JSON.parse(res)
      const all = [back, ...(distractors || []).slice(0, 3)]
      while (all.length < 4) all.push("—")
      const shuffled = all.sort(() => Math.random() - 0.5)
      setOptions(shuffled)
    } catch (e) {
      setError("Couldn't load options. Try again.")
    } finally {
      setLoading(false)
    }
  }, [i, front, back, topic.title, cards])

  React.useEffect(() => { loadOptions() }, [loadOptions])

  const choose = (opt) => {
    if (picked) return
    setPicked(opt)
    const correct = opt === back
    setScore(s => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }))
    if (canWrite) onAnswer(topic.id, correct, cards.length)
  }
  const nextQ = () => { setI((i + 1) % cards.length) }

  return (
    <section id="quiz">
      <button onClick={onBack} className={`mb-4 ${c.muted} text-sm`}>← Back</button>
      <div className="flex items-center justify-between mb-3">
        <span className={`${c.muted} text-sm`}>Q {i + 1} / {cards.length}</span>
        <span className={`${c.muted} text-sm`}>Score {score.right}/{score.total}</span>
      </div>
      <div className={`${c.card} rounded-2xl p-5 mb-4`}>
        <div className={`text-xs ${c.muted} mb-2`}>Translate to Spanish</div>
        <div className="text-xl font-bold">{front}</div>
      </div>
      {loading && (
        <div className={`${c.muted} flex items-center gap-2 py-8 justify-center`}>
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
          Loading options…
        </div>
      )}
      {error && (
        <div className="text-center py-4">
          <p className={`${c.muted} mb-3`}>{error}</p>
          <button onClick={loadOptions} className={`${c.btnPrimary} rounded-xl px-4 py-2 font-semibold`}>Retry</button>
        </div>
      )}
      {options && (
        <ul className="space-y-2">
          {options.map((opt, idx) => {
            const isCorrect = picked && opt === back
            const isWrongPick = picked === opt && opt !== back
            return (
              <li key={idx}>
                <button onClick={() => choose(opt)} disabled={!!picked}
                  className={`w-full text-left rounded-xl p-3 min-h-[44px] font-semibold transition ${isCorrect ? c.optCorrect : isWrongPick ? c.optWrong : picked ? c.optDim : c.optIdle}`}>
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {picked && (
        <button onClick={nextQ} className={`w-full mt-4 ${c.btnPrimary} rounded-xl py-3 min-h-[44px] font-bold`}>Next question →</button>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("irmaSpanish")
  const [topicId, setTopicId] = React.useState(null)
  const [mode, setMode] = React.useState(null)

  const { docs: progressDocs } = useLiveQuery("type", { key: "progress" })
  const { docs: streakDocs } = useLiveQuery("type", { key: "studyDay" })

  const progress = React.useMemo(() => {
    const m = {}
    progressDocs.forEach(d => { m[d.topicId] = { studied: d.studied || 0, total: d.total || 1 } })
    return m
  }, [progressDocs])

  const streak = React.useMemo(() => {
    const days = new Set(streakDocs.map(d => d.day))
    let count = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (days.has(key)) count++; else if (i > 0) break
    }
    return count
  }, [streakDocs])

  const canWrite = !!viewer

  const recordStudyDay = async () => {
    const day = new Date().toISOString().slice(0, 10)
    const existing = streakDocs.find(d => d.day === day && d.userHandle === viewer?.userHandle)
    if (!existing && viewer) {
      await database.put({ type: "studyDay", day, userHandle: viewer.userHandle, createdAt: Date.now() })
    }
  }

  const onFlip = async (tid, total) => {
    const existing = progressDocs.find(d => d.topicId === tid)
    const studied = Math.min(total, (existing?.studied || 0) + 1)
    if (existing) {
      await database.put({ ...existing, studied, total })
    } else {
      await database.put({ type: "progress", topicId: tid, studied, total, createdAt: Date.now() })
    }
    recordStudyDay()
  }

  const onAnswer = async (tid, correct, total) => {
    if (correct) onFlip(tid, total)
    else recordStudyDay()
  }

  const topic = TOPICS.find(t => t.id === topicId)

  const c = {
    page: "min-h-screen text-white",
    card: "bg-white/10 backdrop-blur border border-white/10",
    cardFlip: "bg-gradient-to-br from-white/15 to-white/5 border border-white/20",
    muted: "text-white/60",
    barTrack: "bg-white/10",
    barFill: "bg-gradient-to-r from-emerald-400 to-yellow-300",
    btnPrimary: "bg-white text-purple-900 hover:bg-yellow-200 transition",
    btnSecondary: "bg-white/10 hover:bg-white/20 transition border border-white/10",
    tableHead: "bg-white/10",
    tableRowAlt: "bg-white/5",
    cellHidden: "bg-white/5 text-white/40 italic",
    cellRevealed: "bg-emerald-400/20 text-white",
    optIdle: "bg-white/10 hover:bg-white/20 border border-white/10",
    optCorrect: "bg-emerald-500/40 border border-emerald-300",
    optWrong: "bg-red-500/40 border border-red-300",
    optDim: "bg-white/5 border border-white/5 text-white/50",
  }

  if (isViewerPending) return null

  return (
    <div className={c.page} style={{ background: "linear-gradient(160deg, oklch(0.30 0.15 295), oklch(0.18 0.10 260))", fontFamily: "Nunito, sans-serif" }}>
      <main id="app" className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <header id="app-header" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <ViewerTag />
            <div className={`${c.card} rounded-full px-3 py-1 flex items-center gap-2`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-1 5 3 7"/></svg>
              <span className="text-sm font-bold">{streak} day{streak === 1 ? "" : "s"}</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>Irma's Spanish Study Guide</h1>
          <p className={`${c.muted} text-sm mt-1`}>
            {canWrite ? "Tap a topic to study. Your progress syncs everywhere." : "Read-only view — sign in to track progress."}
          </p>
        </header>

        {!topic && <TopicGrid topics={TOPICS} progress={progress} onPick={setTopicId} c={c} />}
        {topic && !mode && <ModePicker topic={topic} onMode={setMode} onBack={() => setTopicId(null)} c={c} />}
        {topic && mode === "cards" && <Flashcards topic={topic} onFlip={onFlip} onBack={() => setMode(null)} c={c} canWrite={canWrite} />}
        {topic && mode === "table" && <ConjugationTable topic={topic} onBack={() => setMode(null)} c={c} />}
        {topic && mode === "quiz" && <Quiz topic={topic} onAnswer={onAnswer} onBack={() => setMode(null)} c={c} canWrite={canWrite} />}
      </main>
    </div>
  )
}