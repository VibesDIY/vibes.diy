import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("foursquare-dating")

  const { doc: profile, merge: mergeProfile, submit: submitProfile } = useDocument({
    _id: "me",
    type: "profile",
    name: "",
    vibe: "",
    seeking: "",
    friendName: "",
    friendNote: "",
  })

  const { doc: mixerDraft, merge: mergeMixer, submit: submitMixer, reset: resetMixer } = useDocument({
    type: "mixer",
    where: "",
    confirms: [],
    locked: false,
    icebreakers: [],
    createdAt: Date.now(),
  })

  const { docs: pairs } = useLiveQuery("type", { key: "pair", descending: true })
  const { docs: mixers } = useLiveQuery("type", { key: "mixer", descending: true })
  const { docs: profiles } = useLiveQuery("type", { key: "profile" })
  const me = profiles[0]

  const [iceLoadingId, setIceLoadingId] = React.useState(null)
  const [suggestLoading, setSuggestLoading] = React.useState(false)

  function handleProfileSubmit(e) {
    e.preventDefault()
    submitProfile()
  }

  function handleFriendSubmit(e) {
    e.preventDefault()
    if (!profile.name || !profile.friendName) return
    database.put({ type: "pair", name: profile.name, vibe: profile.vibe, friendName: profile.friendName, friendNote: profile.friendNote, createdAt: Date.now() })
  }

  function proposeMixerWith(pair) {
    mergeMixer({ withPair: { _id: pair._id, name: pair.name, friendName: pair.friendName } })
    document.getElementById("mixers")?.scrollIntoView({ behavior: "smooth" })
  }

  function handleProposeMixer(e) {
    e.preventDefault()
    if (!mixerDraft.where || !mixerDraft.withPair) return
    submitMixer()
  }

  function confirmMixer(m) {
    const confirms = Array.from(new Set([...(m.confirms || []), me?._id || "me"]))
    const locked = confirms.length >= 4
    database.put({ ...m, confirms, locked })
  }

  async function generateIcebreakers(m) {
    setIceLoadingId(m._id)
    try {
      const prompt = `Four people are meeting for a group date at "${m.where}". They are: ${me?.name} and their friend ${me?.friendName}, plus ${m.withPair?.name} and their friend ${m.withPair?.friendName}. Generate 5 fun, group-friendly icebreaker questions that get all four people talking. Avoid romantic 1:1 framing.`
      const res = await callAI(prompt, { schema: { properties: { icebreakers: { type: "array", items: { type: "string" } } } } })
      const data = JSON.parse(res)
      await database.put({ ...m, icebreakers: data.icebreakers || [] })
    } finally {
      setIceLoadingId(null)
    }
  }

  async function suggestProfile() {
    setSuggestLoading(true)
    try {
      const res = await callAI("Generate a playful dating profile draft with display name, one-line vibe, and what they're seeking. Keep it warm and specific.", { schema: { properties: { name: { type: "string" }, vibe: { type: "string" }, seeking: { type: "string" } } } })
      const data = JSON.parse(res)
      mergeProfile({ name: data.name, vibe: data.vibe, seeking: data.seeking })
    } finally {
      setSuggestLoading(false)
    }
  }

  function handleConfirmMixer() {}

  const c = {
    page: "min-h-screen pb-32 bg-[#FFF0F8] text-[#1A1235]",
    header: "sticky top-0 z-20 px-4 py-4 border-b-2 border-[#FF5FA0] bg-[#FFF0F8]",
    brandRow: "flex items-center gap-3",
    logoBlocks: "flex gap-1",
    logoSquare: "w-3 h-3 rounded-sm",
    brand: "text-lg font-bold tracking-tight uppercase text-[#1A1235]",
    tagline: "text-xs uppercase tracking-widest mt-0.5 text-[#6B6080]",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "border-2 border-[#1A1235] p-5 bg-white shadow-[4px_4px_0px_#FF5FA0]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-2 text-[#FF5FA0] font-bold",
    sectionTitle: "text-2xl font-bold uppercase tracking-tight mb-4 text-[#1A1235]",
    formRow: "flex flex-col gap-2 mb-3",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[#6B6080]",
    input: "w-full px-3 py-3 border-2 border-[#1A1235] text-base min-h-[44px] bg-white focus:outline-none focus:border-[#FF5FA0] transition-colors",
    btnPrimary: "w-full min-h-[44px] px-4 py-3 border-2 border-[#1A1235] text-sm uppercase tracking-wider font-bold bg-[#FF5FA0] text-white shadow-[3px_3px_0px_#1A1235] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition disabled:opacity-60",
    btnSecondary: "min-h-[44px] px-4 py-3 border-2 border-[#1A1235] text-sm uppercase tracking-wider font-bold bg-[#2EC4B6] text-white shadow-[3px_3px_0px_#1A1235] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition",
    btnGhost: "min-h-[44px] px-3 py-2 border-2 border-[#1A1235] text-xs uppercase tracking-wider font-semibold bg-white hover:bg-[#FFF0F8] transition mt-2",
    suggestBtn: "text-[0.65rem] uppercase tracking-[0.15em] px-3 py-2 border-2 border-[#1A1235] bg-[#FFD60A] text-[#1A1235] shadow-[2px_2px_0px_#1A1235] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60 font-bold",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-4",
    pairCard: "border-2 border-[#1A1235] p-4 bg-white shadow-[3px_3px_0px_#2EC4B6]",
    pairHead: "flex items-center justify-between mb-3",
    pairNames: "text-base font-bold uppercase tracking-tight",
    pairMeta: "text-xs uppercase tracking-widest mt-1 text-[#6B6080]",
    badge: "inline-block px-2 py-1 border-2 border-[#1A1235] text-[0.6rem] uppercase tracking-widest font-bold bg-[#2EC4B6] text-white",
    badgePending: "inline-block px-2 py-1 border-2 border-[#1A1235] text-[0.6rem] uppercase tracking-widest font-bold bg-[#FFD60A] text-[#1A1235]",
    badgeLocked: "inline-block px-2 py-1 border-2 border-[#1A1235] text-[0.6rem] uppercase tracking-widest font-bold bg-[#FF5FA0] text-white",
    badgeMuted: "inline-block px-2 py-1 border-2 border-[#1A1235] text-[0.6rem] uppercase tracking-widest font-bold bg-[#F0EBF8] text-[#6B6080]",
    mixerRow: "border-2 border-[#1A1235] p-4 mb-3 bg-white shadow-[3px_3px_0px_#FF5FA0]",
    mixerHead: "flex items-start justify-between gap-3 mb-2",
    mixerTitle: "text-base font-bold uppercase tracking-tight",
    mixerBody: "text-sm mt-2 text-[#6B6080]",
    iceList: "list-none space-y-2 mt-3",
    iceItem: "border-2 border-[#1A1235] p-3 text-sm bg-[#FFF0F8] shadow-[2px_2px_0px_#2EC4B6]",
    actionBar: "fixed bottom-0 left-0 right-0 border-t-2 border-[#1A1235] px-4 py-3 flex gap-2 z-30 bg-[#FFF0F8]",
    empty: "text-sm py-6 text-center uppercase tracking-widest text-[#6B6080]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brandRow}>
          <div className={c.logoBlocks}>
            <div className={`${c.logoSquare} bg-[#FF5FA0]`} />
            <div className={`${c.logoSquare} bg-[#2EC4B6]`} />
            <div className={`${c.logoSquare} bg-[#FFD60A]`} />
          </div>
          <div>
            <div className={c.brand}>Foursquare</div>
            <div className={c.tagline}>Group dates first. Always.</div>
          </div>
        </div>
      </header>

      <main id="app" className={c.main}>

        <section id="profile" className={c.section}>
          <div className={c.sectionLabel}>Step 01</div>
          <h2 className={c.sectionTitle}>Your Profile</h2>
          <form onSubmit={handleProfileSubmit}>
            <div className={c.formRow}>
              <label className={c.label}>Display name</label>
              <input className={c.input} placeholder="Your name" value={profile.name} onChange={e => mergeProfile({ name: e.target.value })} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>Vibe in one line</label>
              <input className={c.input} placeholder="Loud laugh, quiet brain" value={profile.vibe} onChange={e => mergeProfile({ vibe: e.target.value })} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>Looking for</label>
              <input className={c.input} placeholder="A real one" value={profile.seeking} onChange={e => mergeProfile({ seeking: e.target.value })} />
            </div>
            <div className="flex gap-2 items-center mb-3">
              <button type="button" className={c.suggestBtn} onClick={suggestProfile} disabled={suggestLoading}>
                {suggestLoading ? "Thinking..." : "AI suggest"}
              </button>
            </div>
            <button type="submit" className={c.btnPrimary}>Save profile</button>
          </form>
        </section>

        <section id="friend" className={c.section}>
          <div className={c.sectionLabel}>Step 02 — Required</div>
          <h2 className={c.sectionTitle}>Trusted Friend</h2>
          <p className="text-sm text-[#6B6080] mb-4">You cannot attend a mixer without your wingmate. They must RSVP too.</p>
          <form onSubmit={handleFriendSubmit}>
            <div className={c.formRow}>
              <label className={c.label}>Friend's name</label>
              <input className={c.input} placeholder="The friend who keeps it real" value={profile.friendName} onChange={e => mergeProfile({ friendName: e.target.value })} />
            </div>
            <div className={c.formRow}>
              <label className={c.label}>How you know them</label>
              <input className={c.input} placeholder="College roommate, since 2019" value={profile.friendNote} onChange={e => mergeProfile({ friendNote: e.target.value })} />
            </div>
            <button type="submit" className={c.btnPrimary}>Publish pair to board</button>
          </form>
        </section>

        <section id="board" className={c.section}>
          <div className={c.sectionLabel}>Step 03</div>
          <h2 className={c.sectionTitle}>Mixer Board</h2>
          <p className="text-sm text-[#6B6080] mb-4">Two pairs. Four people. One hangout. No solos.</p>
          <div className={c.grid2}>
            {pairs.length === 0 && <div className={c.empty}>No other pairs yet — invite friends</div>}
            {pairs.map(p => (
              <article key={p._id} className={c.pairCard}>
                <div className={c.pairHead}>
                  <div>
                    <div className={c.pairNames}>{p.name} + {p.friendName}</div>
                    <div className={c.pairMeta}>{p.vibe || "Open to mixers"}</div>
                  </div>
                  <span className={c.badge}>Open</span>
                </div>
                <button className={c.btnSecondary} onClick={() => proposeMixerWith(p)}>Propose foursome</button>
              </article>
            ))}
          </div>
        </section>

        <section id="mixers" className={c.section}>
          <div className={c.sectionLabel}>Step 04</div>
          <h2 className={c.sectionTitle}>Your Mixers</h2>
          <form onSubmit={handleProposeMixer}>
            <div className={c.formRow}>
              <label className={c.label}>Where & when</label>
              <input className={c.input} placeholder="Coffee, Saturday 3pm" value={mixerDraft.where} onChange={e => mergeMixer({ where: e.target.value })} />
            </div>
            {mixerDraft.withPair && <div className="text-xs text-[#6B6080] mb-3">Inviting: {mixerDraft.withPair.name} + {mixerDraft.withPair.friendName}</div>}
            <button type="submit" className={c.btnPrimary} disabled={!mixerDraft.withPair}>Send mixer invite</button>
          </form>

          {mixers.length === 0 && <div className={c.empty}>No mixers yet</div>}
          {mixers.map(m => (
            <div key={m._id} className={c.mixerRow}>
              <div className={c.mixerHead}>
                <div>
                  <div className={c.mixerTitle}>{m.where}</div>
                  <div className={c.pairMeta}>4 people · {m.confirms?.length || 0}/4 confirmed</div>
                </div>
                <span className={m.locked ? c.badgeLocked : c.badgePending}>{m.locked ? "Locked" : "Pending"}</span>
              </div>
              <div className={c.mixerBody}>{me?.name || "You"} + {me?.friendName || "wingmate"} · {m.withPair?.name} + {m.withPair?.friendName}</div>
              {!m.locked && <button className={c.btnGhost} onClick={() => confirmMixer(m)}>Confirm RSVP</button>}
              {m.locked && <button className={c.btnGhost} onClick={() => generateIcebreakers(m)} disabled={iceLoadingId === m._id}>
                {iceLoadingId === m._id ? (<span className="inline-flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin"><circle cx="8" cy="8" r="6" stroke="#1A1235" strokeWidth="3" fill="none" strokeDasharray="28" strokeDashoffset="14"/></svg>Loading...</span>) : "Generate icebreakers"}
              </button>}
              {m.icebreakers && m.icebreakers.length > 0 && (
                <ul className={c.iceList}>
                  {m.icebreakers.map((ice, i) => <li key={i} className={c.iceItem}>{ice}</li>)}
                </ul>
              )}
            </div>
          ))}
        </section>

      </main>

      <div className={c.actionBar}>
        <button className={c.btnSecondary} style={{flex:1}} onClick={() => document.getElementById("board")?.scrollIntoView({ behavior: "smooth" })}>Board</button>
        <button className={c.btnPrimary} style={{flex:2}} onClick={() => document.getElementById("mixers")?.scrollIntoView({ behavior: "smooth" })}>New mixer</button>
      </div>
    </div>
  )
}
