import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Masthead({ ViewerTag, c }) {
  return (
    <header id="app-header" className={`border-b-[length:var(--border-width)] border-[var(--border)] ${c.bg} px-4 pt-5 pb-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.3em] ${c.muted}`}>Vol. I · Daily Edition</p>
          <h1 className={`font-serif text-3xl font-bold leading-tight ${c.ink}`} style={{fontFamily:"'Times New Roman', Times, serif"}}>The Chain Chaser</h1>
          <p className={`text-xs italic ${c.muted}`}>"All The Stores That're Fit To Visit"</p>
        </div>
        <ViewerTag />
      </div>
    </header>
  )
}

function ExpeditionPicker({ c }) {
  return (
    <section id="expedition" className={`px-4 py-4 border-b-[length:var(--border-width)] border-[var(--border)]`}>
      <h2 className={`text-[10px] uppercase tracking-[0.25em] ${c.muted} mb-2`}>§ Plan Your Expedition</h2>
      <p className={`${c.ink} text-sm`}>Choose a chain and a city to begin reporting.</p>
    </section>
  )
}

function Roster({ c, database, locations, visits, viewer, expedition }) {
  const [busyId, setBusyId] = React.useState(null)
  const myVisited = new Set(visits.filter(v => v.reporterHandle === viewer?.userHandle).map(v => v.locationId))

  async function logVisit(loc, file) {
    if (!viewer) return
    setBusyId(loc._id)
    try {
      const _files = file ? { photo: file } : {}
      await database.put({
        type: "visit", locationId: loc._id, expeditionId: loc.expeditionId,
        reporterHandle: viewer.userHandle, visitedAt: Date.now(), _files,
      })
    } finally { setBusyId(null) }
  }

  if (!expedition) {
    return (
      <section id="roster" className="px-4 py-4 border-b-[length:var(--border-width)] border-[var(--border)]">
        <h2 className={`text-[10px] uppercase tracking-[0.25em] ${c.muted} mb-2`}>§ The Roster</h2>
        <p className={`${c.muted} text-sm italic`}>Awaiting expedition.</p>
      </section>
    )
  }

  const roster = locations.filter(l => l.expeditionId === expedition._id)
  const visited = roster.filter(l => myVisited.has(l._id)).length
  const pct = roster.length ? Math.round((visited / roster.length) * 100) : 0

  return (
    <section id="roster" className="px-4 py-4 border-b-[length:var(--border-width)] border-[var(--border)]">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className={`text-[10px] uppercase tracking-[0.25em] ${c.muted}`}>§ The Roster</h2>
        <span className={`text-xs ${c.ink} font-bold`}>{visited}/{roster.length} · {pct}%</span>
      </div>
      {roster.length === 0 && <p className={`${c.muted} text-sm italic`}>Dispatching reporters…</p>}
      <ul className="space-y-2">
        {roster.map(loc => {
          const v = visits.find(x => x.locationId === loc._id && x.reporterHandle === viewer?.userHandle)
          const done = !!v
          return (
            <li key={loc._id} className={`${c.card} ${done ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`${c.ink} font-bold text-sm ${done ? "line-through" : ""}`}>{loc.name}</p>
                  <p className={`${c.muted} text-xs`}>{loc.address}{loc.neighborhood ? ` · ${loc.neighborhood}` : ""}</p>
                  {done && <p className={`${c.muted} text-[10px] mt-1 italic`}>Filed {new Date(v.visitedAt).toLocaleDateString()}</p>}
                </div>
                <div className="w-20 shrink-0">
                  <ImgGen prompt={`black and white newspaper line illustration of a ${expedition.chain} storefront`} showControls={false} className="w-full h-16 object-cover" />
                </div>
              </div>
              {!done && viewer && (
                <div className="mt-2 flex gap-2">
                  <label className={`${c.btnGhost} flex-1 text-center cursor-pointer text-xs`}>
                    {busyId === loc._id ? "Filing…" : "Log Visit + Photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && logVisit(loc, e.target.files[0])} />
                  </label>
                  <button onClick={() => logVisit(loc, null)} disabled={busyId === loc._id} className={`${c.btn} text-xs`}>Quick</button>
                </div>
              )}
              {v?._files?.photo?.url && <img src={v._files.photo.url} alt="" className="mt-2 w-full h-32 object-cover rounded-[var(--radius-sm)]" />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Leaderboard({ c, visits, locations, ViewerTag }) {
  const total = locations.length || 1
  const tally = {}
  for (const v of visits) {
    tally[v.reporterHandle] = (tally[v.reporterHandle] || 0) + 1
  }
  const ranks = Object.entries(tally).sort((a, b) => b[1] - a[1])

  return (
    <section id="leaderboard" className="px-4 py-4">
      <h2 className={`text-[10px] uppercase tracking-[0.25em] ${c.muted} mb-2`}>§ Standings</h2>
      {ranks.length === 0 ? (
        <p className={`${c.muted} text-sm italic`}>No dispatches yet.</p>
      ) : (
        <ol className="space-y-1">
          {ranks.map(([handle, count], i) => (
            <li key={handle} className="flex items-center justify-between border-b-[length:var(--border-width)] border-[var(--border)] py-1">
              <div className="flex items-center gap-2">
                <span className={`${c.ink} font-bold text-sm w-5`}>{i + 1}.</span>
                <ViewerTag userHandle={handle} />
              </div>
              <span className={`${c.muted} text-xs`}>{count} / {locations.length} · {Math.round((count/total)*100)}%</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { useLiveQuery, useDocument, database } = useFireproof("chainChaser")
  const { doc: expedition } = useDocument({ _id: "exp:current" })
  const { docs: locations } = useLiveQuery("type", { key: "location" })
  const { docs: visits } = useLiveQuery("type", { key: "visit" })

  const c = {
    bg: "bg-[var(--background)]",
    ink: "text-[var(--text-primary)]",
    muted: "text-[var(--text-secondary)]",
    border: "border-[var(--border)]",
    btn: "bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius-sm)] px-3 py-3 min-h-[44px] text-sm uppercase tracking-wider",
    btnGhost: "border-[length:var(--border-width)] border-[var(--text-primary)] text-[var(--text-primary)] rounded-[var(--radius-sm)] px-3 py-3 min-h-[44px] text-sm",
    input: "border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 min-h-[44px] w-full bg-[var(--background)] text-[var(--text-primary)]",
    card: "border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] p-3",
  }

  if (isViewerPending) return null

  return (
    <>
      <style>{`:root{--background:#fafaf7;--accent:#666;--text-primary:#111;--text-secondary:#666;--border:#ccc;--primary:#666;--text-disabled:#999;--warning:#f59e0b;--success:#22c55e;--error:#ef4444;--neutral:#6b7280;--font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;--font-family-mono:ui-monospace,Menlo,monospace;--font-size-base:1rem;--radius:0.5rem;--radius-sm:0.25rem;--radius-lg:1rem;--spacing:1rem;--border-width:1px}@media (prefers-color-scheme:dark){:root{--background:#111;--text-primary:#f5f5f0;--text-secondary:#aaa;--border:#333}}`}</style>
      <main id="app" className={`min-h-screen ${c.bg} font-[var(--font-family)]`}>
        <Masthead ViewerTag={ViewerTag} c={c} />
        <ExpeditionPicker c={c} database={database} expedition={expedition?.chain ? expedition : null} isOwner={isOwner} />
        <Roster c={c} database={database} locations={locations} visits={visits} viewer={viewer} expedition={expedition?.chain ? expedition : null} />
        <Leaderboard c={c} visits={visits} locations={locations} ViewerTag={ViewerTag} />
      </main>
    </>
  )
}