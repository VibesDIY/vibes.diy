import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [view, setView] = useState("today")
  const [author, setAuthor] = useState("")
  const [text, setText] = useState("")

  const { database, useLiveQuery } = useFireproof("six-word-exhibit")
  
  const today = new Date().toISOString().split("T")[0]

  const [isSuggesting, setIsSuggesting] = useState(false)

  const { docs: allStories } = useLiveQuery("type", { key: "story", descending: true })
  const filteredToday = allStories.filter(d => d.date === today)
  
  // Group stories by date for the archive
  const archiveGroups = allStories.reduce((acc, story) => {
    if (!acc[story.date]) acc[story.date] = []
    acc[story.date].push(story)
    return acc
  }, {})
  
  const sortedDates = Object.keys(archiveGroups).sort().reverse()

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const resp = await callAI("Write a moody, evocative story about a forgotten key. It MUST be exactly six words long. No more, no less.", {
        schema: {
          properties: {
            story: { type: "string", description: "A six word story" }
          }
        }
      })
      const data = JSON.parse(resp)
      setText(data.story)
    } finally {
      setIsSuggesting(false)
    }
  }

  function handleNav(newView) {
    setView(newView)
  }

  const currentWordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length
  const isExactLength = currentWordCount === 6

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isExactLength || !author.trim()) return

    await database.put({
      type: "story",
      date: today,
      author: author.trim(),
      text: text.trim(),
      createdAt: Date.now()
    })
    setText("")
  }

  const c = {
    page: "min-h-screen flex flex-col items-center p-4 md:p-8 bg-[oklch(0.92_0.01_65)] text-[oklch(0.15_0.02_50)] font-sans",
    container: "w-full max-w-[800px] flex flex-col",
    header: "w-full flex flex-col md:flex-row justify-between items-start md:items-end py-6 mb-8 border-b border-[oklch(0.20_0.02_50)]",
    title: "font-serif font-bold text-3xl md:text-5xl tracking-tight",
    nav: "flex gap-6 mt-6 md:mt-0",
    navBtn: "text-[0.65rem] uppercase py-2 tracking-[0.12em] font-medium cursor-pointer text-[oklch(0.15_0.02_50)] hover:text-[oklch(0.35_0.04_50)] transition-colors",
    main: "w-full flex flex-col gap-16",
    promptBox: "w-full flex flex-col items-center justify-center py-16 px-4 border border-[oklch(0.20_0.02_50)] bg-[oklch(0.95_0.01_70)] text-center gap-6 shadow-sm",
    promptLabel: "text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.55_0.02_50)]",
    promptText: "font-serif text-3xl md:text-5xl font-bold italic",
    formSection: "w-full max-w-[500px] mx-auto flex flex-col gap-8",
    form: "w-full flex flex-col gap-6",
    inputGroup: "w-full flex flex-col gap-2",
    label: "text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.55_0.02_50)]",
    input: "w-full py-3 px-0 border-b border-[oklch(0.20_0.02_50)] focus:border-[oklch(0.15_0.02_50)] outline-none bg-transparent font-serif italic text-lg transition-colors rounded-none whitespace-normal",
    wordCount: "text-[0.65rem] text-right mt-1 font-medium tracking-widest uppercase",
    submitBtn: "w-full py-4 text-[0.65rem] uppercase tracking-[0.12em] mt-4 cursor-pointer bg-[oklch(0.35_0.04_50)] text-[oklch(0.95_0.01_70)] hover:bg-[oklch(0.25_0.03_50)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none rounded-none font-bold",
    feed: "w-full flex flex-col",
    feedLabel: "text-[0.65rem] uppercase tracking-[0.12em] border-b border-[oklch(0.20_0.02_50)] pb-4 mb-4 text-[oklch(0.55_0.02_50)]",
    storyCard: "w-full flex flex-col gap-4 py-8 border-b border-[oklch(0.20_0.02_50)]",
    storyText: "font-serif text-2xl md:text-3xl leading-relaxed italic",
    storyMeta: "w-full flex justify-between items-center text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.55_0.02_50)]",
    archiveList: "w-full flex flex-col gap-16",
    archiveDate: "text-[0.65rem] uppercase tracking-[0.12em] border-b border-[oklch(0.20_0.02_50)] pb-4 text-[oklch(0.55_0.02_50)]",
    aiBtn: "text-[0.65rem] uppercase tracking-[0.12em] text-[oklch(0.35_0.04_50)] hover:text-[oklch(0.15_0.02_50)] py-2 self-start cursor-pointer transition-colors mt-2 text-left"
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap');
      `}</style>

      <div className={c.container}>
        <header className={c.header}>
          <h1 className={c.title}>The Six-Word Exhibition</h1>
          <nav className={c.nav}>
            <button className={`${c.navBtn} ${view === "today" ? "text-[oklch(0.35_0.04_50)] border-b border-[oklch(0.35_0.04_50)]" : ""}`} onClick={() => handleNav("today")}>
              Exhibition
            </button>
            <button className={`${c.navBtn} ${view === "archive" ? "text-[oklch(0.35_0.04_50)] border-b border-[oklch(0.35_0.04_50)]" : ""}`} onClick={() => handleNav("archive")}>
              Archives
            </button>
          </nav>
        </header>

        <main className={c.main}>
          {view === "today" ? (
            <>
              <section className={c.promptBox}>
                <span className={c.promptLabel}>Subject · {today}</span>
                <h2 className={c.promptText}>"A Forgotten Key"</h2>
              </section>

              <section className={c.formSection}>
                <form className={c.form} onSubmit={handleSubmit}>
                  <div className={c.inputGroup}>
                    <label className={c.label}>Author Name</label>
                    <input 
                      className={c.input} 
                      type="text" 
                      placeholder="e.g. E. Hemingway"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </div>
                  
                  <div className={c.inputGroup}>
                    <label className={c.label}>The Story</label>
                    <input 
                      className={c.input} 
                      type="text" 
                      placeholder="Must be exactly six words."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <div className={`${c.wordCount} ${isExactLength ? "text-[oklch(0.35_0.04_50)]" : "text-[oklch(0.55_0.02_50)]"}`}>
                      {currentWordCount} / 6 words
                    </div>
                    <button type="button" className={c.aiBtn} onClick={handleSuggest} disabled={isSuggesting}>
                      {isSuggesting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-3 w-3 text-[oklch(0.35_0.04_50)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Consulting Muse...
                        </span>
                      ) : (
                        "Suggest an idea"
                      )}
                    </button>
                  </div>

                  <button className={c.submitBtn} type="submit" disabled={!isExactLength || !author.trim()}>
                    Contribute to Exhibit
                  </button>
                </form>
              </section>

              <section className={c.feed}>
                <h3 className={c.feedLabel}>Contributions ({filteredToday.length})</h3>
                
                {filteredToday.map(story => (
                  <article key={story._id} className={c.storyCard}>
                    <p className={c.storyText}>"{story.text}"</p>
                    <footer className={c.storyMeta}>
                      <span>{story.author}</span>
                      <span>{new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </footer>
                  </article>
                ))}

                {filteredToday.length === 0 && (
                  <p className="text-[oklch(0.55_0.02_50)] italic font-serif py-8 text-center border-b border-[oklch(0.20_0.02_50)]">
                    The gallery is empty today. Be the first to hang your words.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className={c.archiveList}>
              {sortedDates.length === 0 && (
                <p className="text-[oklch(0.55_0.02_50)] italic font-serif py-16 text-center">
                  The archives carry no history yet.
                </p>
              )}
              {sortedDates.map(date => (
                <div key={date} className={c.feed}>
                  <h3 className={c.archiveDate}>Exhibition Date · {date}</h3>
                  {archiveGroups[date].map(story => (
                    <article key={story._id} className={c.storyCard}>
                      <p className={c.storyText}>"{story.text}"</p>
                      <footer className={c.storyMeta}>
                        <span>{story.author}</span>
                        <span>{new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </footer>
                    </article>
                  ))}
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}