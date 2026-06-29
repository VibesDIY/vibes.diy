import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#fdf6e3] p-4 font-['Space_Grotesk',sans-serif]",
  shell: "max-w-5xl mx-auto",
  header: "mb-6 p-5 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  card: "p-4 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[3px_3px_0px_#1a1a2e]",
  colTitle: "text-xs font-bold uppercase tracking-widest mb-3 text-[#1a1a2e]",
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4",
}

function EventHeader({ database, eventDoc, count }) {
  const update = (field, val) => database.put({ ...eventDoc, [field]: val })
  return (
    <header className={classNames.header}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            value={eventDoc.title || ''}
            onChange={e => update('title', e.target.value)}
            placeholder="Potluck title..."
            className="w-full text-3xl font-bold uppercase tracking-tight text-[#1a1a2e] bg-transparent border-b-2 border-dashed border-[#1a1a2e] focus:outline-none focus:border-[#e63946] py-1"
          />
          <div className="flex gap-3 mt-3 flex-wrap">
            <input
              value={eventDoc.date || ''}
              onChange={e => update('date', e.target.value)}
              placeholder="Saturday 6pm"
              className="text-sm bg-[#ffe66d] border-2 border-[#1a1a2e] rounded px-2 py-1 font-medium"
            />
            <input
              value={eventDoc.location || ''}
              onChange={e => update('location', e.target.value)}
              placeholder="Grandma's house"
              className="text-sm bg-[#a8dadc] border-2 border-[#1a1a2e] rounded px-2 py-1 font-medium"
            />
          </div>
        </div>
        <div className="bg-[#e63946] text-white px-4 py-3 border-2 border-[#1a1a2e] rounded font-mono text-center">
          <div className="text-2xl font-bold leading-none">{count}</div>
          <div className="text-[0.6rem] uppercase tracking-widest mt-1">guests in</div>
        </div>
      </div>
    </header>
  )
}

function DietaryFilter({ filter, setFilter }) {
  return (
    <section className={`${classNames.card} mb-6`}>
      <h2 className={classNames.colTitle}>Filter by diet</h2>
      <div className="flex gap-2 flex-wrap">
        {DIET_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => setFilter(filter === chip ? null : chip)}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 border-[#1a1a2e] rounded transition-transform ${filter === chip ? 'bg-[#e63946] text-white translate-x-[-2px] translate-y-[-2px] shadow-[3px_3px_0px_#1a1a2e]' : `${CHIP_COLORS[chip]} text-[#1a1a2e]`}`}
          >
            {chip}
          </button>
        ))}
        {filter && (
          <button onClick={() => setFilter(null)} className="px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 border-[#1a1a2e] rounded bg-white text-[#1a1a2e]">clear</button>
        )}
      </div>
    </section>
  )
}

function CategoryBoard({ signups, database }) {
  return (
    <section className={classNames.grid}>
      {CATEGORIES.map(cat => {
        const items = signups.filter(s => s.category === cat)
        return (
          <div key={cat} className={classNames.card}>
            <h2 className={classNames.colTitle}>{cat}</h2>
            <div className="space-y-2">
              {items.map(s => <SignupCard key={s._id} doc={s} database={database} />)}
              <ClaimSlot category={cat} database={database} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function SignupCard({ doc, database }) {
  return (
    <div className="p-2 bg-[#fffbe6] border-2 border-[#1a1a2e] rounded">
      <div className="font-bold text-sm">{doc.dish || '(dish?)'}</div>
      <div className="text-xs text-[#555] italic">— {doc.guestName || 'someone'}</div>
      {doc.dietary?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1">
          {doc.dietary.map(d => (
            <span key={d} className={`text-[0.6rem] px-1 py-0.5 border border-[#1a1a2e] rounded ${CHIP_COLORS[d]} uppercase font-bold`}>{d}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => database.del(doc._id)}
        className="text-[0.6rem] uppercase tracking-wider text-[#e63946] mt-1 hover:underline"
      >remove</button>
    </div>
  )
}

function ClaimSlot({ category, database }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [dish, setDish] = useState('')
  const [dietary, setDietary] = useState([])

  const toggleDiet = (d) => setDietary(dietary.includes(d) ? dietary.filter(x => x !== d) : [...dietary, d])

  const save = async () => {
    if (!name.trim() || !dish.trim()) return
    await database.put({
      type: 'signup',
      event: 'event-meta',
      guestName: name.trim(),
      dish: dish.trim(),
      category,
      dietary,
      claimed: true,
      createdAt: Date.now(),
    })
    setName(''); setDish(''); setDietary([]); setOpen(false)
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="w-full p-2 border-2 border-dashed border-[#1a1a2e] rounded text-xs font-bold uppercase tracking-wider text-[#1a1a2e] hover:bg-[#ffe66d] transition-colors"
    >+ claim this slot</button>
  )

  return (
    <div className="p-2 bg-[#ffe66d] border-2 border-[#1a1a2e] rounded space-y-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="your name" className="w-full text-xs px-2 py-1 border-2 border-[#1a1a2e] rounded bg-white" />
      <input value={dish} onChange={e => setDish(e.target.value)} placeholder="what you're bringing" className="w-full text-xs px-2 py-1 border-2 border-[#1a1a2e] rounded bg-white" />
      <div className="flex gap-1 flex-wrap">
        {DIET_CHIPS.map(d => (
          <button key={d} onClick={() => toggleDiet(d)} className={`text-[0.6rem] px-1.5 py-0.5 border border-[#1a1a2e] rounded uppercase font-bold ${dietary.includes(d) ? CHIP_COLORS[d] : 'bg-white'}`}>{d}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 text-xs font-bold uppercase tracking-wider px-2 py-1 bg-[#e63946] text-white border-2 border-[#1a1a2e] rounded">save</button>
        <button onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white border-2 border-[#1a1a2e] rounded">x</button>
      </div>
    </div>
  )
}

const DIET_CHIPS = ['vegan', 'GF', 'nut-free', 'dairy-free']
const CATEGORIES = ['appetizer', 'main', 'side', 'dessert', 'drink']
const CHIP_COLORS = {
  vegan: 'bg-[#a8dadc]',
  GF: 'bg-[#ffe66d]',
  'nut-free': 'bg-[#f4a261]',
  'dairy-free': 'bg-[#e9c46a]',
}

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("potluck-board")
  const { doc: eventDoc } = useDocument({ _id: 'event-meta', title: '', date: '', location: '' })
  const { docs: signups } = useLiveQuery('type', { key: 'signup' })
  const [filter, setFilter] = useState(null)

  const filtered = filter ? signups.filter(s => (s.dietary || []).includes(filter)) : signups

  return (
    <main className={classNames.page}>
      <div className={classNames.shell}>
        <EventHeader database={database} eventDoc={eventDoc} count={signups.length} />
        <DietaryFilter filter={filter} setFilter={setFilter} />
        <CategoryBoard signups={filtered} database={database} />
      </div>
    </main>
  )
}