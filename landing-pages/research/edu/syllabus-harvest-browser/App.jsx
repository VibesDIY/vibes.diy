import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function AddSyllabus({ c, database }) {
  const [doc, setDoc] = React.useState({ title:"", department:"", university:"", cluster:"", level:"" })
  const [loading, setLoading] = React.useState(false)
  const merge = (p) => setDoc(d => ({ ...d, ...p }))
  const save = async () => {
    if (!doc.title.trim()) return
    await database.put({ type:"syllabus", ...doc, createdAt: Date.now() })
    setDoc({ title:"", department:"", university:"", cluster:"", level:"" })
  }
  const suggest = async () => {
    setLoading(true)
    try {
      const r = await callAI("Generate one realistic academic syllabus entry across departments like CS, Sociology, History, etc.", {
        schema: { properties: { title:{type:"string"}, department:{type:"string"}, university:{type:"string"}, cluster:{type:"string"}, level:{type:"string"} } }
      })
      setDoc(JSON.parse(r))
    } finally { setLoading(false) }
  }
  const Spinner = () => <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" strokeDasharray="40 60"/></svg>
  return (
    <section id="add-syllabus" className={c.section}>
      <h2 className={c.h2}>Add Syllabus</h2>
      <div className="space-y-2">
        <input className={c.input} placeholder="Course title" value={doc.title} onChange={e=>merge({title:e.target.value})} />
        <div className="grid grid-cols-2 gap-2">
          <input className={c.input} placeholder="Department" value={doc.department} onChange={e=>merge({department:e.target.value})} />
          <input className={c.input} placeholder="University" value={doc.university} onChange={e=>merge({university:e.target.value})} />
          <input className={c.input} placeholder="Cluster" value={doc.cluster} onChange={e=>merge({cluster:e.target.value})} />
          <input className={c.input} placeholder="Level (UG/Grad)" value={doc.level} onChange={e=>merge({level:e.target.value})} />
        </div>
        <div className="flex gap-2">
          <button className={c.btn} onClick={save}>Save</button>
          <button className={c.btn2} onClick={suggest} disabled={loading}>{loading ? <Spinner/> : "Suggest with AI"}</button>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("syllabus-atlas")
  const { docs: courses } = useLiveQuery("type", { key: "syllabus" })
  const [filters, setFilters] = React.useState({})
  const toggleFilter = (facet, val) => setFilters(f => ({ ...f, [facet]: f[facet] === val ? undefined : val }))
  const clearAll = () => setFilters({})
  const filtered = courses.filter(d => Object.entries(filters).every(([k,v]) => !v || d[k] === v))
  const activeEntries = Object.entries(filters).filter(([,v]) => v)
  const c = {
    page: "min-h-screen bg-[#faf7f0] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]",
    header: "bg-white border-b-[3px] border-[#1a1a2e] shadow-[0_4px_0_0_#1a1a2e] px-4 py-4 sticky top-0 z-20",
    brand: "flex items-center gap-3",
    logo: "flex gap-1",
    sq: "w-3 h-3 border-2 border-[#1a1a2e]",
    title: "text-xl md:text-2xl font-bold uppercase tracking-tight",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b80] mt-1",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0_0_#1a1a2e] p-4",
    h2: "text-base font-bold uppercase tracking-tight mb-3",
    label: "text-[0.6rem] uppercase tracking-[0.15em] text-[#6b6b80]",
    chip: "inline-flex items-center gap-1 px-2 py-1 border-2 border-[#1a1a2e] bg-[#f4d35e] rounded text-xs font-semibold uppercase",
    btn: "px-3 py-2 border-[3px] border-[#1a1a2e] bg-[#e63946] text-white font-bold uppercase text-xs tracking-wider rounded shadow-[3px_3px_0_0_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btn2: "px-3 py-2 border-[3px] border-[#1a1a2e] bg-[#f4d35e] text-[#1a1a2e] font-bold uppercase text-xs tracking-wider rounded shadow-[3px_3px_0_0_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    input: "w-full px-3 py-2 border-[3px] border-[#1a1a2e] rounded bg-white text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[3px_3px_0_0_#1a1a2e] transition-transform",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.logo}>
            <div className={c.sq} style={{background:"#e63946"}}/>
            <div className={c.sq} style={{background:"#f4d35e"}}/>
            <div className={c.sq} style={{background:"#3a86ff"}}/>
          </div>
          <div>
            <div className={c.title}>Syllabus Atlas</div>
            <div className={c.tag}>Faceted corpus browser</div>
          </div>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="active-filters" className={c.section}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={c.h2}>Active Filters</h2>
            <button className={c.btn2} onClick={clearAll} disabled={activeEntries.length===0}>Clear All</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeEntries.length === 0 && <span className={c.chip}>No filters · {courses.length} courses</span>}
            {activeEntries.map(([k,v]) => (
              <button key={k} className={c.chip} onClick={() => toggleFilter(k, v)}>
                {k}: {v} ✕
              </button>
            ))}
          </div>
        </section>
        <section id="facets" className={c.section}>
          <h2 className={c.h2}>Facet Breakdown · {filtered.length} of {courses.length}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {["department","university","cluster","level","region"].map(facet => {
              const counts = {}
              filtered.forEach(d => { if(d[facet]) counts[d[facet]] = (counts[d[facet]]||0)+1 })
              const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1])
              const total = filtered.length || 1
              const colors = {department:"#e63946",university:"#3a86ff",cluster:"#06a77d",level:"#f4d35e",region:"#9b5de5"}
              return (
                <div key={facet} className="border-2 border-[#1a1a2e] rounded p-2">
                  <div className={c.label + " mb-2"}>{facet}</div>
                  {entries.length === 0 && <div className="text-xs text-[#6b6b80]">No data</div>}
                  <div className="space-y-1">
                    {entries.map(([val,n]) => {
                      const pct = Math.round(n/total*100)
                      const active = filters[facet] === val
                      return (
                        <button key={val} onClick={()=>toggleFilter(facet,val)} className={"w-full text-left group "+(active?"ring-2 ring-[#1a1a2e]":"")}>
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="truncate">{val}</span>
                            <span className="font-mono">{n} · {pct}%</span>
                          </div>
                          <div className="h-2 border border-[#1a1a2e] bg-white">
                            <div className="h-full" style={{width:pct+"%",background:colors[facet]}}/>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <section id="course-list" className={c.section}>
          <h2 className={c.h2}>Courses · {filtered.length}</h2>
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.length === 0 && (
              <li className="border-2 border-[#1a1a2e] rounded p-2 text-xs text-[#6b6b80]">No matches · adjust filters or add a syllabus</li>
            )}
            {filtered.map(d => (
              <li key={d._id} className="border-2 border-[#1a1a2e] rounded p-2 hover:bg-[#f4d35e]/30">
                <div className="font-bold text-sm">{d.title}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {d.department && <span className="text-[0.6rem] px-1.5 py-0.5 border border-[#1a1a2e] bg-[#e63946] text-white uppercase font-semibold">{d.department}</span>}
                  {d.university && <span className="text-[0.6rem] px-1.5 py-0.5 border border-[#1a1a2e] bg-[#3a86ff] text-white uppercase font-semibold">{d.university}</span>}
                  {d.cluster && <span className="text-[0.6rem] px-1.5 py-0.5 border border-[#1a1a2e] bg-[#06a77d] text-white uppercase font-semibold">{d.cluster}</span>}
                  {d.level && <span className="text-[0.6rem] px-1.5 py-0.5 border border-[#1a1a2e] bg-[#f4d35e] uppercase font-semibold">{d.level}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <AddSyllabus c={c} database={database} />
      </main>
    </div>
  )
}