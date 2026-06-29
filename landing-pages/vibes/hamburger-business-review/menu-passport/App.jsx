import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&family=Space+Mono:wght@400;700&display=optional"
      rel="stylesheet"
    />
    <style>{`
      :root {
        --bg: oklch(0.11 0.01 270);
        --card-bg: oklch(0.13 0.01 270);
        --text: oklch(0.93 0.01 270);
        --border: oklch(0.22 0.01 270);
        --accent: oklch(0.65 0.18 290);
        --accent-text: oklch(0.10 0.01 270);
        --muted: oklch(0.42 0.01 270);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg: oklch(0.97 0.01 270);
          --card-bg: oklch(1 0 0);
          --text: oklch(0.15 0.01 270);
          --border: oklch(0.85 0.01 270);
          --accent: oklch(0.55 0.20 290);
          --accent-text: oklch(0.98 0 0);
          --muted: oklch(0.55 0.01 270);
        }
      }
      body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }
      .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
      .font-mono { font-family: 'Space Mono', monospace; }
    `}</style>
  </>
)

function DeckBrowser({ database, items, viewer, ViewerTag }) {
  const [idx, setIdx] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)
  const item = items[idx % Math.max(items.length, 1)]

  if (!item) return <p className="text-[var(--muted)] font-mono text-sm">Loading the menu...</p>

  const stamp = () => {
    if (!viewer) return
    database.put({
      type: "stamp",
      itemId: item._id,
      itemName: item.name,
      country: item.country,
      flag: item.flag,
      stampedAt: Date.now(),
      stampedBy: viewer.userHandle,
    })
  }

  const next = () => { setFlipped(false); setIdx((i) => i + 1) }

  return (
    <div className="flex flex-col gap-4">
      <div
        onClick={() => setFlipped((f) => !f)}
        className="rounded-lg border min-h-[360px] p-6 flex flex-col justify-between cursor-pointer transition-transform active:scale-[0.98]"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Card {idx + 1} / {items.length}
          </p>
          <h3 className="font-display text-5xl mt-3 leading-none">{item.name}</h3>
          {!flipped && (
            <p className="font-mono text-xs mt-4" style={{ color: "var(--muted)" }}>
              Tap to reveal origin →
            </p>
          )}
        </div>
        {flipped && (
          <div className="mt-4">
            <div className="text-4xl">{item.flag}</div>
            <p className="font-display text-3xl mt-1">{item.country}</p>
            <p className="text-sm mt-3 leading-relaxed">{item.description}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={next}
          className="flex-1 min-h-[48px] rounded-lg border font-display text-xl"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          Next
        </button>
        <button
          onClick={stamp}
          disabled={!viewer}
          className="flex-1 min-h-[48px] rounded-lg font-display text-xl disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          Stamp It
        </button>
      </div>
      {!viewer && <p className="text-xs font-mono text-center" style={{ color: "var(--muted)" }}>Sign in to stamp your passport.</p>}
    </div>
  )
}

function QuizMode({ database, items, viewer }) {
  const [idx, setIdx] = React.useState(0)
  const [picked, setPicked] = React.useState(null)
  const [score, setScore] = React.useState({ right: 0, total: 0 })
  const item = items[idx % Math.max(items.length, 1)]

  const choices = React.useMemo(() => {
    if (!item) return []
    const others = items.filter((i) => i._id !== item._id).sort(() => Math.random() - 0.5).slice(0, 3)
    return [...others, item].map((i) => i.country).sort(() => Math.random() - 0.5)
  }, [item?._id])

  if (!item) return <p className="text-[var(--muted)] font-mono text-sm">Loading quiz...</p>

  const pick = (country) => {
    if (picked) return
    setPicked(country)
    const right = country === item.country
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }))
    if (viewer) {
      database.put({
        type: "quizAttempt",
        itemId: item._id,
        guess: country,
        actual: item.country,
        correct: right,
        attemptedAt: Date.now(),
        attemptedBy: viewer.userHandle,
      })
    }
  }

  const nextQ = () => { setPicked(null); setIdx((i) => i + 1) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        <span>Question {score.total + (picked ? 0 : 1)}</span>
        <span>Score {score.right}/{score.total}</span>
      </div>
      <div className="rounded-lg border p-6" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>Where is it from?</p>
        <h3 className="font-display text-5xl mt-2 leading-none">{item.name}</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {choices.map((country) => {
          const isPicked = picked === country
          const isAnswer = picked && country === item.country
          const bg = isAnswer ? "var(--accent)" : isPicked ? "var(--border)" : "var(--card-bg)"
          const color = isAnswer ? "var(--accent-text)" : "var(--text)"
          return (
            <button
              key={country}
              onClick={() => pick(country)}
              disabled={!!picked}
              className="min-h-[48px] rounded-lg border text-left px-4 font-display text-xl transition-colors"
              style={{ background: bg, color, borderColor: "var(--border)" }}
            >
              {country}
            </button>
          )
        })}
      </div>
      {picked && (
        <button
          onClick={nextQ}
          className="min-h-[48px] rounded-lg font-display text-xl"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          Next Question →
        </button>
      )}
    </div>
  )
}

function PassportList({ stamps }) {
  if (!stamps.length) {
    return (
      <div className="rounded-lg border p-6 text-center" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <p className="font-display text-3xl">Empty Passport</p>
        <p className="font-mono text-xs mt-2" style={{ color: "var(--muted)" }}>Stamp items from the deck to fill it.</p>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {stamps.map((s) => (
        <li
          key={s._id}
          className="rounded-lg border p-4 flex items-center gap-4"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div className="text-3xl">{s.flag}</div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl leading-none truncate">{s.itemName}</p>
            <p className="font-mono text-xs mt-1" style={{ color: "var(--muted)" }}>
              {s.country} · {new Date(s.stampedAt).toLocaleDateString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

const SEED = [
  { name: "McAloo Tikki", country: "India", flag: "🇮🇳", description: "Spiced potato and pea patty in a bun — McDonald's vegetarian flagship for the Indian market." },
  { name: "Teriyaki Burger", country: "Japan", flag: "🇯🇵", description: "Pork patty glazed in teriyaki sauce, a McDonald's Japan staple since the 1980s." },
  { name: "McSpicy Paneer", country: "India", flag: "🇮🇳", description: "Breaded paneer cheese fillet with tandoori mayo — a fiery Indian exclusive." },
  { name: "Croque McDo", country: "France", flag: "🇫🇷", description: "Toasted ham and Emmental sandwich modeled after the classic French croque monsieur." },
  { name: "Ebi Filet-O", country: "Japan", flag: "🇯🇵", description: "Crispy shrimp patty burger sold across East Asia, originally launched in Japan." },
  { name: "Nürnburger", country: "Germany", flag: "🇩🇪", description: "Three Nürnberger sausages in a sub roll with mustard — a Bavarian McDonald's seasonal." },
  { name: "McMollete", country: "Mexico", flag: "🇲🇽", description: "Open-faced bun with refried beans, cheese, and pico de gallo for breakfast." },
  { name: "Gazpacho", country: "Spain", flag: "🇪🇸", description: "Chilled tomato soup served as a side at Spanish McDonald's in summer." },
]

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery, access } = useFireproof("globalMenuPassport")
  const [tab, setTab] = React.useState("deck")
  const [loadingSeed, setLoadingSeed] = React.useState(false)

  const { docs: items } = useLiveQuery("type", { key: "menuItem" })
  const { docs: stamps } = useLiveQuery(
    (d) => d.type === "stamp" && viewer && d.stampedBy === viewer.userHandle ? d.stampedAt : undefined,
    { descending: true }
  )

  // Seed the catalog once
  React.useEffect(() => {
    if (!isOwner) return
    if (items.length > 0) return
    if (loadingSeed) return
    setLoadingSeed(true)
    Promise.all(
      SEED.map((s) =>
        database.put({ type: "menuItem", ...s, _id: `item:${s.name.toLowerCase().replace(/\s+/g, "-")}` })
      )
    ).finally(() => setLoadingSeed(false))
  }, [isOwner, items.length])

  if (isViewerPending) return null

  return (
    <>
      {FONTS}
      <main id="app" className="min-h-screen pb-24" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <header
          id="app-header"
          className="px-5 pt-6 pb-4 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--muted)" }}>
                Issue No. 01 · Worldwide
              </p>
              <h1 className="font-display text-4xl leading-none mt-1">Menu Passport</h1>
            </div>
            <ViewerTag />
          </div>
        </header>

        <section id="deck" className="px-5 pt-6">
          {tab === "deck" && <DeckBrowser database={database} items={items} viewer={viewer} ViewerTag={ViewerTag} />}
        </section>

        <section id="quiz" className="px-5 pt-6">
          {tab === "quiz" && <QuizMode database={database} items={items} viewer={viewer} />}
        </section>

        <section id="passport" className="px-5 pt-6">
          {tab === "passport" && (
            <>
              <p className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                {stamps.length} stamp{stamps.length === 1 ? "" : "s"} collected
              </p>
              <PassportList stamps={stamps} />
            </>
          )}
        </section>

        <nav
          className="fixed bottom-0 left-0 right-0 border-t flex"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          {[
            { id: "deck", label: "Deck" },
            { id: "quiz", label: "Quiz" },
            { id: "passport", label: "Passport" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 min-h-[56px] font-display text-xl"
              style={{
                background: tab === t.id ? "var(--accent)" : "transparent",
                color: tab === t.id ? "var(--accent-text)" : "var(--text)",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </main>
    </>
  )
}