import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("zonecurious")

  const { doc: cityDoc, merge: mergeCity, submit: submitCity, reset: resetCity } = useDocument({
    type: "city", name: "", summary: "", zones: [], createdAt: 0, createdBy: ""
  })
  const { docs: cities } = useLiveQuery("type", { key: "city", descending: true })
  const [exploreLoading, setExploreLoading] = React.useState(false)
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const [selectedCity, setSelectedCity] = React.useState(null)

  async function exploreCity(e) {
    e.preventDefault()
    if (!cityDoc.name.trim()) return
    setExploreLoading(true)
    try {
      const resp = await callAI(`Explain the zoning basics of ${cityDoc.name} for a curious renter. Be playful but accurate.`, {
        schema: { properties: {
          summary: { type: "string", description: "2-3 sentence plain-language overview" },
          zones: { type: "array", items: { type: "object", properties: {
            name: { type: "string" }, allows: { type: "string" }, vibe: { type: "string" }
          }}}
        }}
      })
      const parsed = JSON.parse(resp)
      await database.put({
        type: "city", name: cityDoc.name, summary: parsed.summary, zones: parsed.zones,
        createdAt: Date.now(), createdBy: viewer?.userSlug || "anon"
      })
      resetCity()
    } finally { setExploreLoading(false) }
  }

  async function suggestCity() {
    setSuggestLoading(true)
    try {
      const resp = await callAI("Suggest one interesting US city for someone learning about zoning. Just the name.", {
        schema: { properties: { city: { type: "string" } } }
      })
      mergeCity({ name: JSON.parse(resp).city })
    } finally { setSuggestLoading(false) }
  }

  const { doc: tipDoc, merge: mergeTip, submit: submitTipForm } = useDocument({
    type: "tip", title: "", when: "", createdAt: 0,
    authorUserSlug: "", authorDisplayName: "", authorAvatarUrl: ""
  })
  const { docs: tips } = useLiveQuery("type", { key: "tip", descending: true })

  async function submitTip(e) {
    e.preventDefault()
    if (!tipDoc.title.trim() || !tipDoc.when.trim()) return
    await database.put({
      type: "tip", title: tipDoc.title, when: tipDoc.when, createdAt: Date.now(),
      authorUserSlug: viewer?.userSlug || "anon",
      authorDisplayName: viewer?.displayName || viewer?.userSlug || "Anonymous",
      authorAvatarUrl: viewer?.avatarUrl || ""
    })
    mergeTip({ title: "", when: "" })
  }

  const { docs: sims } = useLiveQuery("type", { key: "simulation", descending: true, limit: 10 })
  const [simLoading, setSimLoading] = React.useState(null)

  async function simulate(policy, concept) {
    setSimLoading(policy)
    try {
      const resp = await callAI(`Simulate the policy change "${policy}" in a typical US city. Concept: ${concept}.`, {
        schema: { properties: {
          before: { type: "string", description: "What things look like today, 1-2 sentences" },
          after: { type: "string", description: "What would change, 1-2 sentences" }
        }}
      })
      const parsed = JSON.parse(resp)
      await database.put({
        type: "simulation", policy, concept, before: parsed.before, after: parsed.after,
        createdAt: Date.now(), createdBy: viewer?.userSlug || "anon"
      })
    } finally { setSimLoading(null) }
  }

  const Spinner = () => (
    <svg className="animate-spin h-5 w-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" strokeLinecap="round" />
    </svg>
  )

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1947] to-[#1a0f30] text-white font-['Nunito',sans-serif]",
    header: "sticky top-0 z-10 bg-[#2a1947]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight font-['Fredoka',sans-serif]",
    tag: "text-xs text-white/60",
    main: "px-4 py-5 pb-24 max-w-2xl mx-auto space-y-5",
    section: "bg-[#4a2d8a]/40 border border-white/10 rounded-2xl p-4 shadow-lg",
    sectionTitle: "text-lg font-bold mb-3 font-['Fredoka',sans-serif]",
    input: "w-full bg-[#1a0f30]/60 border border-white/15 rounded-xl px-4 py-3 min-h-[44px] placeholder-white/40 text-white focus:outline-none focus:border-[#b89bff]",
    btn: "w-full min-h-[44px] px-4 py-3 rounded-xl bg-[#7c5cd6] hover:bg-[#8d6fe0] active:bg-[#6b4cc4] font-semibold transition disabled:opacity-50",
    btnGhost: "px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm",
    chip: "inline-block text-xs px-2 py-1 rounded-full bg-[#f4d35e]/20 text-[#f4d35e] border border-[#f4d35e]/30",
    row: "bg-[#1a0f30]/40 border border-white/10 rounded-xl p-3",
    avatar: "w-8 h-8 rounded-full border border-white/20",
    empty: "text-sm text-white/50 italic",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Zonecurious</h1>
          <p className={c.tag}>What does your city actually allow?</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>

      <main id="app" className={c.main}>
        <section id="explore-city" className={c.section}>
          <h2 className={c.sectionTitle}>Explore a city</h2>
          <p className="text-sm text-white/70 mb-3">Type a city or address. We'll explain its zoning basics in plain language.</p>
          {can("write") ? (
            <form onSubmit={exploreCity} className="space-y-2 mb-4">
              <input
                className={c.input}
                placeholder="e.g. Minneapolis, MN"
                value={cityDoc.name}
                onChange={(e) => mergeCity({ name: e.target.value })}
                disabled={exploreLoading}
              />
              <div className="flex gap-2">
                <button type="button" onClick={suggestCity} disabled={suggestLoading} className={c.btnGhost}>
                  {suggestLoading ? <Spinner /> : "Suggest one"}
                </button>
                <button type="submit" disabled={exploreLoading} className={c.btn + " flex-1"}>
                  {exploreLoading ? <><Spinner /> Exploring...</> : "Explore"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-white/60 italic mb-4">Read-only view — contact the owner for write access to add cities.</p>
          )}
          <h3 className="text-sm font-semibold text-white/80 mb-2">Recently explored</h3>
          {cities.length === 0 ? (
            <p className={c.empty}>No cities yet. Add one above.</p>
          ) : (
            <ul className="space-y-2">
              {cities.map(city => (
                <li key={city._id} className={c.row}>
                  <button onClick={() => setSelectedCity(selectedCity === city._id ? null : city._id)} className="text-left w-full">
                    <div className="font-semibold">{city.name}</div>
                    <div className="text-xs text-white/60">{selectedCity === city._id ? "Hide" : "Tap to see zoning summary"}</div>
                  </button>
                  {selectedCity === city._id && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-white/80">{city.summary}</p>
                      <div className="space-y-1">
                        {(city.zones || []).map((z, i) => (
                          <div key={i} className="bg-white/5 rounded-lg p-2">
                            <span className={c.chip}>{z.name}</span>
                            <p className="mt-1 text-white/70 text-xs">{z.allows}</p>
                            <p className="text-white/50 text-xs italic">{z.vibe}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="hypotheticals" className={c.section}>
          <h2 className={c.sectionTitle}>What if?</h2>
          <p className="text-sm text-white/70 mb-3">Flip a policy switch and see the simulated before/after.</p>
          {can("write") ? (
            <div className="space-y-2 mb-4">
              {[
                { label: "Allow duplexes in single-family zones", concept: "Missing middle housing" },
                { label: "Eliminate parking minimums near transit", concept: "Smart growth" },
                { label: "Legalize corner stores in residential zones", concept: "Mixed-use" },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={simLoading === p.label}
                  onClick={() => simulate(p.label, p.concept)}
                  className={c.row + " w-full text-left hover:bg-white/5 disabled:opacity-50"}
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {simLoading === p.label && <Spinner />}
                    {p.label}
                  </div>
                  <div className="text-xs text-white/60">{p.concept}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/60 italic mb-4">Read-only — sign in with write access to run simulations.</p>
          )}
          <h3 className="text-sm font-semibold text-white/80 mb-2">Recent simulations</h3>
          {sims.length === 0 ? (
            <p className={c.empty}>No simulations yet.</p>
          ) : (
            <ul className="space-y-2">
              {sims.map(s => (
                <li key={s._id} className={c.row}>
                  <div className="font-semibold text-sm mb-1">{s.policy}</div>
                  <span className={c.chip}>{s.concept}</span>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
                    <div className="bg-white/5 rounded p-2">
                      <div className="text-white/50 uppercase tracking-wide">Before</div>
                      <div>{s.before}</div>
                    </div>
                    <div className="bg-[#7ed957]/10 border border-[#7ed957]/20 rounded p-2">
                      <div className="text-[#7ed957] uppercase tracking-wide">After</div>
                      <div>{s.after}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="engagement" className={c.section}>
          <h2 className={c.sectionTitle}>Get involved</h2>
          <p className="text-sm text-white/70 mb-3">Hearings, comment periods, and workshops your neighbors flagged.</p>
          {can("write") ? (
            <form onSubmit={submitTip} className="space-y-2 mb-4">
              <input
                className={c.input}
                placeholder="Event title (e.g. Planning Commission Hearing)"
                value={tipDoc.title}
                onChange={(e) => mergeTip({ title: e.target.value })}
              />
              <input
                className={c.input}
                placeholder="When & where"
                value={tipDoc.when}
                onChange={(e) => mergeTip({ when: e.target.value })}
              />
              <button type="submit" className={c.btn}>Add tip</button>
            </form>
          ) : (
            <p className="text-sm text-white/60 italic mb-4">Read-only — write access needed to share tips.</p>
          )}
          {tips.length === 0 ? (
            <p className={c.empty}>No tips yet. Share one!</p>
          ) : (
            <ul className="space-y-2">
              {tips.map(t => (
                <li key={t._id} className={c.row}>
                  <div className="flex items-start gap-2">
                    {t.authorAvatarUrl && <img src={t.authorAvatarUrl} alt={t.authorUserSlug} className="w-6 h-6 rounded-full border border-white/20 mt-0.5" />}
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{t.title}</div>
                      <div className="text-xs text-white/60">{t.when}</div>
                      {t.authorDisplayName && <div className="text-xs text-white/40 mt-1">shared by {t.authorDisplayName}</div>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}