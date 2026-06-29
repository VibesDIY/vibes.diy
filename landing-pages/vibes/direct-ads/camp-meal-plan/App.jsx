const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ShoppingList({ database, useDocument, canWrite, classes }) {
  const { doc, merge } = useDocument({ _id: "shopping-list", text: "" })
  if (!canWrite) {
    return (
      _jsxDEV('pre', { className: `${classes.input} min-h-[180px] whitespace-pre-wrap font-mono text-[0.9rem]`, children: doc.text || "(empty)"}, void 0, false, {fileName: _jsxFileName, lineNumber: 10}, this)
    )
  }
  return (
    _jsxDEV('textarea', {
      className: `${classes.input} min-h-[180px] resize-y font-mono text-[0.9rem]`,
      placeholder: "oats\ncoffee\ntrail mix\n..." ,
      value: doc.text || "",
      onChange: e => {
        merge({ text: e.target.value })
        database.put({ ...doc, _id: "shopping-list", text: e.target.value })
      },}, void 0, false, {fileName: _jsxFileName, lineNumber: 14}, this
    )
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("trail-table")
  const { doc: settings, merge: mergeSettings } = useDocument({ _id: "trip-settings", days: 3 })
  const days = settings.days || 3

  function handleStub(e) { if (_optionalChain([e, 'optionalAccess', _2 => _2.preventDefault])) e.preventDefault() }

  function setDays(n) {
    if (!can("write")) return
    mergeSettings({ days: n })
    database.put({ ...settings, _id: "trip-settings", days: n })
  }

  const { docs: mealDocs } = useLiveQuery("type", { key: "meal" })
  const meals = {}
  for (const m of mealDocs) meals[`${m.day}-${m.slot}`] = m

  const [editing, setEditing] = React.useState(null) // "day-slot"
  const [draftName, setDraftName] = React.useState("")
  const [draftCook, setDraftCook] = React.useState("")
  const [suggesting, setSuggesting] = React.useState(null)

  function startEdit(day, slot) {
    if (!can("write")) return
    const k = `${day}-${slot}`
    const existing = meals[k]
    setEditing(k)
    setDraftName(_optionalChain([existing, 'optionalAccess', _3 => _3.name]) || "")
    setDraftCook(_optionalChain([existing, 'optionalAccess', _4 => _4.cook]) || "")
  }

  async function saveEdit(day, slot) {
    const k = `${day}-${slot}`
    const existing = meals[k]
    const doc = { ...(existing || {}), _id: _optionalChain([existing, 'optionalAccess', _5 => _5._id]) || `meal-${k}`, type: "meal", day, slot, name: draftName.trim() }
    if (slot === "dinner") doc.cook = draftCook.trim()
    await database.put(doc)
    setEditing(null)
  }

  async function suggestMeal(day, slot) {
    if (!can("write")) return
    setSuggesting(`${day}-${slot}`)
    try {
      const knownCooks = [...new Set(mealDocs.filter(m => m.cook).map(m => m.cook))]
      const prompt = `Suggest one camping-friendly ${slot} meal name (short, 2-5 words).${slot === "dinner" && knownCooks.length ? ` Also pick a cook from this list: ${knownCooks.join(", ")}.` : ""}`
      const schema = { properties: { name: { type: "string" }, ...(slot === "dinner" ? { cook: { type: "string" } } : {}) } }
      const res = JSON.parse(await callAI(prompt, { schema }))
      const doc = { _id: `meal-${day}-${slot}`, type: "meal", day, slot, name: res.name }
      if (slot === "dinner" && res.cook) doc.cook = res.cook
      const existing = meals[`${day}-${slot}`]
      if (existing) doc._rev = existing._rev
      await database.put(doc)
    } finally {
      setSuggesting(null)
    }
  }

  const c = {
    page: "min-h-screen text-white font-['Nunito',sans-serif] pb-12",
    hero: "relative flex flex-col items-center justify-center text-center px-6 min-h-[60vh]",
    heroOverlay: "absolute inset-0 bg-gradient-to-b from-[#1a1230]/30 via-[#1a1230]/50 to-[#1a1230]/90",
    heroContent: "relative z-10 max-w-2xl",
    heroTitle: "font-['Fredoka',sans-serif] text-white leading-[1.1] font-bold drop-shadow-lg",
    heroSub: "text-white/80 mt-4 max-w-[500px] mx-auto leading-relaxed drop-shadow-md",
    main: "px-4 py-5 space-y-6 max-w-6xl mx-auto",
    section: "bg-[#3a2560]/40 border border-white/10 rounded-2xl p-5 shadow-lg",
    sectionTitle: "text-[1.4rem] font-bold mb-3 font-['Fredoka',sans-serif] text-[#f5d76e]",
    btn: "min-h-[44px] px-6 py-3 rounded-xl bg-[#5a3a8a] hover:bg-[#6b48a0] active:bg-[#4a2f75] text-white font-bold text-[1rem] transition",
    btnSmall: "min-h-[44px] px-4 py-2 rounded-lg bg-[#5a3a8a]/80 hover:bg-[#6b48a0] text-[0.9rem] text-white font-semibold transition",
    input: "w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#1a1230] border border-white/15 text-white text-[1rem] placeholder-white/40 focus:outline-none focus:border-[#f5d76e]",
    slot: "bg-[#1a1230]/60 border border-white/10 rounded-xl p-4 min-h-[88px] flex flex-col gap-1 cursor-pointer hover:border-[#f5d76e]/40 transition",
    slotLabel: "text-[0.75rem] uppercase tracking-wider text-[#9ee8b8] font-bold",
    avatar: "w-8 h-8 rounded-full border border-white/20",
  }

  return (
    _jsxDEV('div', { className: c.page, style: { background: "#1a1230" }, children: [
      _jsxDEV('link', { href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@400;700;800&display=optional", rel: "stylesheet",}, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this )
      , _jsxDEV('div', { id: "app-header", className: c.hero, style: { minHeight: '60vh', background: "url('https://images.unsplash.com/photo-1466220549276-aef9ce186540?w=1920&q=80&fit=crop') center/cover no-repeat" }, children: [
        _jsxDEV('div', { className: c.heroOverlay }, void 0, false, {fileName: _jsxFileName, lineNumber: 105}, this)
        , _jsxDEV('div', { className: c.heroContent, children: [
          _jsxDEV('h1', { className: c.heroTitle, style: { fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Every great trip starts at the table." }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
          , _jsxDEV('p', { className: c.heroSub, style: { fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Plan meals for every day of camp — who's cooking, what's on." }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
        , viewer && _jsxDEV('img', { src: viewer.avatarUrl, alt: viewer.userSlug, className: c.avatar + " absolute top-4 right-4 z-10",}, void 0, false, {fileName: _jsxFileName, lineNumber: 110}, this )
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@mylestan?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Myles Tan" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 104}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "trip-settings", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Trip Length" }, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
          , can("write") ? (
            _jsxDEV('div', { className: "flex items-center gap-2 flex-wrap"   , children: [
              _jsxDEV('span', { className: "text-[1rem] text-white/70 mr-2"  , children: "Days:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 116}, this)
              , [2,3,4,5,6,7].map(n => (
                _jsxDEV('button', {

                  className: `${c.btnSmall} ${days === n ? "ring-2 ring-[#f5d76e]" : ""}`,
                  onClick: () => setDays(n),
 children: n}, n, false, {fileName: _jsxFileName, lineNumber: 118}, this)
              ))
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
          ) : (
            _jsxDEV('p', { className: "text-[0.9rem] text-white/70" , children: "Read-only view — contact the trip owner for write access."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
          )
          , _jsxDEV('p', { className: "text-[0.85rem] text-white/50 mt-3"  , children: ["Currently planning a "   , days, "-day trip." ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 128}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 112}, this)

        , _jsxDEV('section', { id: "meal-grid", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Meal Plan" }, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this)
          , _jsxDEV('div', { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"    , children: 
            Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              return (
                _jsxDEV('div', { className: "space-y-2", children: [
                  _jsxDEV('h3', { className: "font-['Fredoka',sans-serif] font-bold text-[1.15rem] text-white/90"  , children: ["Day " , day]}, void 0, true, {fileName: _jsxFileName, lineNumber: 138}, this)
                  , ["breakfast","lunch","dinner"].map(slot => {
                    const k = `${day}-${slot}`
                    const meal = meals[k]
                    const isEditing = editing === k
                    const isSuggesting = suggesting === k
                    return (
                      _jsxDEV('div', { className: c.slot, onClick: () => !isEditing && startEdit(day, slot), children: [
                        _jsxDEV('span', { className: c.slotLabel, children: slot}, void 0, false, {fileName: _jsxFileName, lineNumber: 146}, this)
                        , isEditing && can("write") ? (
                          _jsxDEV('div', { className: "space-y-1", onClick: e => e.stopPropagation(), children: [
                            _jsxDEV('input', {
                              className: c.input,
                              value: draftName,
                              onChange: e => setDraftName(e.target.value),
                              placeholder: "meal name" ,
                              autoFocus: true,}, void 0, false, {fileName: _jsxFileName, lineNumber: 149}, this
                            )
                            , slot === "dinner" && (
                              _jsxDEV('input', {
                                className: c.input,
                                value: draftCook,
                                onChange: e => setDraftCook(e.target.value),
                                placeholder: "cook",}, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this
                              )
                            )
                            , _jsxDEV('div', { className: "flex gap-2" , children: [
                              _jsxDEV('button', { className: c.btnSmall, onClick: () => saveEdit(day, slot), children: "Save"}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this)
                              , _jsxDEV('button', { className: c.btnSmall, onClick: () => setEditing(null), children: "Cancel"}, void 0, false, {fileName: _jsxFileName, lineNumber: 166}, this)
                            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 164}, this)
                          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 148}, this)
                        ) : (
                          _jsxDEV(_Fragment, { children: [
                            _jsxDEV('span', { className: _optionalChain([meal, 'optionalAccess', _6 => _6.name]) ? "text-white text-[1rem] font-medium" : "text-white/50 text-[0.9rem] italic", children: 
                              _optionalChain([meal, 'optionalAccess', _7 => _7.name]) || (can("write") ? "tap to add" : "—")
                            }, void 0, false, {fileName: _jsxFileName, lineNumber: 171}, this)
                            , slot === "dinner" && _jsxDEV('span', { className: "text-[0.85rem] text-white/60" , children: ["cook: " , _optionalChain([meal, 'optionalAccess', _8 => _8.cook]) || "—"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 174}, this)
                            , can("write") && !_optionalChain([meal, 'optionalAccess', _9 => _9.name]) && (
                              _jsxDEV('button', {
                                className: "text-[0.85rem] text-[#f5d76e] mt-1 self-start flex items-center gap-1 disabled:opacity-50"       ,
                                disabled: isSuggesting,
                                onClick: e => { e.stopPropagation(); suggestMeal(day, slot) },
 children: 
                                isSuggesting ? (
                                  _jsxDEV(_Fragment, { children: [
                                    _jsxDEV('svg', { className: "animate-spin w-3 h-3"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "3", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this), "suggesting..."

                                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 182}, this)
                                ) : "✨ suggest"
                              }, void 0, false, {fileName: _jsxFileName, lineNumber: 176}, this)
                            )
                          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 170}, this)
                        )
                      ]}, slot, true, {fileName: _jsxFileName, lineNumber: 145}, this)
                    )
                  })
                ]}, day, true, {fileName: _jsxFileName, lineNumber: 137}, this)
              )
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 133}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)

        , _jsxDEV('section', { id: "shopping-list", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Shopping List" }, void 0, false, {fileName: _jsxFileName, lineNumber: 201}, this)
          , _jsxDEV(ShoppingList, { database: database, useDocument: useDocument, canWrite: can("write"), classes: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 202}, this )
          , _jsxDEV('p', { className: "text-[0.85rem] text-white/50 mt-2"  , children: "Shared with the whole trip — edits sync live."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 203}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 200}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
  )
}