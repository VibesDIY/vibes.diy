import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

// Unsplash gathering photos used as background decoration
const BG_PHOTO = "https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=1920&q=85&fit=crop"
const ACCENT_PHOTOS = [
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=70&fit=crop", // dinner table
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&q=70&fit=crop", // party lights
  "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=400&q=70&fit=crop", // celebration
  "https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=400&q=70&fit=crop", // gathering
]

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("gather-round")

  const { doc: event, merge: mergeEvent, save: saveEvent } = useDocument({
    _id: "event", name: "", date: "", time: "", location: ""
  })

  const { doc: rsvp, merge: mergeRsvp, submit: submitRsvp, reset: resetRsvp } = useDocument({
    type: "rsvp", name: "", attending: "yes", note: "", greeting: "", createdAt: Date.now(),
  })

  const { docs: rsvps } = useLiveQuery("type", { key: "rsvp", descending: true })
  const yesCount = rsvps.filter((r) => r.attending === "yes").length
  const noCount = rsvps.filter((r) => r.attending === "no").length

  const [savingEvent, setSavingEvent] = React.useState(false)
  const [submittingRsvp, setSubmittingRsvp] = React.useState(false)
  const [suggestingEvent, setSuggestingEvent] = React.useState(false)
  const [suggestingNote, setSuggestingNote] = React.useState(false)

  async function handleSaveEvent() {
    setSavingEvent(true)
    try { await saveEvent() } finally { setSavingEvent(false) }
  }

  async function handleSuggestEvent() {
    setSuggestingEvent(true)
    try {
      const res = await callAI(
        "Suggest a fun, warm event idea with name, a date in the next 2 months (YYYY-MM-DD), time (HH:MM 24h), and a friendly location string.",
        { schema: { properties: { name: { type: "string" }, date: { type: "string" }, time: { type: "string" }, location: { type: "string" } } } }
      )
      mergeEvent(JSON.parse(res))
    } finally { setSuggestingEvent(false) }
  }

  async function handleSubmitRsvp(e) {
    e.preventDefault()
    if (!rsvp.name.trim()) return
    setSubmittingRsvp(true)
    try {
      const res = await callAI(
        `Write a warm, one-sentence personal thank-you for a guest named ${rsvp.name} who is ${rsvp.attending === "yes" ? "coming" : "not able to come"} to "${event.name || "the event"}". ${rsvp.note ? `They said: "${rsvp.note}".` : ""} Keep it cozy and short.`,
        { schema: { properties: { greeting: { type: "string" } } } }
      )
      const { greeting } = JSON.parse(res)
      await database.put({ ...rsvp, greeting, createdAt: Date.now() })
      resetRsvp()
    } finally { setSubmittingRsvp(false) }
  }

  async function handleSuggestNote() {
    setSuggestingNote(true)
    try {
      const res = await callAI(
        `Suggest a short warm RSVP note (one sentence) from a guest for the event "${event.name || "a gathering"}".`,
        { schema: { properties: { note: { type: "string" } } } }
      )
      mergeRsvp({ note: JSON.parse(res).note })
    } finally { setSuggestingNote(false) }
  }

  const spinner = (
    <svg className="animate-spin w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
    </svg>
  )

  const c = {
    section: "rounded-2xl bg-[oklch(0.18_0.12_300/0.72)] border border-white/12 p-5 shadow-xl backdrop-blur-md",
    h2: "text-lg font-bold font-['Fredoka',sans-serif] text-[oklch(0.88_0.18_95)] mb-3",
    label: "block text-sm text-white/80 mb-1 font-semibold",
    input: "w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[oklch(0.88_0.18_95)] min-h-[44px]",
    btnPrimary: "w-full rounded-xl bg-[oklch(0.70_0.15_155)] hover:bg-[oklch(0.75_0.15_155)] text-[oklch(0.20_0.10_155)] font-bold py-3 min-h-[44px] transition shadow-md",
    btnGhost: "rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-4 py-2 text-sm transition",
    pill: "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
    pillYes: "bg-[oklch(0.70_0.15_155/0.25)] text-[oklch(0.85_0.15_155)] border border-[oklch(0.70_0.15_155/0.4)]",
    pillNo: "bg-[oklch(0.55_0.20_25/0.25)] text-[oklch(0.80_0.18_25)] border border-[oklch(0.55_0.20_25/0.4)]",
    row: "rounded-xl bg-white/5 border border-white/10 p-3",
    note: "text-sm text-white/75 mt-1 italic",
    greet: "text-xs text-[oklch(0.88_0.18_95)] mt-2 leading-snug",
    suggest: "text-xs text-[oklch(0.88_0.18_95)] underline hover:no-underline",
  }

  return (
    <div className="relative min-h-screen text-white font-['Nunito',sans-serif]">
      {/* Unsplash background */}
      <div className="fixed inset-0 z-0">
        <img
          src={BG_PHOTO}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = "none" }}
        />
        {/* layered overlay: deep purple tint preserving original color scheme */}
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.14_0.14_300/0.82)] to-[oklch(0.08_0.10_300/0.90)]" />
      </div>

      {/* Floating decorative Unsplash photo strips — blurred, top and bottom */}
      <div className="fixed top-0 inset-x-0 z-0 h-32 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="flex gap-2 opacity-20 blur-sm scale-110">
          {ACCENT_PHOTOS.map((src, i) => (
            <img key={i} src={src} alt=""
              className="h-32 w-40 object-cover flex-shrink-0 rounded-lg"
              onError={(e) => { e.target.style.display = "none" }}
            />
          ))}
        </div>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-0 h-24 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="flex gap-2 opacity-15 blur-sm scale-110 translate-y-4">
          {[...ACCENT_PHOTOS].reverse().map((src, i) => (
            <img key={i} src={src} alt=""
              className="h-24 w-36 object-cover flex-shrink-0 rounded-lg"
              onError={(e) => { e.target.style.display = "none" }}
            />
          ))}
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@400;700&display=optional');`}</style>

      {/* Content */}
      <div className="relative z-10">
        <header id="app-header" className="px-5 pt-10 pb-6 text-center">
          <h1 className="text-3xl font-bold font-['Fredoka',sans-serif] text-[oklch(0.88_0.18_95)] tracking-wide drop-shadow-lg">
            Gather Round
          </h1>
          <p className="text-sm text-white/70 mt-1">A cozy little RSVP page</p>
        </header>

        <main id="app" className="px-4 pb-28 max-w-xl mx-auto space-y-5">
          {/* Event details */}
          <section id="event-details" className={c.section}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={c.h2}>The Event</h2>
              {can("write") && (
                <button onClick={handleSuggestEvent} disabled={suggestingEvent} className={c.btnGhost}>
                  {suggestingEvent ? <>{spinner} thinking…</> : "✨ surprise me"}
                </button>
              )}
            </div>
            {can("write") ? (
              <div className="space-y-3">
                <div>
                  <label className={c.label}>Event name</label>
                  <input className={c.input} placeholder="Summer Cookout" value={event.name}
                    onChange={(e) => mergeEvent({ name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={c.label}>Date</label>
                    <input type="date" className={c.input} value={event.date}
                      onChange={(e) => mergeEvent({ date: e.target.value })} />
                  </div>
                  <div>
                    <label className={c.label}>Time</label>
                    <input type="time" className={c.input} value={event.time}
                      onChange={(e) => mergeEvent({ time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={c.label}>Where</label>
                  <input className={c.input} placeholder="123 Sunny Lane" value={event.location}
                    onChange={(e) => mergeEvent({ location: e.target.value })} />
                </div>
                <button onClick={handleSaveEvent} disabled={savingEvent} className={c.btnPrimary}>
                  {savingEvent ? <>{spinner} Saving…</> : "Save event"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-2xl font-bold font-['Fredoka',sans-serif] text-white">
                  {event.name || "An event is being planned"}
                </p>
                {(event.date || event.time) && (
                  <p className="text-white/80">{event.date} {event.time && `· ${event.time}`}</p>
                )}
                {event.location && <p className="text-white/70">{event.location}</p>}
              </div>
            )}
          </section>

          {/* Headcount */}
          <section id="headcount" className={c.section}>
            <h2 className={c.h2}>Who's In</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-[oklch(0.70_0.15_155/0.2)] border border-[oklch(0.70_0.15_155/0.4)] py-3">
                <div className="text-3xl font-bold font-['Fredoka',sans-serif] text-[oklch(0.85_0.15_155)]">{yesCount}</div>
                <div className="text-xs text-white/70 mt-1">coming</div>
              </div>
              <div className="rounded-xl bg-[oklch(0.55_0.20_25/0.2)] border border-[oklch(0.55_0.20_25/0.4)] py-3">
                <div className="text-3xl font-bold font-['Fredoka',sans-serif] text-[oklch(0.80_0.18_25)]">{noCount}</div>
                <div className="text-xs text-white/70 mt-1">can't make it</div>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 py-3">
                <div className="text-3xl font-bold font-['Fredoka',sans-serif] text-[oklch(0.88_0.18_95)]">{rsvps.length}</div>
                <div className="text-xs text-white/70 mt-1">total replies</div>
              </div>
            </div>
          </section>

          {/* RSVP form */}
          <section id="rsvp-form" className={c.section}>
            <h2 className={c.h2}>Your RSVP</h2>
            <form onSubmit={handleSubmitRsvp} className="space-y-3">
              <div>
                <label className={c.label}>Your name</label>
                <input className={c.input} placeholder="Jamie" value={rsvp.name}
                  onChange={(e) => mergeRsvp({ name: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Will you be there?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => mergeRsvp({ attending: "yes" })}
                    className={`rounded-xl py-3 font-bold min-h-[44px] border transition ${rsvp.attending === "yes"
                      ? "bg-[oklch(0.70_0.15_155)] text-[oklch(0.20_0.10_155)] border-[oklch(0.70_0.15_155)]"
                      : "bg-white/5 text-white/80 border-white/15"}`}>
                    Yes, I'm in!
                  </button>
                  <button type="button" onClick={() => mergeRsvp({ attending: "no" })}
                    className={`rounded-xl py-3 font-bold min-h-[44px] border transition ${rsvp.attending === "no"
                      ? "bg-[oklch(0.55_0.20_25)] text-white border-[oklch(0.55_0.20_25)]"
                      : "bg-white/5 text-white/80 border-white/15"}`}>
                    Can't make it
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={c.label} style={{ marginBottom: 0 }}>A little note (optional)</label>
                  <button type="button" onClick={handleSuggestNote} disabled={suggestingNote} className={c.suggest}>
                    {suggestingNote ? <>{spinner} thinking…</> : "✨ suggest"}
                  </button>
                </div>
                <textarea className={c.input} rows={2} placeholder="Bringing a cake!"
                  value={rsvp.note} onChange={(e) => mergeRsvp({ note: e.target.value })} />
              </div>
              <button type="submit" disabled={submittingRsvp || !rsvp.name.trim()} className={c.btnPrimary}>
                {submittingRsvp ? <>{spinner} Sending warm wishes…</> : "Send my RSVP"}
              </button>
            </form>
          </section>

          {/* Guest list */}
          <section id="guest-list" className={c.section}>
            <h2 className={c.h2}>The Guest List</h2>
            {rsvps.length === 0 ? (
              <p className="text-sm text-white/60 italic">No replies yet — be the first to RSVP above!</p>
            ) : (
              <ul className="space-y-2">
                {rsvps.map((r) => (
                  <li key={r._id} className={c.row}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{r.name}</span>
                      <span className={`${c.pill} ${r.attending === "yes" ? c.pillYes : c.pillNo}`}>
                        {r.attending === "yes" ? "coming" : "can't make it"}
                      </span>
                    </div>
                    {r.note && <p className={c.note}>"{r.note}"</p>}
                    {r.greeting && <p className={c.greet}>💌 {r.greeting}</p>}
                    {can("write") && (
                      <button onClick={() => database.del(r._id)}
                        className="text-xs text-[oklch(0.80_0.18_25)] hover:underline mt-2">
                        remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
