import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const STATES = ["LOAF", "ROCKET", "DEMANDING", "ASLEEP", "ZOOMIES", "CLOAKED"]

const GLYPHS = {
  LOAF:      "  ▄▄▄▄▄▄  \n ( ●  ● ) \n(▒▒▒▒▒▒▒▒)\n ▔▔▔▔▔▔▔▔ ",
  ROCKET:    "    ▲    \n   ╱│╲   \n   ███   \n   │ │   \n   ▼ ▼   ",
  DEMANDING: "  ╱╲╱╲   \n ( ●▼● ) \n  >MEOW< \n  ╱│││╲  ",
  ASLEEP:    "   z Z   \n  z      \n (─.─)   \n(▒▒▒▒▒▒) ",
  ZOOMIES:   " →→→→→→  \n(>●ω●)>→→\n →→→→→→  \n  ░ ░ ░  ",
  CLOAKED:   "  ░░░░░  \n ░ ??? ░ \n  ░░░░░  \n   ░░    ",
}

const GlobalCRT = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=VT323&display=optional');
    html, body, #root { background: oklch(0.16 0 0); color: oklch(0.87 0.30 142); }
    body { font-family: 'VT323', monospace; font-size: 18px; line-height: 1.4; }
    .crt-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 99;
      background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px); }
    .crt-sweep { position: fixed; left: 0; right: 0; height: 3px; pointer-events: none; z-index: 100;
      background: linear-gradient(to bottom, oklch(0.87 0.30 142 / 0.6), transparent);
      animation: sweep 8s linear infinite; }
    @keyframes sweep { 0% { top: -3px } 100% { top: 100% } }
    .glow { text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7); }
    .dot-on { background: oklch(0.87 0.30 142); box-shadow: 0 0 8px oklch(0.87 0.30 142 / 0.9); }
    .dot-off { background: oklch(0.87 0.30 142 / 0.4); }
    input, select, textarea { font-family: 'VT323', monospace; font-size: 18px; caret-color: oklch(0.87 0.30 142); }
    button:hover { background: oklch(0.87 0.30 142); color: oklch(0.16 0 0); }
    select option { background: oklch(0.16 0 0); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: oklch(0.87 0.30 142 / 0.4); }
  `}</style>
)

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("pet-status-board")

  const { doc: newPet, merge: mergePet, submit: submitPet } = useDocument({
    type: "pet",
    name: "",
    species: "cat",
    createdAt: Date.now(),
  })

  const { docs: pets } = useLiveQuery("type", { key: "pet" })
  const { docs: events } = useLiveQuery("type", { key: "event", descending: true, limit: 50 })

  function handleAddPet(e) {
    e.preventDefault()
    if (!newPet.name.trim()) return
    submitPet()
  }

  function handleTapPet(petId, currentState) {
    const idx = STATES.indexOf(currentState)
    const next = STATES[(idx + 1) % STATES.length]
    database.put({
      type: "event",
      petId,
      state: next,
      ts: Date.now(),
      by: "me",
    })
  }

  function latestStateFor(petId) {
    const e = events.find((x) => x.petId === petId)
    return e ? e.state : "LOAF"
  }

  function logFor(petId) {
    return events.filter((e) => e.petId === petId).slice(0, 20)
  }

  function fmtTime(ts) {
    const d = new Date(ts)
    return d.toTimeString().slice(0, 8)
  }

  function petName(petId) {
    const p = pets.find((x) => x._id === petId)
    return p ? p.name.toUpperCase() : "?"
  }

  const c = {
    page: "min-h-screen p-4 max-w-3xl mx-auto",
    header: "mb-6 pb-3 border-b border-[oklch(0.87_0.30_142/0.3)]",
    title: "text-3xl tracking-wider glow",
    subtitle: "text-sm uppercase tracking-widest mt-1 text-[oklch(0.87_0.30_142/0.4)]",
    sectionLabel: "text-xs uppercase tracking-widest mb-2 text-[oklch(0.87_0.30_142/0.4)]",
    addForm: "flex flex-col gap-2 mb-6 p-3 border border-[oklch(0.87_0.30_142/0.3)] bg-black/85",
    addRow: "flex gap-2",
    input: "flex-1 bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-2 py-2 min-h-[44px] outline-none focus:border-[oklch(0.87_0.30_142)]",
    select: "bg-transparent border border-[oklch(0.87_0.30_142/0.3)] px-2 py-2 min-h-[44px] outline-none focus:border-[oklch(0.87_0.30_142)]",
    button: "px-3 py-2 min-h-[44px] border border-[oklch(0.87_0.30_142/0.3)] tracking-wider text-[oklch(0.87_0.30_142)] transition-colors",
    petGrid: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-8",
    petCard: "border border-[oklch(0.87_0.30_142/0.3)] p-4 flex flex-col bg-black/85",
    petHead: "flex items-center justify-between mb-3",
    petName: "text-xl tracking-wider glow",
    petMeta: "text-xs uppercase tracking-widest text-[oklch(0.87_0.30_142/0.4)]",
    tapZone: "w-full py-6 my-3 border border-[oklch(0.87_0.30_142/0.3)] bg-[oklch(0.87_0.30_142/0.05)] min-h-[160px] flex flex-col items-center justify-center gap-2 hover:bg-[oklch(0.87_0.30_142/0.1)]",
    glyph: "whitespace-pre leading-tight text-sm text-[oklch(0.87_0.30_142)]",
    stateLabel: "text-2xl tracking-widest mt-2 glow text-white",
    tapHint: "text-xs uppercase tracking-widest mt-2 text-[oklch(0.87_0.30_142/0.4)]",
    petLogLabel: "text-xs uppercase tracking-widest mt-3 mb-1 text-[oklch(0.87_0.30_142/0.4)]",
    petLog: "text-xs leading-relaxed max-h-32 overflow-y-auto",
    petLogRow: "flex gap-2 py-0.5 border-b border-[oklch(0.87_0.30_142/0.1)]",
    feedSection: "border border-[oklch(0.87_0.30_142/0.3)] p-3 bg-black/85",
    feedList: "text-xs leading-relaxed max-h-96 overflow-y-auto",
    feedRow: "flex gap-2 py-0.5 border-b border-[oklch(0.87_0.30_142/0.1)]",
    dot: "inline-block w-[6px] h-[6px] rounded-full",
    empty: "text-xs uppercase tracking-widest py-4 text-center text-[oklch(0.87_0.30_142/0.4)]",
  }

  return (
    <main id="app" className={c.page}>
      <GlobalCRT />
      <div className="crt-overlay" />
      <div className="crt-sweep" />
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>▌ PET STATUS BOARD</h1>
        <div className={c.subtitle}>SYS: HOUSEHOLD TERMINAL // ONLINE</div>
      </header>

      <section id="add-pet">
        <div className={c.sectionLabel}>SYS: REGISTER NEW PET</div>
        <form className={c.addForm} onSubmit={handleAddPet}>
          <div className={c.addRow}>
            <input
              className={c.input}
              placeholder="> pet name_"
              value={newPet.name}
              onChange={(e) => mergePet({ name: e.target.value })}
            />
            <select
              className={c.select}
              value={newPet.species}
              onChange={(e) => mergePet({ species: e.target.value })}
            >
              <option>cat</option>
              <option>dog</option>
              <option>bird</option>
              <option>other</option>
            </select>
          </div>
          <button type="submit" className={c.button}>[ ADD PET ]</button>
        </form>
      </section>

      <section id="pets">
        <div className={c.sectionLabel}>STATUS: ACTIVE PETS</div>
        {pets.length === 0 ? (
          <div className={c.empty}>NO PETS REGISTERED // ADD ONE ABOVE</div>
        ) : (
          <div className={c.petGrid}>
            {pets.map((pet) => {
              const state = latestStateFor(pet._id)
              const log = logFor(pet._id)
              return (
                <article key={pet._id} className={c.petCard}>
                  <div className={c.petHead}>
                    <div className={c.petName}>
                      <span className="dot-on inline-block w-[6px] h-[6px] rounded-full mr-2 align-middle" />
                      {pet.name.toUpperCase()}
                    </div>
                    <div className={c.petMeta}>{pet.species}</div>
                  </div>
                  <button className={c.tapZone} onClick={() => handleTapPet(pet._id, state)}>
                    <pre className={c.glyph}>{GLYPHS[state]}</pre>
                    <div className={c.stateLabel}>{state}</div>
                    <div className={c.tapHint}>→ TAP TO CYCLE</div>
                  </button>
                  <div className={c.petLogLabel}>FEED: PET LOG</div>
                  {log.length === 0 ? (
                    <div className={c.empty}>NO TRANSITIONS YET</div>
                  ) : (
                    <ul className={c.petLog}>
                      {log.map((ev) => (
                        <li key={ev._id} className={c.petLogRow}>
                          <span>{fmtTime(ev.ts)}</span>
                          <span>→ {ev.state}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section id="household-feed" className={c.feedSection}>
        <div className={c.sectionLabel}>FEED: HOUSEHOLD TRANSITIONS // LAST 50</div>
        {events.length === 0 ? (
          <div className={c.empty}>NO TRANSITIONS LOGGED</div>
        ) : (
          <ul className={c.feedList}>
            {events.map((ev) => (
              <li key={ev._id} className={c.feedRow}>
                <span>{fmtTime(ev.ts)}</span>
                <span>{petName(ev.petId)}</span>
                <span>→ {ev.state}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}