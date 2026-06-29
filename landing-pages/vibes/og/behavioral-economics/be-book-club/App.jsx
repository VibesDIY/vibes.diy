const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
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
  const { docs: chapters } = useLiveQuery("bookId", { key: _optionalChain([currentBook, 'optionalAccess', _ => _._id]) })
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
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('div', { children: [
          _jsxDEV('h1', { className: c.title, children: [_jsxDEV('span', { className: c.script, children: "BookClub"}, void 0, false, {fileName: _jsxFileName, lineNumber: 40}, this), " Atlas" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 40}, this)
          , _jsxDEV('p', { className: c.tagline, children: "Behavioral economics, read together"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 39}, this)
        , viewer && _jsxDEV('img', { src: viewer.avatarUrl, alt: viewer.userSlug, className: "w-9 h-9 rounded-full border border-[oklch(0.25_0.04_30/0.25)]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 43}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 38}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "current-book", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: currentBook ? currentBook.title : "Current Book" }, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
          , !currentBook && _jsxDEV('div', { children: [
            _jsxDEV('p', { className: c.muted + " mb-3", children: "Track chapters, claim sections to summarize, and map concepts from your behavioral economics reading." }, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
            , _jsxDEV('div', { className: "bg-white/40 border border-[oklch(0.25_0.04_30/0.15)] rounded-lg p-3 space-y-1", children: [
              _jsxDEV('p', { className: "font-semibold text-sm", children: "Popular picks:" }, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
              , ["Misbehaving — Richard Thaler", "Nudge — Thaler & Sunstein", "Thinking, Fast and Slow — Kahneman", "Predictably Irrational — Ariely"].map(title =>
                _jsxDEV('p', { className: "text-sm " + c.muted, children: "· " + title }, title, false, {fileName: _jsxFileName, lineNumber: 47}, this)
              )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 47}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 47}, this)
          , currentBook && can("write") && _jsxDEV(BookForm, { database: database, c: c }, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 47}, this)
        , _jsxDEV('section', { id: "chapters", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Chapters"}, void 0, false, {fileName: _jsxFileName, lineNumber: 49}, this)
          , !currentBook && _jsxDEV('p', { className: c.muted, children: "Start a book to add chapters."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 50}, this)
          , _jsxDEV('ul', { children: 
            chapters.sort((a,b) => (a.order||0) - (b.order||0)).map(ch => (
              _jsxDEV('li', { className: c.row, children: [
                _jsxDEV('div', { className: "flex items-center justify-between gap-2"   , children: [
                  _jsxDEV('div', { className: "flex-1", children: [
                    _jsxDEV('p', { className: "font-semibold", children: ["Ch " , ch.order, ". " , ch.title]}, void 0, true, {fileName: _jsxFileName, lineNumber: 56}, this)
                    , ch.claimedBy ? (
                      _jsxDEV('p', { className: c.muted, children: ["Claimed by "  , ch.claimedByName]}, void 0, true, {fileName: _jsxFileName, lineNumber: 58}, this)
                    ) : (
                      _jsxDEV('p', { className: c.muted, children: "Unclaimed"}, void 0, false, {fileName: _jsxFileName, lineNumber: 60}, this)
                    )
                    , ch.summary && _jsxDEV('p', { className: "text-sm mt-1" , children: ch.summary}, void 0, false, {fileName: _jsxFileName, lineNumber: 62}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 55}, this)
                  , can("write") && viewer && !ch.claimedBy && (
                    _jsxDEV('button', { className: c.btnGhost, onClick: () => database.put({ ...ch, claimedBy: viewer.userSlug, claimedByName: viewer.displayName || viewer.userSlug }), children: "Claim"}, void 0, false, {fileName: _jsxFileName, lineNumber: 65}, this)
                  )
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 54}, this)
                , can("write") && viewer && ch.claimedBy === viewer.userSlug && (
                  _jsxDEV(SummaryEditor, { chapter: ch, database: database, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 69}, this )
                )
              ]}, ch._id, true, {fileName: _jsxFileName, lineNumber: 53}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 51}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 48}, this)
        , _jsxDEV('section', { id: "examples", className: c.sectionWide, children: [
          _jsxDEV('h2', { className: c.h2, children: "Real-World Examples" }, void 0, false, {fileName: _jsxFileName, lineNumber: 76}, this)
          , can("write") && viewer && currentBook && (
            _jsxDEV(ExampleForm, { database: database, c: c, viewer: viewer, chapters: chapters, bookId: currentBook._id,}, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this )
          )
          , _jsxDEV('ul', { className: "mt-3", children: [
            examples.filter(e => e.bookId === _optionalChain([currentBook, 'optionalAccess', _2 => _2._id])).map(ex => {
              const voteCount = votes.filter(v => v.exampleId === ex._id).length
              const myVote = viewer && votes.find(v => v.exampleId === ex._id && v.userSlug === viewer.userSlug)
              const ch = chapters.find(c => c._id === ex.chapterId)
              return (
                _jsxDEV('li', { className: c.row, children: 
                  _jsxDEV('div', { className: "flex items-start gap-3"  , children: [
                    _jsxDEV('div', { className: "flex flex-col items-center"  , children: [
                      _jsxDEV('button', {
                        disabled: !can("write") || !viewer,
                        className: c.btnGhost,
                        onClick: () => {
                          if (myVote) database.del(myVote._id)
                          else database.put({ type: "vote", exampleId: ex._id, userSlug: viewer.userSlug })
                        },
 children: myVote ? "▲" : "△"}, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this)
                      , _jsxDEV('span', { className: "text-sm font-bold" , children: voteCount}, void 0, false, {fileName: _jsxFileName, lineNumber: 97}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
                    , _jsxDEV('div', { className: "flex-1", children: [
                      _jsxDEV('p', { className: "text-sm", children: ex.text}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this)
                      , _jsxDEV('div', { className: "mt-1", children: (ex.concepts||[]).map(k => _jsxDEV('span', { className: c.chip, children: k}, k, false, {fileName: _jsxFileName, lineNumber: 101}, this))}, void 0, false, {fileName: _jsxFileName, lineNumber: 101}, this)
                      , _jsxDEV('p', { className: c.muted, children: ["by " , ex.authorName, ch ? ` · Ch ${ch.order} ${ch.title}` : ""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 99}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
                }, ex._id, false, {fileName: _jsxFileName, lineNumber: 86}, this)
              )
            })
            , examples.filter(e => e.bookId === _optionalChain([currentBook, 'optionalAccess', _3 => _3._id])).length === 0 && _jsxDEV('p', { className: c.muted, children: "No examples yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 80}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 75}, this)
        , _jsxDEV('section', { id: "concept-map", className: c.sectionWide, children: [
          _jsxDEV('h2', { className: c.h2, children: "Concept Map" }, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
          , _jsxDEV(ConceptMap, { chapters: chapters, examples: examples.filter(e => e.bookId === _optionalChain([currentBook, 'optionalAccess', _4 => _4._id])), votes: votes,}, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 46}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 37}, this)
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
    _jsxDEV('form', { onSubmit: submit, className: "mt-3 space-y-2" , children: [
      _jsxDEV('input', { className: c.input, placeholder: "Book title (e.g. Misbehaving)"   , value: title, onChange: e => setTitle(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this )
      , _jsxDEV('textarea', { className: c.input, placeholder: "Chapters, one per line or comma-separated"     , value: chaptersText, onChange: e => setChaptersText(e.target.value), rows: 3,}, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this )
      , _jsxDEV('button', { type: "submit", disabled: loading, className: c.btn, children: 
        loading ? _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 142}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 142}, this) : "Start book"
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 138}, this)
  )
}

function SummaryEditor({ chapter, database, c }) {
  const [text, setText] = React.useState(chapter.summary || "")
  return (
    _jsxDEV('div', { className: "mt-2 flex gap-2"  , children: [
      _jsxDEV('input', { className: c.input, placeholder: "Write your chapter summary…"   , value: text, onChange: e => setText(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this )
      , _jsxDEV('button', { className: c.btnGhost, onClick: () => database.put({ ...chapter, summary: text }), children: "Save"}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
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
    _jsxDEV('form', { onSubmit: submit, className: "space-y-2", children: [
      _jsxDEV('textarea', { className: c.input, placeholder: "A marketing email exploited framing by…"     , value: text, onChange: e => setText(e.target.value), rows: 2,}, void 0, false, {fileName: _jsxFileName, lineNumber: 199}, this )
      , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
        _jsxDEV('select', { className: c.input + " flex-1 min-w-[180px]", value: chapterId, onChange: e => setChapterId(e.target.value), children: [
          _jsxDEV('option', { value: "", children: "No chapter" }, void 0, false, {fileName: _jsxFileName, lineNumber: 202}, this)
          , chapters.sort((a,b)=>(a.order||0)-(b.order||0)).map(ch => _jsxDEV('option', { value: ch._id, children: ["Ch " , ch.order, ". " , ch.title]}, ch._id, true, {fileName: _jsxFileName, lineNumber: 203}, this))
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 201}, this)
        , _jsxDEV('button', { type: "button", onClick: suggest, disabled: loading || !text.trim(), className: c.btnGhost, children: 
          loading ? _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 206}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 206}, this) : "Suggest tags ✨"
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 205}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 200}, this)
      , rationale && _jsxDEV('p', { className: c.muted, children: rationale}, void 0, false, {fileName: _jsxFileName, lineNumber: 209}, this)
      , _jsxDEV('div', { className: "flex flex-wrap gap-1"  , children: 
        CONCEPTS.map(t => (
          _jsxDEV('button', { type: "button", onClick: () => toggleTag(t), className: `text-xs px-2 py-1 rounded-full border ${tags.includes(t) ? "bg-[oklch(0.65_0.18_55)] text-white border-transparent" : "border-[oklch(0.25_0.04_30/0.25)]"}`, children: t}, t, false, {fileName: _jsxFileName, lineNumber: 212}, this)
        ))
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 210}, this)
      , _jsxDEV('button', { type: "submit", className: c.btn, children: "Post example" }, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 198}, this)
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
  return _jsxDEV('svg', { ref: ref, className: "w-full h-[420px] bg-white/40 rounded border border-[oklch(0.25_0.04_30/0.15)]"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 265}, this )
}