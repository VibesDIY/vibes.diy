import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("dog-walk-announcer")

  const { doc: profile, merge: mergeProfile, save: saveProfile } = useDocument({ _id: "profile:me", handle: "", dog: "" })
  const { doc: walkDraft, merge: mergeDraft, submit: submitDraft, reset: resetDraft } = useDocument({
    type: "walk", walker: "", dog: "", route: "", eta_minutes: 20, ts_start: 0, joined: [], ended_ts: 0,
  })

  const { docs: walks } = useLiveQuery("type", { key: "walk", descending: true })
  const active = walks.filter((w) => !w.ended_ts)
  const past = walks.filter((w) => w.ended_ts)

  const [now, setNow] = React.useState(Date.now())
  const [suggesting, setSuggesting] = React.useState(false)
  React.useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])

  function handleProfileSubmit(e) {
    e.preventDefault()
    saveProfile()
  }

  function handleStartSubmit(e) {
    e.preventDefault()
    if (!profile.handle || !walkDraft.route) return
    mergeDraft({ walker: profile.handle, dog: profile.dog, ts_start: Date.now(), joined: [], ended_ts: 0 })
    submitDraft()
    resetDraft()
  }

  function handleJoin(walk) {
    if (!profile.handle) return
    if (walk.joined?.includes(profile.handle)) return
    database.put({ ...walk, joined: [...(walk.joined || []), profile.handle] })
  }

  function handleEnd(walk) {
    database.put({ ...walk, ended_ts: Date.now() })
  }

  async function handleSuggestRoute() {
    setSuggesting(true)
    try {
      const r = await callAI("Suggest one short neighborhood dog-walking route description, max 8 words.", {
        schema: { properties: { route: { type: "string" } } }
      })
      const { route } = JSON.parse(r)
      mergeDraft({ route })
    } finally { setSuggesting(false) }
  }

  // streaks: consecutive day count per walker from past walks
  const streaks = {}
  const longest = {}
  for (const w of past) {
    const day = new Date(w.ts_start).toISOString().slice(0,10)
    streaks[w.walker] = streaks[w.walker] || new Set()
    streaks[w.walker].add(day)
    const dur = Math.round(((w.ended_ts || w.ts_start) - w.ts_start) / 60000)
    if (!longest[w.walker] || dur > longest[w.walker]) longest[w.walker] = dur
  }
  function consecutive(daySet) {
    if (!daySet || daySet.size === 0) return 0
    const days = [...daySet].sort().reverse()
    let count = 0
    let cursor = new Date().toISOString().slice(0,10)
    for (const d of days) {
      if (d === cursor) {
        count++
        const dt = new Date(cursor); dt.setDate(dt.getDate()-1); cursor = dt.toISOString().slice(0,10)
      } else break
    }
    return count
  }
  const leaderboard = Object.keys(streaks).map(walker => ({
    walker, streak: consecutive(streaks[walker]), longest: longest[walker] || 0
  })).sort((a,b) => b.streak - a.streak || b.longest - a.longest)

  function mins(ms) { return Math.max(0, Math.round(ms / 60000)) }

  const c = {
    page: "min-h-screen w-full bg-[oklch(0.16_0_0)] text-[oklch(0.87_0.30_142)]",
    crt: "fixed inset-0 pointer-events-none z-[99] bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0px,rgba(0,255,0,0.03)_1px,transparent_1px,transparent_3px)]",
    sweep: "fixed left-0 right-0 h-[3px] pointer-events-none z-[100] bg-gradient-to-b from-[oklch(0.87_0.30_142_/_0.4)] to-transparent",
    shell: "relative max-w-[640px] mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex flex-col gap-2 pb-4 border-b border-[oklch(0.87_0.30_142_/_0.3)]",
    title: "text-2xl tracking-wider [text-shadow:0_0_10px_oklch(0.87_0.30_142/0.7)]",
    subtitle: "text-sm tracking-widest uppercase text-[oklch(0.87_0.30_142_/_0.4)]",
    statusRow: "flex items-center gap-2 text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)]",
    dot: "inline-block w-[6px] h-[6px] rounded-full bg-[oklch(0.87_0.30_142)] [box-shadow:0_0_8px_oklch(0.87_0.30_142/0.9)]",
    section: "flex flex-col gap-3",
    sectionLabel: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)]",
    card: "border border-[oklch(0.87_0.30_142_/_0.3)] bg-[oklch(0_0_0_/_0.85)] p-4 flex flex-col gap-3",
    field: "flex flex-col gap-1",
    label: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)]",
    input: "bg-transparent border border-[oklch(0.87_0.30_142_/_0.3)] px-3 py-3 min-h-[44px] outline-none w-full text-[oklch(0.87_0.30_142)] caret-[oklch(0.87_0.30_142)] placeholder:text-[oklch(0.87_0.30_142_/_0.4)]",
    textarea: "bg-transparent border border-[oklch(0.87_0.30_142_/_0.3)] px-3 py-3 min-h-[88px] outline-none w-full resize-none text-[oklch(0.87_0.30_142)] caret-[oklch(0.87_0.30_142)] placeholder:text-[oklch(0.87_0.30_142_/_0.4)]",
    row: "flex flex-row gap-3 items-center",
    btn: "px-4 py-3 min-h-[44px] border border-[oklch(0.87_0.30_142_/_0.3)] tracking-widest text-sm text-[oklch(0.87_0.30_142)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black transition-colors",
    btnGhost: "px-3 py-2 min-h-[36px] tracking-widest text-xs border border-[oklch(0.87_0.30_142_/_0.3)] text-[oklch(0.87_0.30_142)] hover:bg-[oklch(0.87_0.30_142)] hover:text-black transition-colors",
    feedCard: "border border-[oklch(0.87_0.30_142_/_0.3)] bg-[oklch(0_0_0_/_0.85)] p-4 flex flex-col gap-3",
    feedHead: "flex items-start justify-between gap-3",
    feedMeta: "flex flex-col gap-1",
    feedName: "text-base tracking-wide [text-shadow:0_0_10px_oklch(0.87_0.30_142/0.7)]",
    feedRoute: "text-sm",
    feedSub: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)]",
    joiners: "text-xs flex flex-wrap gap-2 text-[oklch(0.87_0.30_142_/_0.4)]",
    logList: "flex flex-col gap-2",
    logRow: "border border-[oklch(0.87_0.30_142_/_0.3)] bg-[oklch(0_0_0_/_0.85)] px-3 py-2 flex flex-row justify-between items-center text-sm",
    leaderRow: "flex justify-between border-b border-[oklch(0.87_0.30_142_/_0.3)] py-2 text-sm last:border-0",
    suggestBtn: "self-start text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142_/_0.4)] hover:text-[oklch(0.87_0.30_142)]",
    grid2: "grid grid-cols-2 gap-3",
  }

  return (
    <div className={c.page} style={{ fontFamily: '"VT323", monospace', fontSize: 18, lineHeight: 1.4 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');@keyframes sweep{0%{top:-3px}100%{top:100vh}}`}</style>
      <div className={c.crt} aria-hidden="true" />
      <div className={c.sweep} aria-hidden="true" style={{ animation: 'sweep 8s linear infinite' }} />
      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>▌ DOG.WALK.ANNOUNCER</h1>
          <div className={c.subtitle}>SYS: neighborhood broadcast terminal</div>
          <div className={c.statusRow}>
            <span className={c.dot} /> <span>STATUS: online</span>
          </div>
        </header>

        <main id="app" className="flex flex-col gap-6">

          <section id="profile" className={c.section}>
            <div className={c.sectionLabel}>SYS: operator profile</div>
            <form className={c.card} onSubmit={handleProfileSubmit}>
              <div className={c.grid2}>
                <div className={c.field}>
                  <label className={c.label}>handle</label>
                  <input className={c.input} placeholder="jchris" value={profile.handle} onChange={(e) => mergeProfile({ handle: e.target.value })} />
                </div>
                <div className={c.field}>
                  <label className={c.label}>dog</label>
                  <input className={c.input} placeholder="Pickles" value={profile.dog} onChange={(e) => mergeProfile({ dog: e.target.value })} />
                </div>
              </div>
              <div className={c.row}>
                <button className={c.btn} type="submit">[ SAVE ]</button>
              </div>
            </form>
          </section>

          <section id="start-walk" className={c.section}>
            <div className={c.sectionLabel}>STATUS: launch new walk</div>
            <form className={c.card} onSubmit={handleStartSubmit}>
              <div className={c.field}>
                <label className={c.label}>route</label>
                <textarea className={c.textarea} placeholder="around the cemetery" value={walkDraft.route} onChange={(e) => mergeDraft({ route: e.target.value })} />
              </div>
              <button type="button" className={c.suggestBtn} onClick={handleSuggestRoute} disabled={suggesting}>
                {suggesting ? "░ thinking..." : "░ suggest a route"}
              </button>
              <div className={c.field}>
                <label className={c.label}>eta (minutes)</label>
                <input className={c.input} type="number" placeholder="20" value={walkDraft.eta_minutes} onChange={(e) => mergeDraft({ eta_minutes: Number(e.target.value) })} />
              </div>
              <div className={c.row}>
                <button className={c.btn} type="submit">[ START WALK ]</button>
              </div>
            </form>
          </section>

          <section id="active-feed" className={c.section}>
            <div className={c.sectionLabel}>FEED: walks active now</div>

            {active.length === 0 && <div className={c.feedSub}>→ no walks active. start one.</div>}
            {active.map((w) => (
              <article key={w._id} className={c.feedCard}>
                <div className={c.feedHead}>
                  <div className={c.feedMeta}>
                    <div className={c.feedName}>● {w.walker} + {w.dog}</div>
                    <div className={c.feedRoute}>{w.route}</div>
                    <div className={c.feedSub}>ETA {w.eta_minutes}m · started {mins(now - w.ts_start)}m ago</div>
                  </div>
                  {w.walker !== profile.handle && (
                    <button className={c.btnGhost} onClick={() => handleJoin(w)}>[ JOIN ]</button>
                  )}
                </div>
                <div className={c.joiners}>
                  <span>→ joined: {w.joined?.length ? w.joined.join(", ") : "nobody yet"}</span>
                </div>
                {w.walker === profile.handle && (
                  <div className={c.row}>
                    <button className={c.btnGhost} onClick={() => handleEnd(w)}>[ END WALK ]</button>
                  </div>
                )}
              </article>
            ))}
          </section>

          <section id="streaks" className={c.section}>
            <div className={c.sectionLabel}>SYS: streaks · longest walks</div>
            <div className={c.card}>
              {leaderboard.length === 0 && <div className={c.feedSub}>→ no completed walks yet</div>}
              {leaderboard.map((row) => (
                <div key={row.walker} className={c.leaderRow}>
                  <span>{row.walker}</span>
                  <span>▲ {row.streak}d streak · █ {row.longest}m</span>
                </div>
              ))}
            </div>
          </section>

          <section id="scrollback" className={c.section}>
            <div className={c.sectionLabel}>LOG: scrollback</div>
            <ul className={c.logList}>
              {past.length === 0 && <li className={c.feedSub}>→ scrollback empty</li>}
              {past.map((w) => (
                <li key={w._id} className={c.logRow}>
                  <span>{w.walker} + {w.dog} · {w.route}</span>
                  <span>{mins(w.ended_ts - w.ts_start)}m · {w.joined?.length || 0} joiner{(w.joined?.length || 0) === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          </section>

        </main>
      </div>
    </div>
  )
}