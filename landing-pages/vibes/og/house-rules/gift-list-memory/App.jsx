import React, { useState, useMemo } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5efe3] p-6",
  header: "max-w-6xl mx-auto mb-6",
  title: "text-3xl font-bold uppercase tracking-tight",
  layout: "max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4",
  rail: "bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  panel: "bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  form: "bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625] mt-4",
  sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6478] mb-2",
}

function PeopleRail({ people, onAdd }) {
  const [name, setName] = useState("")
  const [relation, setRelation] = useState("")

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), relation: relation.trim() })
    setName("")
    setRelation("")
  }

  return (
    <aside id="people-rail" className={classNames.rail}>
      <h2 className={classNames.sectionLabel}>Family</h2>
      <ul className="space-y-2 mb-4">
        {people.map((p) => (
          <li key={p._id} className="p-2 border-[2px] border-[#1a1625] rounded bg-[#fdf8ec]">
            <div className="font-semibold text-sm">{p.name}</div>
            {p.relation && <div className="text-[0.7rem] uppercase tracking-[0.1em] text-[#6b6478]">{p.relation}</div>}
          </li>
        ))}
        {people.length === 0 && <li className="text-xs text-[#6b6478] italic">No one yet — add a loved one below.</li>}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full px-2 py-1 border-[2px] border-[#1a1625] rounded text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[3px_3px_0px_#1a1625] transition"
        />
        <input
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder="Relation (Aunt, Dad...)"
          className="w-full px-2 py-1 border-[2px] border-[#1a1625] rounded text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[3px_3px_0px_#1a1625] transition"
        />
        <button
          type="submit"
          className="w-full px-3 py-1.5 bg-[#8b4a5c] text-white text-xs uppercase tracking-[0.08em] font-semibold border-[2px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#1a1625] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition"
        >
          Add Person
        </button>
      </form>
    </aside>
  )
}

function GiftGrid({ people, gifts, years }) {
  const lookup = useMemo(() => {
    const m = {}
    gifts.forEach((g) => {
      m[`${g.personName}::${g.year}`] = g
    })
    return m
  }, [gifts])

  return (
    <section id="gift-grid" className={classNames.panel}>
      <h2 className={classNames.sectionLabel}>Gift Ledger</h2>
      {people.length === 0 ? (
        <p className="text-sm text-[#6b6478] italic">Add someone to the family to begin the ledger.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-[2px] border-[#1a1625]">
                <th className="text-left py-2 px-2 text-[0.6rem] uppercase tracking-[0.15em]">Person</th>
                {years.map((y) => (
                  <th key={y} className="text-left py-2 px-2 text-[0.6rem] uppercase tracking-[0.15em] font-mono">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p._id} className="border-b border-[#e8dfc9] hover:bg-[#fdf8ec]">
                  <td className="py-2 px-2 font-semibold">
                    {p.name}
                    {p.relation && <div className="text-[0.65rem] text-[#6b6478] font-normal">{p.relation}</div>}
                  </td>
                  {years.map((y) => {
                    const g = lookup[`${p.name}::${y}`]
                    return (
                      <td key={y} className="py-2 px-2 align-top">
                        {g ? (
                          <div className="bg-[#fdf8ec] border-[2px] border-[#1a1625] rounded p-1.5 text-xs">
                            <div className="font-semibold">{g.gift}</div>
                            {g.notes && <div className="text-[0.65rem] text-[#6b6478] italic mt-0.5">{g.notes}</div>}
                          </div>
                        ) : (
                          <span className="text-[#c8bfa9]">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AddGiftForm({ people, gifts, years, onSave, flagDupes, setFlagDupes }) {
  const [personName, setPersonName] = useState("")
  const [year, setYear] = useState(years[years.length - 1])
  const [gift, setGift] = useState("")
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const warning = useMemo(() => {
    if (!flagDupes || !personName || !gift.trim()) return null
    const priorGifts = gifts.filter((g) => g.personName === personName && g.year !== Number(year))
    const giftLower = gift.trim().toLowerCase()
    for (const pg of priorGifts) {
      const pgLower = pg.gift.toLowerCase()
      if (pgLower === giftLower) {
        return `You already gave ${personName} "${pg.gift}" in ${pg.year}.`
      }
      const words = giftLower.split(/\s+/).filter((w) => w.length > 3)
      if (words.some((w) => pgLower.includes(w))) {
        return `You almost gave ${personName} the same ${pg.gift.toLowerCase()} you gave them in ${pg.year}.`
      }
    }
    return null
  }, [flagDupes, personName, gift, year, gifts])

  const suggestIdea = async () => {
    if (!personName) return
    const person = people.find((p) => p.name === personName)
    const priorGifts = gifts.filter((g) => g.personName === personName).map((g) => `${g.year}: ${g.gift}`).join(", ")
    setIsLoading(true)
    try {
      const res = await callAI(
        `Suggest one thoughtful gift idea for ${personName}${person?.relation ? ` (my ${person.relation})` : ""} for ${year}. Prior gifts: ${priorGifts || "none"}. Avoid repeating prior gifts.`,
        { schema: { properties: { gift: { type: "string" }, notes: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      setGift(parsed.gift || "")
      setNotes(parsed.notes || "")
    } finally {
      setIsLoading(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!personName || !gift.trim()) return
    onSave({ personName, year: Number(year), gift: gift.trim(), notes: notes.trim() })
    setGift("")
    setNotes("")
  }

  return (
    <section id="add-gift" className={classNames.form}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.sectionLabel + " mb-0"}>Add A Gift</h2>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] cursor-pointer">
          <span>Flag Duplicates</span>
          <button
            type="button"
            onClick={() => setFlagDupes(!flagDupes)}
            className={`w-12 h-6 border-[2px] border-[#1a1625] rounded relative transition ${flagDupes ? "bg-[#d4a84b]" : "bg-white"}`}
          >
            <span
              className={`absolute top-[1px] w-4 h-4 bg-[#1a1625] rounded transition-transform ${flagDupes ? "translate-x-[22px]" : "translate-x-[2px]"}`}
            />
          </button>
        </label>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          className="px-2 py-1.5 border-[2px] border-[#1a1625] rounded text-sm bg-white"
        >
          <option value="">Choose a person…</option>
          {people.map((p) => (
            <option key={p._id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="px-2 py-1.5 border-[2px] border-[#1a1625] rounded text-sm bg-white font-mono"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          value={gift}
          onChange={(e) => setGift(e.target.value)}
          placeholder="Gift (e.g. knit scarf)"
          className="px-2 py-1.5 border-[2px] border-[#1a1625] rounded text-sm sm:col-span-2"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (color, size, where from...)"
          className="px-2 py-1.5 border-[2px] border-[#1a1625] rounded text-sm sm:col-span-2"
        />
        {warning && (
          <div className="sm:col-span-2 p-2 bg-[#f5e6c8] border-[2px] border-[#8b4a5c] rounded text-sm text-[#5a2f3d] italic">
            ✦ A gentle reminder: {warning}
          </div>
        )}
        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 px-3 py-2 bg-[#4a6b4a] text-white text-xs uppercase tracking-[0.08em] font-semibold border-[2px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#1a1625] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition"
          >
            Save Gift
          </button>
          <button
            type="button"
            onClick={suggestIdea}
            disabled={isLoading || !personName}
            className="px-3 py-2 bg-[#d4a84b] text-[#1a1625] text-xs uppercase tracking-[0.08em] font-semibold border-[2px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#1a1625] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition disabled:opacity-50"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" strokeDasharray="42 60" />
              </svg>
            ) : "Suggest"}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("family-gift-ledger")
  const { docs: people } = useLiveQuery("type", { key: "person" })
  const { docs: gifts } = useLiveQuery("type", { key: "gift" })
  const [flagDupes, setFlagDupes] = useState(true)

  const years = [2022, 2023, 2024, 2025]

  const addPerson = ({ name, relation }) => {
    database.put({ type: "person", name, relation, createdAt: Date.now() })
  }

  const saveGift = ({ personName, year, gift, notes }) => {
    const existing = gifts.find((g) => g.personName === personName && g.year === year)
    if (existing) {
      database.put({ ...existing, gift, notes })
    } else {
      database.put({ type: "gift", personName, year, gift, notes, createdAt: Date.now() })
    }
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Family Gift Ledger</h1>
        <p className="text-sm text-[#6b6478] mt-1 italic">A cozy record of giving, year by year.</p>
      </header>
      <div className={classNames.layout}>
        <PeopleRail people={people} onAdd={addPerson} />
        <div>
          <GiftGrid people={people} gifts={gifts} years={years} />
          <AddGiftForm
            people={people}
            gifts={gifts}
            years={years}
            onSave={saveGift}
            flagDupes={flagDupes}
            setFlagDupes={setFlagDupes}
          />
        </div>
      </div>
    </main>
  )
}