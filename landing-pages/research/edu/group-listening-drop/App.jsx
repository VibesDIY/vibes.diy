import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

function ReactionList({ c }) {
  const { useLiveQuery } = useFireproof("drop-crew")
  const { docs } = useLiveQuery("type", { key: "reaction", descending: true, limit: 50 })
  if (!docs.length) return <p className="text-sm text-[#6b6577] font-mono">no reactions yet. be first.</p>
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d._id} className={c.row}>
          <p className="text-[0.65rem] font-mono uppercase tracking-[0.15em] text-[#e84a3f]">{d.who} {d.scene && <span className="text-[#6b6577]">// {d.scene}</span>}</p>
          <p className="text-base">{d.text}</p>
        </li>
      ))}
    </ul>
  )
}

function CurrentDrop({ database, now, c }) {
  const { useDocument } = useFireproof("drop-crew")
  const { doc } = useDocument({ _id: "current-drop" })
  if (!doc.title) return null
  const ms = doc.dropTime - now
  const live = ms <= 0
  const mm = Math.max(0, Math.floor(ms / 60000))
  const ss = Math.max(0, Math.floor((ms % 60000) / 1000))
  return (
    <div className="mt-5 border-t-[3px] border-[#1a1625] pt-4">
      <p className={c.label}>{live ? "Now spinning" : "Next up"}</p>
      <p className="text-lg font-bold uppercase">{doc.title}</p>
      <p className="text-xs font-mono text-[#6b6577]">hosted by {doc.host}</p>
      <p className={"font-mono text-4xl font-bold mt-2 " + (live ? "text-[#4ab06e]" : "text-[#e84a3f]")}>
        {live ? "LIVE" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
      </p>
    </div>
  )
}

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("drop-crew")
  const { doc: me, merge: mergeMe, save: saveMe } = useDocument({ _id: "me", name: "", scene: "" })
  const [albumTitle, setAlbumTitle] = React.useState("")
  const [dropAt, setDropAt] = React.useState("")
  const [reaction, setReaction] = React.useState("")
  const [now, setNow] = React.useState(Date.now())
  const [loadingHype, setLoadingHype] = React.useState(false)
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#1a1625] font-['Space_Grotesk',sans-serif] pb-24",
    header: "bg-[#1a1625] text-[#f5f1e8] border-b-[3px] border-[#1a1625] px-5 py-5 sticky top-0 z-20",
    brand: "text-3xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#e84a3f] mt-1 font-mono",
    main: "px-4 py-5 max-w-[920px] mx-auto space-y-5",
    section: "bg-white border-[3px] border-[#1a1625] rounded-[4px] shadow-[4px_4px_0px_#1a1625] p-5",
    h2: "text-xl font-bold uppercase tracking-tight mb-4",
    btn: "bg-[#e84a3f] text-white border-[3px] border-[#1a1625] rounded-[4px] shadow-[4px_4px_0px_#1a1625] px-5 py-3 font-bold uppercase tracking-wider text-sm min-h-[48px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnYellow: "bg-[#f0c419] text-[#1a1625] border-[3px] border-[#1a1625] rounded-[4px] shadow-[3px_3px_0px_#1a1625] px-4 py-3 font-bold uppercase tracking-wider text-sm min-h-[48px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    input: "w-full bg-white border-[3px] border-[#1a1625] rounded-[4px] px-4 py-3 text-base focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1625] transition-all",
    row: "border-[3px] border-[#1a1625] rounded-[4px] p-3 bg-white",
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6577] font-bold mb-2 block",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-[#e84a3f] border-2 border-[#f5f1e8]" />
            <div className="w-3 h-3 bg-[#f0c419] border-2 border-[#f5f1e8]" />
            <div className="w-3 h-3 bg-[#4ab06e] border-2 border-[#f5f1e8]" />
          </div>
          <div>
            <h1 className={c.brand}>Drop Crew</h1>
            <p className={c.tag}>Listen together // react loud</p>
          </div>
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="scene-picker" className={c.section}>
          <h2 className={c.h2}>Your Scene {me.scene && <span className="text-[#e84a3f]">// {me.scene}</span>}</h2>
          <label className={c.label}>Your name</label>
          <input className={c.input + " mb-4"} placeholder="DJ Tape Hiss" value={me.name} onChange={(e) => mergeMe({ name: e.target.value })} />
          <label className={c.label}>Pick a scene</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Punk", "Jazz", "Hyperpop", "Ambient", "Hip-hop", "Shoegaze"].map((s) => (
              <button key={s} onClick={() => mergeMe({ scene: s })} className={(me.scene === s ? "bg-[#4ab06e] " : "bg-[#f0c419] ") + "text-[#1a1625] border-[3px] border-[#1a1625] rounded-[4px] shadow-[3px_3px_0px_#1a1625] px-3 py-2 font-bold uppercase tracking-wider text-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"}>{s}</button>
            ))}
          </div>
          <button className={c.btn} onClick={() => saveMe()} disabled={!me.name || !me.scene}>Lock it in</button>
        </section>

        <section id="album-drop" className={c.section}>
          <h2 className={c.h2}>The Drop</h2>
          <label className={c.label}>Album / set title</label>
          <div className="flex gap-2 mb-4">
            <input className={c.input} placeholder="Unknown Pleasures" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} />
            <button className={c.btnYellow + " whitespace-nowrap"} disabled={loadingHype} onClick={async () => {
              setLoadingHype(true)
              try {
                const r = await callAI(`Suggest one real album that fits the ${me.scene || "music"} scene. Just the title and artist.`, { schema: { properties: { suggestion: { type: "string" } } } })
                setAlbumTitle(JSON.parse(r).suggestion)
              } finally { setLoadingHype(false) }
            }}>{loadingHype ? <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="20 10" /></svg> : "Idea"}</button>
          </div>
          <label className={c.label}>Minutes until drop</label>
          <input className={c.input + " mb-4"} type="number" placeholder="5" value={dropAt} onChange={(e) => setDropAt(e.target.value)} />
          <button className={c.btn} disabled={!albumTitle || !dropAt} onClick={() => {
            database.put({ _id: "current-drop", type: "drop", title: albumTitle, dropTime: Date.now() + Number(dropAt) * 60000, host: me.name })
            setAlbumTitle(""); setDropAt("")
          }}>Announce drop</button>
          <CurrentDrop database={database} now={now} c={c} />
        </section>

        <section id="reaction-feed" className={c.section}>
          <h2 className={c.h2}>Live Feed</h2>
          <form className="flex gap-2 mb-4" onSubmit={(e) => {
            e.preventDefault()
            if (!reaction.trim() || !me.name) return
            database.put({ type: "reaction", text: reaction, who: me.name, scene: me.scene, at: Date.now() })
            setReaction("")
          }}>
            <input className={c.input} placeholder={me.scene === "Jazz" ? "smooth as hell..." : me.scene === "Punk" ? "FERAL!!!" : "this slaps"} value={reaction} onChange={(e) => setReaction(e.target.value)} />
            <button type="submit" className={c.btn}>Send</button>
          </form>
          <ReactionList c={c} />
        </section>
      </main>
    </div>
  )
}