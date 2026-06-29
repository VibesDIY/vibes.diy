import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CHANNELS = [
  { id: "kiosk", label: "KIOSK", automated: true },
  { id: "app", label: "MOBILE_APP", automated: true },
  { id: "drive_thru", label: "DRIVE_THRU", automated: false },
  { id: "cashier", label: "HUMAN_CASHIER", automated: false },
]

function ThemeStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');
      :root {
        --background: oklch(0.16 0.000 0);
        --terminal: oklch(0.00 0.000 0 / 0.85);
        --green: oklch(0.87 0.30 142);
        --green-dim: oklch(0.87 0.30 142 / 0.4);
        --green-border: oklch(0.87 0.30 142 / 0.3);
        --green-faint: oklch(0.87 0.30 142 / 0.1);
        --white: oklch(1.00 0.000 0);
        --warning: #f59e0b;
        --error: #ef4444;
        --font-family: 'VT323', ui-monospace, monospace;
        --radius: 0.25rem;
        --spacing: 1rem;
        --border-width: 1px;
      }
      body { background: var(--background); }
      #app { animation: flicker 6s infinite; }
      @keyframes flicker { 0%,100%{opacity:1} 97%{opacity:0.96} 98%{opacity:1} }
      .scanlines { background-image: repeating-linear-gradient(0deg, transparent 0, transparent 2px, oklch(0 0 0 / 0.15) 2px, oklch(0 0 0 / 0.15) 3px); }
    `}</style>
  )
}

function LogVisit({ c, viewer, database }) {
  const [restaurant, setRestaurant] = React.useState("")
  const [busy, setBusy] = React.useState(null)

  async function log(channelId) {
    if (!viewer || busy) return
    setBusy(channelId)
    try {
      await database.put({
        type: "visit",
        channel: channelId,
        restaurant: restaurant.trim() || null,
        createdAt: Date.now(),
        authorHandle: viewer.userHandle,
      })
      setRestaurant("")
    } finally {
      setBusy(null)
    }
  }

  if (!viewer) {
    return (
      <section id="log-visit" className={c.section}>
        <h2 className={c.h2}>&gt; LOG_VISIT</h2>
        <p className={c.muted}>// ACCESS DENIED — authenticate to log entries</p>
      </section>
    )
  }

  return (
    <section id="log-visit" className={c.section}>
      <h2 className={c.h2}>&gt; LOG_VISIT</h2>
      <input
        className={c.input + " mb-2"}
        placeholder="restaurant_name (optional)"
        value={restaurant}
        onChange={(e) => setRestaurant(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => log(ch.id)}
            disabled={busy !== null}
            className={c.btn + " text-left"}
          >
            {busy === ch.id ? (
              <svg className="animate-spin inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
            ) : "[+] "}
            {ch.label}
            <div className="text-xs text-[var(--green-dim)]">{ch.automated ? "// automated" : "// human"}</div>
          </button>
        ))}
      </div>
    </section>
  )
}

function Ledger({ c, visits, database, viewer }) {
  const labelFor = (id) => CHANNELS.find((ch) => ch.id === id)?.label || id
  return (
    <section id="ledger" className={c.section}>
      <h2 className={c.h2}>&gt; LEDGER.dat <span className="text-[var(--green-dim)] text-sm">({visits.length})</span></h2>
      {visits.length === 0 ? (
        <p className={c.muted}>// no entries yet — log a visit above</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {visits.map((v) => (
            <li key={v._id} className="flex items-center justify-between gap-2 text-sm border-b border-[var(--green-faint)] py-1">
              <span className="text-[var(--green)]">
                [{new Date(v.createdAt).toISOString().slice(5,16).replace("T"," ")}] {labelFor(v.channel)}
                {v.restaurant && <span className="text-[var(--green-dim)]"> @ {v.restaurant}</span>}
              </span>
              {viewer?.userHandle === v.authorHandle && (
                <button onClick={() => database.del(v._id)} className="text-[var(--error)] text-xs px-2 py-1 hover:underline">[del]</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Tally({ c, visits }) {
  const total = visits.length
  const counts = CHANNELS.map((ch) => ({
    ...ch,
    n: visits.filter((v) => v.channel === ch.id).length,
  }))
  const automated = counts.filter((x) => x.automated).reduce((a, x) => a + x.n, 0)
  const ratio = total ? (automated / total) * 100 : 0

  return (
    <section id="tally" className={c.section}>
      <h2 className={c.h2}>&gt; AUTOMATION_RATIO</h2>
      {total === 0 ? (
        <p className={c.muted}>// awaiting first entry</p>
      ) : (
        <>
          <div className="text-3xl text-[var(--green)] mb-2">{ratio.toFixed(1)}<span className="text-base text-[var(--green-dim)]">% automated ({automated}/{total})</span></div>
          <ul className="space-y-1">
            {counts.map((ch) => {
              const pct = total ? (ch.n / total) * 100 : 0
              return (
                <li key={ch.id} className="text-sm">
                  <div className="flex justify-between text-[var(--green-dim)]">
                    <span>{ch.label} {ch.automated ? "[A]" : "[H]"}</span>
                    <span>{ch.n} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-[var(--green-faint)] rounded-[var(--radius)] overflow-hidden">
                    <div className="h-full bg-[var(--green)]" style={{ width: pct + "%" }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function Projection({ c, visits, viewer }) {
  const [proj, setProj] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState(null)
  const svgRef = React.useRef(null)

  const total = visits.length
  const humanCount = visits.filter((v) => {
    const ch = CHANNELS.find((x) => x.id === v.channel)
    return ch && !ch.automated
  }).length
  const humanPct = total ? (humanCount / total) * 100 : 0

  async function runProjection() {
    if (loading || total < 3) return
    setLoading(true); setErr(null)
    try {
      const summary = CHANNELS.map((ch) => `${ch.label}:${visits.filter(v=>v.channel===ch.id).length}`).join(", ")
      const firstTs = visits.length ? Math.min(...visits.map(v=>v.createdAt)) : Date.now()
      const days = Math.max(1, (Date.now() - firstTs) / 86400000)
      const prompt = `Given fast-food order channel counts over ${days.toFixed(1)} days: ${summary}. Human cashier currently ${humanPct.toFixed(1)}% of orders. Project when human-cashier orders drop below 5% of visits. Return JSON with extinctionDate (ISO), confidence (0-1), commentary (one sardonic sentence about automation), and trajectory (array of {monthsFromNow:int, humanPct:number} for next 24 months).`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            extinctionDate: { type: "string" },
            confidence: { type: "number" },
            commentary: { type: "string" },
            trajectory: {
              type: "array",
              items: { type: "object", properties: { monthsFromNow: { type: "number" }, humanPct: { type: "number" } } }
            }
          }
        }
      })
      setProj(JSON.parse(res))
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (!proj?.trajectory?.length || !svgRef.current) return
    const data = proj.trajectory
    const width = 320, height = 160, m = { top: 10, right: 10, bottom: 24, left: 28 }
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${width} ${height}`).style("width", "100%").style("height", "auto")
    const x = d3.scaleLinear().domain(d3.extent(data, d=>d.monthsFromNow)).range([m.left, width-m.right])
    const y = d3.scaleLinear().domain([0, 100]).range([height-m.bottom, m.top])
    const line = d3.line().x(d=>x(d.monthsFromNow)).y(d=>y(d.humanPct)).curve(d3.curveMonotoneX)
    svg.append("line").attr("x1", m.left).attr("x2", width-m.right).attr("y1", y(5)).attr("y2", y(5))
      .attr("stroke", "oklch(0.87 0.30 142 / 0.4)").attr("stroke-dasharray", "2 3")
    svg.append("path").datum(data).attr("fill", "none").attr("stroke", "oklch(0.87 0.30 142)").attr("stroke-width", 1.5).attr("d", line)
    svg.append("g").attr("transform", `translate(0,${height-m.bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(d=>d+"mo"))
      .selectAll("text,line,path").attr("stroke", "oklch(0.87 0.30 142 / 0.4)").attr("fill", "oklch(0.87 0.30 142)").attr("font-family", "VT323")
    svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d=>d+"%"))
      .selectAll("text,line,path").attr("stroke", "oklch(0.87 0.30 142 / 0.4)").attr("fill", "oklch(0.87 0.30 142)").attr("font-family", "VT323")
  }, [proj])

  return (
    <section id="projection" className={c.section}>
      <h2 className={c.h2}>&gt; HUMAN_EXTINCTION_PROJECTION</h2>
      {total < 3 ? (
        <p className={c.muted}>// need at least 3 entries to project (have {total})</p>
      ) : (
        <>
          {viewer && (
            <button onClick={runProjection} disabled={loading} className={c.btnPrimary + " mb-2"}>
              {loading ? (
                <><svg className="animate-spin inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>COMPUTING...</>
              ) : "[RUN] PROJECT_EXTINCTION"}
            </button>
          )}
          {err && <p className="text-[var(--error)] text-sm">// ERR: {err}</p>}
          {proj && (
            <div>
              <div className="text-sm text-[var(--green-dim)] mb-1">
                EXTINCTION_DATE: <span className="text-[var(--green)]">{proj.extinctionDate}</span> ·
                CONFIDENCE: <span className="text-[var(--green)]">{(proj.confidence*100).toFixed(0)}%</span>
              </div>
              <p className="text-[var(--green)] italic text-sm mb-2">// {proj.commentary}</p>
              <svg ref={svgRef} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("automatonLedger")
  const { docs: visits } = useLiveQuery("createdAt", { descending: true, limit: 500 })

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--green)] font-[var(--font-family)] scanlines",
    shell: "max-w-3xl mx-auto p-[var(--spacing)] space-y-4",
    header: "border-[length:var(--border-width)] border-[var(--green-border)] bg-[var(--terminal)] p-3 rounded-[var(--radius)] flex items-center justify-between gap-3",
    title: "text-2xl text-[var(--green)] tracking-wider",
    sub: "text-sm text-[var(--green-dim)]",
    section: "border-[length:var(--border-width)] border-[var(--green-border)] bg-[var(--terminal)] p-[var(--spacing)] rounded-[var(--radius)]",
    h2: "text-xl text-[var(--green)] mb-2",
    muted: "text-[var(--green-dim)] text-sm",
    btn: "min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--green-border)] bg-[var(--green-faint)] text-[var(--green)] hover:bg-[var(--green-dim)] hover:text-[var(--background)] rounded-[var(--radius)] tracking-wider",
    btnPrimary: "min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--green)] bg-[var(--green)] text-[var(--background)] rounded-[var(--radius)] tracking-wider disabled:opacity-50",
    input: "w-full min-h-[44px] px-3 py-2 bg-[var(--background)] border-[length:var(--border-width)] border-[var(--green-border)] text-[var(--green)] rounded-[var(--radius)] placeholder:text-[var(--green-dim)]",
    pill: "text-xs px-2 py-1 border-[length:var(--border-width)] border-[var(--green-border)] text-[var(--green-dim)] rounded-[var(--radius)]",
  }

  if (isViewerPending) return <div className={c.page}><ThemeStyle /></div>

  return (
    <div id="app" className={c.page}>
      <ThemeStyle />
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div>
            <h1 className={c.title}>AUTOMATON_LEDGER.exe</h1>
            <p className={c.sub}>// v0.1 — tracking the cashier extinction event</p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && <span className={c.pill}>ROOT</span>}
            <ViewerTag />
          </div>
        </header>

        <main className="space-y-4">
          <LogVisit c={c} viewer={viewer} database={database} />
          <Tally c={c} visits={visits} />
          <Projection c={c} visits={visits} viewer={viewer} />
          <Ledger c={c} visits={visits} database={database} viewer={viewer} />
        </main>
      </div>
    </div>
  )
}