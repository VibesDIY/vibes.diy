import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "use-vibes"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const MASCOTS = ["Ronald McDonald", "The Burger King", "Colonel Sanders", "Jack Box", "The Noid", "Wendy"]

function Header({ ViewerTag }) {
  const c = {
    wrap: "border-b border-[var(--border)] bg-[var(--card-bg)] backdrop-blur",
    inner: "max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3",
    title: "font-mono text-[var(--accent)] tracking-widest text-sm uppercase",
    sub: "text-[var(--muted)] text-xs font-mono",
  }
  return (
    <header id="app-header" className={c.wrap}>
      <div className={c.inner}>
        <div>
          <div className={c.title}>◈ Mascot Lore Vault</div>
          <div className={c.sub}>archive of departed icons</div>
        </div>
        <ViewerTag />
      </div>
    </header>
  )
}

function Generator({ viewer, database }) {
  const [mascot, setMascot] = React.useState(MASCOTS[0])
  const [loading, setLoading] = React.useState(false)

  async function generate() {
    if (!viewer) return
    setLoading(true)
    try {
      const raw = await callAI(
        `You are a satirical mascot archivist. Write a lore dossier for ${mascot}. Be dryly reverent, archival, and a little sad.`,
        {
          schema: {
            properties: {
              era: { type: "string", description: "Years active, e.g. '1971–2003'" },
              status: { type: "string", description: "Retired / Active / Exiled / Missing" },
              controversies: { type: "array", items: { type: "string" } },
              keyEpisodes: { type: "array", items: { type: "string" } },
              elegy: { type: "string", description: "One-line elegy" },
            },
          },
        }
      )
      const dossier = JSON.parse(raw)
      await database.put({
        type: "loreCard",
        mascot,
        ...dossier,
        createdBy: viewer.userHandle,
        createdAt: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  const c = {
    wrap: "rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4",
    label: "font-mono text-xs uppercase tracking-widest text-[var(--muted)]",
    chips: "flex flex-wrap gap-2",
    chip: "px-3 py-2 min-h-[44px] rounded font-mono text-xs border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition",
    chipOn: "px-3 py-2 min-h-[44px] rounded font-mono text-xs border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]",
    btn: "w-full min-h-[44px] rounded bg-[var(--accent)] text-[var(--accent-text)] font-mono text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2",
    note: "text-xs text-[var(--muted)] font-mono",
  }

  if (!viewer) {
    return (
      <section id="generator" className={c.wrap}>
        <div className={c.label}>◈ Curator Access</div>
        <p className={c.note}>Sign in to file new dossiers. The archive remains open for browsing.</p>
      </section>
    )
  }

  return (
    <section id="generator" className={c.wrap}>
      <div className={c.label}>◈ File New Dossier</div>
      <div className={c.chips}>
        {MASCOTS.map((m) => (
          <button key={m} className={m === mascot ? c.chipOn : c.chip} onClick={() => setMascot(m)}>
            {m}
          </button>
        ))}
      </div>
      <button className={c.btn} disabled={loading} onClick={generate}>
        {loading ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Excavating…
          </>
        ) : (
          `Generate Lore for ${mascot}`
        )}
      </button>
    </section>
  )
}

function LoreCard({ doc, canDelete, onDelete }) {
  const c = {
    wrap: "rounded-lg border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden",
    imgWrap: "aspect-square bg-[var(--bg)] border-b border-[var(--border)]",
    body: "p-4 space-y-3",
    name: "font-mono text-[var(--accent)] tracking-widest text-sm uppercase",
    row: "flex gap-2 text-xs font-mono",
    rowLabel: "text-[var(--muted)] uppercase tracking-wider w-24 shrink-0",
    rowVal: "text-[var(--text)] flex-1",
    list: "list-disc list-inside text-xs text-[var(--text)] space-y-1",
    elegy: "italic text-[var(--purple)] border-l-2 border-[var(--accent)] pl-3 text-sm",
    del: "text-xs font-mono text-[var(--muted)] hover:text-[var(--accent)] underline",
  }
  return (
    <article className={c.wrap}>
      <div className={c.imgWrap}>
        <ImgGen
          prompt={`Faded sepia archival portrait of ${doc.mascot}, fast food mascot, museum photograph, dark amber tones, melancholy, vintage paper texture`}
          database="vaultPortraits"
        />
      </div>
      <div className={c.body}>
        <div className={c.name}>◈ {doc.mascot}</div>
        <div className={c.row}><span className={c.rowLabel}>Era</span><span className={c.rowVal}>{doc.era}</span></div>
        <div className={c.row}><span className={c.rowLabel}>Status</span><span className={c.rowVal}>{doc.status}</span></div>
        {doc.controversies?.length > 0 && (
          <div>
            <div className={c.rowLabel + " mb-1"}>Controversies</div>
            <ul className={c.list}>{doc.controversies.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {doc.keyEpisodes?.length > 0 && (
          <div>
            <div className={c.rowLabel + " mb-1"}>Key Episodes</div>
            <ul className={c.list}>{doc.keyEpisodes.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {doc.elegy && <blockquote className={c.elegy}>"{doc.elegy}"</blockquote>}
        {canDelete && (
          <button className={c.del} onClick={onDelete}>
            Remove from archive
          </button>
        )}
      </div>
    </article>
  )
}

function Gallery({ viewer, isOwner, database, docs }) {
  const c = {
    wrap: "space-y-4",
    label: "font-mono text-xs uppercase tracking-widest text-[var(--muted)]",
    empty: "text-center py-12 text-[var(--muted)] font-mono text-sm border border-dashed border-[var(--border)] rounded-lg",
  }
  return (
    <section id="gallery" className={c.wrap}>
      <div className={c.label}>◈ Archive ({docs.length})</div>
      {docs.length === 0 ? (
        <div className={c.empty}>The vault is empty. No dossiers filed.</div>
      ) : (
        docs.map((d) => (
          <LoreCard
            key={d._id}
            doc={d}
            canDelete={viewer && (isOwner || d.createdBy === viewer.userHandle)}
            onDelete={() => database.del(d._id)}
          />
        ))
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("mascotVault")
  const { docs } = useLiveQuery("createdAt", { descending: true })

  const c = {
    page: "min-h-screen bg-[var(--bg)] text-[var(--text)] font-[Inter,sans-serif]",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
  }

  if (isViewerPending) return <div className={c.page} />

  return (
    <>
      <style>{`
        :root {
          --bg: oklch(0.08 0.03 280);
          --card-bg: oklch(0.12 0.03 280 / 0.7);
          --text: oklch(0.93 0.02 80);
          --border: oklch(0.65 0.15 80 / 0.12);
          --accent: oklch(0.72 0.15 75);
          --accent-text: oklch(0.10 0.03 280);
          --muted: oklch(0.50 0.04 290);
          --purple: oklch(0.55 0.18 300);
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Mono:wght@400;700&display=optional');
      `}</style>
      <div id="app" className={c.page}>
        <Header ViewerTag={ViewerTag} />
        <main className={c.main}>
          <Generator viewer={viewer} database={database} />
          <Gallery viewer={viewer} isOwner={isOwner} database={database} docs={docs} />
        </main>
      </div>
    </>
  )
}