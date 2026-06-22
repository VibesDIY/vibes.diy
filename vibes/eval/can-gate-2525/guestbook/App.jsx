import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function SignForm() {
  const { database } = useFireproof("guestbook")
  const { can, ready, me } = useVibe("guestbook")
  const [name, setName] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return
    setIsSaving(true)
    setError("")
    try {
      const result = await database.put({
        type: "entry",
        name: name.trim(),
        message: message.trim(),
        authorHandle: me?.userHandle,
        createdAt: Date.now(),
        reply: null,
      })
      setName("")
      setMessage("")
      try {
        const aiRaw = await callAI(
          `A guest named "${name.trim()}" left this message in a guestbook: "${message.trim()}". Write a single warm, charming one-line thank-you reply or a fun fact inspired by their message. Keep it under 20 words.`,
          { schema: { properties: { reply: { type: "string" } } } }
        )
        const { reply } = JSON.parse(aiRaw)
        const saved = await database.get(result.id)
        await database.put({ ...saved, reply })
      } catch (err) {
        // AI flourish is optional; entry already saved
      }
    } catch (err) {
      setError("Could not save. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!ready) {
    return (
      <section id="sign-form" className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-[var(--spacing)]">
        <p className="text-[var(--text-secondary)] italic">Loading…</p>
      </section>
    )
  }

  const verdict = can.create({ type: "entry", authorHandle: me?.userHandle })
  if (!verdict.ok) {
    return (
      <section id="sign-form" className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-[var(--spacing)]">
        <h2 className="text-2xl mb-2 text-[var(--text-primary)]">Reading only</h2>
        <p className="text-[var(--text-secondary)] italic">{verdict.reason}</p>
      </section>
    )
  }

  return (
    <section id="sign-form" className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-[var(--spacing)]">
      <h2 className="text-2xl mb-3 text-[var(--text-primary)]">Leave your mark</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          disabled={isSaving}
          className="w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] text-[var(--text-primary)] text-lg"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A short message…"
          disabled={isSaving}
          rows={3}
          className="w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] px-3 py-3 text-[var(--text-primary)] text-lg resize-none"
        />
        <button
          type="submit"
          disabled={isSaving || !name.trim() || !message.trim()}
          className="w-full min-h-[44px] bg-[var(--primary)] text-[#0a0a0a] rounded-[var(--radius)] px-4 py-3 text-lg tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Signing…
            </>
          ) : "Sign the book"}
        </button>
        {error && <p className="text-[var(--error)] text-sm">{error}</p>}
      </form>
    </section>
  )
}

function EntryList() {
  const { useLiveQuery } = useFireproof("guestbook")
  const { ViewerTag } = useViewer()
  const { docs } = useLiveQuery("createdAt", { descending: true, limit: 100 })
  const entries = docs.filter((d) => d.type === "entry")

  return (
    <section id="entry-list" className="space-y-3">
      <h2 className="text-2xl text-[var(--text-primary)] mb-2">Past signatures</h2>
      {entries.length === 0 && (
        <p className="text-[var(--text-secondary)] italic">No one has signed yet. Be the first.</p>
      )}
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry._id}
            className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-[var(--spacing)]"
          >
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl text-[var(--text-primary)] truncate">{entry.name}</span>
                {entry.authorHandle && <ViewerTag userHandle={entry.authorHandle} />}
              </div>
              <time className="text-xs text-[var(--text-secondary)] shrink-0">
                {new Date(entry.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p className="text-lg text-[var(--text-primary)] italic leading-relaxed">"{entry.message}"</p>
            {entry.reply && (
              <p className="mt-3 pt-3 border-t-[length:var(--border-width)] border-[var(--border)] text-sm text-[var(--text-secondary)]">
                <span className="opacity-60">— </span>{entry.reply}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready } = useVibe("guestbook")

  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 backdrop-blur-md bg-[color-mix(in_srgb,var(--background)_80%,transparent)] border-b-[length:var(--border-width)] border-[var(--border)] px-5 py-4 flex items-center justify-between",
    title: "text-3xl tracking-wide",
    main: "max-w-2xl mx-auto px-5 py-6 space-y-6",
  }

  return (
    <div className={c.page}>
      <style>{`
        :root {
          --background: oklch(0.17 0.000 0);
          --text-primary: rgba(255, 255, 255, 0.92);
          --text-secondary: rgba(255, 255, 255, 0.55);
          --border: rgba(255, 255, 255, 0.18);
          --accent: oklch(0.93 0.006 265);
          --surface: rgba(255, 255, 255, 0.04);
          --primary: oklch(0.93 0.006 265);
          --secondary: oklch(0.93 0.006 265);
          --font-family: 'Cormorant Garamond', serif;
          --radius: 0.5rem;
          --radius-sm: 0.25rem;
          --radius-lg: 1rem;
          --spacing: 1rem;
          --border-width: 1px;
        }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=optional');
      `}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>The Guestbook</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <SignForm />
        <EntryList />
      </main>
    </div>
  )
}