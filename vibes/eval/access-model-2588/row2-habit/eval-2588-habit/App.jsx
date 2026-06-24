import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function Header({ ViewerTag, c }) {
  return (
    <header id="app-header" className={`${c.header} sticky top-0 z-10 px-4 py-4 border-b-[length:var(--border-width)] border-[var(--border)] flex items-center justify-between`}>
      <div>
        <h1 className={`text-xl font-semibold ${c.textPrimary} tracking-tight`}>Daily Habits</h1>
        <p className={`text-xs ${c.textSecondary} mt-0.5`}>Build the streak</p>
      </div>
      <ViewerTag />
    </header>
  )
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function last7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }
  return days
}

function HabitGrid({ c, database, habits, completions, canEdit }) {
  const today = dayKey()
  const days = last7Days()
  const doneSet = new Set(completions.map((cm) => `${cm.habitId}:${cm.day}`))

  async function toggle(habitId, day) {
    const key = `${habitId}:${day}`
    const existing = completions.find((cm) => cm.habitId === habitId && cm.day === day)
    if (existing) {
      await database.del(existing._id)
    } else {
      await database.put({ type: "completion", habitId, day, createdAt: Date.now() })
    }
  }

  function streak(habitId) {
    let s = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (doneSet.has(`${habitId}:${dayKey(d)}`)) s++
      else if (i > 0) break
    }
    return s
  }

  return (
    <section id="habit-grid" className={`${c.surface} rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]`}>
      <h2 className={`text-sm font-medium ${c.textPrimary} mb-3`}>This week</h2>
      {habits.length === 0 ? (
        <p className={`text-sm ${c.textSecondary}`}>No habits yet. Add one below.</p>
      ) : (
        <ul className="space-y-3">
          {habits.map((h) => (
            <li key={h._id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${c.textPrimary} font-medium`}>{h.name}</span>
                <span className={`text-xs ${c.textSecondary}`}>🔥 {streak(h._id)}d</span>
              </div>
              <div className="flex gap-1.5">
                {days.map((day) => {
                  const done = doneSet.has(`${h._id}:${day}`)
                  const isToday = day === today
                  return (
                    <button
                      key={day}
                      disabled={!canEdit}
                      onClick={() => toggle(h._id, day)}
                      className={`flex-1 min-h-[44px] rounded-[var(--radius-sm)] border-[length:var(--border-width)] text-xs font-medium transition-opacity ${
                        done
                          ? "bg-[var(--success)] border-[var(--success)] text-[var(--background)]"
                          : "border-[var(--border)] text-[var(--text-secondary)]"
                      } ${isToday ? "ring-1 ring-[var(--accent)]" : ""} ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                      aria-label={`${h.name} ${day}`}
                    >
                      {day.slice(8)}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddHabit({ c, database, canEdit, can }) {
  const [name, setName] = React.useState("")
  const verdict = can.create({ type: "habit", name: "x" })

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await database.put({ type: "habit", name: name.trim(), createdAt: Date.now() })
    setName("")
  }

  if (!canEdit) {
    return (
      <section id="add-habit" className={`${c.surface} rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]`}>
        <p className={`text-sm ${c.textSecondary}`}>{verdict.reason || "Read-only view"}</p>
      </section>
    )
  }

  return (
    <section id="add-habit" className={`${c.surface} rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]`}>
      <h2 className={`text-sm font-medium ${c.textPrimary} mb-3`}>Add a habit</h2>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className={c.input}
          placeholder="e.g. Drink water"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={c.button} disabled={!name.trim()}>Add</button>
      </form>
    </section>
  )
}

function AICoach({ c, habits, completions, database, canEdit }) {
  const [suggestion, setSuggestion] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)

  async function getSuggestion() {
    setIsLoading(true)
    setSuggestion(null)
    try {
      const habitNames = habits.map((h) => h.name).join(", ") || "none yet"
      const recentCount = completions.filter((cm) => {
        const days = (Date.now() - (cm.createdAt || 0)) / 86400000
        return days < 7
      }).length
      const prompt = `User's habits: ${habitNames}. Completions in last 7 days: ${recentCount}. Give one short motivational nudge AND suggest one new complementary habit.`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            nudge: { type: "string", description: "Short motivational sentence" },
            newHabit: { type: "string", description: "Name of a new habit to add" },
          },
        },
      })
      setSuggestion(JSON.parse(res))
    } catch (err) {
      setSuggestion({ nudge: "Couldn't reach the coach. Try again.", newHabit: "" })
    } finally {
      setIsLoading(false)
    }
  }

  async function accept() {
    if (!suggestion?.newHabit) return
    await database.put({ type: "habit", name: suggestion.newHabit, createdAt: Date.now() })
    setSuggestion(null)
  }

  return (
    <section id="ai-coach" className={`${c.accent} rounded-[var(--radius-lg)] p-[var(--spacing)]`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-sm font-semibold ${c.accentText}`}>AI Coach</h2>
        <button
          onClick={getSuggestion}
          disabled={isLoading}
          className="bg-[var(--background)] text-[var(--accent)] rounded-[var(--radius)] px-3 py-2 min-h-[40px] text-xs font-medium flex items-center gap-2 disabled:opacity-60"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          {isLoading ? "Thinking..." : "Inspire me"}
        </button>
      </div>
      {suggestion && (
        <div className="space-y-2">
          <p className={`text-sm ${c.accentText} opacity-90`}>{suggestion.nudge}</p>
          {suggestion.newHabit && (
            <div className="flex items-center gap-2 bg-[var(--background)] rounded-[var(--radius)] p-2">
              <span className={`text-xs text-[var(--text-primary)] flex-1`}>Try: <strong>{suggestion.newHabit}</strong></span>
              {canEdit && (
                <button onClick={accept} className="text-xs bg-[var(--success)] text-[var(--background)] rounded-[var(--radius-sm)] px-2 py-1 font-medium">Add</button>
              )}
              <button onClick={() => setSuggestion(null)} className={`text-xs text-[var(--text-secondary)] px-2 py-1`}>Dismiss</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("habitTracker")
  const { can, ready } = useVibe("habitTracker")
  const { docs: habits } = useLiveQuery("type", { key: "habit" })
  const { docs: completions } = useLiveQuery("type", { key: "completion" })
  const canEdit = ready && can.create({ type: "habit", name: "x" }).ok

  const c = {
    page: "bg-[var(--background)] min-h-screen font-[var(--font-family)]",
    header: "bg-[var(--background)]",
    surface: "bg-[var(--surface)]",
    textPrimary: "text-[var(--text-primary)]",
    textSecondary: "text-[var(--text-secondary)]",
    accent: "bg-[var(--accent)]",
    accentText: "text-[var(--background)]",
    button: "bg-[var(--primary)] text-[var(--background)] rounded-[var(--radius)] px-4 py-3 min-h-[44px] font-medium",
    input: "bg-[var(--surface)] text-[var(--text-primary)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] px-3 py-3 min-h-[44px] w-full",
  }

  return (
    <div className={c.page}>
      <style>{`:root {
        --background: #030303;
        --surface: rgba(255, 255, 255, 0.04);
        --accent: #ffffff;
        --text-primary: rgba(255, 255, 255, 0.92);
        --text-secondary: rgba(255, 255, 255, 0.55);
        --border: rgba(255, 255, 255, 0.18);
        --primary: #ffffff;
        --secondary: #ffffff;
        --warning: #f59e0b;
        --success: #22c55e;
        --error: #ef4444;
        --font-family: 'Inter', sans-serif;
        --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
        --font-size-base: 1rem;
        --radius: 0.5rem;
        --radius-sm: 0.25rem;
        --radius-lg: 1rem;
        --spacing: 1rem;
        --border-width: 1px;
      }`}</style>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app" className="px-4 py-4 pb-24 max-w-2xl mx-auto space-y-4">
        <HabitGrid c={c} database={database} habits={habits} completions={completions} canEdit={canEdit} />
        <AddHabit c={c} database={database} canEdit={canEdit} can={can} />
        <AICoach c={c} habits={habits} completions={completions} database={database} canEdit={canEdit} />
      </main>
    </div>
  )
}