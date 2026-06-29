import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Readings({ c, database, useLiveQuery, useDocument, viewer, can }) {
  const { doc, merge, submit } = useDocument({ type: "reading", title: "", citation: "", clarifies: "", createdAt: Date.now() })
  const { docs: readings } = useLiveQuery("type", { key: "reading", descending: true })
  const { docs: posts } = useLiveQuery("type", { key: "readingPost" })
  const [openId, setOpenId] = React.useState(null)
  const [postText, setPostText] = React.useState("")
  const [showForm, setShowForm] = React.useState(false)

  function add(e) { e.preventDefault(); if (!doc.title.trim()) return; submit(); setShowForm(false) }

  async function addPost(rid) {
    if (!postText.trim() || !viewer) return
    await database.put({
      type: "readingPost", readingId: rid, body: postText.trim(),
      authorSlug: viewer.userSlug, authorName: viewer.displayName ?? viewer.userSlug, authorAvatar: viewer.avatarUrl,
      createdAt: Date.now(),
    })
    setPostText("")
  }

  return (
    <section id="readings" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Reading Group</span>
        {can("write") && <button className={c.btnGhost} onClick={() => setShowForm(s => !s)}>{showForm ? "Cancel" : "+ Add reading"}</button>}
      </div>
      <div className={c.sectionBody}>
        {showForm && can("write") && (
          <form onSubmit={add} className="space-y-2">
            <input className={c.input} placeholder="Title" value={doc.title} onChange={e => merge({ title: e.target.value })} />
            <input className={c.input} placeholder="Citation / author" value={doc.citation} onChange={e => merge({ citation: e.target.value })} />
            <textarea className={c.textarea} placeholder="What methodological decision does this clarify?" value={doc.clarifies} onChange={e => merge({ clarifies: e.target.value })} />
            <button type="submit" className={c.btn}>Add</button>
          </form>
        )}
        {readings.length === 0 && <p className={c.empty}>No readings yet.</p>}
        {readings.map(r => {
          const rPosts = posts.filter(p => p.readingId === r._id).sort((a, b) => a.createdAt - b.createdAt)
          const open = openId === r._id
          return (
            <div key={r._id} className={c.card}>
              <button className="text-left w-full" onClick={() => setOpenId(open ? null : r._id)}>
                <div className="font-medium text-sm">{r.title}</div>
                <p className="text-xs text-[#78716c] mt-1">{r.citation}</p>
                <p className="text-xs text-[#57534e] mt-1 italic">Clarifies: {r.clarifies}</p>
                <div className={c.meta}>{rPosts.length} discussion posts</div>
              </button>
              {open && (
                <div className="mt-3 space-y-2 border-t border-[#e7e5e4] pt-3">
                  {rPosts.map(p => (
                    <div key={p._id} className="flex gap-2 text-xs">
                      <img src={p.authorAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      <div><div className="font-medium">{p.authorName}</div><p className="whitespace-pre-wrap">{p.body}</p></div>
                    </div>
                  ))}
                  {can("write") && (
                    <div className="flex gap-2">
                      <input className={c.input} placeholder="Discuss…" value={openId === r._id ? postText : ""} onChange={e => setPostText(e.target.value)} />
                      <button className={c.btn} onClick={() => addPost(r._id)}>Post</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Sessions({ c, database, useLiveQuery, useDocument, viewer, can }) {
  const { doc, merge, submit } = useDocument({ type: "session", presenter: "", decision: "", scheduledFor: "", createdAt: Date.now() })
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true })
  const { docs: notes } = useLiveQuery("type", { key: "sessionNote" })
  const [openId, setOpenId] = React.useState(null)
  const [noteText, setNoteText] = React.useState("")
  const [showForm, setShowForm] = React.useState(false)

  function schedule(e) { e.preventDefault(); if (!doc.decision.trim()) return; submit(); setShowForm(false) }

  async function addNote(sid) {
    if (!noteText.trim() || !viewer) return
    await database.put({
      type: "sessionNote", sessionId: sid, body: noteText.trim(),
      authorSlug: viewer.userSlug, authorName: viewer.displayName ?? viewer.userSlug, authorAvatar: viewer.avatarUrl,
      createdAt: Date.now(),
    })
    setNoteText("")
  }

  return (
    <section id="sessions" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Work-Through Sessions</span>
        {can("write") && <button className={c.btnGhost} onClick={() => setShowForm(s => !s)}>{showForm ? "Cancel" : "+ Schedule"}</button>}
      </div>
      <div className={c.sectionBody}>
        {showForm && can("write") && (
          <form onSubmit={schedule} className="space-y-2">
            <input className={c.input} placeholder="Presenter name" value={doc.presenter} onChange={e => merge({ presenter: e.target.value })} />
            <input className={c.input} placeholder="When (e.g., Thurs 4pm)" value={doc.scheduledFor} onChange={e => merge({ scheduledFor: e.target.value })} />
            <textarea className={c.textarea} placeholder="Decision being worked through (FE vs RE, marginal interaction term, panel attrition...)" value={doc.decision} onChange={e => merge({ decision: e.target.value })} />
            <button type="submit" className={c.btn}>Schedule session</button>
          </form>
        )}
        {sessions.length === 0 && <p className={c.empty}>No sessions scheduled.</p>}
        {sessions.map(s => {
          const sNotes = notes.filter(n => n.sessionId === s._id).sort((a, b) => a.createdAt - b.createdAt)
          const open = openId === s._id
          return (
            <div key={s._id} className={c.card}>
              <button className="text-left w-full" onClick={() => setOpenId(open ? null : s._id)}>
                <div className="font-medium text-sm">{s.presenter || "Presenter TBD"} · {s.scheduledFor || "unscheduled"}</div>
                <p className="text-xs text-[#57534e] mt-1">{s.decision}</p>
                <div className={c.meta}>{sNotes.length} notes</div>
              </button>
              {open && (
                <div className="mt-3 space-y-2 border-t border-[#e7e5e4] pt-3">
                  {sNotes.map(n => (
                    <div key={n._id} className="flex gap-2 text-xs">
                      <img src={n.authorAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      <div><div className="font-medium">{n.authorName}</div><p className="whitespace-pre-wrap">{n.body}</p></div>
                    </div>
                  ))}
                  {can("write") && (
                    <div className="flex gap-2">
                      <input className={c.input} placeholder="Live note…" value={openId === s._id ? noteText : ""} onChange={e => setNoteText(e.target.value)} />
                      <button className={c.btn} onClick={() => addNote(s._id)}>Add</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ProjectCards({ c, database, useLiveQuery, useDocument, viewer, can }) {
  const empty = { type: "project", title: "", researchQuestion: "", dataStructure: "", design: "", modelSpecs: "", diagnostics: "", interpretation: "", qualCoding: "", createdAt: Date.now() }
  const { doc, merge, submit } = useDocument(empty)
  const { docs: projects } = useLiveQuery("type", { key: "project", descending: true })
  const [openId, setOpenId] = React.useState(null)
  const [showForm, setShowForm] = React.useState(false)
  const [aiLoading, setAiLoading] = React.useState(false)

  async function suggest() {
    setAiLoading(true)
    try {
      const res = await callAI(
        `Suggest an example structured project description for an education doctoral dissertation. Use realistic education research scenario.`,
        { schema: { properties: {
          title: { type: "string" }, researchQuestion: { type: "string" }, dataStructure: { type: "string" },
          design: { type: "string" }, modelSpecs: { type: "string" }, diagnostics: { type: "string" },
          interpretation: { type: "string" }, qualCoding: { type: "string" },
        } } }
      )
      merge(JSON.parse(res))
    } finally { setAiLoading(false) }
  }

  function save(e) { e.preventDefault(); if (!doc.title.trim()) return; submit(); setShowForm(false) }

  const fields = [
    ["researchQuestion", "Research question"],
    ["dataStructure", "Data structure (nesting, panel, etc.)"],
    ["design", "Design (quasi-experimental / observational)"],
    ["modelSpecs", "Candidate model specifications"],
    ["diagnostics", "Planned diagnostics"],
    ["interpretation", "Interpretation strategy"],
    ["qualCoding", "Qualitative coding scheme (if mixed methods)"],
  ]

  return (
    <section id="projects" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Project Cards</span>
        {can("write") && <button className={c.btnGhost} onClick={() => setShowForm(s => !s)}>{showForm ? "Cancel" : "+ New card"}</button>}
      </div>
      <div className={c.sectionBody}>
        {showForm && can("write") && (
          <form onSubmit={save} className="space-y-2">
            <input className={c.input} placeholder="Project title" value={doc.title} onChange={e => merge({ title: e.target.value })} />
            {fields.map(([k, label]) => (
              <div key={k}>
                <label className={c.label}>{label}</label>
                <textarea className={c.textarea} value={doc[k]} onChange={e => merge({ [k]: e.target.value })} />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="submit" className={c.btn}>Save card</button>
              <button type="button" className={c.btnGhost} disabled={aiLoading} onClick={suggest}>
                {aiLoading ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg> : "Suggest example"}
              </button>
            </div>
          </form>
        )}
        {projects.length === 0 && <p className={c.empty}>No project cards yet.</p>}
        {projects.map(p => (
          <div key={p._id} className={c.card}>
            <button className="text-left w-full" onClick={() => setOpenId(openId === p._id ? null : p._id)}>
              <div className="font-medium text-sm">{p.title}</div>
              <p className="text-xs text-[#78716c] mt-1">{p.researchQuestion?.slice(0, 100)}</p>
            </button>
            {openId === p._id && (
              <div className="mt-3 space-y-2 text-xs border-t border-[#e7e5e4] pt-3">
                {fields.map(([k, label]) => p[k] && (
                  <div key={k}><div className="font-semibold text-[#57534e]">{label}</div><p className="whitespace-pre-wrap">{p[k]}</p></div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function QuestionBoard({ c, database, useLiveQuery, useDocument, viewer, can }) {
  const { doc, merge, submit } = useDocument({ type: "question", title: "", body: "", createdAt: Date.now() })
  const { docs: questions } = useLiveQuery("type", { key: "question", descending: true })
  const { docs: replies } = useLiveQuery("type", { key: "reply" })
  const [openId, setOpenId] = React.useState(null)
  const [replyText, setReplyText] = React.useState("")
  const [aiLoading, setAiLoading] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)

  async function askAdvisor() {
    if (!doc.title && !doc.body) return
    setAiLoading(true)
    try {
      const res = await callAI(
        `As a quantitative methodology advisor, suggest considerations for: "${doc.title}\n${doc.body}". Cover diagnostic steps, alternative specifications, and canonical references.`,
        { schema: { properties: {
          diagnostics: { type: "array", items: { type: "string" } },
          alternatives: { type: "array", items: { type: "string" } },
          references: { type: "array", items: { type: "string" } },
        } } }
      )
      const data = JSON.parse(res)
      const block = `\n\n— AI advisor draft —\nDiagnostics:\n${data.diagnostics.map(d => "• " + d).join("\n")}\nAlternatives:\n${data.alternatives.map(d => "• " + d).join("\n")}\nReferences:\n${data.references.map(d => "• " + d).join("\n")}`
      merge({ body: (doc.body || "") + block })
    } finally { setAiLoading(false) }
  }

  function post(e) {
    e.preventDefault()
    if (!doc.title.trim()) return
    submit()
    setShowForm(false)
  }

  async function sendReply(qid) {
    if (!replyText.trim() || !viewer) return
    await database.put({
      type: "reply", questionId: qid, body: replyText.trim(),
      authorSlug: viewer.userSlug, authorName: viewer.displayName ?? viewer.userSlug, authorAvatar: viewer.avatarUrl,
      createdAt: Date.now(),
    })
    setReplyText("")
  }

  return (
    <section id="questions" className={c.section}>
      <div className={c.sectionHead}>
        <span className={c.sectionTitle}>Question Board</span>
        {can("write") && <button className={c.btnGhost} onClick={() => setShowForm(s => !s)}>{showForm ? "Cancel" : "+ Ask"}</button>}
      </div>
      <div className={c.sectionBody}>
        {showForm && can("write") && (
          <form onSubmit={post} className="space-y-2">
            <input className={c.input} placeholder="Question title" value={doc.title} onChange={e => merge({ title: e.target.value })} />
            <textarea className={c.textarea} placeholder="Describe the decision, data structure, what you've tried..." value={doc.body} onChange={e => merge({ body: e.target.value })} />
            <div className="flex gap-2 flex-wrap">
              <button type="submit" className={c.btn}>Post</button>
              <button type="button" className={c.btnGhost} disabled={aiLoading} onClick={askAdvisor}>
                {aiLoading ? (
                  <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
                ) : "AI advisor"}
              </button>
            </div>
          </form>
        )}
        {questions.length === 0 && <p className={c.empty}>No questions yet — start one.</p>}
        {questions.map(q => {
          const qReplies = replies.filter(r => r.questionId === q._id)
          const open = openId === q._id
          return (
            <div key={q._id} className={c.card}>
              <button className="text-left w-full" onClick={() => setOpenId(open ? null : q._id)}>
                <div className="font-medium text-sm">{q.title}</div>
                <p className="text-xs text-[#57534e] mt-1 whitespace-pre-wrap">{open ? q.body : (q.body || "").slice(0, 140) + ((q.body || "").length > 140 ? "…" : "")}</p>
                <div className={c.meta}>{qReplies.length} {qReplies.length === 1 ? "reply" : "replies"}</div>
              </button>
              {open && (
                <div className="mt-3 space-y-2 border-t border-[#e7e5e4] pt-3">
                  {qReplies.map(r => (
                    <div key={r._id} className="flex gap-2 text-xs">
                      <img src={r.authorAvatar} alt={r.authorSlug} className="w-6 h-6 rounded-full flex-shrink-0" />
                      <div><div className="font-medium">{r.authorName}</div><p className="whitespace-pre-wrap">{r.body}</p></div>
                    </div>
                  ))}
                  {can("write") && (
                    <div className="flex gap-2">
                      <input className={c.input} placeholder="Add reasoning, references…" value={openId === q._id ? replyText : ""} onChange={e => setReplyText(e.target.value)} />
                      <button className={c.btn} onClick={() => sendReply(q._id)}>Reply</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("methods-commons")

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#1a1a1a] pb-24",
    header: "bg-[#1a1a1a] text-[#fafaf9] px-5 py-5 sticky top-0 z-10 border-b-4 border-[#c0392b]",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-[#a8a29e] mt-1",
    viewerChip: "flex items-center gap-2 mt-3 text-xs text-[#d6d3d1]",
    avatar: "w-6 h-6 rounded-full border border-[#44403c]",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-5",
    section: "bg-white rounded-lg border border-[#e7e5e4] shadow-sm overflow-hidden",
    sectionHead: "px-4 py-3 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fafaf9]",
    sectionTitle: "text-sm font-semibold uppercase tracking-wide text-[#57534e]",
    sectionBody: "p-4 space-y-3",
    btn: "min-h-[44px] px-4 py-2 bg-[#c0392b] text-white rounded-md font-medium text-sm hover:bg-[#a93226] disabled:opacity-50 transition",
    btnGhost: "min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#c0392b] border border-[#c0392b] rounded-md hover:bg-[#fef2f2]",
    input: "w-full px-3 py-2 border border-[#d6d3d1] rounded-md text-sm focus:outline-none focus:border-[#c0392b] bg-white",
    textarea: "w-full px-3 py-2 border border-[#d6d3d1] rounded-md text-sm focus:outline-none focus:border-[#c0392b] bg-white min-h-[80px] resize-y",
    label: "block text-xs font-medium text-[#57534e] mb-1",
    card: "border border-[#e7e5e4] rounded-md p-3 bg-[#fafaf9]",
    meta: "text-xs text-[#78716c] mt-2",
    empty: "text-sm text-[#a8a29e] italic py-6 text-center",
    tab: "px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b-2",
    tabActive: "border-[#c0392b] text-[#c0392b]",
    tabIdle: "border-transparent text-[#78716c]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Methods Commons</h1>
        <p className={c.tagline}>Doctoral methods peer group · shared analytic workspace</p>
        {viewer && (
          <div className={c.viewerChip}>
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
            <span>{viewer.displayName ?? viewer.userSlug}</span>
            {!can("write") && <span className="ml-2 text-[#a8a29e]">(read-only)</span>}
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <QuestionBoard c={c} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} viewer={viewer} can={can} />

        <ProjectCards c={c} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} viewer={viewer} can={can} />

        <Sessions c={c} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} viewer={viewer} can={can} />

        <Readings c={c} database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} viewer={viewer} can={can} />
      </main>
    </div>
  )
}