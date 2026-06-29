import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function BoundaryPlot({ score, reg }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    const w = 320, h = 140
    svg.attr("viewBox", `0 0 ${w} ${h}`)
    const pts = d3.range(60).map(() => ({ x: Math.random() * w, y: Math.random() * h, k: Math.random() > 0.5 }))
    svg.selectAll("circle").data(pts).enter().append("circle")
      .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", 3)
      .attr("fill", d => d.k ? "#22d3ee" : "#f472b6").attr("opacity", 0.8)
    const curve = d3.line().curve(d3.curveCardinal)
    const slope = reg ? Math.log(reg + 0.1) * 12 : 0
    const path = d3.range(0, w + 10, 10).map(x => [x, h / 2 + Math.sin(x / 30) * slope])
    svg.append("path").attr("d", curve(path)).attr("stroke", "#fbbf24").attr("stroke-width", 2).attr("fill", "none")
    if (score) {
      svg.append("text").attr("x", 8).attr("y", 18).attr("fill", "#fff").attr("font-size", 12)
        .text(`score ${score}`)
    }
  }, [score, reg])
  return <svg ref={ref} className="w-full h-40 rounded-xl bg-white/5 border border-white/10" />
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("ml-playground")
  const { doc: session, merge: mergeSession } = useDocument({
    _id: "current-session",
    dataset: null,
    method: null,
    regularization: 1.0,
  })
  const { docs: snapshots } = useLiveQuery("type", { key: "snapshot", descending: true })
  const [aiText, setAiText] = React.useState("")
  const [aiLoading, setAiLoading] = React.useState(false)
  const [runLoading, setRunLoading] = React.useState(false)
  const [pinned, setPinned] = React.useState([])

  const datasets = [
    { id: "irises", name: "Irises", desc: "150 flowers, 4 features, 3 classes" },
    { id: "two-moons", name: "Two Moons", desc: "Synthetic 2D, nonlinear" },
    { id: "mnist", name: "MNIST Digits", desc: "Handwritten 0–9, 64-D" },
    { id: "churn", name: "Customer Churn", desc: "Tabular, mixed features" },
  ]
  const methods = ["Logistic Regression", "Decision Tree", "Random Forest", "SVM", "k-Means", "PCA", "Neural Net"]

  async function runExperiment() {
    setRunLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      const score = (0.6 + Math.random() * 0.35).toFixed(3)
      mergeSession({ lastScore: score })
    } finally {
      setRunLoading(false)
    }
  }

  async function explainCurrent() {
    if (!session.dataset || !session.method) return
    setAiLoading(true)
    try {
      const prompt = `Explain in plain language: running ${session.method} on the ${session.dataset} dataset with regularization ${session.regularization}. What is the method doing? When does it shine? When does it break?`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            explanation: { type: "string" },
            shines: { type: "string" },
            breaks: { type: "string" },
          },
        },
      })
      const parsed = JSON.parse(res)
      setAiText(`${parsed.explanation}\n\nShines: ${parsed.shines}\n\nBreaks: ${parsed.breaks}`)
    } catch (e) {
      setAiText("Couldn't reach the tutor. Try again.")
    } finally {
      setAiLoading(false)
    }
  }

  async function saveSnapshot() {
    if (!session.dataset || !session.method) return
    await database.put({
      type: "snapshot",
      dataset: session.dataset,
      method: session.method,
      regularization: session.regularization,
      score: session.lastScore,
      createdAt: Date.now(),
      authorUserSlug: viewer?.userSlug,
      authorDisplayName: viewer?.displayName ?? viewer?.userSlug,
      authorAvatarUrl: viewer?.avatarUrl,
    })
  }

  function togglePin(id) {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)))
  }

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white pb-24",
    header: "sticky top-0 z-10 backdrop-blur-md bg-[#1e1b4b]/80 border-b border-white/10 px-4 py-3",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-purple-200/80",
    main: "max-w-3xl mx-auto px-4 py-4 space-y-4",
    section: "bg-black/30 border border-white/10 rounded-2xl p-4 shadow-lg",
    h2: "text-lg font-semibold mb-3 flex items-center gap-2",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#22d3ee] text-[#0f172a] font-semibold active:scale-95 transition disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm active:scale-95",
    input: "w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-200/50 focus:outline-none focus:border-[#22d3ee]",
    card: "p-3 rounded-xl bg-white/5 border border-white/10",
    chip: "inline-flex items-center px-2 py-1 rounded-full text-xs bg-white/10 border border-white/15",
    muted: "text-sm text-purple-200/70",
    avatar: "w-8 h-8 rounded-full border border-white/20",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className={c.title}>ML Playground</h1>
            <p className={c.tagline}>Pick a dataset. Try a method. See what breaks.</p>
          </div>
          {viewer && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-200/80 hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
              <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            </div>
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="dataset-picker" className={c.section}>
          <h2 className={c.h2}>1. Pick a dataset</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only view — current selection: {session.dataset ?? "none"}.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {datasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => mergeSession({ dataset: d.id })}
                    className={
                      c.card +
                      " text-left active:scale-95 " +
                      (session.dataset === d.id ? "ring-2 ring-[#22d3ee]" : "")
                    }
                  >
                    <div className="font-semibold">{d.name}</div>
                    <div className={c.muted}>{d.desc}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <div className={c.muted + " mb-1"}>Method</div>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => (
                    <button
                      key={m}
                      onClick={() => mergeSession({ method: m })}
                      className={
                        c.chip +
                        " active:scale-95 " +
                        (session.method === m ? "bg-[#22d3ee] text-[#0f172a] border-[#22d3ee]" : "")
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section id="experiment-runner" className={c.section}>
          <h2 className={c.h2}>2. Run experiment</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only — last CV score: {session.lastScore ?? "—"}</p>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <div className={c.muted + " mb-1"}>Regularization strength: {Number(session.regularization).toFixed(2)}</div>
                <input
                  type="range"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={session.regularization}
                  onChange={(e) => mergeSession({ regularization: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </label>
              <BoundaryPlot score={session.lastScore} reg={session.regularization} />
              <div className="flex items-center justify-between gap-2">
                <span className={c.muted}>CV score: {session.lastScore ?? "—"}</span>
                <div className="flex gap-2">
                  <button onClick={saveSnapshot} disabled={!session.lastScore} className={c.btnGhost}>Save snapshot</button>
                  <button onClick={runExperiment} disabled={runLoading || !session.dataset || !session.method} className={c.btn}>
                    {runLoading ? (
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                      </svg>
                    ) : "Run"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section id="ai-tutor" className={c.section}>
          <h2 className={c.h2}>3. Why does this matter?</h2>
          <p className={c.muted + " mb-3"}>
            {session.dataset && session.method
              ? `Tutor will explain ${session.method} on ${session.dataset}.`
              : "Pick a dataset and method first."}
          </p>
          {can("write") && (
            <button
              onClick={explainCurrent}
              disabled={aiLoading || !session.dataset || !session.method}
              className={c.btn}
            >
              {aiLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                  </svg>
                  Thinking…
                </span>
              ) : "Explain this"}
            </button>
          )}
          <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 min-h-[80px] whitespace-pre-wrap text-sm">
            {aiText || <span className={c.muted}>Tutor output will appear here.</span>}
          </div>
        </section>

        <section id="saved-experiments" className={c.section}>
          <h2 className={c.h2}>4. Saved snapshots</h2>
          {snapshots.length === 0 ? (
            <p className={c.muted}>No snapshots yet. Run an experiment and save it.</p>
          ) : (
            <ul className="space-y-2">
              {snapshots.map((s) => (
                <li key={s._id} className={c.card + " flex items-center justify-between gap-3"}>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.method} on {s.dataset}</div>
                    <div className={c.muted}>reg {Number(s.regularization).toFixed(2)} · score {s.score}</div>
                    {s.authorDisplayName && (
                      <div className="flex items-center gap-1 mt-1">
                        <img src={s.authorAvatarUrl} alt="" className="w-4 h-4 rounded-full" />
                        <span className="text-xs text-purple-200/60">{s.authorDisplayName}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => togglePin(s._id)}
                    className={c.btnGhost + " " + (pinned.includes(s._id) ? "bg-[#22d3ee]/30 border-[#22d3ee]" : "")}
                  >
                    {pinned.includes(s._id) ? "Pinned" : "Pin"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="compare-snapshots" className={c.section}>
          <h2 className={c.h2}>5. Compare pinned</h2>
          {pinned.length < 2 ? (
            <p className={c.muted}>Pin two snapshots above to compare them side-by-side.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {pinned.map((id) => {
                const s = snapshots.find((x) => x._id === id)
                if (!s) return null
                return (
                  <div key={id} className={c.card}>
                    <div className="font-semibold text-sm">{s.method}</div>
                    <div className={c.muted}>on {s.dataset}</div>
                    <div className="mt-2 text-2xl font-bold text-[#22d3ee]">{s.score}</div>
                    <div className={c.muted}>reg {Number(s.regularization).toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}