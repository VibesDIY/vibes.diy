import React from "react"
import { useFireproof } from "use-fireproof"

const DEALS = [
  { _id: "sixers-new", name: "Philadelphia 76ers New Arena", location: "Philadelphia", year: 2025, type: "new build", costM: 1500, publicM: 0, privateM: 1500, privatePct: 100, rent: "privately financed", terms: "Fully private build." },
  { _id: "intuit-dome", name: "Intuit Dome (Clippers)", location: "Inglewood", year: 2024, type: "new build", costM: 2000, publicM: 0, privateM: 2000, privatePct: 100, rent: "privately financed", terms: "Owner kept naming rights, fully private." },
  { _id: "chase-center", name: "Chase Center (Warriors)", location: "San Francisco", year: 2019, type: "new build", costM: 1400, publicM: 0, privateM: 1400, privatePct: 100, rent: "privately financed", terms: "Fully private build." },
  { _id: "climate-pledge", name: "Climate Pledge Arena", location: "Seattle", year: 2021, type: "renovation", costM: 1150, publicM: 0, privateM: 1150, privatePct: 100, rent: "39-year lease", terms: "Privately financed renovation with no public subsidy." },
  { _id: "rocket-mortgage", name: "Rocket Mortgage FieldHouse (Cavaliers)", location: "Cleveland", year: 2019, type: "renovation", costM: 185, publicM: 70, privateM: 115, privatePct: 62, rent: "long-term lease", terms: "Owner absorbed cost overruns." },
  { _id: "little-caesars", name: "Little Caesars Arena (Pistons)", location: "Detroit", year: 2017, type: "new build", costM: 863, publicM: 324, privateM: 539, privatePct: 60, rent: "shared tenancy", terms: "Shared with the NHL Red Wings." },
  { _id: "golden-1", name: "Golden 1 Center (Kings)", location: "Sacramento", year: 2016, type: "new build", costM: 535, publicM: 255, privateM: 280, privatePct: 52, rent: "hard cost cap", terms: "Team absorbed a $57M overrun." },
  { _id: "fiserv-forum", name: "Fiserv Forum (Bucks)", location: "Milwaukee", year: 2018, type: "new build", costM: 524, publicM: 250, privateM: 274, privatePct: 52, rent: "30-year non-relocation clause", terms: "About $60M in ticket surcharge over 30 years." },
  { _id: "spurs-new", name: "San Antonio Spurs New Arena", location: "San Antonio", year: 2027, type: "new build", costM: 1300, publicM: 800, privateM: 500, privatePct: 38, rent: "$4M per year rent", terms: "Plus $2.5M per year in community benefits." },
  { _id: "capital-one", name: "Capital One Arena", location: "Washington DC", year: 2025, type: "renovation", costM: 800, publicM: 515, privateM: 285, privatePct: 36, rent: "rent through 2050", terms: "Public rent of $1.5–2.3M per year through 2050." },
  { _id: "state-farm", name: "State Farm Arena (Hawks)", location: "Atlanta", year: 2018, type: "renovation", costM: 193, publicM: 143, privateM: 50, privatePct: 26, rent: "lease through 2046", terms: "Lease locked through 2046." },
  { _id: "gainbridge", name: "Gainbridge Fieldhouse (Pacers)", location: "Indianapolis", year: 2021, type: "renovation", costM: 360, publicM: 295, privateM: 65, privatePct: 18, rent: "long-term lease", terms: "Long-term lease commitment." },
  { _id: "okc-new", name: "OKC New Arena (Thunder)", location: "Oklahoma City", year: 2028, type: "new build", costM: 900, publicM: 850, privateM: 50, privatePct: 6, rent: "rent plus 3% escalator", terms: "Roughly a $1B relocation penalty in the early years." },
  { _id: "spectrum", name: "Spectrum Center (Hornets)", location: "Charlotte", year: 2021, type: "renovation", costM: 245, publicM: 245, privateM: 0, privatePct: 0, rent: "$2M per year rent", terms: "Plus a $1.1M per year capital fund." },
  { _id: "fedex-forum", name: "FedExForum (Grizzlies)", location: "Memphis", year: 2020, type: "renovation", costM: 550, publicM: 550, privateM: 0, privatePct: 0, rent: "lease extension", terms: "Publicly funded with a lease extension secured." },
  { _id: "moda-center", name: "Moda Center (PROPOSED, Trail Blazers)", location: "Portland", year: 2026, type: "renovation", costM: 600, publicM: 600, privateM: 0, privatePct: 0, rent: "$1 per year", terms: "Zero private capital, zero rent, zero revenue share, no relocation penalty.", proposed: true },
]

const INK = "#1a1a1a"
const MUTED = "#6b6b6b"
const PAPER = "#f7f3ea"
const RUBY = "#DA291C"
const HAIRLINE = "#d8d2c2"

export default function App() {
  const { database, useLiveQuery } = useFireproof("arena-deals")
  const { docs, status } = useLiveQuery("_id")
  const [sortKey, setSortKey] = React.useState("privatePct")
  const [selected, setSelected] = React.useState(null)
  const [seeded, setSeeded] = React.useState(false)

  React.useEffect(() => {
    if (seeded) return
    if (status === "loading") return
    if (docs.length >= DEALS.length) { setSeeded(true); return }
    let cancelled = false
    ;(async () => {
      const existing = new Set(docs.map(d => d._id))
      for (const d of DEALS) {
        if (cancelled) return
        if (!existing.has(d._id)) {
          try { await database.put(d) } catch {}
        }
      }
      if (!cancelled) setSeeded(true)
    })()
    return () => { cancelled = true }
  }, [status, docs.length, seeded, database])

  const sorted = React.useMemo(() => {
    const arr = docs.filter(d => d.name)
    if (sortKey === "privatePct") {
      return [...arr].sort((a, b) => b.privatePct - a.privatePct || b.costM - a.costM)
    }
    return [...arr].sort((a, b) => b.costM - a.costM)
  }, [docs, sortKey])

  const maxCost = React.useMemo(() => Math.max(1, ...sorted.map(d => d.costM)), [sorted])

  return (
    <main style={{ background: PAPER, minHeight: "100vh", color: INK, fontFamily: "Georgia, 'Times New Roman', serif", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 28, marginBottom: 36 }}>
          <div style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 11, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase", marginBottom: 12 }}>A Public Ledger · Sixteen Deals</div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", margin: 0, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1 }}>The Subsidy Scoreboard</h1>
          <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, marginTop: 18, maxWidth: 720 }}>
            Recent major North American sports-arena projects, ranked by the share of construction cost paid with private capital. The Portland Moda Center proposal is shown in <span style={{ color: RUBY, fontWeight: 600 }}>ruby</span> for comparison.
          </p>
        </header>

        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase" }}>Sort by</div>
          <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 2 }}>
            <SortButton active={sortKey === "privatePct"} onClick={() => setSortKey("privatePct")}>Private share</SortButton>
            <SortButton active={sortKey === "costM"} onClick={() => setSortKey("costM")}>Total cost</SortButton>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 18, alignItems: "center", fontSize: 12, color: MUTED, fontFamily: "ui-monospace, monospace" }}>
            <LegendSwatch color={INK} label="Other deals" />
            <LegendSwatch color={RUBY} label="Portland (proposed)" />
          </div>
        </div>

        <Chart deals={sorted} sortKey={sortKey} maxCost={maxCost} onSelect={setSelected} selected={selected} />

        <section style={{ marginTop: 56, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 28, maxWidth: 760, fontSize: 14, lineHeight: 1.7, color: MUTED }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: INK, marginBottom: 10 }}>A note on the bars near zero</div>
          Several of the public-heavy deals at the bottom of this chart still secured real rent, revenue-sharing, or relocation penalties — Oklahoma City's roughly $1B relocation penalty, Charlotte's $2M annual rent plus capital fund, Washington's rent through 2050. The Portland proposal includes none of these. So the chart, as drawn, understates how far the Moda Center proposal sits from the norm.
        </section>

        {selected && <DetailPanel deal={selected} onClose={() => setSelected(null)} />}
      </div>
    </main>
  )
}

function SortButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? INK : "transparent",
      color: active ? PAPER : INK,
      border: "none",
      padding: "9px 16px",
      fontSize: 12,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      cursor: "pointer",
      fontFamily: "ui-monospace, monospace",
      transition: "background 0.2s, color 0.2s",
    }}>{children}</button>
  )
}

function LegendSwatch({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 18, height: 10, background: color, display: "inline-block" }} />
      {label}
    </span>
  )
}

function Chart({ deals, sortKey, maxCost, onSelect, selected }) {
  const rowH = 38
  const gap = 8
  const labelW = 280
  const rightPad = 90
  const topPad = 36
  const bottomPad = 24
  const [width, setWidth] = React.useState(1000)
  const wrapRef = React.useRef(null)

  React.useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.max(560, e.contentRect.width))
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const compact = width < 720
  const effLabelW = compact ? 160 : labelW
  const barAreaW = Math.max(120, width - effLabelW - rightPad)
  const height = topPad + bottomPad + deals.length * (rowH + gap)

  const ticks = sortKey === "privatePct"
    ? [0, 25, 50, 75, 100]
    : [0, 500, 1000, 1500, 2000].filter(t => t <= maxCost * 1.05)

  const scale = (d) => sortKey === "privatePct"
    ? (d.privatePct / 100) * barAreaW
    : (d.costM / maxCost) * barAreaW

  const tickX = (t) => sortKey === "privatePct"
    ? (t / 100) * barAreaW
    : (t / maxCost) * barAreaW

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width={width} height={height} style={{ display: "block", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>
        {ticks.map(t => (
          <g key={t} transform={`translate(${effLabelW + tickX(t)},0)`}>
            <line x1={0} x2={0} y1={topPad - 6} y2={height - bottomPad} stroke={HAIRLINE} strokeWidth={1} />
            <text x={0} y={topPad - 12} fill={MUTED} fontSize={10} textAnchor="middle" letterSpacing="0.1em">
              {sortKey === "privatePct" ? `${t}%` : `$${t}M`}
            </text>
          </g>
        ))}
        <text x={effLabelW} y={14} fill={INK} fontSize={11} letterSpacing="0.15em">
          {sortKey === "privatePct" ? "PRIVATE SHARE OF CONSTRUCTION COST" : "TOTAL PROJECT COST"}
        </text>

        {deals.map((d, i) => {
          const y = topPad + i * (rowH + gap)
          const w = scale(d)
          const isPortland = d.proposed
          const color = isPortland ? RUBY : INK
          const isSelected = selected && selected._id === d._id
          return (
            <g key={d._id} transform={`translate(0, ${y})`} style={{ cursor: "pointer", transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)" }} onClick={() => onSelect(d)}>
              <rect x={0} y={0} width={width} height={rowH} fill={isSelected ? "rgba(218,41,28,0.04)" : "transparent"} />
              <text x={effLabelW - 12} y={rowH / 2 + 4} textAnchor="end" fill={isPortland ? RUBY : INK} fontSize={compact ? 10 : 12} fontFamily="Georgia, serif" fontWeight={isPortland ? 600 : 400}>
                {truncate(d.name, compact ? 22 : 38)}
              </text>
              <rect
                x={effLabelW}
                y={rowH / 2 - 9}
                width={Math.max(1, w)}
                height={18}
                fill={color}
                style={{ transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1), fill 0.3s" }}
              >
                <title>{d.name}: {d.privatePct}% private · ${d.costM}M total</title>
              </rect>
              <text x={effLabelW + w + 8} y={rowH / 2 + 4} fill={color} fontSize={11} fontWeight={isPortland ? 700 : 500}>
                {sortKey === "privatePct" ? `${d.privatePct}%` : `$${d.costM}M`}
              </text>
              {isPortland && (
                <text x={effLabelW + Math.max(w, 0) + (sortKey === "privatePct" ? 44 : 60)} y={rowH / 2 + 4} fill={RUBY} fontSize={9} letterSpacing="0.18em" fontWeight={700}>
                  PROPOSED
                </text>
              )}
            </g>
          )
        })}

        <line x1={effLabelW} x2={effLabelW} y1={topPad - 6} y2={height - bottomPad} stroke={INK} strokeWidth={1} />
      </svg>
    </div>
  )
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…"
}

function DetailPanel({ deal, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: PAPER, maxWidth: 560, width: "100%", padding: "36px 36px 32px", border: `1px solid ${INK}`, fontFamily: "Georgia, serif", position: "relative" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 14, background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: INK, lineHeight: 1 }}>×</button>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>
          {deal.location} · {deal.year} · {deal.type}
        </div>
        <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 500, color: deal.proposed ? RUBY : INK, letterSpacing: "-0.01em" }}>{deal.name}</h2>

        <Row label="Total cost" value={`$${deal.costM}M`} />
        <Row label="Public capital" value={`$${deal.publicM}M (${100 - deal.privatePct}%)`} />
        <Row label="Private capital" value={`$${deal.privateM}M (${deal.privatePct}%)`} accent={deal.proposed} />
        <Row label="Annual rent" value={deal.rent} />

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${HAIRLINE}`, fontSize: 14, lineHeight: 1.65, color: INK }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Notable terms</div>
          {deal.terms}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}`, fontSize: 14 }}>
      <span style={{ color: MUTED, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "ui-monospace, monospace", color: accent ? RUBY : INK, fontWeight: accent ? 700 : 500 }}>{value}</span>
    </div>
  )
}