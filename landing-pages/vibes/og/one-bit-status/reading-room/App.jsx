import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

if (typeof document !== "undefined" && !document.getElementById("vt323-font")) {
  const l = document.createElement("link")
  l.id = "vt323-font"
  l.rel = "stylesheet"
  l.href = "https://fonts.googleapis.com/css2?family=VT323&display=optional"
  document.head.appendChild(l)
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("reading-room")
  const [me, setMe] = React.useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("rrnr-name") || "" : ""))
  const [nameDraft, setNameDraft] = React.useState(me)
  const [titleDraft, setTitleDraft] = React.useState("")
  const [authorDraft, setAuthorDraft] = React.useState("")
  const [totalDraft, setTotalDraft] = React.useState("300")
  const [quoteDraft, setQuoteDraft] = React.useState("")
  const [newTitle, setNewTitle] = React.useState("")
  const [newAuthor, setNewAuthor] = React.useState("")
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const { docs: events } = useLiveQuery("ts", { descending: true, limit: 200 })

  const latestByName = React.useMemo(() => {
    const map = new Map()
    for (const d of events) {
      if (!d.name) continue
      if (!map.has(d.name)) map.set(d.name, d)
    }
    return Array.from(map.values())
  }, [events])

  function relTime(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
    if (s < 60) return "just now"
    if (s < 3600) return Math.floor(s / 60) + "m ago"
    if (s < 86400) return Math.floor(s / 3600) + "h ago"
    return Math.floor(s / 86400) + "d ago"
  }

  async function writeEvent(payload) {
    await database.put({ ...payload, ts: Date.now() })
  }

  function handleJoin(e) {
    e.preventDefault()
    const name = nameDraft.trim()
    if (!name || !titleDraft.trim()) return
    const total = parseInt(totalDraft, 10) || 300
    if (typeof localStorage !== "undefined") localStorage.setItem("rrnr-name", name)
    setMe(name)
    writeEvent({ name, title: titleDraft.trim(), author: authorDraft.trim(), page: 0, total, kind: "switch" })
    setTitleDraft(""); setAuthorDraft("")
  }

  function handleBump(amount) {
    const mine = latestByName.find((d) => d.name === me)
    if (!mine) return
    const nextPage = Math.min((mine.page || 0) + amount, mine.total || 300)
    writeEvent({ name: me, title: mine.title, author: mine.author, page: nextPage, prevPage: mine.page || 0, total: mine.total || 300, kind: "bump" })
  }

  function handleQuote(e) {
    e.preventDefault()
    const mine = latestByName.find((d) => d.name === me)
    if (!mine || !quoteDraft.trim()) return
    writeEvent({ name: me, title: mine.title, author: mine.author, page: mine.page || 0, total: mine.total || 300, quote: quoteDraft.trim(), kind: "quote" })
    setQuoteDraft("")
  }

  function handleSwitch(e) {
    e.preventDefault()
    if (!me || !newTitle.trim()) return
    const mine = latestByName.find((d) => d.name === me)
    writeEvent({ name: me, title: newTitle.trim(), author: newAuthor.trim(), page: 0, total: (mine && mine.total) || 300, kind: "switch" })
    setNewTitle(""); setNewAuthor("")
  }

  async function suggestBook() {
    setIsSuggesting(true)
    try {
      const r = await callAI("Suggest one short, evocative literary novel a small book club might be reading. Return strict JSON.", {
        schema: { properties: { title: { type: "string" }, author: { type: "string" }, total: { type: "number" } } },
      })
      const p = JSON.parse(r)
      if (p.title) setTitleDraft(p.title)
      if (p.author) setAuthorDraft(p.author)
      if (p.total) setTotalDraft(String(p.total))
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen w-full relative",
    pageStyle: { background: "oklch(0.16 0 0)", color: "oklch(0.87 0.30 142)", fontFamily: "'VT323', monospace", fontSize: "18px", lineHeight: 1.4 },
    shell: "max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex flex-col gap-2 pb-4",
    headerStyle: { borderBottom: "1px solid oklch(0.87 0.30 142 / 0.3)" },
    brand: "flex items-center justify-between",
    title: "text-3xl tracking-wide",
    titleStyle: { textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" },
    sub: "text-xs uppercase tracking-widest",
    subStyle: { color: "oklch(0.87 0.30 142 / 0.4)", letterSpacing: "0.1em" },
    statusRow: "flex items-center gap-3 text-xs uppercase tracking-widest",
    dot: "w-[6px] h-[6px] rounded-full inline-block",
    dotActive: { background: "oklch(0.87 0.30 142)", boxShadow: "0 0 8px oklch(0.87 0.30 142 / 0.8)" },
    dotIdle: { background: "oklch(0.87 0.30 142 / 0.4)" },

    identity: "flex flex-col gap-2 p-3",
    identityStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.3)", background: "oklch(0 0 0 / 0.85)" },
    identityRow: "flex items-center gap-2",
    input: "flex-1 bg-transparent px-2 py-2 min-h-[44px] outline-none",
    inputStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.3)", color: "oklch(0.87 0.30 142)", caretColor: "oklch(0.87 0.30 142)", fontFamily: "'VT323', monospace", fontSize: "18px" },
    btn: "px-3 py-2 min-h-[44px] tracking-widest text-sm cursor-pointer",
    btnStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.6)", color: "oklch(0.87 0.30 142)", background: "transparent", fontFamily: "'VT323', monospace", fontSize: "16px" },

    section: "flex flex-col gap-3",
    sectionLabel: "text-xs uppercase tracking-widest",
    sectionLabelStyle: { color: "oklch(0.87 0.30 142 / 0.5)", letterSpacing: "0.15em" },

    cards: "flex flex-col gap-4",
    card: "p-4 flex flex-col gap-3",
    cardStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.3)", background: "oklch(0 0 0 / 0.85)" },
    cardHead: "flex items-center justify-between gap-2",
    cardName: "flex items-center gap-2 text-sm uppercase tracking-widest",
    cardTime: "text-xs uppercase tracking-widest",
    bookTitle: "text-3xl leading-tight",
    bookTitleStyle: { color: "oklch(0.87 0.30 142)", textShadow: "0 0 10px oklch(0.87 0.30 142 / 0.7)" },
    bookAuthor: "text-base",
    bookAuthorStyle: { color: "oklch(0.87 0.30 142 / 0.4)" },
    progressWrap: "flex flex-col gap-1",
    progressBar: "w-full h-3 relative overflow-hidden",
    progressBarStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.3)", background: "oklch(0.87 0.30 142 / 0.05)" },
    progressFill: "h-full absolute left-0 top-0",
    progressFillStyle: { background: "oklch(0.87 0.30 142)", boxShadow: "0 0 8px oklch(0.87 0.30 142 / 0.8)" },
    progressMeta: "flex items-center justify-between text-xs uppercase tracking-widest",

    bumpRow: "grid grid-cols-3 gap-2",
    bumpBtn: "py-3 min-h-[44px] text-center tracking-widest cursor-pointer",
    bumpBtnStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.6)", color: "oklch(0.87 0.30 142)", background: "transparent", fontFamily: "'VT323', monospace", fontSize: "16px" },

    quoteForm: "flex flex-col gap-2",
    textarea: "w-full bg-transparent px-2 py-2 min-h-[60px] outline-none resize-none",
    textareaStyle: { border: "1px solid oklch(0.87 0.30 142 / 0.3)", color: "oklch(0.87 0.30 142)", caretColor: "oklch(0.87 0.30 142)", fontFamily: "'VT323', monospace", fontSize: "18px" },
    quoteRow: "flex items-center justify-between gap-2",

    switchForm: "flex flex-col gap-2 pt-3",
    switchFormStyle: { borderTop: "1px solid oklch(0.87 0.30 142 / 0.3)" },
    switchRow: "grid grid-cols-2 gap-2",

    feed: "flex flex-col gap-2 pt-4",
    feedStyle: { borderTop: "1px solid oklch(0.87 0.30 142 / 0.3)" },
    feedItem: "flex items-start gap-2 text-base leading-snug py-2",
    feedItemStyle: { borderBottom: "1px solid oklch(0.87 0.30 142 / 0.15)" },
    feedDot: "mt-2",
    feedBody: "flex-1",
    feedTime: "text-xs uppercase tracking-widest",

    footer: "text-xs uppercase tracking-widest text-center pt-4",
  }

  return (
    <div className={c.page} style={c.pageStyle}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99, background: "repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px)" }}></div>
      <div style={{ position: "fixed", left: 0, right: 0, height: "3px", pointerEvents: "none", zIndex: 100, background: "linear-gradient(to bottom, transparent, oklch(0.87 0.30 142 / 0.25), transparent)", animation: "crtSweep 8s linear infinite" }}></div>
      <style>{`@keyframes crtSweep { 0% { top: -3px } 100% { top: 100vh } }`}</style>
      <div className={c.shell}>
        <header id="app-header" className={c.header} style={c.headerStyle}>
          <div className={c.brand}>
            <h1 className={c.title} style={c.titleStyle}>READING-RIGHT-NOW ROOM</h1>
            <span className={c.sub} style={c.subStyle}>v0.1</span>
          </div>
          <div className={c.statusRow}>
            <span className={c.dot} style={c.dotActive}></span>
            <span>SYS: ONLINE</span>
            <span>·</span>
            <span>{latestByName.length} READER{latestByName.length === 1 ? "" : "S"}</span>
            {me ? <><span>·</span><span>YOU: {me.toUpperCase()}</span></> : null}
          </div>
        </header>

        <main id="app" className="flex flex-col gap-6">
          <section id="identity" className={c.section}>
            <span className={c.sectionLabel} style={c.sectionLabelStyle}>SYS: IDENTITY</span>
            <form onSubmit={handleJoin} className={c.identity} style={c.identityStyle}>
              <div className={c.identityRow}>
                <input className={c.input} style={c.inputStyle} placeholder="your handle" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                <button type="submit" className={c.btn} style={c.btnStyle}>[ JOIN ]</button>
              </div>
              <div className={c.identityRow}>
                <input className={c.input} style={c.inputStyle} placeholder="book title" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
              </div>
              <div className={c.identityRow}>
                <input className={c.input} style={c.inputStyle} placeholder="author" value={authorDraft} onChange={(e) => setAuthorDraft(e.target.value)} />
                <input className={c.input} style={c.inputStyle} placeholder="total pages" value={totalDraft} onChange={(e) => setTotalDraft(e.target.value)} inputMode="numeric" />
              </div>
              <div className={c.identityRow}>
                <button type="button" onClick={suggestBook} disabled={isSuggesting} className={c.btn} style={c.btnStyle}>
                  {isSuggesting ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="9" fill="none" stroke="oklch(0.87 0.30 142)" strokeWidth="3" strokeDasharray="42 60" /></svg>
                      QUERY...
                    </span>
                  ) : "[ SUGGEST ]"}
                </button>
                <span className={c.sub} style={c.subStyle}>AI ▸ pick a book for me</span>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
            </form>
          </section>

          <section id="cards" className={c.section}>
            <span className={c.sectionLabel} style={c.sectionLabelStyle}>STATUS: READERS</span>
            {latestByName.length === 0 ? (
              <div className={c.card} style={c.cardStyle}>
                <span className={c.sub} style={c.subStyle}>NO READERS ▸ JOIN ABOVE TO BROADCAST</span>
              </div>
            ) : (
              <ul className={c.cards}>
                {latestByName.map((d) => {
                  const total = d.total || 300
                  const pct = Math.min(100, Math.round(((d.page || 0) / total) * 100))
                  const isMe = d.name === me
                  const fresh = Date.now() - d.ts < 1000 * 60 * 30
                  return (
                    <li key={d.name} className={c.card} style={c.cardStyle}>
                      <div className={c.cardHead}>
                        <div className={c.cardName}>
                          <span className={c.dot} style={fresh ? c.dotActive : c.dotIdle}></span>
                          <span>{d.name}{isMe ? " ▸ YOU" : ""}</span>
                        </div>
                        <span className={c.cardTime} style={c.subStyle}>{relTime(d.ts)}</span>
                      </div>
                      <div>
                        <div className={c.bookTitle} style={c.bookTitleStyle}>{d.title}</div>
                        <div className={c.bookAuthor} style={c.bookAuthorStyle}>{d.author || "—"}</div>
                      </div>
                      <div className={c.progressWrap}>
                        <div className={c.progressBar} style={c.progressBarStyle}>
                          <div className={c.progressFill} style={{ ...c.progressFillStyle, width: pct + "%" }}></div>
                        </div>
                        <div className={c.progressMeta} style={c.subStyle}>
                          <span>p.{d.page || 0} / {total}</span>
                          <span>{pct}%</span>
                        </div>
                      </div>

                      {isMe && (
                        <>
                          <div className={c.bumpRow}>
                            <button onClick={() => handleBump(1)} className={c.bumpBtn} style={c.bumpBtnStyle}>[ +1 ]</button>
                            <button onClick={() => handleBump(5)} className={c.bumpBtn} style={c.bumpBtnStyle}>[ +5 ]</button>
                            <button onClick={() => handleBump(10)} className={c.bumpBtn} style={c.bumpBtnStyle}>[ +10 ]</button>
                          </div>

                          <form onSubmit={handleQuote} className={c.quoteForm}>
                            <textarea className={c.textarea} style={c.textareaStyle} placeholder="optional passage quote..." value={quoteDraft} onChange={(e) => setQuoteDraft(e.target.value)}></textarea>
                            <div className={c.quoteRow}>
                              <span className={c.sub} style={c.subStyle}>FEED: PASSAGE</span>
                              <button type="submit" className={c.btn} style={c.btnStyle}>[ TRANSMIT ]</button>
                            </div>
                          </form>

                          <form onSubmit={handleSwitch} className={c.switchForm} style={c.switchFormStyle}>
                            <span className={c.sectionLabel} style={c.sectionLabelStyle}>SYS: SWITCH BOOK</span>
                            <div className={c.switchRow}>
                              <input className={c.input} style={c.inputStyle} placeholder="new title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                              <input className={c.input} style={c.inputStyle} placeholder="new author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} />
                            </div>
                            <button type="submit" className={c.btn} style={c.btnStyle}>[ SWITCH ]</button>
                          </form>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section id="feed" className={c.section}>
            <span className={c.sectionLabel} style={c.sectionLabelStyle}>FEED: ACTIVITY</span>
            <ul className={c.feed} style={c.feedStyle}>
              {events.slice(0, 40).map((d) => (
                <li key={d._id} className={c.feedItem} style={c.feedItemStyle}>
                  <span className={c.feedDot}>▸</span>
                  <div className={c.feedBody}>
                    <div>
                      {d.kind === "bump" && <>{d.name} bumped '{d.title}' p.{d.prevPage ?? 0} → {d.page}</>}
                      {d.kind === "switch" && <>{d.name} switched to '{d.title}'{d.author ? " — " + d.author : ""}</>}
                      {d.kind === "quote" && <>{d.name} ▸ "{d.quote}" <span style={c.subStyle}>(p.{d.page})</span></>}
                    </div>
                    <span className={c.feedTime} style={c.subStyle}>{relTime(d.ts)}</span>
                  </div>
                </li>
              ))}
              {events.length === 0 && (
                <li className={c.feedItem} style={c.feedItemStyle}>
                  <span className={c.feedDot}>▸</span>
                  <div className={c.feedBody}>
                    <div>NO TRANSMISSIONS YET</div>
                  </div>
                </li>
              )}
            </ul>
          </section>

          <footer className={c.footer} style={c.subStyle}>END OF TRANSMISSION ░▒█</footer>
        </main>
      </div>
    </div>
  )
}