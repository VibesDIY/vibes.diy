import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ThemeStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700;900&display=optional');
      :root {
        --background: oklch(0.06 0.000 0);
        --surface: oklch(0.17 0.000 0);
        --surface-2: oklch(0.30 0.000 0);
        --border: oklch(0.40 0.000 0);
        --text-primary: oklch(0.90 0.000 0);
        --text-secondary: oklch(0.55 0.000 0);
        --accent: oklch(0.73 0.10 78);
        --accent-text: oklch(0.97 0.07 100);
        --font-family: 'Cinzel', serif;
        --font-display: 'Cinzel Decorative', serif;
        --radius: 0.5rem;
        --spacing: 1rem;
        --border-width: 1px;
      }
      body { background: var(--background); color: var(--text-primary); font-family: var(--font-family); }
      .display { font-family: var(--font-display); letter-spacing: 0.05em; }
    `}</style>
  )
}

function SearchSection() {
  const c = {
    section: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]',
    heading: 'display text-[var(--accent)] text-lg mb-3 uppercase tracking-wider',
    body: 'text-[var(--text-secondary)] text-sm italic',
  }
  return (
    <section id="search" className={c.section}>
      <h2 className={c.heading}>Inquire of the Codex</h2>
      <p className={c.body}>Name a brand and place. The codex shall divine its operator.</p>
    </section>
  )
}

function CodexFeed({ locations, selectedId, onSelect, ViewerTag }) {
  const c = {
    section: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]',
    heading: 'display text-[var(--accent)] text-lg mb-3 uppercase tracking-wider',
    body: 'text-[var(--text-secondary)] text-sm italic',
    empty: 'text-[var(--text-secondary)] italic text-sm',
    item: 'w-full text-left bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3 hover:border-[var(--accent)] transition-colors',
    itemActive: 'w-full text-left bg-[var(--background)] border-[length:var(--border-width)] border-[var(--accent)] rounded-[var(--radius)] p-3',
    brand: 'display text-[var(--accent)] text-base uppercase tracking-wider',
    place: 'text-[var(--text-primary)] text-sm',
    meta: 'text-[var(--text-secondary)] text-xs uppercase tracking-wider mt-1',
  }
  return (
    <section id="feed" className={c.section}>
      <h2 className={c.heading}>The Communal Ledger</h2>
      {locations.length === 0 ? (
        <p className={c.empty}>No locations yet inscribed. Be the first chronicler.</p>
      ) : (
        <ul className="space-y-2">
          {locations.map((loc) => (
            <li key={loc._id}>
              <button type="button" onClick={() => onSelect(loc._id)} className={selectedId === loc._id ? c.itemActive : c.item}>
                <div className={c.brand}>{loc.brand}</div>
                <div className={c.place}>{loc.place}</div>
                <div className={c.meta}>{loc.operatorType} · ~{loc.estimatedUnits} units · {loc.confidence}</div>
                <div className="mt-2"><ViewerTag userHandle={loc.authorHandle} /></div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AnnotationsSection({ location, annotations, viewer, database, ViewerTag }) {
  const [note, setNote] = React.useState("")
  const c = {
    section: 'bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]',
    heading: 'display text-[var(--accent)] text-lg mb-3 uppercase tracking-wider',
    body: 'text-[var(--text-secondary)] text-sm italic',
    input: 'w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] text-[var(--text-primary)] font-[var(--font-family)] mb-2',
    btn: 'w-full bg-[var(--accent)] text-[var(--background)] font-[var(--font-family)] uppercase tracking-wider px-4 py-3 min-h-[44px] rounded-[var(--radius)] disabled:opacity-50',
    note: 'bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3 mb-2',
    noteBody: 'text-[var(--text-primary)] text-sm mb-2',
    locked: 'text-[var(--text-secondary)] italic text-sm',
  }

  async function inscribe(e) {
    e.preventDefault()
    if (!viewer || !location || !note.trim()) return
    await database.put({
      type: "annotation",
      locationId: location._id,
      body: note.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    })
    setNote("")
  }

  if (!location) {
    return (
      <section id="annotations" className={c.section}>
        <h2 className={c.heading}>Field Annotations</h2>
        <p className={c.body}>Select a location above to inscribe a note.</p>
      </section>
    )
  }

  return (
    <section id="annotations" className={c.section}>
      <h2 className={c.heading}>Annotations · {location.brand}</h2>
      <ul className="mb-3">
        {annotations.length === 0 && <p className={c.body}>No annotations yet. Be the first scribe.</p>}
        {annotations.map((a) => (
          <li key={a._id} className={c.note}>
            <p className={c.noteBody}>{a.body}</p>
            <ViewerTag userHandle={a.authorHandle} />
          </li>
        ))}
      </ul>
      {viewer ? (
        <form onSubmit={inscribe}>
          <textarea className={c.input} rows="3" placeholder="Inscribe a note ('Black-owned, opened 1987'...)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" disabled={!note.trim()} className={c.btn}>Inscribe</button>
        </form>
      ) : (
        <p className={c.locked}>Sign in to inscribe annotations.</p>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useLiveQuery, database } = useFireproof("franchiseCodex")
  const { docs: locations } = useLiveQuery("type", { key: "location", descending: true })
  const { docs: allAnnotations } = useLiveQuery("type", { key: "annotation" })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = locations.find((l) => l._id === selectedId) || null
  const annotations = allAnnotations.filter((a) => a.locationId === selectedId).sort((a, b) => a.createdAt - b.createdAt)

  const c = {
    main: 'min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)] p-[var(--spacing)] max-w-2xl mx-auto space-y-4',
    header: 'flex items-center justify-between border-b-[length:var(--border-width)] border-[var(--border)] pb-3 mb-2',
    title: 'display text-[var(--accent)] text-xl md:text-2xl uppercase',
    subtitle: 'text-[var(--text-secondary)] text-xs tracking-widest uppercase mt-1',
  }

  if (isViewerPending) return null

  return (
    <>
      <ThemeStyles />
      <main id="app" className={c.main}>
        <header id="app-header" className={c.header}>
          <div>
            <h1 className={c.title}>Franchise Codex</h1>
            <p className={c.subtitle}>A Field Guide to the Golden Arches</p>
          </div>
          <ViewerTag />
        </header>
        <SearchSection viewer={viewer} database={database} />
        <CodexFeed locations={locations} selectedId={selectedId} onSelect={setSelectedId} ViewerTag={ViewerTag} />
        <AnnotationsSection location={selected} annotations={annotations} viewer={viewer} database={database} ViewerTag={ViewerTag} />
      </main>
    </>
  )
}