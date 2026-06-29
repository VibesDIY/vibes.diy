const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CATEGORIES = ["Shelter", "Kitchen", "Safety", "Navigation", "Personal"]

export default function App() {
  const { viewer, can } = useViewer()
  const { useLiveQuery, useDocument, database } = useFireproof("trailhead-tally")
  const { docs: items } = useLiveQuery("type", { key: "gear" })
  const { doc: draft, merge, submit } = useDocument({
    type: "gear", name: "", category: "Shelter", weight: "medium", claimedBy: null, createdAt: Date.now()
  })
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const existing = items.map((i) => i.name).join(", ") || "none yet"
      const res = await callAI(
        `Suggest one common camping gear item not in this list: ${existing}. Choose category from: ${CATEGORIES.join(", ")}. Weight is light, medium, or heavy.`,
        { schema: { properties: { name: { type: "string" }, category: { type: "string" }, weight: { type: "string" } } } }
      )
      const s = JSON.parse(res)
      merge({ name: s.name || "", category: CATEGORIES.includes(s.category) ? s.category : "Shelter", weight: ["light","medium","heavy"].includes(s.weight) ? s.weight : "medium" })
    } finally {
      setIsSuggesting(false)
    }
  }

  function handleClaim(item) {
    const name = prompt("Your name (who's carrying this)?")
    if (!name || !name.trim()) return
    database.put({ ...item, claimedBy: name.trim() })
  }
  function handleUnclaim(item) {
    database.put({ ...item, claimedBy: null })
  }

  const weightClass = (w) => w === "light" ? c.weightLight : w === "heavy" ? c.weightHeavy : c.weightMedium

  const c = {
    page: "min-h-screen text-white font-['Nunito',sans-serif] pb-32",
    hero: "relative flex flex-col items-center justify-center text-center px-6 min-h-[60vh]",
    heroOverlay: "absolute inset-0 bg-gradient-to-b from-[#2a1a4a]/30 via-[#2a1a4a]/50 to-[#1a0f33]/90",
    heroContent: "relative z-10 max-w-2xl",
    heroTitle: "font-['Fredoka',sans-serif] text-white leading-[1.1] font-bold drop-shadow-lg",
    heroSub: "text-white/80 mt-4 max-w-[500px] mx-auto leading-relaxed drop-shadow-md",
    avatar: "w-9 h-9 rounded-full border-2 border-[#c9a96e]",
    main: "px-4 py-5 space-y-5 max-w-2xl mx-auto",
    section: "bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg",
    sectionHead: "flex items-center justify-between mb-3",
    sectionTitle: "text-[1.4rem] font-bold",
    countBadge: "text-[0.85rem] bg-[#c9a96e] text-[#2a1a4a] px-3 py-1 rounded-full font-bold",
    row: "flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0",
    itemName: "font-semibold flex-1 text-[1rem]",
    weightBadge: "text-[0.75rem] uppercase tracking-wider px-2 py-1 rounded-full font-bold",
    weightLight: "bg-[#7dd3a8] text-[#1a3a2a]",
    weightMedium: "bg-[#e8c987] text-[#3a2a1a]",
    weightHeavy: "bg-[#e07b6a] text-[#3a1a1a]",
    claimBtn: "min-h-[44px] px-4 py-2 bg-[#5a3a8a] hover:bg-[#6a4a9a] text-white text-[1rem] font-bold rounded-lg",
    claimedTag: "text-[0.85rem] text-[#7dd3a8] italic",
    input: "w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white text-[1rem] placeholder-white/40 min-h-[44px]",
    select: "w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white text-[1rem] min-h-[44px]",
    primaryBtn: "min-h-[44px] px-6 py-3 bg-[#c9a96e] hover:bg-[#d9b97e] text-[#2a1a4a] font-bold text-[1rem] rounded-lg flex-1",
    suggestBtn: "min-h-[44px] px-4 py-3 bg-[#5a3a8a] hover:bg-[#6a4a9a] text-white text-[1rem] font-bold rounded-lg flex items-center gap-1",
    addBar: "fixed bottom-0 left-0 right-0 bg-[#1a0f33]/98 backdrop-blur border-t border-white/10 p-3",
    readOnly: "text-[0.85rem] text-white/50 italic text-center py-2",
  }

  return (
    _jsxDEV('div', { className: c.page, style: { background: "#1a0f33" }, children: [
      _jsxDEV('link', { href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@400;700;800&display=optional", rel: "stylesheet",}, void 0, false, {fileName: _jsxFileName, lineNumber: 72}, this )
      , _jsxDEV('div', { id: "app-header", className: c.hero, style: { minHeight: '60vh', background: "url('https://images.unsplash.com/photo-1537905569824-f89f14cceb68?w=1920&q=80&fit=crop') center/cover no-repeat" }, children: [
        _jsxDEV('div', { className: c.heroOverlay }, void 0, false, {fileName: _jsxFileName, lineNumber: 74}, this)
        , _jsxDEV('div', { className: c.heroContent, children: [
          _jsxDEV('h1', { className: c.heroTitle, style: { fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Don't forget the headlamp." }, void 0, false, {fileName: _jsxFileName, lineNumber: 76}, this)
          , _jsxDEV('p', { className: c.heroSub, style: { fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Pack list for the trip — check it off, share it with the crew." }, void 0, false, {fileName: _jsxFileName, lineNumber: 77}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 75}, this)
        , viewer && _jsxDEV('img', { src: viewer.avatarUrl, alt: viewer.userSlug, className: c.avatar + " absolute top-4 right-4 z-10",}, void 0, false, {fileName: _jsxFileName, lineNumber: 79}, this )
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@joshhild?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Josh Hild" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 73}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "gear-list", className: c.section, children: [
          _jsxDEV('div', { className: c.sectionHead, children: 
            _jsxDEV('h2', { className: c.sectionTitle, children: "Gear by Category"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 83}, this)
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this)
          , _jsxDEV('div', { className: "space-y-4", children: 
            CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              const unclaimed = catItems.filter((i) => !i.claimedBy).length
              return (
                _jsxDEV('div', { children: [
                  _jsxDEV('div', { className: "flex items-center justify-between mb-1"   , children: [
                    _jsxDEV('h3', { className: "font-bold text-[#c9a96e] text-[1.15rem]" , children: cat}, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
                    , _jsxDEV('span', { className: c.countBadge, children: [unclaimed, " unclaimed" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 91}, this)
                  , catItems.length === 0 ? (
                    _jsxDEV('div', { className: "text-[0.9rem] text-white/50 italic py-3"   , children: "No items yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this)
                  ) : (
                    _jsxDEV('ul', { children: 
                      catItems.map((item) => (
                        _jsxDEV('li', { className: c.row, children: [
                          _jsxDEV('span', { className: c.itemName, children: item.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 101}, this)
                          , _jsxDEV('span', { className: `${c.weightBadge} ${weightClass(item.weight)}`, children: item.weight}, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)
                          , item.claimedBy ? (
                            can("write") ? (
                              _jsxDEV('button', { onClick: () => handleUnclaim(item), className: c.claimedTag + " underline", children: [
                                item.claimedBy, " ✓"
                              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 105}, this)
                            ) : (
                              _jsxDEV('span', { className: c.claimedTag, children: [item.claimedBy, " ✓" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 109}, this)
                            )
                          ) : can("write") ? (
                            _jsxDEV('button', { onClick: () => handleClaim(item), className: c.claimBtn, children: "Claim"}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
                          ) : (
                            _jsxDEV('span', { className: "text-[0.85rem] text-white/40" , children: "unclaimed"}, void 0, false, {fileName: _jsxFileName, lineNumber: 114}, this)
                          )
                        ]}, item._id, true, {fileName: _jsxFileName, lineNumber: 100}, this)
                      ))
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this)
                  )
                ]}, cat, true, {fileName: _jsxFileName, lineNumber: 90}, this)
              )
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 85}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 81}, this)
        , _jsxDEV('section', { id: "add-item", className: c.section, children: [
          _jsxDEV('div', { className: c.sectionHead, children: 
            _jsxDEV('h2', { className: c.sectionTitle, children: "Add Gear" }, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
          , !can("write") ? (
            _jsxDEV('p', { className: c.readOnly, children: "Read-only view — contact the trip owner for write access."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 130}, this)
          ) : (
            _jsxDEV('form', { onSubmit: (e) => { e.preventDefault(); if (draft.name.trim()) submit() }, className: "space-y-3", children: [
              _jsxDEV('div', { className: "flex gap-2" , children: [
                _jsxDEV('input', {
                  type: "text",
                  placeholder: "Item name (e.g. headlamp)"   ,
                  value: draft.name,
                  onChange: (e) => merge({ name: e.target.value }),
                  className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 134}, this
                )
                , _jsxDEV('button', { type: "button", onClick: handleSuggest, disabled: isSuggesting, className: c.suggestBtn, children: 
                  isSuggesting ? (
                    _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: 
                      _jsxDEV('path', { d: "M21 12a9 9 0 1 1-6.2-8.5"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this )
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
                  ) : "Suggest"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 133}, this)
              , _jsxDEV('select', { value: draft.category, onChange: (e) => merge({ category: e.target.value }), className: c.select, children: 
                CATEGORIES.map((cat) => _jsxDEV('option', { value: cat, children: cat}, cat, false, {fileName: _jsxFileName, lineNumber: 150}, this))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 149}, this)
              , _jsxDEV('select', { value: draft.weight, onChange: (e) => merge({ weight: e.target.value }), className: c.select, children: [
                _jsxDEV('option', { value: "light", children: "Light"}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this)
                , _jsxDEV('option', { value: "medium", children: "Medium"}, void 0, false, {fileName: _jsxFileName, lineNumber: 154}, this)
                , _jsxDEV('option', { value: "heavy", children: "Heavy"}, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 152}, this)
              , _jsxDEV('button', { type: "submit", className: c.primaryBtn, children: "Add to pack"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 132}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 80}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 71}, this)
  )
}