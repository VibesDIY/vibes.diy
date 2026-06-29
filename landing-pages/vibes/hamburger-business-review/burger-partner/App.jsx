import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const MEAL_TIMES = ["breakfast", "lunch", "dinner", "late-night"]

function OrderForm({ viewer, partnerA, partnerB, mergeA, mergeB, onScore, isLoading, onSuggest, isSuggesting }) {
  const c = {
    grid: "grid grid-cols-1 sm:grid-cols-2 gap-4",
    card: "rounded-xl bg-white/5 border border-white/10 p-3 space-y-2",
    label: "block text-xs uppercase tracking-wide text-white/60 font-semibold",
    input: "w-full min-h-[44px] px-3 py-2 rounded-lg bg-[oklch(0.18_0.10_300)] border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-[oklch(0.88_0.18_95)]",
    name: "text-base font-['Fredoka',sans-serif] font-semibold text-[oklch(0.88_0.18_95)]",
    row: "flex gap-2",
    btn: "w-full min-h-[48px] rounded-xl bg-[oklch(0.47_0.18_295)] hover:bg-[oklch(0.38_0.17_295)] active:bg-[oklch(0.30_0.15_295)] text-white font-semibold font-['Fredoka',sans-serif] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors",
    suggest: "text-xs px-2 py-1 rounded-md bg-[oklch(0.70_0.15_155)] hover:bg-[oklch(0.70_0.15_155/0.8)] text-black font-semibold disabled:opacity-50 flex items-center gap-1",
    select: "w-full min-h-[44px] px-3 py-2 rounded-lg bg-[oklch(0.18_0.10_300)] border border-white/15 text-white focus:outline-none focus:border-[oklch(0.88_0.18_95)]",
    locked: "text-sm text-white/60 italic",
  }

  if (!viewer) {
    return <p className={c.locked}>Sign in to enter orders and score a new couple.</p>
  }

  function renderSide(label, p, merge) {
    return (
      <div className={c.card}>
        <div className="flex items-center justify-between">
          <h3 className={c.name}>{label}</h3>
          <button type="button" className={c.suggest} onClick={() => onSuggest(merge)} disabled={isSuggesting}>
            {isSuggesting ? <Spinner /> : <SparkIcon />} idea
          </button>
        </div>
        <label className={c.label}>Name</label>
        <input className={c.input} value={p.name} onChange={(e) => merge({ name: e.target.value })} placeholder="e.g. Sam" />
        <label className={c.label}>Chain</label>
        <input className={c.input} value={p.chain} onChange={(e) => merge({ chain: e.target.value })} placeholder="McDonald's, In-N-Out..." />
        <label className={c.label}>Go-to items</label>
        <input className={c.input} value={p.items} onChange={(e) => merge({ items: e.target.value })} placeholder="Double cheeseburger, fries..." />
        <label className={c.label}>Sauces</label>
        <input className={c.input} value={p.sauces} onChange={(e) => merge({ sauces: e.target.value })} placeholder="Ketchup, ranch..." />
        <div className={c.row}>
          <div className="flex-1">
            <label className={c.label}>Price ($)</label>
            <input type="number" className={c.input} value={p.price} onChange={(e) => merge({ price: e.target.value })} placeholder="12" />
          </div>
          <div className="flex-1">
            <label className={c.label}>Calories</label>
            <input type="number" className={c.input} value={p.calories} onChange={(e) => merge({ calories: e.target.value })} placeholder="900" />
          </div>
        </div>
        <label className={c.label}>Meal time</label>
        <select className={c.select} value={p.mealTime} onChange={(e) => merge({ mealTime: e.target.value })}>
          {MEAL_TIMES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={c.grid}>
        {renderSide("Partner A", partnerA, mergeA)}
        {renderSide("Partner B", partnerB, mergeB)}
      </div>
      <button className={c.btn} onClick={onScore} disabled={isLoading}>
        {isLoading ? <><Spinner /> Scoring...</> : <><HeartIcon /> Score compatibility</>}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  )
}

function VerdictCard({ scores, partnerA, partnerB, authorHandle, ViewerTag, fresh }) {
  const overall = scores.overall ?? 0
  const dims = [
    ["Chain overlap", scores.chainOverlap],
    ["Sauce agreement", scores.sauceAgreement],
    ["Price gap", scores.priceGap],
    ["Calorie gap", scores.calorieGap],
    ["Meal-time sync", scores.mealTimeAlignment],
  ]
  const ringColor = overall >= 75 ? "oklch(0.70 0.15 155)" : overall >= 50 ? "oklch(0.88 0.18 95)" : "oklch(0.55 0.20 25)"
  const c = {
    card: `rounded-2xl bg-gradient-to-br from-[oklch(0.30_0.15_295)] to-[oklch(0.18_0.10_300)] border ${fresh ? "border-[oklch(0.88_0.18_95)]" : "border-white/15"} p-4 space-y-3 shadow-lg`,
    header: "flex items-center justify-between gap-3",
    names: "text-lg font-['Fredoka',sans-serif] font-semibold",
    big: "text-3xl font-['Fredoka',sans-serif] font-bold",
    barRow: "flex items-center gap-2 text-xs",
    barLabel: "w-28 text-white/70",
    barTrack: "flex-1 h-2 rounded-full bg-white/10 overflow-hidden",
    barFill: "h-full rounded-full",
    barNum: "w-8 text-right text-white/80 font-mono",
    verdict: "text-sm text-white/85 italic leading-relaxed",
    meta: "flex items-center justify-between text-xs text-white/50 pt-2 border-t border-white/10",
  }
  return (
    <div className={c.card}>
      <div className={c.header}>
        <div>
          <div className={c.names}>{partnerA.name || "Partner A"} <span className="text-white/40">&</span> {partnerB.name || "Partner B"}</div>
          <div className="text-xs text-white/50">{partnerA.chain || "?"} × {partnerB.chain || "?"}</div>
        </div>
        <div className="text-right">
          <div className={c.big} style={{ color: ringColor }}>{overall}%</div>
          <div className="text-xs text-white/50">compatible</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {dims.map(([label, val]) => (
          <div key={label} className={c.barRow}>
            <span className={c.barLabel}>{label}</span>
            <span className={c.barTrack}>
              <span className={c.barFill} style={{ width: `${val ?? 0}%`, background: ringColor }} />
            </span>
            <span className={c.barNum}>{val ?? 0}</span>
          </div>
        ))}
      </div>
      <p className={c.verdict}>"{scores.verdict}"</p>
      {authorHandle && ViewerTag && (
        <div className={c.meta}>
          <span>scored by</span>
          <ViewerTag userHandle={authorHandle} />
        </div>
      )}
    </div>
  )
}

const emptyPartner = { name: "", chain: "", items: "", sauces: "", price: "", calories: "", mealTime: "lunch" }

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("burgerPartner")

  const [partnerA, setPartnerA] = React.useState(emptyPartner)
  const [partnerB, setPartnerB] = React.useState(emptyPartner)
  const [result, setResult] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [error, setError] = React.useState("")

  const mergeA = (patch) => setPartnerA((p) => ({ ...p, ...patch }))
  const mergeB = (patch) => setPartnerB((p) => ({ ...p, ...patch }))

  const { docs: verdicts } = useLiveQuery("type", { key: "verdict", descending: true })

  async function handleSuggest(merge) {
    setIsSuggesting(true)
    try {
      const res = await callAI("Invent one realistic fast-food order for a person. Return chain, items (comma list), sauces (comma list), price as number 5-20, calories as number 400-1400, and mealTime (breakfast, lunch, dinner, or late-night).", {
        schema: {
          properties: {
            chain: { type: "string" },
            items: { type: "string" },
            sauces: { type: "string" },
            price: { type: "number" },
            calories: { type: "number" },
            mealTime: { type: "string" },
          },
        },
      })
      const s = JSON.parse(res)
      merge({ chain: s.chain, items: s.items, sauces: s.sauces, price: String(s.price), calories: String(s.calories), mealTime: s.mealTime })
    } catch (e) {
      setError("Suggestion failed")
    } finally {
      setIsSuggesting(false)
    }
  }

  async function handleScore() {
    if (!viewer) return
    setError("")
    setIsLoading(true)
    try {
      const prompt = `You are a fast-food relationship analyst. Score compatibility between two people's go-to orders.

Partner A (${partnerA.name || "A"}): chain=${partnerA.chain}, items=${partnerA.items}, sauces=${partnerA.sauces}, price=$${partnerA.price}, calories=${partnerA.calories}, mealTime=${partnerA.mealTime}

Partner B (${partnerB.name || "B"}): chain=${partnerB.chain}, items=${partnerB.items}, sauces=${partnerB.sauces}, price=$${partnerB.price}, calories=${partnerB.calories}, mealTime=${partnerB.mealTime}

Return integer scores 0-100 for: chainOverlap, sauceAgreement, priceGap (100=identical, 0=huge gap), calorieGap (100=identical), mealTimeAlignment. overall is 0-100. verdict is a single paragraph (3-5 sentences) addressed to the couple.`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            chainOverlap: { type: "number" },
            sauceAgreement: { type: "number" },
            priceGap: { type: "number" },
            calorieGap: { type: "number" },
            mealTimeAlignment: { type: "number" },
            overall: { type: "number" },
            verdict: { type: "string" },
          },
        },
      })
      const parsed = JSON.parse(res)
      setResult(parsed)
      await database.put({
        type: "verdict",
        partnerA,
        partnerB,
        scores: parsed,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      })
      setPartnerA(emptyPartner)
      setPartnerB(emptyPartner)
    } catch (e) {
      setError("Scoring failed. Try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] text-white font-['Nunito',sans-serif]",
    header: "sticky top-0 z-10 backdrop-blur-md bg-[oklch(0.18_0.10_300/0.7)] border-b border-white/10 px-4 py-3 flex items-center justify-between",
    title: "text-xl font-['Fredoka',sans-serif] font-semibold tracking-tight",
    titleAccent: "text-[oklch(0.88_0.18_95)]",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24",
    section: "rounded-2xl bg-white/5 border border-white/10 p-4 shadow-lg shadow-black/20",
    sectionTitle: "text-base font-['Fredoka',sans-serif] font-semibold mb-3 text-[oklch(0.88_0.18_95)]",
    hint: "text-sm text-white/60",
  }

  if (isViewerPending) return <div className={c.page} />

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>
          Burger <span className={c.titleAccent}>Partner</span>
        </h1>
        <ViewerTag />
      </header>

      <main id="app" className={c.main}>
        <section id="intro" className={c.section}>
          <h2 className={c.sectionTitle}>How compatible are your orders?</h2>
          <p className={c.hint}>
            Two people, two fast-food orders. We'll score the chemistry and write you a verdict.
            {!viewer && " Sign in to score a new couple."}
          </p>
        </section>

        <section id="order-form-slot" className={c.section}>
          <h2 className={c.sectionTitle}>Enter both orders</h2>
          <OrderForm
            viewer={viewer}
            partnerA={partnerA}
            partnerB={partnerB}
            mergeA={mergeA}
            mergeB={mergeB}
            onScore={handleScore}
            isLoading={isLoading}
            onSuggest={handleSuggest}
            isSuggesting={isSuggesting}
          />
          {error && <p className="text-sm text-[oklch(0.55_0.20_25)] mt-2">{error}</p>}
        </section>

        {result && (
          <section id="score-panel-slot" className={c.section}>
            <h2 className={c.sectionTitle}>Latest verdict</h2>
            <VerdictCard scores={result} partnerA={partnerA} partnerB={partnerB} fresh />
          </section>
        )}

        <section id="card-gallery-slot" className={c.section}>
          <h2 className={c.sectionTitle}>Scored couples ({verdicts.length})</h2>
          {verdicts.length === 0 ? (
            <p className={c.hint}>No verdicts yet. Be the first.</p>
          ) : (
            <ul className="space-y-3">
              {verdicts.map((v) => (
                <li key={v._id}>
                  <VerdictCard scores={v.scores} partnerA={v.partnerA} partnerB={v.partnerB} authorHandle={v.authorHandle} ViewerTag={ViewerTag} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}