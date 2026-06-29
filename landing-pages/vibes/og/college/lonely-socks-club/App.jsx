import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("lonely-socks-club")

  const { doc: sockDraft, merge: mergeSock, submit: submitSock } = useDocument({
    type: "sock",
    name: "",
    age: "",
    location: "",
    bio: "",
    _files: {},
    createdAt: Date.now(),
  })

  const { docs: socks } = useLiveQuery("type", { key: "sock", descending: true })
  const { docs: reunions } = useLiveQuery("type", { key: "reunion", descending: true })

  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [isReuniting, setIsReuniting] = React.useState(false)
  const [matchPick, setMatchPick] = React.useState(null)

  function handleUpload(e) { e.preventDefault(); submitSock() }
  async function handleProposeMatch(sock) {
    if (!matchPick) { setMatchPick(sock); return }
    if (matchPick._id === sock._id) { setMatchPick(null); return }
    setIsReuniting(true)
    try {
      const prompt = `Write a wildly overdramatic two-sentence reunion announcement, like a reality TV finale, for two long-lost socks named ${matchPick.name} and ${sock.name}. Be tearful and absurd.`
      const res = await callAI(prompt, { schema: { properties: { announcement: { type: "string" } } } })
      const { announcement } = JSON.parse(res)
      await database.put({ type: "reunion", sockA: matchPick.name, sockB: sock.name, announcement, createdAt: Date.now() })
      setMatchPick(null)
    } finally { setIsReuniting(false) }
  }

  async function handleReact(sock, kind) {
    await database.put({ type: "reaction", sockId: sock._id, kind, createdAt: Date.now() })
  }

  async function handleSuggestBio() {
    setIsSuggesting(true)
    try {
      const prompt = `Write a tragic, funny, overly dramatic 2-sentence dating-app bio for a single lonely sock${sockDraft.name ? ` named ${sockDraft.name}` : ""}. Mention loss, hope, and a small physical detail.`
      const res = await callAI(prompt, { schema: { properties: { bio: { type: "string" } } } })
      const { bio } = JSON.parse(res)
      mergeSock({ bio })
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen pb-24 bg-[#f5f1e8] text-[#1a1a2e]",
    header: "sticky top-0 z-20 px-4 py-4 border-b-[3px] border-[#1a1a2e] bg-white",
    brandRow: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[2px]",
    title: "text-xl font-bold tracking-tight uppercase",
    tagline: "text-[0.65rem] uppercase tracking-[0.15em] mt-1 text-[#5a5a6e]",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-8",
    section: "border-[3px] border-[#1a1a2e] bg-white p-5 shadow-[6px_6px_0px_#1a1a2e]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-3 text-[#5a5a6e]",
    sectionTitle: "text-2xl font-bold uppercase tracking-tight mb-4",
    form: "space-y-3",
    field: "block",
    label: "block text-[0.65rem] uppercase tracking-[0.15em] mb-1",
    input: "w-full px-3 py-3 border-[3px] border-[#1a1a2e] text-base min-h-[44px] bg-white",
    textarea: "w-full px-3 py-3 border-[3px] border-[#1a1a2e] text-base min-h-[88px] bg-white",
    row: "flex gap-2 items-center flex-wrap",
    btnPrimary: "px-4 py-3 border-[3px] border-[#1a1a2e] bg-[#d63a2f] text-white uppercase tracking-[0.08em] text-sm font-bold min-h-[44px] shadow-[4px_4px_0px_#1a1a2e]",
    btnSecondary: "px-4 py-3 border-[3px] border-[#1a1a2e] bg-[#e8c547] text-[#1a1a2e] uppercase tracking-[0.08em] text-sm font-bold min-h-[44px] shadow-[3px_3px_0px_#1a1a2e] text-center",
    btnGhost: "px-3 py-2 border-[3px] border-[#1a1a2e] bg-white uppercase tracking-[0.08em] text-xs font-bold",
    suggestBtn: "px-3 py-2 border-[3px] border-[#1a1a2e] bg-[#3a6dc9] text-white text-xs uppercase tracking-[0.08em] font-bold shadow-[3px_3px_0px_#1a1a2e]",
    feed: "grid grid-cols-1 md:grid-cols-2 gap-4",
    card: "border-[3px] border-[#1a1a2e] bg-white p-4 shadow-[4px_4px_0px_#1a1a2e]",
    cardImg: "w-full aspect-square border-[3px] border-[#1a1a2e] mb-3 overflow-hidden bg-[#e8c547]",
    cardName: "text-lg font-bold uppercase tracking-tight",
    cardMeta: "text-[0.65rem] uppercase tracking-[0.15em] mb-2 text-[#5a5a6e]",
    cardBio: "text-sm leading-relaxed mb-3",
    reactRow: "flex gap-2 flex-wrap",
    reunionList: "space-y-3",
    reunion: "border-[3px] border-[#1a1a2e] bg-[#4a9d5f] text-white p-4 shadow-[4px_4px_0px_#1a1a2e]",
    reunionTitle: "text-base font-bold uppercase tracking-tight mb-1",
    reunionBody: "text-sm leading-relaxed",
    bottomBar: "fixed bottom-0 left-0 right-0 border-t-[3px] border-[#1a1a2e] bg-white px-4 py-3 flex gap-2 z-20 justify-around",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brandRow}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#d63a2f] border-[#1a1a2e]`}></span>
            <span className={`${c.dot} bg-[#e8c547] border-[#1a1a2e]`}></span>
            <span className={`${c.dot} bg-[#4a9d5f] border-[#1a1a2e]`}></span>
          </div>
          <h1 className={c.title}>The Lonely Socks Club</h1>
        </div>
        <p className={c.tagline}>For unpaired souls · Reunions since 1am</p>
      </header>

      <main id="app" className={c.main}>
        <div className="border-[3px] border-[#1a1a2e] bg-[#e8c547] p-6 shadow-[6px_6px_0px_#1a1a2e]" style={{marginBottom:0}}>
          <p className="text-[0.6rem] uppercase tracking-[0.25em] mb-2 text-[#1a1a2e]">// laundry tragedy support group</p>
          <h2 className="text-4xl font-bold uppercase tracking-tight leading-none text-[#1a1a2e]" style={{textShadow:"4px 4px 0 rgba(214,58,47,0.35)"}}>Two soles,<br/>one destiny.</h2>
          <p className="mt-3 text-sm text-[#1a1a2e]">Post your lonely sock. Find their match. Announce the tearful reunion.</p>
        </div>

        <section id="upload" className={c.section}>
          <p className={c.sectionLabel}>Step One</p>
          <h2 className={c.sectionTitle}>Submit a lost soul</h2>
          <form className={c.form} onSubmit={handleUpload}>
            <div className={c.field}>
              <label className={c.label}>Sock photo</label>
              <input type="file" accept="image/*" className={c.input} onChange={(e) => { const f = e.target.files?.[0]; if (f) mergeSock({ _files: { photo: f } }) }} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Sock name</label>
              <input type="text" placeholder="e.g. Reginald" className={c.input} value={sockDraft.name} onChange={(e) => mergeSock({ name: e.target.value })} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Age in laundry cycles</label>
              <input type="number" placeholder="14" className={c.input} value={sockDraft.age} onChange={(e) => mergeSock({ age: e.target.value })} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Last seen</label>
              <input type="text" placeholder="3rd floor dryer, Hutchins Hall" className={c.input} value={sockDraft.location} onChange={(e) => mergeSock({ location: e.target.value })} />
            </div>
            <div className={c.field}>
              <div className={c.row}>
                <label className={c.label}>Tragic bio</label>
                <button type="button" className={c.suggestBtn} onClick={handleSuggestBio} disabled={isSuggesting}>
                  {isSuggesting ? (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>) : "Suggest with AI"}
                </button>
              </div>
              <textarea placeholder="Tell us their story..." className={c.textarea} value={sockDraft.bio} onChange={(e) => mergeSock({ bio: e.target.value })}></textarea>
            </div>
            <button type="submit" className={c.btnPrimary}>Post to the club</button>
          </form>
        </section>

        <section id="feed" className={c.section}>
          <p className={c.sectionLabel}>Browse the heartbroken</p>
          <h2 className={c.sectionTitle}>Single socks near you</h2>
          {matchPick && (<p className={c.cardMeta}>Matchmaking with {matchPick.name} — pick a partner below {isReuniting && "(reuniting...)"}</p>)}
          {socks.length === 0 ? (
            <p className={c.cardBio}>No lonely socks yet. Submit the first lost soul above.</p>
          ) : (
            <div className={c.feed}>
              {socks.map((s) => (
                <article key={s._id} className={c.card}>
                  <div className={c.cardImg}>
                    {s._files?.photo?.url && <img src={s._files.photo.url} alt={s.name} className="w-full h-full object-cover" />}
                  </div>
                  <h3 className={c.cardName}>{s.name || "Unnamed"}</h3>
                  <p className={c.cardMeta}>Age {s.age || "?"} cycles · {s.location || "Unknown"}</p>
                  <p className={c.cardBio}>{s.bio || "No bio yet. A mystery sock."}</p>
                  <div className={c.reactRow}>
                    <button className={c.btnGhost} onClick={() => handleReact(s, "heart")}>Heart</button>
                    <button className={c.btnGhost} onClick={() => handleReact(s, "sob")}>Sob</button>
                    <button className={c.btnGhost} onClick={() => handleProposeMatch(s)} disabled={isReuniting}>
                      {matchPick?._id === s._id ? "Cancel" : "Propose match"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="reunions" className={c.section}>
          <p className={c.sectionLabel}>Wall of joy</p>
          <h2 className={c.sectionTitle}>Reunions</h2>
          {reunions.length === 0 ? (
            <p className={c.cardBio}>No reunions yet. The laundry room waits in silence.</p>
          ) : (
            <ul className={c.reunionList}>
              {reunions.map((r) => (
                <li key={r._id} className={c.reunion}>
                  <h3 className={c.reunionTitle}>{r.sockA} + {r.sockB}</h3>
                  <p className={c.reunionBody}>{r.announcement}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <nav className={c.bottomBar}>
        <a href="#upload" className={c.btnSecondary}>Submit</a>
        <a href="#feed" className={c.btnSecondary}>Browse</a>
        <a href="#reunions" className={c.btnSecondary}>Reunions</a>
      </nav>
    </div>
  )
}