import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("coldwar-atlas")
  const { doc: sel } = useDocument({ _id: "current-selection", year: 1962 })
  const year = sel.year || 1962
  const svgRef = React.useRef(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const { docs: briefingDocs } = useLiveQuery("year", { key: year })
  const briefing = briefingDocs.find(d => d._id === `briefing-${year}`)
  const { doc: noteDoc, merge: mergeNote } = useDocument({ text: "" })
  const { docs: allNotes } = useLiveQuery("type", { key: "note", descending: true })
  const notes = allNotes.filter(n => n.year === year)

  React.useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth || 600
    const height = 80
    const margin = { left: 12, right: 12, top: 30, bottom: 20 }
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${width} ${height}`)
    const x = d3.scaleLinear().domain([1945, 1991]).range([margin.left, width - margin.right])
    svg.append("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", 40).attr("y2", 40)
      .attr("stroke", "#3a4a6a").attr("stroke-width", 2)
    svg.selectAll(".tick")
      .data(d3.range(1945, 1992, 5)).enter().append("text")
      .attr("x", d => x(d)).attr("y", 65)
      .attr("fill", "#8a9ab0").attr("font-size", "10px")
      .attr("text-anchor", "middle").attr("font-family", "Roboto Mono")
      .text(d => d)
    svg.append("circle")
      .attr("cx", x(year)).attr("cy", 40).attr("r", 8)
      .attr("fill", "white").attr("stroke", "#3a4a6a").attr("stroke-width", 2)
    const pick = (event) => {
      const [px] = d3.pointer(event, svgRef.current)
      const scaleX = width / svgRef.current.getBoundingClientRect().width
      const y = Math.round(x.invert(px * scaleX))
      const clamped = Math.max(1945, Math.min(1991, y))
      database.put({ ...sel, year: clamped })
    }
    svg.style("cursor", "pointer").on("click", pick)
    svg.call(d3.drag().on("drag", pick))
  }, [year])

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4a6a] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-2xl tracking-widest uppercase",
    titleAccent: "font-['Archivo_Black',sans-serif] text-3xl",
    tagline: "text-xs text-[#8a9ab0] mt-1 tracking-wider",
    main: "max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a6a] bg-black p-5 rounded-sm",
    sectionTitle: "font-['Archivo_Black',sans-serif] text-lg uppercase tracking-wider mb-4 text-white",
    btn: "min-h-[44px] px-4 py-3 bg-white text-black uppercase tracking-wider text-sm hover:bg-[#ccc] disabled:opacity-50",
    input: "w-full min-h-[44px] bg-[#1a1a1a] border border-[#3a4a6a] px-3 py-2 text-white",
    card: "border border-[#3a4a6a] bg-[#0a0a0a] p-3 rounded-sm",
    label: "text-[10px] uppercase tracking-widest text-[#8a9ab0]",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>
          <span className={c.titleAccent}>COLD WAR</span> ATLAS
        </h1>
        <p className={c.tagline}>CLASSIFIED DOSSIER // 1945 — 1991</p>
      </header>
      <main id="app" className={c.main}>
        <section id="timeline" className={c.section}>
          <h2 className={c.sectionTitle}>Timeline</h2>
          <div className="flex items-baseline gap-3 mb-3">
            <span className={c.label}>Selected Year</span>
            <span className="font-['Archivo_Black',sans-serif] text-3xl">{year}</span>
          </div>
          <svg ref={svgRef} className="w-full h-20 block" />
          <p className={c.label}>Tap or drag along the bar to select a year — syncs live</p>
        </section>
        <section id="briefing" className={c.section}>
          <h2 className={c.sectionTitle}>Briefing — {year}</h2>
          {can("write") && (
            <button
              className={c.btn + " mb-4 inline-flex items-center gap-2"}
              disabled={isLoading || !!briefing}
              onClick={async () => {
                setIsLoading(true)
                try {
                  const res = await callAI(`Cold War briefing for year ${year}. Provide 2-4 concise items per category covering US decisions, Soviet decisions, proxy conflicts, diplomatic shifts (détente, Sino-Soviet split, etc.), and cultural moments.`, {
                    schema: { properties: {
                      us: { type: "array", items: { type: "string" } },
                      soviet: { type: "array", items: { type: "string" } },
                      proxy: { type: "array", items: { type: "string" } },
                      diplomatic: { type: "array", items: { type: "string" } },
                      cultural: { type: "array", items: { type: "string" } },
                    }}
                  })
                  const data = JSON.parse(res)
                  await database.put({ _id: `briefing-${year}`, year, ...data })
                } finally { setIsLoading(false) }
              }}>
              {isLoading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>}
              {briefing ? "Briefing Loaded" : isLoading ? "Generating..." : "Generate Briefing"}
            </button>
          )}
          <div className="space-y-4">
            {[["US Decisions","us"],["Soviet Decisions","soviet"],["Proxy Conflicts","proxy"],["Diplomatic Shifts","diplomatic"],["Cultural Moments","cultural"]].map(([cat,key]) => (
              <div key={key}>
                <h3 className={c.label + " mb-2"}>{cat}</h3>
                <div className="space-y-2">
                  {briefing && briefing[key] && briefing[key].length > 0 ? briefing[key].map((item, i) => (
                    <div key={i} className={c.card}>{item}</div>
                  )) : <div className={c.card + " text-[#8a9ab0]"}>No data yet — generate a briefing.</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section id="annotations" className={c.section}>
          <h2 className={c.sectionTitle}>Annotations — {year}</h2>
          {!viewer ? (
            <p className={c.label + " mb-4"}>Sign in to add notes.</p>
          ) : !can("write") ? (
            <p className={c.label + " mb-4"}>Read-only view — contact the owner for write access.</p>
          ) : (
            <form
              className="flex gap-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault()
                const text = noteDoc.text?.trim()
                if (!text) return
                database.put({
                  type: "note", year, text,
                  authorSlug: viewer.userSlug,
                  authorName: viewer.displayName ?? viewer.userSlug,
                  authorAvatar: viewer.avatarUrl,
                  createdAt: Date.now(),
                })
                mergeNote({ text: "" })
              }}>
              <input
                className={c.input}
                placeholder="Add a personal note for this year"
                value={noteDoc.text || ""}
                onChange={(e) => mergeNote({ text: e.target.value })}
              />
              <button className={c.btn} type="submit">Save</button>
            </form>
          )}
          <ul className="space-y-2">
            {notes.length === 0 && <li className={c.card + " text-[#8a9ab0]"}>No notes yet for this year.</li>}
            {notes.map(n => (
              <li key={n._id} className={c.card}>
                <div className="flex items-center gap-2 mb-1">
                  {n.authorAvatar && <img src={n.authorAvatar} alt={n.authorSlug} className="w-5 h-5 rounded-full" />}
                  <span className={c.label}>{n.authorName}</span>
                </div>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}