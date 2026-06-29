import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AlphabetStrip({ letter, setLetter }) {
  const cls = (active) => `min-w-[36px] min-h-[36px] rounded-[var(--radius-sm)] text-sm font-semibold ${active ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface)]"}`
  return (
    <section id="alphabet" className="px-4 py-3 border-b border-[var(--border)] overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        <button onClick={() => setLetter("All")} className={cls(letter === "All") + " px-3"}>All</button>
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
          <button key={l} onClick={() => setLetter(l)} className={cls(letter === l)}>{l}</button>
        ))}
      </div>
    </section>
  )
}

function SearchBar({ query, setQuery }) {
  return (
    <section id="search" className="px-4 py-3">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search terms, definitions…"
        className="w-full min-h-[44px] px-4 rounded-[var(--radius)] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
      />
    </section>
  )
}

function AddTermForm({ viewer, database }) {
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const [definition, setDefinition] = React.useState("")
  const [example, setExample] = React.useState("")
  const [aiLoading, setAiLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  if (!viewer) {
    return (
      <section id="add-term" className="px-4 pb-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
          Sign in to add a term to the lexicon.
        </div>
      </section>
    )
  }

  async function suggestExample() {
    if (!term.trim()) return
    setAiLoading(true)
    try {
      const res = await callAI(
        `Write a single fun, natural example sentence using the basketball slang term "${term}"${definition ? ` (meaning: ${definition})` : ""}. Keep it under 20 words, court-flavored.`,
        { schema: { properties: { example: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      if (parsed.example) setExample(parsed.example)
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    if (!term.trim() || !definition.trim()) return
    setSaving(true)
    try {
      await database.put({
        type: "term",
        term: term.trim(),
        definition: definition.trim(),
        example: example.trim(),
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      })
      setTerm(""); setDefinition(""); setExample(""); setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="add-term" className="px-4 pb-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full min-h-[48px] rounded-[var(--radius-lg)] bg-[var(--accent)] text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Coin a new term
        </button>
      ) : (
        <form onSubmit={save} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Term (e.g. Wet Outlet)"
            className="w-full min-h-[44px] px-3 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
          />
          <textarea
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            placeholder="Definition"
            rows={2}
            className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
          />
          <div className="space-y-2">
            <textarea
              value={example}
              onChange={e => setExample(e.target.value)}
              placeholder="Example sentence (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={suggestExample}
              disabled={aiLoading || !term.trim()}
              className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1.5 disabled:opacity-50"
            >
              {aiLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>
              )}
              {aiLoading ? "Thinking…" : "Suggest example with AI"}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 min-h-[44px] rounded-[var(--radius)] border border-[var(--border)] font-semibold text-sm">Cancel</button>
            <button type="submit" disabled={saving || !term.trim() || !definition.trim()} className="flex-1 min-h-[44px] rounded-[var(--radius)] bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save term"}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function GlossaryFeed() {
  return (
    <section id="glossary" className="px-4 pb-24 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] pt-2">Top terms</h2>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--text-secondary)] text-sm">
        No terms yet. Be the first to coin one.
      </div>
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useLiveQuery, database } = useFireproof("hoopsLexicon")
  const { docs: termDocs } = useLiveQuery("type", { key: "term" })
  const { docs: voteDocs } = useLiveQuery("type", { key: "upvote" })
  const [query, setQuery] = React.useState("")
  const [letter, setLetter] = React.useState("All")

  const voteCounts = {}
  const myVotes = {}
  for (const v of voteDocs) {
    voteCounts[v.termId] = (voteCounts[v.termId] || 0) + 1
    if (viewer && v.voterHandle === viewer.userHandle) myVotes[v.termId] = v
  }

  const q = query.trim().toLowerCase()
  const filtered = termDocs
    .filter(t => {
      if (letter !== "All" && (t.term || "").charAt(0).toUpperCase() !== letter) return false
      if (q && !((t.term || "").toLowerCase().includes(q) || (t.definition || "").toLowerCase().includes(q))) return false
      return true
    })
    .sort((a, b) => (voteCounts[b._id] || 0) - (voteCounts[a._id] || 0) || (a.term || "").localeCompare(b.term || ""))

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "sticky top-0 z-10 bg-[var(--background)]/90 backdrop-blur border-b border-[var(--border)]",
  }

  return (
    <>
      <style>{`
:root {
  --background: oklch(1.00 0 0);
  --surface: rgba(255, 255, 255, 0.85);
  --primary: oklch(0.62 0.24 25);
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.14);
  --accent: oklch(0.62 0.24 25);
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.06 0 0);
    --surface: rgba(255, 255, 255, 0.04);
    --primary: oklch(0.38 0.24 25);
    --text-primary: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --border: rgba(255, 255, 255, 0.18);
    --accent: oklch(0.38 0.24 25);
  }
}
      `}</style>
      <main id="app" className={c.page}>
        <header id="app-header" className={c.header}>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Hoops Lexicon</h1>
              <p className="text-xs text-[var(--text-secondary)]">Our crew's slang &amp; plays</p>
            </div>
            <ViewerTag />
          </div>
          <SearchBar query={query} setQuery={setQuery} />
          <AlphabetStrip letter={letter} setLetter={setLetter} />
        </header>
        <AddTermForm viewer={viewer} database={database} />
        <GlossaryFeed terms={filtered} voteCounts={voteCounts} myVotes={myVotes} viewer={viewer} database={database} />
      </main>
    </>
  )
}