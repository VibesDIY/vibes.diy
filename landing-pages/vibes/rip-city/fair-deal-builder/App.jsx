import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const SEED = [
  { _id: "rent", label: "Arena Rent", lowM: 121, highM: 188, precedent: "Owner pays this in Raleigh, plus a Charlotte-style capital reserve.", order: 1 },
  { _id: "pilot", label: "Payment In Lieu Of Taxes", lowM: 165, highM: 330, precedent: "Peer-city standard; the building is tax-exempt today.", order: 2 },
  { _id: "revenue-share", label: "Premium Revenue Share", lowM: 80, highM: 140, precedent: "18% of gross premium club and naming. Peer standard.", order: 3 },
  { _id: "parking", label: "Event Parking Share", lowM: 50, highM: 100, precedent: "City takes 30% of gross event parking. Peer standard.", order: 4 },
  { _id: "development", label: "Rose Quarter Development", lowM: 150, highM: 250, precedent: "Ground rent plus property taxes. The owner signed this in Raleigh.", order: 5 },
  { _id: "naming", label: "Naming Rights Share", lowM: 40, highM: 100, precedent: "Share arena and district naming. Peer standard.", order: 6 },
  { _id: "user-fees", label: "Close Ticket-Fee Carve-Outs", lowM: 50, highM: 50, precedent: "Bridge-lease standard.", order: 7 },
  { _id: "operator-cash", label: "Operator Puts In Real Money", lowM: 245, highM: 245, precedent: "Peer-average private capital into revenue upgrades.", order: 8 },
]

const SEGMENT_COLORS = ["#2e3440", "#4c566a", "#5e6d7e", "#6b7280", "#7c8794", "#8b96a3", "#9aa5b2", "#a8b3c0"]
const SCALE_MAX = 1200 // millions
const RUBY = "#DA291C"

function useCountUp(target, duration = 700) {
  const [value, setValue] = React.useState(target)
  const fromRef = React.useRef(target)
  const startRef = React.useRef(0)
  React.useEffect(() => {
    fromRef.current = value
    startRef.current = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

function fmtM(n) {
  return `$${n.toFixed(0)}M`
}

function Header() {
  const c = {
    wrap: "border-b border-[var(--border)] px-5 py-6 md:px-10 md:py-8",
    eyebrow: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]",
    title: "text-2xl md:text-4xl font-semibold mt-2 text-[var(--text-primary)] leading-tight",
    sub: "text-sm md:text-base text-[var(--text-secondary)] mt-3 max-w-2xl leading-relaxed",
  }
  return (
    <header id="app-header" className={c.wrap}>
      <div className={c.eyebrow}>Public Ledger · Moda Center Negotiation</div>
      <h1 className={c.title}>Build Your Own Fair Deal</h1>
      <p className={c.sub}>
        The deal currently on the table returns the public essentially zero. Switch on the terms the same owner — or comparable cities — have already agreed to elsewhere, and see the projected twenty-year public return.
      </p>
    </header>
  )
}

function RunningTotal({ terms }) {
  const enabled = terms.filter((t) => t.enabled)
  const low = enabled.reduce((s, t) => s + t.lowM, 0)
  const high = enabled.reduce((s, t) => s + t.highM, 0)
  const animLow = useCountUp(low)
  const animHigh = useCountUp(high)
  const mid = (animLow + animHigh) / 2
  const pct = Math.min(100, (mid / SCALE_MAX) * 100)

  const c = {
    wrap: "px-5 md:px-10 py-8 border-b border-[var(--border)]",
    label: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]",
    total: "font-mono text-3xl md:text-5xl mt-2 text-[var(--text-primary)] tabular-nums",
    range: "text-[var(--text-secondary)] text-base md:text-lg mt-1 font-mono",
    caption: "text-sm text-[var(--text-secondary)] mt-3 italic",
    barWrap: "mt-6 relative h-3 bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] rounded-sm overflow-hidden",
    barFill: "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
    ticks: "flex justify-between text-xs font-mono text-[var(--text-secondary)] mt-2 tabular-nums",
  }

  return (
    <section className={c.wrap}>
      <div className={c.label}>Projected 20-Year Public Return</div>
      <div className={c.total}>{fmtM(animLow)} – {fmtM(animHigh)}</div>
      <div className={c.range}>vs. <span style={{ color: RUBY }}>$0</span> on the table today</div>
      <div className={c.barWrap}>
        <div className={c.barFill} style={{ width: `${pct}%`, background: RUBY }} />
        <div style={{ position: "absolute", left: `${(1100 / SCALE_MAX) * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--text-primary)", opacity: 0.3 }} />
      </div>
      <div className={c.ticks}>
        <span>$0</span><span>$300M</span><span>$600M</span><span>$900M</span><span>$1.2B</span>
      </div>
    </section>
  )
}

function StackedBar({ terms }) {
  const enabled = terms.filter((t) => t.enabled)
  const c = {
    wrap: "px-5 md:px-10 py-8 border-b border-[var(--border)]",
    label: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4",
    bar: "relative h-12 bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] rounded-sm overflow-hidden border border-[var(--border)]",
    empty: "absolute inset-0 flex items-center justify-center text-sm text-[var(--text-secondary)] italic",
    legend: "mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono text-[var(--text-secondary)]",
    legendItem: "flex items-center gap-2",
    swatch: "w-3 h-3 rounded-sm",
  }
  return (
    <section className={c.wrap}>
      <div className={c.label}>Composition (midpoint of range)</div>
      <div className={c.bar}>
        {enabled.length === 0 && <div className={c.empty}>No terms enabled. The current deal.</div>}
        {enabled.map((t, i) => {
          const mid = (t.lowM + t.highM) / 2
          const w = (mid / SCALE_MAX) * 100
          return (
            <div key={t._id} title={`${t.label}: ${fmtM(mid)}`}
              style={{ width: `${w}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], transition: "width 700ms ease-out" }}
              className="inline-block h-full align-top text-[10px] text-white px-2 py-1 overflow-hidden whitespace-nowrap font-mono">
              {t.label}
            </div>
          )
        })}
      </div>
      <div className={c.legend}>
        {enabled.map((t, i) => (
          <div key={t._id} className={c.legendItem}>
            <span className={c.swatch} style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
            <span>{t.label} · {fmtM((t.lowM + t.highM) / 2)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function TermRow({ term, database }) {
  const [saving, setSaving] = React.useState(false)
  const [context, setContext] = React.useState(null)
  const [loadingCtx, setLoadingCtx] = React.useState(false)

  async function toggle() {
    setSaving(true)
    try {
      await database.put({ ...term, enabled: !term.enabled })
    } finally {
      setSaving(false)
    }
  }

  async function fetchContext() {
    setLoadingCtx(true)
    try {
      const resp = await callAI(
        `Briefly compare this NBA arena deal term to known peer-city precedents in 2-3 dry factual sentences: "${term.label}" — ${term.precedent}. Cite specific cities or deals if known.`,
        { schema: { properties: { context: { type: "string" } } } }
      )
      const { context } = JSON.parse(resp)
      setContext(context)
    } catch (e) {
      setContext("Context unavailable.")
    } finally {
      setLoadingCtx(false)
    }
  }

  const c = {
    row: `px-5 md:px-10 py-5 border-b border-[var(--border)] transition-opacity ${saving ? "opacity-60" : ""}`,
    top: "flex items-start gap-4",
    toggle: "relative w-12 h-7 rounded-full transition-colors flex-shrink-0 mt-1",
    knob: "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all",
    body: "flex-1 min-w-0",
    label: "text-base md:text-lg font-medium text-[var(--text-primary)]",
    precedent: "text-sm text-[var(--text-secondary)] mt-1 leading-relaxed",
    range: "font-mono text-sm text-[var(--text-primary)] mt-2 tabular-nums",
    ctxBtn: "text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-2 underline underline-offset-2",
    ctxBox: "mt-3 p-3 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] border-l-2 text-sm text-[var(--text-primary)] leading-relaxed",
    saving: "text-xs text-[var(--text-secondary)] italic ml-2",
  }

  return (
    <div className={c.row}>
      <div className={c.top}>
        <button onClick={toggle} disabled={saving} className={c.toggle}
          style={{ background: term.enabled ? RUBY : "color-mix(in srgb, var(--text-primary) 15%, transparent)" }}
          aria-label={`Toggle ${term.label}`}>
          <span className={c.knob} style={{ left: term.enabled ? "1.375rem" : "0.125rem" }} />
        </button>
        <div className={c.body}>
          <div className={c.label}>
            {term.label}
            {saving && <span className={c.saving}>saving…</span>}
          </div>
          <div className={c.precedent}>{term.precedent}</div>
          <div className={c.range}>
            {term.lowM === term.highM ? fmtM(term.lowM) : `${fmtM(term.lowM)} – ${fmtM(term.highM)}`} over 20 years
          </div>
          <button onClick={fetchContext} disabled={loadingCtx} className={c.ctxBtn}>
            {loadingCtx ? (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
                Loading context
              </span>
            ) : context ? "Refresh context" : "Show precedent context"}
          </button>
          {context && (
            <div className={c.ctxBox} style={{ borderColor: RUBY }}>{context}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Controls({ terms, database }) {
  const [busy, setBusy] = React.useState(false)
  async function selectAll() {
    setBusy(true)
    try {
      await Promise.all(terms.filter((t) => !t.enabled).map((t) => database.put({ ...t, enabled: true })))
    } finally { setBusy(false) }
  }
  async function clearAll() {
    setBusy(true)
    try {
      await Promise.all(terms.filter((t) => t.enabled).map((t) => database.put({ ...t, enabled: false })))
    } finally { setBusy(false) }
  }
  const c = {
    wrap: "px-5 md:px-10 py-5 border-b border-[var(--border)] flex flex-wrap gap-3",
    btn: "px-4 py-3 min-h-[44px] text-sm uppercase tracking-wider border font-mono transition-colors",
    primary: "text-white",
    secondary: "border-[var(--border)] text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]",
  }
  return (
    <section className={c.wrap}>
      <button onClick={selectAll} disabled={busy} className={`${c.btn} ${c.primary}`} style={{ background: RUBY, borderColor: RUBY }}>
        Enable All Terms
      </button>
      <button onClick={clearAll} disabled={busy} className={`${c.btn} ${c.secondary}`}>
        Reset (Current Deal)
      </button>
    </section>
  )
}

function Footer() {
  const c = {
    wrap: "px-5 md:px-10 py-8 text-xs text-[var(--text-secondary)] leading-relaxed max-w-3xl",
  }
  return (
    <footer className={c.wrap}>
      Ranges are 20-year projections derived from publicly reported precedent deals and peer-city standards. Figures in U.S. dollars, millions. This tool is illustrative; it does not predict an outcome, only what comparable jurisdictions have already accepted as ordinary.
    </footer>
  )
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("fair-deal-terms")
  const { docs: terms } = useLiveQuery("order")

  React.useEffect(() => {
    (async () => {
      for (const seed of SEED) {
        try {
          await database.get(seed._id)
        } catch {
          await database.put({ ...seed, enabled: false })
        }
      }
    })()
  }, [database])

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    shell: "max-w-4xl mx-auto",
  }

  return (
    <>
      <style>{`
:root {
  --background: #fbf8f2;
  --accent: #DA291C;
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.14);
  --surface: rgba(255, 255, 255, 0.85);
  --primary: #DA291C;
  --secondary: #666;
  --font-family: Georgia, 'Times New Roman', serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --radius: 0.25rem;
  --spacing: 1rem;
  --border-width: 1px;
}
.font-mono, .tabular-nums { font-family: var(--font-family-mono); font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) {
  :root {
    --background: #14110d;
    --text-primary: rgba(245, 240, 230, 0.92);
    --text-secondary: rgba(245, 240, 230, 0.5);
    --border: rgba(245, 240, 230, 0.14);
    --surface: rgba(255, 255, 255, 0.04);
  }
}
      `}</style>
      <main id="app" className={c.page}>
        <div className={c.shell}>
          <Header />
          <RunningTotal terms={terms} />
          <StackedBar terms={terms} />
          <Controls terms={terms} database={database} />
          <section id="terms">
            {terms.map((t) => <TermRow key={t._id} term={t} database={database} />)}
          </section>
          <Footer />
        </div>
      </main>
    </>
  )
}