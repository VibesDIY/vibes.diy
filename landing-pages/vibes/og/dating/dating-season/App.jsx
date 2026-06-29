import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function FeedItem({ answer, c, onReact }) {
  const { useLiveQuery } = useFireproof("season-cohort")
  const { docs: reactions } = useLiveQuery("answerId", { key: answer._id })
  const counts = reactions.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {})
  const minutes = Math.max(1, Math.floor((Date.now() - (answer.createdAt || 0)) / 60000))
  const timeLabel = minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`
  return (
    <li className={c.feedItem}>
      <div className={c.feedHead}>
        <span className={c.feedName}>{answer.member}</span>
        <span className={c.feedTime}>{timeLabel}</span>
      </div>
      <p className={c.feedBody}>{answer.body}</p>
      <div className={c.reactRow}>
        <button className={c.reactBtn} onClick={() => onReact(answer._id, "same")}>Same · {counts.same || 0}</button>
        <button className={c.reactBtn} onClick={() => onReact(answer._id, "more")}>Tell me more · {counts.more || 0}</button>
        <button className={c.reactBtn} onClick={() => onReact(answer._id, "wow")}>Wow · {counts.wow || 0}</button>
      </div>
    </li>
  )
}

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("season-cohort")
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  React.useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap"
    link.rel = "stylesheet"
    document.head.appendChild(link)
    document.documentElement.style.fontFamily = "'Lora', Georgia, serif"
  }, [])

  const TODAYS_PROMPT = "What's a small thing that made you feel alive this week?"
  const memberId = React.useMemo(() => {
    let id = localStorage.getItem("season-member-id")
    if (!id) {
      id = "Member " + String(Math.floor(Math.random() * 30) + 1).padStart(2, "0")
      localStorage.setItem("season-member-id", id)
    }
    return id
  }, [])

  const { doc, merge, submit } = useDocument({
    type: "answer",
    prompt: TODAYS_PROMPT,
    body: "",
    member: memberId,
    createdAt: Date.now(),
  })

  const { docs: answers } = useLiveQuery("type", { key: "answer", descending: true, limit: 30 })
  const { docs: rsvps } = useLiveQuery("type", { key: "rsvp" })

  const goingCount = rsvps.filter(r => r.status === "going").length
  const maybeCount = rsvps.filter(r => r.status === "maybe").length
  const myRsvp = rsvps.find(r => r.member === memberId && r.activity === "park-picnic")

  function handlePromptSubmit(e) {
    e.preventDefault()
    if (!doc.body.trim()) return
    submit()
  }

  function handleReact(answerId, kind) {
    database.put({ type: "reaction", answerId, kind, member: memberId, createdAt: Date.now() })
  }

  function handleRSVP() {
    if (myRsvp) {
      database.put({ ...myRsvp, status: myRsvp.status === "going" ? "maybe" : "going" })
    } else {
      database.put({ type: "rsvp", activity: "park-picnic", status: "going", member: memberId, createdAt: Date.now() })
    }
  }

  async function handleSuggestAnswer() {
    setIsSuggesting(true)
    try {
      const res = await callAI(`Give one short, sincere, first-person answer (under 25 words) to this prompt: "${TODAYS_PROMPT}"`, {
        schema: { properties: { answer: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      merge({ body: parsed.answer })
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen pb-24 bg-[#FAF0DC] text-[#2A1810]",
    header: "sticky top-0 z-20 px-4 py-4 border-b-2 border-[#C96A28] bg-[#FAF0DC]",
    headerInner: "max-w-[920px] mx-auto flex items-center justify-between",
    logo: "flex items-center gap-3",
    logoSquares: "flex gap-1",
    logoSquare: "w-3 h-3 rounded-sm",
    brand: "text-base font-semibold italic tracking-wide text-[#2A1810]",
    seasonBadge: "px-3 py-1 bg-[#C96A28] text-[#FFF8EE] text-[0.65rem] uppercase tracking-widest font-semibold",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "border border-[#C96A28] bg-[#FFF8EE] p-5 shadow-[3px_3px_0px_#C96A28]",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold mb-2 text-[#7A5C48]",
    sectionTitle: "text-2xl font-semibold italic tracking-tight mb-4 text-[#2A1810]",
    statsRow: "grid grid-cols-3 gap-3",
    statCard: "border border-[#C96A28] bg-[#FFF8EE] overflow-hidden",
    statHeader: "px-3 py-1 text-[0.6rem] uppercase tracking-widest font-semibold",
    statBody: "p-3",
    statNumber: "text-2xl font-semibold",
    statUnit: "text-[0.6rem] uppercase tracking-widest text-[#7A5C48]",
    promptCard: "border border-[#D4A843] border-t-4 border-t-[#D4A843] bg-[#FFF8EE] p-5 shadow-[3px_3px_0px_#C96A28]",
    promptLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-semibold mb-2 text-[#7A5C48]",
    promptText: "text-xl font-semibold italic mb-4 leading-snug text-[#2A1810]",
    promptForm: "space-y-3",
    textarea: "w-full p-3 border border-[#C96A28] bg-[#FAF0DC] text-sm min-h-[100px] resize-none focus:outline-none focus:shadow-[2px_2px_0px_#C96A28] transition-all",
    formRow: "flex gap-2 items-center justify-between flex-wrap",
    suggestBtn: "px-3 py-2 border border-[#C96A28] bg-[#D4A843] text-[#2A1810] text-[0.7rem] uppercase tracking-wider font-semibold min-h-[40px] shadow-[2px_2px_0px_#C96A28] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all",
    submitBtn: "px-5 py-3 bg-[#C96A28] text-[#FFF8EE] text-[0.75rem] uppercase tracking-wider font-semibold min-h-[44px] shadow-[3px_3px_0px_#7A3A10] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all",
    feedList: "space-y-3",
    feedItem: "border border-[#C96A28] bg-[#FFF8EE] p-4 shadow-[2px_2px_0px_#C96A28]",
    feedHead: "flex items-center justify-between mb-2",
    feedName: "text-sm font-semibold italic",
    feedTime: "text-[0.65rem] uppercase tracking-widest text-[#7A5C48]",
    feedBody: "text-sm leading-relaxed mb-3",
    reactRow: "flex gap-2 flex-wrap",
    reactBtn: "px-3 py-1 border border-[#C96A28] bg-[#FAF0DC] text-xs font-medium min-h-[32px] flex items-center gap-1 hover:bg-[#D4A843] transition-colors",
    activityCard: "border border-[#6B9E76] border-t-4 border-t-[#6B9E76] bg-[#FFF8EE] p-5 shadow-[3px_3px_0px_#6B9E76]",
    activityHead: "flex items-start justify-between mb-3 gap-3",
    activityTitle: "text-lg font-semibold italic",
    activityWhen: "text-[0.65rem] uppercase tracking-widest text-[#7A5C48]",
    activityDesc: "text-sm leading-relaxed mb-4",
    rsvpRow: "flex items-center justify-between gap-3 flex-wrap",
    rsvpCount: "text-[0.7rem] uppercase tracking-widest font-medium text-[#7A5C48]",
    rsvpBtn: "px-4 py-2 bg-[#6B9E76] text-[#FFF8EE] text-[0.7rem] uppercase tracking-wider font-semibold min-h-[44px] shadow-[2px_2px_0px_#3A6040] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all",
    bottomBar: "fixed bottom-0 left-0 right-0 border-t-2 border-[#C96A28] bg-[#FAF0DC] px-4 py-3 z-20",
    bottomInner: "max-w-[920px] mx-auto flex gap-2 justify-around",
    tabBtn: "flex-1 py-2 text-[0.7rem] uppercase tracking-widest font-semibold border border-[#C96A28] bg-[#FAF0DC] min-h-[44px] active:bg-[#D4A843] hover:bg-[#FFF0D0] transition-colors",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div className={c.logo}>
            <div className={c.logoSquares}>
              <div className={`${c.logoSquare} bg-[#C96A28]`}></div>
              <div className={`${c.logoSquare} bg-[#D4A843]`}></div>
              <div className={`${c.logoSquare} bg-[#6B9E76]`}></div>
            </div>
            <span className={c.brand}>Season</span>
          </div>
          <span className={c.seasonBadge}>Week 2 of 6</span>
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="hero" className="border border-[#C96A28] bg-[#FFF8EE] p-6 relative shadow-[4px_4px_0px_#C96A28] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[5px] flex">
            <span className="flex-1 bg-[#C96A28]"></span>
            <span className="flex-1 bg-[#D4A843]"></span>
            <span className="flex-1 bg-[#6B9E76]"></span>
            <span className="flex-1 bg-[#7B96C2]"></span>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold italic leading-tight mt-2 text-[#2A1810]">30 strangers.<br/>6 weeks.<br/>No browsing.</h1>
          <p className="text-sm mt-3 max-w-md text-[#7A5C48]">Daily prompts. Weekly activities. The pool closes at season start.</p>
        </section>

        <section id="cohort-stats" className={c.section}>
          <div className={c.sectionLabel}>Your Cohort</div>
          <div className={c.statsRow}>
            <div className={c.statCard}>
              <div className={`${c.statHeader} bg-[#C96A28] text-[#FFF8EE]`}>Answers</div>
              <div className={c.statBody}>
                <div className={c.statNumber}>{answers.length}</div>
                <div className={c.statUnit}>posted today</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHeader} bg-[#D4A843] text-[#2A1810]`}>Days Left</div>
              <div className={c.statBody}>
                <div className={c.statNumber}>28</div>
                <div className={c.statUnit}>remaining</div>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHeader} bg-[#6B9E76] text-[#FFF8EE]`}>Pairs</div>
              <div className={c.statBody}>
                <div className={c.statNumber}>3</div>
                <div className={c.statUnit}>formed</div>
              </div>
            </div>
          </div>
        </section>

        <section id="daily-prompt" className={c.promptCard}>
          <div className={c.promptLabel}>Today's Prompt</div>
          <p className={c.promptText}>{TODAYS_PROMPT}</p>
          <form className={c.promptForm} onSubmit={handlePromptSubmit}>
            <textarea
              className={c.textarea}
              placeholder="Share with your cohort..."
              value={doc.body}
              onChange={(e) => merge({ body: e.target.value })}
            />
            <div className={c.formRow}>
              <button type="button" className={c.suggestBtn} onClick={handleSuggestAnswer} disabled={isSuggesting}>
                {isSuggesting ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
                  </svg>
                ) : "Suggest"}
              </button>
              <button type="submit" className={c.submitBtn}>Post Answer</button>
            </div>
          </form>
        </section>

        <section id="cohort-feed">
          <h2 className={c.sectionTitle}>Cohort Responses</h2>
          <ul className={c.feedList}>
            {answers.length === 0 && (
              <li className={c.feedItem}>
                <p className={c.feedBody}>No answers yet today. Be the first to share.</p>
              </li>
            )}
            {answers.map((a) => <FeedItem key={a._id} answer={a} c={c} onReact={handleReact} />)}
          </ul>
        </section>

        <section id="weekly-activity" className={c.activityCard}>
          <div className={c.promptLabel}>This Week's Activity</div>
          <div className={c.activityHead}>
            <h3 className={c.activityTitle}>Saturday Park Picnic</h3>
            <span className={c.activityWhen}>Sat 2pm</span>
          </div>
          <p className={c.activityDesc}>Bring something to share. Riverside Park, north entrance. Rain or shine — we have a tarp.</p>
          <div className={c.rsvpRow}>
            <span className={c.rsvpCount}>{goingCount} going · {maybeCount} maybe</span>
            <button className={c.rsvpBtn} onClick={handleRSVP}>
              {myRsvp ? (myRsvp.status === "going" ? "Going ✓" : "Maybe") : "RSVP Going"}
            </button>
          </div>
        </section>
      </main>

      <nav className={c.bottomBar}>
        <div className={c.bottomInner}>
          <button className={c.tabBtn}>Today</button>
          <button className={c.tabBtn}>Cohort</button>
          <button className={c.tabBtn}>Activities</button>
        </div>
      </nav>
    </div>
  )
}
