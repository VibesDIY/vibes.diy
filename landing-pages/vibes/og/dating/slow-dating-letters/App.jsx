import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function getOrInitStartDate() {
  let d = localStorage.getItem("slowpost-start")
  if (!d) { d = new Date().toISOString().slice(0, 10); localStorage.setItem("slowpost-start", d) }
  return d
}
function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(1, Math.floor(ms / 86400000) + 1)
}
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("slowpost")
  const { docs: letters } = useLiveQuery("createdAt", { descending: false })
  const { docs: handshakes } = useLiveQuery("type", { key: "handshake" })

  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  React.useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&display=swap"
    link.rel = "stylesheet"
    document.head.appendChild(link)
    document.documentElement.style.fontFamily = "'Playfair Display', Georgia, serif"
  }, [])

  const START_DATE = React.useMemo(() => getOrInitStartDate(), [])
  const currentDay = Math.min(14, daysSince(START_DATE))
  const today = todayKey()
  const alreadyWroteToday = letters.some((l) => l.from === "you" && l.dayKey === today)
  const youReady = handshakes.some((h) => h.who === "you")
  const themReady = handshakes.some((h) => h.who === "them")
  const bothReady = youReady && themReady

  async function handleSend(e) {
    e.preventDefault()
    if (alreadyWroteToday || !draft.trim()) return
    setIsSending(true)
    try {
      await database.put({
        type: "letter",
        from: "you",
        body: draft.trim(),
        day: currentDay,
        dayKey: today,
        kind: currentDay === 7 ? "surprise" : "regular",
        createdAt: Date.now(),
      })
      setDraft("")
    } finally {
      setIsSending(false)
    }
  }

  async function handleReady() {
    if (youReady) return
    await database.put({ type: "handshake", who: "you", at: Date.now() })
  }

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const prompt = currentDay === 7
        ? "Suggest one tender, surprising thing someone might share when asked 'what would surprise me about you' in a slow-correspondence dating letter. One short paragraph, first person."
        : "Suggest a thoughtful opening paragraph for a long-form dating letter to a stranger you've been writing for two weeks. One short paragraph, first person, warm but not flirty."
      const raw = await callAI(prompt, { schema: { properties: { paragraph: { type: "string" } } } })
      const { paragraph } = JSON.parse(raw)
      setDraft((d) => (d ? d + "\n\n" + paragraph : paragraph))
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen pb-32 bg-[#F5E6C8] text-[#1A120B]",
    header: "sticky top-0 px-5 py-4 border-b border-[#8B2635] bg-[#F5E6C8] flex items-center justify-between z-20",
    brand: "flex items-center gap-3",
    brandDots: "flex gap-1",
    dot: "w-2 h-2 rounded-full",
    brandText: "text-base font-semibold italic tracking-wide text-[#1A120B]",
    dayBadge: "px-3 py-1 bg-[#8B2635] text-[#FAF0D7] text-xs font-semibold uppercase tracking-wider",
    main: "max-w-[720px] mx-auto px-5 py-6 space-y-6",
    heroCard: "bg-[#FAF0D7] p-8 border-t-4 border-[#8B2635]",
    heroTitle: "text-4xl md:text-6xl font-semibold italic leading-none text-[#1A120B]",
    heroMeta: "mt-4 text-xs uppercase tracking-widest font-medium text-[#5C4033]",
    section: "bg-[#FAF0D7] p-5 border-t-2 border-[#8B2635]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold mb-3 text-[#5C4033]",
    letter: "bg-[#FAEBD7] p-5 mb-4 border-l-2 border-[#8B2635]",
    letterMeta: "text-[0.6rem] uppercase tracking-widest font-semibold mb-3 text-[#8B2635]",
    letterBody: "text-[0.95rem] leading-[1.8] whitespace-pre-wrap text-[#1A120B] italic",
    composer: "bg-[#FAF0D7] p-5 border-t-2 border-[#5C4033]",
    textarea: "w-full min-h-[200px] border border-[#C4A882] bg-[#FAEBD7] p-4 text-[0.9rem] leading-relaxed italic resize-y focus:outline-none focus:border-[#8B2635] transition-colors",
    composerRow: "flex items-center justify-between mt-3 gap-3 flex-wrap",
    btnPrimary: "px-5 py-3 bg-[#8B2635] text-[#FAF0D7] font-semibold uppercase tracking-wider text-sm min-h-[44px] hover:bg-[#6B1A28] transition-colors disabled:opacity-50",
    btnSecondary: "px-4 py-2 border border-[#8B2635] text-[#8B2635] font-semibold uppercase tracking-wider text-xs min-h-[44px] hover:bg-[#8B2635] hover:text-[#FAF0D7] transition-colors",
    btnGhost: "px-4 py-2 border border-[#C4A882] text-[#5C4033] font-medium uppercase tracking-wider text-xs min-h-[44px] hover:border-[#8B2635] hover:text-[#8B2635] transition-colors",
    handshake: "bg-[#FAF0D7] p-5 border-t-2 border-[#C4A882]",
    handshakeRow: "flex items-center justify-between gap-3 mt-3",
    statusPill: "px-3 py-1 border border-[#C4A882] text-[#5C4033] text-[0.65rem] uppercase tracking-widest font-semibold",
    bottomBar: "fixed bottom-0 left-0 right-0 border-t border-[#8B2635] bg-[#F5E6C8] px-5 py-3 flex items-center justify-between gap-3 z-20",
  }

  return (
    <div className={c.page} id="app">
      <header className={c.header} id="app-header">
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={`${c.dot} bg-[#8B2635]`}></span>
            <span className={`${c.dot} bg-[#5C4033]`}></span>
            <span className={`${c.dot} bg-[#C4A882]`}></span>
          </div>
          <span className={c.brandText}>Slowpost</span>
        </div>
        <span className={c.dayBadge}>Day {currentDay} of 14</span>
      </header>

      <main className={c.main}>
        <section id="hero" className={c.heroCard}>
          <h1 className={c.heroTitle}>Dear Stranger</h1>
          <p className={c.heroMeta}>One letter a day · No photos yet</p>
        </section>

        <section id="thread" className={c.section}>
          <div className={c.sectionLabel}>Letters so far</div>
          {letters.length === 0 && (
            <p className="text-sm leading-relaxed italic text-[#5C4033]">No letters yet. Write the first one below — they will appear here as you both reply.</p>
          )}
          {letters.map((l) => (
            <article key={l._id} className={c.letter}>
              <div className={c.letterMeta}>
                {l.from === "you" ? "From you" : "From them"} · Day {l.day}{l.kind === "surprise" ? " · Surprise prompt" : ""}
              </div>
              <p className={c.letterBody}>{l.body}</p>
            </article>
          ))}
        </section>

        <section id="composer" className={c.composer}>
          <div className={c.sectionLabel}>
            {currentDay === 7 ? "Day 7 prompt — what would surprise me about you?" : "Your reply for today"}
          </div>
          {alreadyWroteToday && (
            <p className="text-sm leading-relaxed italic text-[#5C4033] mb-3">You've already sent today's letter. Come back tomorrow.</p>
          )}
          <form onSubmit={handleSend}>
            <textarea
              className={c.textarea}
              placeholder="Take your time. There is no rush."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={alreadyWroteToday}
            />
            <div className={c.composerRow}>
              <button type="button" onClick={handleSuggest} disabled={isSuggesting} className={c.btnGhost}>
                {isSuggesting ? "Thinking…" : "Need a spark?"}
              </button>
              <button type="submit" disabled={alreadyWroteToday || !draft.trim() || isSending} className={c.btnPrimary}>
                {isSending ? "Sending…" : "Send Letter"}
              </button>
            </div>
          </form>
        </section>

        <section id="handshake" className={c.handshake}>
          <div className={c.sectionLabel}>Photo Handshake</div>
          <p className="text-sm leading-relaxed italic text-[#5C4033]">
            {bothReady
              ? "You both said yes. Photos are unlocked."
              : "Neither of you has seen a photo. When you both tap ready, faces unlock."}
          </p>
          <div className={c.handshakeRow}>
            <span className={c.statusPill}>
              {bothReady ? "Unlocked" : youReady ? "Waiting on them" : "Waiting"}
            </span>
            <button type="button" onClick={handleReady} disabled={youReady} className={c.btnSecondary}>
              {youReady ? "You're ready" : "I'm Ready"}
            </button>
          </div>
        </section>
      </main>

      <nav className={c.bottomBar} id="bottom-bar">
        <span className={c.statusPill}>{alreadyWroteToday ? "0 replies left today" : "1 reply left today"}</span>
        <a href="#composer" className={c.btnPrimary}>Write</a>
      </nav>
    </div>
  )
}
