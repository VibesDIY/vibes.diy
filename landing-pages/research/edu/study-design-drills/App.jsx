import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("study-design-buddy")
  const { docs: attempts } = useLiveQuery("type", { key: "attempt", descending: true })

  const designs = ["cohort", "case-control", "cross-sectional"]
  const stats = designs.map(d => {
    const forDesign = attempts.filter(a => a.correctDesign === d)
    const correct = forDesign.filter(a => a.designCorrect).length
    return { design: d, correct, total: forDesign.length, pct: forDesign.length ? Math.round((correct / forDesign.length) * 100) : 0 }
  })
  const weakest = [...stats].sort((a, b) => (a.total === 0 ? 1 : a.pct) - (b.total === 0 ? 1 : b.pct))[0]?.design || "cohort"

  const [scenario, setScenario] = React.useState(null)
  const [pick, setPick] = React.useState("")
  const [justification, setJustification] = React.useState("")
  const [measure, setMeasure] = React.useState("")
  const [bias, setBias] = React.useState("")
  const [feedback, setFeedback] = React.useState(null)
  const [loadingScenario, setLoadingScenario] = React.useState(false)
  const [loadingGrade, setLoadingGrade] = React.useState(false)

  async function generateScenario() {
    setLoadingScenario(true)
    setFeedback(null)
    setPick(""); setJustification(""); setMeasure(""); setBias("")
    try {
      const focus = attempts.length > 0 ? weakest : designs[Math.floor(Math.random() * 3)]
      const res = await callAI(
        `Generate a short, realistic public-health research scenario (2-3 sentences) where the correct study design is ${focus}. Include enough detail (rare outcome? rare exposure? prevalence question? temporal need?) for a student to reason about the design choice. Also give the canonical measure of association and one classic selection bias for this design.`,
        { schema: { properties: {
          vignette: { type: "string", description: "2-3 sentence scenario" },
          correctDesign: { type: "string", description: "cohort, case-control, or cross-sectional" },
          correctMeasure: { type: "string", description: "e.g. odds ratio, risk ratio, prevalence ratio" },
          correctBias: { type: "string", description: "one canonical selection bias for this design" },
          reasoning: { type: "string", description: "Why this design fits" },
        }}}
      )
      setScenario(JSON.parse(res))
    } finally { setLoadingScenario(false) }
  }

  async function submitAnswer() {
    if (!scenario || !pick) return
    setLoadingGrade(true)
    try {
      const res = await callAI(
        `Grade this student's answer to an epidemiology scenario.\n\nScenario: ${scenario.vignette}\nCorrect design: ${scenario.correctDesign}\nCorrect measure: ${scenario.correctMeasure}\nCorrect bias example: ${scenario.correctBias}\n\nStudent's pick: ${pick}\nJustification: ${justification}\nMeasure named: ${measure}\nBias flagged: ${bias}\n\nGrade each part, explain reasoning, flag misconceptions.`,
        { schema: { properties: {
          designCorrect: { type: "boolean" },
          measureCorrect: { type: "boolean" },
          biasReasonable: { type: "boolean" },
          explanation: { type: "string", description: "2-3 sentence explanation of the correct answer" },
          misconception: { type: "string", description: "common misconception to watch for, or empty" },
        }}}
      )
      const graded = JSON.parse(res)
      setFeedback(graded)
      await database.put({
        type: "attempt",
        createdAt: Date.now(),
        vignette: scenario.vignette,
        correctDesign: scenario.correctDesign,
        pickedDesign: pick,
        designCorrect: graded.designCorrect,
        justification, measure, bias,
        measureCorrect: graded.measureCorrect,
        biasReasonable: graded.biasReasonable,
        explanation: graded.explanation,
        authorSlug: viewer?.userSlug || "anonymous",
        authorName: viewer?.displayName || "Anonymous",
      })
    } finally { setLoadingGrade(false) }
  }

  const Spinner = () => (
    <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
  )

  function CustomScenario({ database, viewer, c }) {
    const [text, setText] = React.useState("")
    const [pick, setPick] = React.useState("")
    const [result, setResult] = React.useState(null)
    const [loading, setLoading] = React.useState(false)

    async function grade() {
      if (!text || !pick) return
      setLoading(true)
      try {
        const res = await callAI(
          `Student wrote this research scenario: "${text}"\nThey think the right design is: ${pick}\n\nIs that the best choice? Explain in 2-3 sentences. Name the correct design, the canonical measure of association, and one selection bias.`,
          { schema: { properties: {
            studentCorrect: { type: "boolean" },
            bestDesign: { type: "string" },
            measure: { type: "string" },
            bias: { type: "string" },
            explanation: { type: "string" },
          }}}
        )
        const graded = JSON.parse(res)
        setResult(graded)
        await database.put({
          type: "custom",
          createdAt: Date.now(),
          text, pickedDesign: pick,
          ...graded,
          authorSlug: viewer?.userSlug || "anonymous",
        })
      } finally { setLoading(false) }
    }

    return (
      <div>
        <p className="text-sm text-purple-200/70 mb-3">Paste a research question from a news article and we'll grade your design choice.</p>
        <textarea className={c.input} rows="3" placeholder="e.g. Researchers want to know whether…" value={text} onChange={e => setText(e.target.value)} />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {["cohort", "case-control", "cross-sectional"].map(d => (
            <button key={d} onClick={() => setPick(d)} className={`${c.btnGhost} text-xs capitalize ${pick === d ? "ring-2 ring-[#a878f0] bg-white/10" : ""}`}>{d}</button>
          ))}
        </div>
        <button className={c.btn + " w-full mt-3"} onClick={grade} disabled={!text || !pick || loading}>
          {loading ? <><Spinner /> Grading…</> : "Grade my answer"}
        </button>
        {result && (
          <div className="mt-4 bg-[#1a1238]/50 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className={`${c.pill} ${result.studentCorrect ? c.pillGreen : c.pillRed}`}>Best: {result.bestDesign}</span>
              <span className={`${c.pill} ${c.pillGold}`}>Measure: {result.measure}</span>
            </div>
            <p className="text-sm text-purple-100">{result.explanation}</p>
            <p className="text-xs text-amber-200/80">Bias to watch: {result.bias}</p>
          </div>
        )}
      </div>
    )
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1b4a] to-[#150f30] text-white font-['Nunito',sans-serif] pb-24",
    header: "sticky top-0 z-10 bg-[#1a1238]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-purple-200/70",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section: "bg-[#3a2566]/40 border border-white/10 rounded-2xl p-5 shadow-lg",
    h2: "text-lg font-bold mb-3 flex items-center gap-2",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#6b3fc4] hover:bg-[#7d4dd6] active:bg-[#5a35a8] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-medium transition",
    input: "w-full bg-[#1a1238]/60 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-purple-200/40 focus:outline-none focus:border-[#a878f0]",
    pill: "px-3 py-1 rounded-full text-xs font-semibold",
    pillGreen: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
    pillGold: "bg-amber-400/20 text-amber-200 border border-amber-300/30",
    pillRed: "bg-rose-500/20 text-rose-300 border border-rose-400/30",
    avatar: "w-8 h-8 rounded-full border border-white/20",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Study Design Buddy</h1>
          <p className={c.tagline}>Cohort vs. case-control, drilled.</p>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="stats" className={c.section}>
          <h2 className={c.h2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>
            Your accuracy
          </h2>
          <div className="space-y-3">
            {stats.map(s => (
              <div key={s.design}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{s.design}{weakest === s.design && attempts.length > 0 && <span className="ml-2 text-amber-300 text-xs">← focus</span>}</span>
                  <span className="text-purple-200/70">{s.correct} / {s.total}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#6b3fc4] transition-all" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-200/60 mt-3">
            {attempts.length === 0 ? "Answer scenarios to fill these bars." : `${attempts.length} attempts logged. Weakest design gets prioritized.`}
          </p>
        </section>

        <section id="scenario" className={c.section}>
          <h2 className={c.h2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Scenario
          </h2>
          <div className="bg-[#1a1238]/50 rounded-xl p-4 mb-4 min-h-[80px] text-purple-100">
            {scenario ? <p className="italic">{scenario.vignette}</p> : <p className="italic text-purple-200/60">Tap "New scenario" to get a public-health vignette.</p>}
          </div>

          {!can("write") ? (
            <p className="text-sm text-purple-200/70 italic">Read-only view — contact the owner for write access to answer scenarios.</p>
          ) : !scenario ? (
            <button className={c.btn + " w-full"} onClick={generateScenario} disabled={loadingScenario}>
              {loadingScenario ? <><Spinner /> Generating…</> : "New scenario"}
            </button>
          ) : feedback ? (
            <div className="space-y-3">
              <div className="bg-[#1a1238]/50 rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`${c.pill} ${feedback.designCorrect ? c.pillGreen : c.pillRed}`}>
                    Design: {feedback.designCorrect ? "✓" : "✗"} {scenario.correctDesign}
                  </span>
                  <span className={`${c.pill} ${feedback.measureCorrect ? c.pillGreen : c.pillGold}`}>
                    Measure: {scenario.correctMeasure}
                  </span>
                  <span className={`${c.pill} ${feedback.biasReasonable ? c.pillGreen : c.pillGold}`}>
                    Bias: {scenario.correctBias}
                  </span>
                </div>
                <p className="text-sm text-purple-100">{feedback.explanation}</p>
                {feedback.misconception && <p className="text-xs text-amber-200/80">Watch out: {feedback.misconception}</p>}
              </div>
              <button className={c.btn + " w-full"} onClick={generateScenario} disabled={loadingScenario}>
                {loadingScenario ? <><Spinner /> Generating…</> : "Next scenario"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Which design fits?</label>
                <div className="grid grid-cols-3 gap-2">
                  {designs.map(d => (
                    <button key={d} onClick={() => setPick(d)} className={`${c.btnGhost} text-xs capitalize ${pick === d ? "ring-2 ring-[#a878f0] bg-white/10" : ""}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Justify in one sentence</label>
                <textarea className={c.input} rows="2" placeholder="Because…" value={justification} onChange={e => setJustification(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Measure of association</label>
                <input className={c.input} placeholder="e.g. odds ratio, risk ratio" value={measure} onChange={e => setMeasure(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">A potential selection bias</label>
                <input className={c.input} placeholder="e.g. healthy worker effect" value={bias} onChange={e => setBias(e.target.value)} />
              </div>
              <button className={c.btn + " w-full"} onClick={submitAnswer} disabled={!pick || loadingGrade}>
                {loadingGrade ? <><Spinner /> Grading…</> : "Submit answer"}
              </button>
            </div>
          )}
        </section>

        <section id="custom" className={c.section}>
          <h2 className={c.h2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Write your own
          </h2>
          {!can("write") ? (
            <p className="text-sm text-purple-200/70 italic">Read-only view — contact the owner for write access to submit custom scenarios.</p>
          ) : (
            <CustomScenario database={database} viewer={viewer} c={c} />
          )}
        </section>

        <section id="history" className={c.section}>
          <h2 className={c.h2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
            Recent attempts
          </h2>
          {attempts.length === 0 ? (
            <p className="text-sm text-purple-200/60 italic">No attempts yet. Start drilling above.</p>
          ) : (
            <ul className="space-y-3">
              {attempts.slice(0, 8).map(a => (
                <li key={a._id} className="bg-[#1a1238]/40 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm text-purple-100 flex-1">{a.vignette}</p>
                    <span className={`${c.pill} ${a.designCorrect ? c.pillGreen : c.pillRed} shrink-0`}>
                      {a.designCorrect ? "✓" : "✗"}
                    </span>
                  </div>
                  <p className="text-xs text-purple-200/60">
                    Picked <span className="capitalize font-semibold">{a.pickedDesign}</span> · correct was <span className="capitalize font-semibold">{a.correctDesign}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}