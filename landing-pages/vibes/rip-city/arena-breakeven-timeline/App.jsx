import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"

const SEED = {
  _id: "assumptions",
  publicCostM: 1020,
  leaseYears: 20,
  returnLow: 17.9,
  returnHigh: 29,
  renoOnlyCostM: 600,
  renoOnlyPayback: 21,
}

function fmtMoney(m) {
  if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`
  return `$${m.toFixed(0)}M`
}

function computeBreakeven(cost, annualReturn) {
  if (annualReturn <= 0) return Infinity
  return cost / annualReturn
}

function PaybackChart({ cost, annualReturn, leaseYears, label }) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(320, e.contentRect.width))
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const horizon = 40
  const height = 420
  const margin = { top: 40, right: 24, bottom: 48, left: 72 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const breakeven = computeBreakeven(cost, annualReturn)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const x = d3.scaleLinear().domain([0, horizon]).range([0, innerW])
    const yMax = Math.max(cost * 1.15, annualReturn * horizon * 1.05)
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0])

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // Hairline grid
    g.append("g")
      .attr("class", "grid")
      .selectAll("line.h")
      .data(y.ticks(6))
      .enter()
      .append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d))
      .attr("stroke", "rgba(20,20,20,0.08)")
      .attr("stroke-width", 1)

    // Years data
    const years = d3.range(0, horizon + 1)
    const returnData = years.map((yr) => ({ yr, val: yr * annualReturn }))

    // Area between cost line and return line (gap shown in neutral)
    const area = d3.area()
      .x((d) => x(d.yr))
      .y0((d) => y(Math.min(d.val, cost)))
      .y1(() => y(cost))
      .curve(d3.curveMonotoneX)

    g.append("path")
      .datum(returnData)
      .attr("fill", "rgba(20,20,20,0.06)")
      .attr("d", area)

    // Cost reference line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(cost)).attr("y2", y(cost))
      .attr("stroke", "rgba(20,20,20,0.85)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3")

    g.append("text")
      .attr("x", innerW - 6).attr("y", y(cost) - 8)
      .attr("text-anchor", "end")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 11)
      .attr("fill", "rgba(20,20,20,0.7)")
      .text(`PUBLIC COMMITMENT  ${fmtMoney(cost)}`)

    // Return line (animated)
    const line = d3.line()
      .x((d) => x(d.yr))
      .y((d) => y(d.val))
      .curve(d3.curveMonotoneX)

    const path = g.append("path")
      .datum(returnData)
      .attr("fill", "none")
      .attr("stroke", "rgba(20,20,20,0.92)")
      .attr("stroke-width", 2)
      .attr("d", line)

    const totalLen = path.node().getTotalLength()
    path
      .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
      .attr("stroke-dashoffset", totalLen)
      .transition().duration(800).ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0)

    // Lease-end vertical
    g.append("line")
      .attr("x1", x(leaseYears)).attr("x2", x(leaseYears))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#DA291C")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0)
      .transition().duration(600).delay(400).attr("opacity", 0.9)

    g.append("text")
      .attr("x", x(leaseYears) + 6).attr("y", 14)
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 11)
      .attr("fill", "#DA291C")
      .attr("opacity", 0)
      .text(`LEASE ENDS · YEAR ${leaseYears}`)
      .transition().duration(600).delay(500).attr("opacity", 1)

    // Break-even marker
    if (isFinite(breakeven) && breakeven <= horizon) {
      g.append("line")
        .attr("x1", x(breakeven)).attr("x2", x(breakeven))
        .attr("y1", y(cost)).attr("y2", innerH)
        .attr("stroke", "#DA291C")
        .attr("stroke-width", 1)
        .attr("opacity", 0)
        .transition().duration(500).delay(900).attr("opacity", 0.5)

      g.append("circle")
        .attr("cx", x(breakeven)).attr("cy", y(cost))
        .attr("r", 0)
        .attr("fill", "#DA291C")
        .transition().duration(500).delay(900).attr("r", 5)

      g.append("text")
        .attr("x", x(breakeven) + 8).attr("y", y(cost) - 10)
        .attr("font-family", "ui-monospace, monospace")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("fill", "#DA291C")
        .attr("opacity", 0)
        .text(`BREAK-EVEN · YEAR ${breakeven.toFixed(1)}`)
        .transition().duration(500).delay(1000).attr("opacity", 1)
    }

    // X axis
    const xAxis = d3.axisBottom(x).ticks(8).tickFormat((d) => `${d}y`).tickSize(4)
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .call((s) => s.select(".domain").attr("stroke", "rgba(20,20,20,0.4)"))
      .call((s) => s.selectAll("text").attr("font-family", "ui-monospace, monospace").attr("font-size", 10).attr("fill", "rgba(20,20,20,0.6)"))

    // Y axis
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat((d) => fmtMoney(d)).tickSize(4)
    g.append("g")
      .call(yAxis)
      .call((s) => s.select(".domain").attr("stroke", "rgba(20,20,20,0.4)"))
      .call((s) => s.selectAll("text").attr("font-family", "ui-monospace, monospace").attr("font-size", 10).attr("fill", "rgba(20,20,20,0.6)"))

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 38)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 10)
      .attr("fill", "rgba(20,20,20,0.5)")
      .text("YEARS FROM AGREEMENT")

    g.append("text")
      .attr("transform", `translate(-54,${innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, monospace")
      .attr("font-size", 10)
      .attr("fill", "rgba(20,20,20,0.5)")
      .text("CUMULATIVE DOLLARS")

    // Hover tooltip
    const tip = g.append("g").attr("opacity", 0)
    tip.append("line").attr("y1", 0).attr("y2", innerH).attr("stroke", "rgba(20,20,20,0.3)").attr("stroke-width", 1)
    const tipBox = tip.append("g")
    tipBox.append("rect").attr("width", 140).attr("height", 44).attr("fill", "rgba(255,255,255,0.95)").attr("stroke", "rgba(20,20,20,0.2)")
    const tipYear = tipBox.append("text").attr("x", 8).attr("y", 16).attr("font-family", "ui-monospace, monospace").attr("font-size", 11).attr("fill", "rgba(20,20,20,0.9)")
    const tipVal = tipBox.append("text").attr("x", 8).attr("y", 32).attr("font-family", "ui-monospace, monospace").attr("font-size", 10).attr("fill", "rgba(20,20,20,0.6)")

    svg.append("rect")
      .attr("x", margin.left).attr("y", margin.top)
      .attr("width", innerW).attr("height", innerH)
      .attr("fill", "transparent")
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event, g.node())
        const yr = Math.max(0, Math.min(horizon, x.invert(mx)))
        const val = yr * annualReturn
        tip.attr("opacity", 1).attr("transform", `translate(${x(yr)},0)`)
        tipBox.attr("transform", `translate(${x(yr) + 8 > innerW - 150 ? -148 : 8}, 8)`)
        tipYear.text(`Year ${yr.toFixed(1)}`)
        tipVal.text(`Returned: ${fmtMoney(val)}`)
      })
      .on("mouseleave", () => tip.attr("opacity", 0))

  }, [width, cost, annualReturn, leaseYears, innerW, innerH, breakeven])

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  )
}

export default function App() {
  const { database, useDocument } = useFireproof("payback")
  const { doc, merge } = useDocument(SEED)

  const [annualReturn, setAnnualReturn] = useState(doc.returnLow || SEED.returnLow)
  const [renoOnly, setRenoOnly] = useState(false)

  useEffect(() => {
    if (doc && doc.returnLow != null) setAnnualReturn(doc.returnLow)
  }, [doc?._id])

  const cost = renoOnly ? doc.renoOnlyCostM : doc.publicCostM
  const lease = doc.leaseYears
  const breakeven = computeBreakeven(cost, annualReturn)
  const overshoot = isFinite(breakeven) ? breakeven - lease : Infinity

  function commitReturn() {
    database.put({ ...doc, lastAdjusted: Date.now() }).catch(() => {})
  }

  const c = {
    page: "bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    rule: "border-[var(--border)]",
    muted: "text-[var(--text-secondary)]",
    accent: "text-[#DA291C]",
    mono: "font-[var(--font-family-mono)] tabular-nums",
    section: "border-t border-[var(--border)] py-8",
    pill: "inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase border border-[var(--border)] text-[var(--text-secondary)]",
  }

  return (
    <>
      <style>{`
:root {
  --background: #faf7f0;
  --accent: #DA291C;
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.18);
  --surface: rgba(255, 255, 255, 0.85);
  --primary: #DA291C;
  --secondary: #666;
  --font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --font-size-base: 1rem;
  --radius: 0.25rem;
  --spacing: 1rem;
  --border-width: 1px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #14110d;
    --text-primary: rgba(245, 240, 230, 0.92);
    --text-secondary: rgba(245, 240, 230, 0.5);
    --border: rgba(245, 240, 230, 0.18);
    --surface: rgba(255, 255, 255, 0.04);
  }
}
input[type=range] { accent-color: #DA291C; }
      `}</style>

      <main className={`${c.page} min-h-screen`} id="app">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-16">

          <header id="app-header" className="mb-10">
            <div className={c.pill}>A Civic Ledger</div>
            <h1 className="mt-4 text-3xl md:text-5xl font-light leading-tight tracking-tight">
              The Payback Clock
            </h1>
            <p className={`${c.muted} mt-3 text-sm md:text-base max-w-2xl leading-relaxed`}>
              On the proposed public commitment to the Moda Center renovation. How long, at the projected rate of return, until the public is made whole — and whether the lease lasts that long.
            </p>
            <div className={`${c.mono} ${c.muted} text-xs mt-4`}>
              Sources: City of Portland VSG study; campaign figures. Figures in millions USD.
            </div>
          </header>

          <section id="headline" className={c.section}>
            <div className={c.pill}>Finding</div>
            <h2 className="mt-3 text-2xl md:text-4xl font-light leading-tight">
              {isFinite(breakeven) ? (
                <>
                  Break-even: <span className={`${c.mono} ${c.accent} font-medium`}>Year {breakeven.toFixed(1)}</span>
                  <span className={c.muted}> — but the lease ends at </span>
                  <span className={`${c.mono} ${c.accent} font-medium`}>Year {lease}</span>.
                </>
              ) : (
                <span className={c.muted}>At this rate, break-even is indefinite.</span>
              )}
            </h2>
            {isFinite(overshoot) && overshoot > 0 && (
              <p className={`${c.muted} mt-3 text-sm md:text-base`}>
                The public would, on these assumptions, finish recouping its commitment{" "}
                <span className={`${c.mono} text-[var(--text-primary)]`}>{overshoot.toFixed(1)} years</span>{" "}
                after the lease obligating the team to remain has expired.
              </p>
            )}
          </section>

          <section id="chart" className={c.section}>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className={c.pill}>Cumulative Ledger</div>
                <h3 className="mt-2 text-lg font-normal">
                  {renoOnly ? "Renovation Only" : "Full Public Commitment"} vs. Annual Return
                </h3>
              </div>
              <div className={`${c.mono} text-xs ${c.muted} hidden md:block`}>
                Horizon: 40 years
              </div>
            </div>
            <PaybackChart
              cost={cost}
              annualReturn={annualReturn}
              leaseYears={lease}
              label={renoOnly ? "Renovation" : "Full Commitment"}
            />

            <div className="mt-6 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-px bg-[var(--text-primary)]" style={{borderTop: "1.5px dashed"}} />
                <span className={c.muted}>Public commitment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-0.5 bg-[var(--text-primary)]" />
                <span className={c.muted}>Cumulative return</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-0.5 bg-[#DA291C]" />
                <span className={c.muted}>Lease end / break-even</span>
              </div>
            </div>
          </section>

          <section id="controls" className={c.section}>
            <div className={c.pill}>Adjust the Assumption</div>
            <div className="mt-5 grid md:grid-cols-2 gap-8">
              <div>
                <label className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm">Annual return to the public</span>
                    <span className={`${c.mono} text-lg ${c.accent}`}>
                      ${annualReturn.toFixed(1)}M / yr
                    </span>
                  </div>
                  <input
                    type="range"
                    min={doc.returnLow}
                    max={doc.returnHigh}
                    step={0.1}
                    value={annualReturn}
                    onChange={(e) => setAnnualReturn(parseFloat(e.target.value))}
                    onPointerUp={commitReturn}
                    className="w-full mt-3 min-h-[44px]"
                  />
                  <div className={`flex justify-between ${c.mono} text-[10px] ${c.muted} mt-1`}>
                    <span>${doc.returnLow}M identified</span>
                    <span>${doc.returnHigh}M tax + fees</span>
                  </div>
                </label>
                <p className={`${c.muted} text-xs mt-3 leading-relaxed`}>
                  The lower figure is the tax revenue the city has actually identified. The higher figure adds projected user and parking fees — a more generous accounting.
                </p>
              </div>

              <div>
                <span className="text-sm block mb-3">Compare scenario</span>
                <div className="inline-flex border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
                  <button
                    onClick={() => setRenoOnly(false)}
                    className={`px-4 py-3 text-xs md:text-sm min-h-[44px] ${!renoOnly ? "bg-[var(--text-primary)] text-[var(--background)]" : c.muted}`}
                  >
                    Full Commitment · $1.02B
                  </button>
                  <button
                    onClick={() => setRenoOnly(true)}
                    className={`px-4 py-3 text-xs md:text-sm min-h-[44px] border-l border-[var(--border)] ${renoOnly ? "bg-[var(--text-primary)] text-[var(--background)]" : c.muted}`}
                  >
                    Renovation Only · $600M
                  </button>
                </div>
                <p className={`${c.muted} text-xs mt-4 leading-relaxed`}>
                  Even the leaner renovation-only figure — stripped of surrounding district commitments — breaks even around year 21. The lease ends at year 20.
                </p>
              </div>
            </div>
          </section>

          <section id="ledger" className={c.section}>
            <div className={c.pill}>Source Figures</div>
            <table className={`${c.mono} w-full mt-4 text-sm`}>
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3">Total public commitment</td>
                  <td className="py-3 text-right">{fmtMoney(doc.publicCostM)}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3">Renovation-only figure</td>
                  <td className="py-3 text-right">{fmtMoney(doc.renoOnlyCostM)}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3">Identified annual tax return</td>
                  <td className="py-3 text-right">${doc.returnLow}M</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3">Tax plus fees, generous accounting</td>
                  <td className="py-3 text-right">${doc.returnHigh}M</td>
                </tr>
                <tr>
                  <td className="py-3">Lease obligation</td>
                  <td className="py-3 text-right">{doc.leaseYears} years</td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer className={`${c.section} ${c.muted} text-xs leading-relaxed`}>
            Figures drawn from the City of Portland VSG study and publicly stated campaign positions. The horizon, slider range, and scenario toggle render directly from a shared configuration document; assumption changes propagate live to other viewers.
          </footer>
        </div>
      </main>
    </>
  )
}