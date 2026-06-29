import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ReviewForm({ chapterId, database, viewer, c }) {
  const [stage, setStage] = React.useState("Internal")
  const [body, setBody] = React.useState("")
  function file(e) {
    e.preventDefault()
    if (!body.trim()) return
    database.put({
      type: "comment", chapterId, stage, body, createdAt: Date.now(),
      authorUserSlug: viewer?.userSlug || "anon",
      authorDisplayName: viewer?.displayName || viewer?.userSlug || "anon",
      authorAvatarUrl: viewer?.avatarUrl || "",
    })
    setBody("")
  }
  return (
    <form onSubmit={file} className="space-y-2 mb-4">
      <div className="flex gap-2 flex-wrap">
        {["Internal","Peer","Public"].map(s => (
          <button type="button" key={s} onClick={() => setStage(s)} className={`${c.badge} ${stage === s ? "bg-white text-black" : ""}`}>{s}</button>
        ))}
      </div>
      <textarea className={c.textarea} value={body} onChange={e => setBody(e.target.value)} placeholder="File a review comment..." />
      <button type="submit" className={c.btn}>File comment</button>
    </form>
  )
}

function StudyForm({ chapterId, database, viewer, c }) {
  const [citation, setCitation] = React.useState("")
  const [claim, setClaim] = React.useState("")
  const [confidence, setConfidence] = React.useState("Well-supported")
  function attach(e) {
    e.preventDefault()
    if (!citation.trim()) return
    database.put({ type: "study", chapterId, citation, claim, confidence, createdAt: Date.now(), createdBy: viewer?.userSlug || "anon" })
    setCitation(""); setClaim("")
  }
  return (
    <form onSubmit={attach} className="space-y-2 mb-4">
      <input className={c.input} value={citation} onChange={e => setCitation(e.target.value)} placeholder="Citation (Author, Year, Journal)" />
      <input className={c.input} value={claim} onChange={e => setClaim(e.target.value)} placeholder="Linked claim from draft" />
      <div className="flex gap-2 flex-wrap">
        {["Well-supported","Emerging","Contested"].map(lvl => (
          <button type="button" key={lvl} onClick={() => setConfidence(lvl)} className={`${c.badge} ${confidence === lvl ? "bg-white text-black" : ""}`}>{lvl}</button>
        ))}
      </div>
      <button type="submit" className={c.btn}>Attach study</button>
    </form>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("nca-dossier")
  const [selectedChapterId, setSelectedChapterId] = React.useState(null)
  const [auditResult, setAuditResult] = React.useState(null)
  const [isAuditing, setIsAuditing] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  const { doc: chapterDraft, merge: mergeChapter, submit: submitChapter } = useDocument({
    type: "chapter", title: "", agency: "", authors: "", outline: "", draft: "", status: "Draft", createdAt: Date.now(),
  })
  const { docs: chapters } = useLiveQuery("type", { key: "chapter", descending: true })
  const { docs: studies } = useLiveQuery("type", { key: "study", descending: true })
  const { docs: comments } = useLiveQuery("type", { key: "comment", descending: true })

  const selected = chapters.find(ch => ch._id === selectedChapterId) || chapters[0]
  const chapterStudies = studies.filter(s => s.chapterId === selected?._id)
  const chapterComments = comments.filter(cm => cm.chapterId === selected?._id)

  async function suggestChapter() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Suggest one NCA chapter idea with a specific scientific scope.", {
        schema: { properties: { title: { type: "string" }, agency: { type: "string" }, authors: { type: "string" }, outline: { type: "string" } } }
      })
      const d = JSON.parse(r)
      mergeChapter({ title: d.title, agency: d.agency, authors: d.authors, outline: d.outline })
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.16_0_0)] text-[oklch(1_0_0)] font-mono",
    header: "border-b border-[oklch(0.28_0.03_257)] bg-black px-4 py-5 sticky top-0 z-10",
    brand: "text-xl font-black tracking-wider uppercase",
    brandFont: { fontFamily: "'Archivo Black', sans-serif" },
    tagline: "text-xs text-[oklch(0.65_0_0)] mt-1 tracking-wide",
    viewer: "flex items-center gap-2 text-xs text-[oklch(0.75_0_0)]",
    avatar: "w-7 h-7 rounded-full border border-[oklch(0.28_0.03_257)]",
    main: "px-4 py-5 space-y-5 max-w-3xl mx-auto pb-24",
    section: "border border-[oklch(0.28_0.03_257)] bg-black p-4 rounded-sm",
    h2: "text-sm font-black uppercase tracking-widest mb-3 border-b border-[oklch(0.28_0.03_257)] pb-2",
    h2Font: { fontFamily: "'Archivo Black', sans-serif" },
    input: "w-full bg-[oklch(0.16_0_0)] border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-white min-h-[44px]",
    textarea: "w-full bg-[oklch(0.16_0_0)] border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] px-3 py-3 text-sm rounded-sm focus:outline-none focus:border-white min-h-[100px]",
    btn: "bg-white text-black px-4 py-3 text-xs font-black uppercase tracking-widest rounded-sm min-h-[44px] disabled:opacity-40",
    btnGhost: "border border-[oklch(0.28_0.03_257)] text-[oklch(1_0_0)] px-3 py-2 text-xs uppercase tracking-wider rounded-sm",
    row: "border border-[oklch(0.28_0.03_257)] p-3 rounded-sm bg-[oklch(0.16_0_0)]",
    label: "text-[10px] uppercase tracking-widest text-[oklch(0.65_0_0)] block mb-1",
    badge: "inline-block text-[10px] uppercase tracking-widest px-2 py-1 border border-[oklch(0.28_0.03_257)] rounded-sm",
    empty: "text-xs text-[oklch(0.55_0_0)] italic py-4 text-center",
  }

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={c.brand} style={c.brandFont}>DOSSIER // NCA</h1>
            <p className={c.tagline}>National Climate Assessment — coordination console</p>
          </div>
          {viewer && (
            <div className={c.viewer}>
              <img src={viewer.avatarUrl} alt="" className={c.avatar} />
              <span className="hidden sm:inline">{viewer.displayName ?? viewer.userSlug}</span>
            </div>
          )}
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="chapters" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Chapter Dossiers</h2>
          {can("write") ? (
            <form onSubmit={submitChapter} className="space-y-2 mb-4">
              <div>
                <label className={c.label}>Chapter title</label>
                <input className={c.input} value={chapterDraft.title} onChange={e => mergeChapter({ title: e.target.value })} placeholder="e.g. Regional climate vulnerability" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={c.label}>Lead agency</label>
                  <input className={c.input} value={chapterDraft.agency} onChange={e => mergeChapter({ agency: e.target.value })} placeholder="NOAA" />
                </div>
                <div>
                  <label className={c.label}>Authors</label>
                  <input className={c.input} value={chapterDraft.authors} onChange={e => mergeChapter({ authors: e.target.value })} placeholder="comma separated" />
                </div>
              </div>
              <div>
                <label className={c.label}>Draft text</label>
                <textarea className={c.textarea} value={chapterDraft.draft} onChange={e => mergeChapter({ draft: e.target.value })} placeholder="Draft prose..." />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className={c.btn}>Open dossier</button>
                <button type="button" onClick={suggestChapter} disabled={isSuggesting} className={c.btnGhost}>
                  {isSuggesting ? (<svg className="animate-spin inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>) : "AI suggest"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-[oklch(0.55_0_0)] mb-3">Read-only — contact the convener for write access.</p>
          )}
          <ul className="space-y-2">
            {chapters.length === 0 && <li className={c.empty}>No chapters yet.</li>}
            {chapters.map(ch => (
              <li key={ch._id} onClick={() => setSelectedChapterId(ch._id)} className={`${c.row} cursor-pointer ${selected?._id === ch._id ? "border-white" : ""}`}>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <strong className="text-sm">{ch.title || "(untitled)"}</strong>
                  <span className={c.badge}>{ch.status}</span>
                </div>
                <div className="text-[11px] text-[oklch(0.65_0_0)]">{ch.agency || "—"} · {ch.authors || "no authors"}</div>
              </li>
            ))}
          </ul>
        </section>
        <section id="evidence" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Evidence Base {selected && <span className="text-[10px] text-[oklch(0.55_0_0)]">// {selected.title}</span>}</h2>
          <div className="text-[11px] text-[oklch(0.65_0_0)] mb-3">Attach studies with citation metadata. Tag each claim's confidence.</div>
          {selected && can("write") ? (
            <StudyForm chapterId={selected._id} database={database} viewer={viewer} c={c} />
          ) : !selected ? (
            <p className={c.empty}>Select a chapter above.</p>
          ) : (
            <p className="text-xs text-[oklch(0.55_0_0)] mb-3">Read-only view.</p>
          )}
          <ul className="space-y-2">
            {chapterStudies.length === 0 && <li className={c.empty}>No studies attached.</li>}
            {chapterStudies.map(s => (
              <li key={s._id} className={c.row}>
                <div className="text-xs">{s.citation}</div>
                <div className="text-[11px] text-[oklch(0.65_0_0)] mt-1">Claim: {s.claim}</div>
                <span className={`${c.badge} mt-2`}>{s.confidence}</span>
              </li>
            ))}
          </ul>
        </section>
        <section id="review" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Review Log {selected && <span className="text-[10px] text-[oklch(0.55_0_0)]">// {selected.title}</span>}</h2>
          <div className="text-[11px] text-[oklch(0.65_0_0)] mb-3">Internal · Peer · Public — every comment persists for FOIA.</div>
          {selected && can("write") ? (
            <ReviewForm chapterId={selected._id} database={database} viewer={viewer} c={c} />
          ) : !selected ? (
            <p className={c.empty}>Select a chapter above.</p>
          ) : (
            <p className="text-xs text-[oklch(0.55_0_0)] mb-3">Read-only view.</p>
          )}
          <ul className="space-y-2">
            {chapterComments.length === 0 && <li className={c.empty}>No review comments filed.</li>}
            {chapterComments.map(cm => (
              <li key={cm._id} className={c.row}>
                <div className="flex justify-between text-[10px] text-[oklch(0.65_0_0)] mb-1">
                  <span>{cm.stage}</span>
                  <span className="flex items-center gap-1">{cm.authorAvatarUrl && <img src={cm.authorAvatarUrl} alt="" className="w-4 h-4 rounded-full" />}{cm.authorDisplayName}</span>
                </div>
                <div className="text-xs whitespace-pre-wrap">{cm.body}</div>
                {cm.response && <div className="mt-2 pl-2 border-l border-[oklch(0.28_0.03_257)] text-[11px] text-[oklch(0.75_0_0)]"><span className="text-[oklch(0.55_0_0)]">Author response: </span>{cm.response}</div>}
                {can("write") && !cm.response && <button onClick={() => { const r = prompt("Author response:"); if (r) database.put({ ...cm, response: r, respondedAt: Date.now() }) }} className={`${c.btnGhost} mt-2`}>Respond</button>}
              </li>
            ))}
          </ul>
        </section>
        <section id="audit" className={c.section}>
          <h2 className={c.h2} style={c.h2Font}>Scientific Integrity Audit</h2>
          <div className="text-[11px] text-[oklch(0.65_0_0)] mb-3">AI auditor cross-checks the draft against the attached evidence base.</div>
          {!selected ? (
            <p className={c.empty}>Select a chapter to audit.</p>
          ) : (
            <>
              {can("write") && (
                <button
                  onClick={async () => {
                    setIsAuditing(true); setAuditResult(null)
                    try {
                      const prompt = `You are a scientific integrity auditor for the National Climate Assessment.\n\nCHAPTER: ${selected.title}\nLEAD AGENCY: ${selected.agency}\n\nDRAFT TEXT:\n${selected.draft || "(none)"}\n\nEVIDENCE BASE:\n${chapterStudies.map(s => `- [${s.confidence}] ${s.citation} — claim: ${s.claim}`).join("\n") || "(none)"}\n\nReturn structured findings.`
                      const r = await callAI(prompt, { schema: { properties: {
                        unsupportedClaims: { type: "array", items: { type: "string" } },
                        evidenceGaps: { type: "array", items: { type: "string" } },
                        disagreementsForConvener: { type: "array", items: { type: "string" } },
                        confidenceAdjustments: { type: "array", items: { type: "string" } },
                      } } })
                      const parsed = JSON.parse(r)
                      setAuditResult(parsed)
                      database.put({ type: "audit", chapterId: selected._id, findings: parsed, createdAt: Date.now(), createdBy: viewer?.userSlug || "anon" })
                    } finally { setIsAuditing(false) }
                  }}
                  disabled={isAuditing}
                  className={c.btn}
                >
                  {isAuditing ? (<><svg className="animate-spin inline mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>Auditing…</>) : "Run integrity audit"}
                </button>
              )}
              {auditResult && (
                <div className="mt-4 space-y-3">
                  {[
                    ["Unsupported claims", auditResult.unsupportedClaims],
                    ["Evidence gaps", auditResult.evidenceGaps],
                    ["For convener resolution", auditResult.disagreementsForConvener],
                    ["Confidence adjustments", auditResult.confidenceAdjustments],
                  ].map(([label, items]) => (
                    <div key={label} className={c.row}>
                      <div className={c.label}>{label}</div>
                      {items && items.length > 0 ? (
                        <ul className="text-xs space-y-1 list-disc pl-4">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                      ) : <div className="text-[11px] text-[oklch(0.55_0_0)]">None flagged.</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}