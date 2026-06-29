import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Composer({ viewer, ViewerTag, c }) {
  return (
    <section id="composer" className={`${c.card} ${c.border} border rounded-[var(--radius)] p-[var(--spacing)] mb-4`}>
      <div className="flex items-center gap-2 mb-3">
        <ViewerTag />
        {viewer && <span className={`text-xs ${c.muted}`}>filing as registrant</span>}
      </div>
      <h2 className={`text-sm uppercase tracking-widest ${c.muted} mb-2`}>Form 10-K · New Filing</h2>
      {!viewer && <p className={`text-sm ${c.muted}`}>Sign in to file an annual report.</p>}
      {viewer && (
        <p className={`text-sm ${c.muted}`}>Paste order lines below. One item per line.</p>
      )}
    </section>
  )
}

function FilingCard({ doc, c, viewer, isOwner, database, ViewerTag }) {
  const [open, setOpen] = React.useState(false)
  const f = doc.filing || {}
  const canDelete = viewer && (isOwner || viewer.userHandle === doc.authorHandle)
  return (
    <li className={`${c.card} ${c.border} border rounded-[var(--radius)] p-[var(--spacing)]`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-bold text-base">{f.registrantName || "Unnamed Registrant"}</h3>
            {f.ticker && <span className={`text-[10px] font-mono ${c.tag} px-1.5 py-0.5 rounded`}>{f.ticker}</span>}
          </div>
          <p className={`text-[10px] uppercase tracking-widest ${c.dim} font-mono mt-1`}>
            Filed {new Date(doc.createdAt).toLocaleDateString()} · Form 10-K
          </p>
        </div>
        <ViewerTag userHandle={doc.authorHandle} />
      </div>
      {doc._files?.receipt?.url && (
        <img src={doc._files.receipt.url} alt="receipt" className="w-full max-h-48 object-contain rounded mb-3 bg-black/40" />
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`${c.cardHi} rounded p-2`}>
          <p className={`text-[9px] uppercase tracking-widest ${c.dim}`}>Revenue</p>
          <p className="text-sm font-mono mt-1">{f.revenue}</p>
        </div>
        <div className={`${c.cardHi} rounded p-2`}>
          <p className={`text-[9px] uppercase tracking-widest ${c.dim}`}>COGS (kcal)</p>
          <p className="text-sm font-mono mt-1">{f.cogs}</p>
        </div>
      </div>
      {open && (
        <div className="space-y-3 mt-3">
          <div>
            <p className={`text-[10px] uppercase tracking-widest ${c.muted} mb-1`}>Item 7 · MD&A</p>
            <p className="text-sm leading-relaxed">{f.mda}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-widest ${c.muted} mb-1`}>Item 1A · Risk Factors</p>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {(f.riskFactors || []).map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-widest ${c.muted} mb-1`}>Forward-Looking Statements</p>
            <p className="text-sm leading-relaxed italic">{f.forwardOutlook}</p>
          </div>
          <details className="mt-2">
            <summary className={`text-[10px] uppercase tracking-widest ${c.dim} cursor-pointer`}>Exhibit A · Order detail</summary>
            <pre className={`text-xs font-mono ${c.muted} mt-2 whitespace-pre-wrap`}>{doc.items}</pre>
          </details>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <button onClick={() => setOpen(!open)} className={`text-xs ${c.muted} underline`}>
          {open ? "Collapse filing" : "Read full filing"}
        </button>
        {canDelete && (
          <button onClick={() => database.del(doc._id)} className={`text-xs ${c.danger}`}>
            Withdraw
          </button>
        )}
      </div>
    </li>
  )
}

function Archive({ c, database, useLiveQuery, viewer, isOwner, ViewerTag }) {
  const { docs } = useLiveQuery("createdAt", { descending: true })
  return (
    <section id="archive">
      <h2 className={`text-sm uppercase tracking-widest ${c.muted} mb-3`}>Filing Archive · {docs.length}</h2>
      {docs.length === 0 ? (
        <p className={`text-sm ${c.dim} italic`}>No filings on record. The commission awaits.</p>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <FilingCard key={d._id} doc={d} c={c} viewer={viewer} isOwner={isOwner} database={database} ViewerTag={ViewerTag} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("filings")

  const c = {
    page: "bg-[#0a0a0a] text-white min-h-screen",
    card: "bg-[#1a1a1a]",
    cardHi: "bg-[#1f2233]",
    border: "border-[#3a3f55]",
    muted: "text-[#a8b0c4]",
    dim: "text-white/60",
    tag: "bg-white/10",
    accent: "bg-white text-black",
    danger: "text-red-400",
    input: "bg-[#0f0f0f] border-[#3a3f55] text-white placeholder:text-white/40",
    btn: "bg-white text-black font-medium rounded-md px-4 py-3 min-h-[44px] disabled:opacity-50",
  }

  if (isViewerPending) return <div className={c.page} />

  return (
    <div className={`${c.page} font-['Inter',system-ui,sans-serif]`}>
      <header id="app-header" className={`${c.border} border-b px-4 py-5 sticky top-0 ${c.page} z-10`}>
        <div className="max-w-2xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">FILINGS</h1>
            <p className={`text-[11px] uppercase tracking-[0.2em] ${c.muted}`}>Edgar for your lunch</p>
          </div>
          <span className={`text-[10px] ${c.dim} font-mono`}>FORM 10-K</span>
        </div>
      </header>
      <main id="app" className="max-w-2xl mx-auto px-4 py-5">
        <Composer viewer={viewer} ViewerTag={ViewerTag} c={c} database={database} />
        <Archive c={c} database={database} useLiveQuery={useLiveQuery} viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} />
      </main>
    </div>
  )
}