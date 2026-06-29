import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CONCEPTS = ["prospect theory","loss aversion","present bias","hyperbolic discounting","bounded rationality","nudge theory","framing effects","reference-dependent preferences","heuristics and biases","social preferences","endowment effect","intertemporal choice"]

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("bookclub-atlas")
  const { docs: books } = useLiveQuery("type", { key: "book", descending: true })
  const currentBook = books[0]
  const { docs: chapters } = useLiveQuery("bookId", { key: currentBook?._id })
  const { docs: examples } = useLiveQuery("type", { key: "example", descending: true })
  const { docs: votes } = useLiveQuery("type", { key: "vote" })

  const c = {
    page: "min-h-screen bg-[oklch(0.96_0.03_70)] text-[oklch(0.25_0.04_30)] font-serif",
    header: "sticky top-0 z-10 bg-[oklch(0.95_0.03_70)] border-b border-[oklch(0.25_0.04_30/0.15)] px-4 py-3 flex items-center justify-between",
    title: "text-2xl font-bold tracking-tight",
    script: "text-[oklch(0.65_0.18_55)] italic",
    tagline: "text-xs text-[oklch(0.50_0.04_30)]",
    main: "max-w-5xl mx-auto px-4 py-4 grid gap-4 md:grid-cols-2",
    section: "bg-white/60 border border-[oklch(0.25_0.04_30/0.15)] rounded-lg p-4 shadow-sm",
    sectionWide: "bg-white/60 border border-[oklch(0.25_0.04_30/0.15)] rounded-lg p-4 shadow-sm md:col-span-2",
    h2: "text-lg font-bold mb-3 border-b border-[oklch(0.25_0.04_30/0.15)] pb-2",
    btn: "min-h-[44px] px-4 py-2 bg-[oklch(0.65_0.18_55)] text-white rounded font-medium hover:bg-[oklch(0.60_0.15_40)] disabled:opacity-50",
    btnGhost: "min-h-[36px] px-3 py-1 border border-[oklch(0.25_0.04_30/0.25)] rounded text-sm hover:bg-[oklch(0.95_0.03_70)]",
    input: "w-full min-h-[44px] px-3 py-2 border border-[oklch(0.25_0.04_30/0.25)] rounded bg-white",
    row: "py-2 border-b border-[oklch(0.25_0.04_30/0.10)] last:border-0",
    chip: "inline-block text-xs px-2 py-1 rounded-full bg-[oklch(0.72_0.15_80/0.3)] text-[oklch(0.25_0.04_30)] mr-1 mb-1",
    muted: "text-sm text-[oklch(0.50_0.04_30)]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}><span className={c.script}>BookClub</span> Atlas</h1>
          <p className={c.tagline}>Behavioral economics, read together</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-9 h-9 rounded-full border border-[oklch(0.25_0.04_30/0.25)]" />}
      </header>

      <main id="app" className={c.main}>
        <section id="current-book" className={c.section}><h2 className={c.h2}>{/* current-book pass */}</h2></section>
        <section id="chapters" className={c.section}>
          <h2 className={c.h2}>Chapters</h2>
          {!currentBook && <p className={c.muted}>Start a book to add chapters.</p>}
          <ul>
            {chapters.sort((a,b) => (a.order||0) - (b.order||0)).map(ch => (
              <li key={ch._id} className={c.row}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">Ch {ch.order}. {ch.title}</p>
                    {ch.claimedBy ? (
                      <p className={c.muted}>Claimed by {ch.claimedByName}</p>
                    ) : (
                      <p className={c.muted}>Unclaimed</p>
                    )}
                    {ch.summary && <p className="text-sm mt-1">{ch.summary}</p>}
                  </div>
                  {can("write") && viewer && !ch.claimedBy && (
                    <button className={c.btnGhost} onClick={() => database.put({ ...ch, claimedBy: viewer.userSlug, claimedByName: viewer.displayName || viewer.userSlug })}>Claim</button>
                  )}
                </div>
                {can("write") && viewer && ch.claimedBy === viewer.userSlug && (
                  <SummaryEditor chapter={ch} database={database} c={c} />
                )}
              </li>
            ))}
          </ul>
        </section>
        <section id="examples" className={c.sectionWide}>
          <h2 className={c.h2}>Real-World Examples</h2>
          {can("write") && viewer && currentBook && (
            <ExampleForm database={database} c={c} viewer={viewer} chapters={chapters} bookId={currentBook._id} />
          )}
          <ul className="mt-3">
            {examples.filter(e => e.bookId === currentBook?._id).map(ex => {
              const voteCount = votes.filter(v => v.exampleId === ex._id).length
              const myVote = viewer && votes.find(v => v.exampleId === ex._id && v.userSlug === viewer.userSlug)
              const ch = chapters.find(c => c._id === ex.chapterId)
              return (
                <li key={ex._id} className={c.row}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <button
                        disabled={!can("write") || !viewer}
                        className={c.btnGhost}
                        onClick={() => {
                          if (myVote) database.del(myVote._id)
                          else database.put({ type: "vote", exampleId: ex._id, userSlug: viewer.userSlug })
                        }}
                      >{myVote ? "▲" : "△"}</button>
                      <span className="text-sm font-bold">{voteCount}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{ex.text}</p>
                      <div className="mt-1">{(ex.concepts||[]).map(k => <span key={k} className={c.chip}>{k}</span>)}</div>
                      <p className={c.muted}>by {ex.authorName}{ch ? ` · Ch ${ch.order} ${ch.title}` : ""}</p>
                    </div>
                  </div>
                </li>
              )
            })}
            {examples.filter(e => e.bookId === currentBook?._id).length === 0 && <p className={c.muted}>No examples yet.</p>}
          </ul>
        </section>
        <section id="concept-map" className={c.sectionWide}>
          <h2 className={c.h2}>Concept Map</h2>
          <ConceptMap chapters={chapters} examples={examples.filter(e => e.bookId === currentBook?._id)} votes={votes} />
        </section>
      </main>
    </div>
  )
}

function BookForm({ database, c }) {
  const [title, setTitle] = React.useState("")
  const [chaptersText, setChaptersText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const book = await database.put({ type: "book", title: title.trim(), createdAt: Date.now() })
      const lines = chaptersText.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      for (let i = 0; i < lines.length; i++) {
        await database.put({ type: "chapter", bookId: book.id, order: i + 1, title: lines[i] })
      }
      setTitle(""); setChaptersText("")
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <input className={c.input} placeholder="Book title (e.g. Misbehaving)" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={c.input} placeholder="Chapters, one per line or comma-separated" value={chaptersText} onChange={e => setChaptersText(e.target.value)} rows={3} />
      <button type="submit" disabled={loading} className={c.btn}>
        {loading ? <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg> : "Start book"}
      </button>
    </form>
  )
}

function SummaryEditor({ chapter, database, c }) {
  const [text, setText] = React.useState(chapter.summary || "")
  return (
    <div className="mt-2 flex gap-2">
      <input className={c.input} placeholder="Write your chapter summary…" value={text} onChange={e => setText(e.target.value)} />
      <button className={c.btnGhost} onClick={() => database.put({ ...chapter, summary: text })}>Save</button>
    </div>
  )
}

function ExampleForm({ database, c, viewer, chapters, bookId }) {
  const [text, setText] = React.useState("")
  const [chapterId, setChapterId] = React.useState("")
  const [tags, setTags] = React.useState([])
  const [rationale, setRationale] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function suggest() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const ch = chapters.find(c => c._id === chapterId)
      const prompt = `Given this real-world example: "${text}"${ch ? ` from chapter "${ch.title}"` : ""}, pick the 1-3 best matching behavioral economics concepts from this vocabulary: ${CONCEPTS.join(", ")}. Return relevance 0-1 and a one-sentence rationale.`
      const res = await callAI(prompt, { schema: { properties: {
        concepts: { type: "array", items: { type: "string" } },
        relevance: { type: "number" },
        rationale: { type: "string" }
      }}})
      const parsed = JSON.parse(res)
      setTags((parsed.concepts || []).filter(t => CONCEPTS.includes(t)))
      setRationale(parsed.rationale || "")
    } finally { setLoading(false) }
  }

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    await database.put({
      type: "example", bookId, chapterId: chapterId || null, text: text.trim(),
      concepts: tags, authorSlug: viewer.userSlug, authorName: viewer.displayName || viewer.userSlug,
      createdAt: Date.now()
    })
    setText(""); setTags([]); setRationale(""); setChapterId("")
  }

  function toggleTag(t) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea className={c.input} placeholder="A marketing email exploited framing by…" value={text} onChange={e => setText(e.target.value)} rows={2} />
      <div className="flex gap-2 flex-wrap">
        <select className={c.input + " flex-1 min-w-[180px]"} value={chapterId} onChange={e => setChapterId(e.target.value)}>
          <option value="">No chapter</option>
          {chapters.sort((a,b)=>(a.order||0)-(b.order||0)).map(ch => <option key={ch._id} value={ch._id}>Ch {ch.order}. {ch.title}</option>)}
        </select>
        <button type="button" onClick={suggest} disabled={loading || !text.trim()} className={c.btnGhost}>
          {loading ? <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg> : "Suggest tags ✨"}
        </button>
      </div>
      {rationale && <p className={c.muted}>{rationale}</p>}
      <div className="flex flex-wrap gap-1">
        {CONCEPTS.map(t => (
          <button type="button" key={t} onClick={() => toggleTag(t)} className={`text-xs px-2 py-1 rounded-full border ${tags.includes(t) ? "bg-[oklch(0.65_0.18_55)] text-white border-transparent" : "border-[oklch(0.25_0.04_30/0.25)]"}`}>{t}</button>
        ))}
      </div>
      <button type="submit" className={c.btn}>Post example</button>
    </form>
  )
}

function ConceptMap({ chapters, examples, votes }) {
  const ref = React.useRef()
  React.useEffect(() => {
    const svg = d3.select(ref.current)
    svg.selectAll("*").remove()
    const width = 700, height = 420
    svg.attr("viewBox", `0 0 ${width} ${height}`)

    const usedConcepts = new Set()
    examples.forEach(e => (e.concepts || []).forEach(k => usedConcepts.add(k)))

    const nodes = [
      ...Array.from(usedConcepts).map(k => ({ id: "c:" + k, label: k, kind: "concept" })),
      ...chapters.map(ch => ({ id: "ch:" + ch._id, label: "Ch " + ch.order, kind: "chapter" })),
    ]
    const links = []
    examples.forEach(ex => {
      (ex.concepts || []).forEach(k => {
        if (ex.chapterId) links.push({ source: "c:" + k, target: "ch:" + ex.chapterId })
      })
    })

    if (nodes.length === 0) {
      svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").attr("fill", "oklch(0.50 0.04 30)").text("Post examples with concept tags to grow the map")
      return
    }

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width/2, height/2))

    const link = svg.append("g").attr("stroke", "oklch(0.25 0.04 30 / 0.25)").selectAll("line").data(links).enter().append("line")
    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g")
    node.append("circle")
      .attr("r", d => d.kind === "concept" ? 10 : 7)
      .attr("fill", d => d.kind === "concept" ? "oklch(0.65 0.18 55)" : "oklch(0.72 0.15 80)")
    node.append("text").text(d => d.label).attr("x", 12).attr("y", 4).attr("font-size", 11).attr("fill", "oklch(0.25 0.04 30)")

    sim.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y)
      node.attr("transform", d => `translate(${d.x},${d.y})`)
    })
    return () => sim.stop()
  }, [chapters, examples, votes])
  return <svg ref={ref} className="w-full h-[420px] bg-white/40 rounded border border-[oklch(0.25_0.04_30/0.15)]" />
}