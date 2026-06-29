const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CATEGORIES = ["Clothes", "Toys", "Tools", "Misc"]

function Roster({ c, useLiveQuery, database, can }) {
  const { docs } = useLiveQuery("type", { key: "signup", descending: true })
  const tables = docs.filter(d => d.spot === "Table").length
  const blankets = docs.filter(d => d.spot === "Blanket").length

  return (
    _jsxDEV(_Fragment, { children: [
      _jsxDEV('div', { className: "text-base text-[var(--muted)] mb-3"  , children: [
        docs.length, " " , docs.length === 1 ? "spot" : "spots", " · "  , tables, " table" , tables !== 1 ? "s" : "", " · "  , blankets, " blanket" , blankets !== 1 ? "s" : ""
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 15}, this)
      , _jsxDEV('ul', { children: 
        docs.length === 0 ? (
          _jsxDEV('li', { className: c.row, children: [
            _jsxDEV('div', { className: "font-semibold", children: "No one yet"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 21}, this)
            , _jsxDEV('div', { className: "text-base text-[var(--muted)]" , children: "Be the first to claim a spot."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 22}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 20}, this)
        ) : docs.map(d => (
          _jsxDEV('li', { className: c.row, children: 
            _jsxDEV('div', { className: "flex justify-between items-start gap-2"   , children: [
              _jsxDEV('div', { className: "flex-1", children: [
                _jsxDEV('div', { className: "font-semibold text-base", children: [d.name, " " , _jsxDEV('span', { className: "text-[0.85rem] text-[var(--muted)] font-normal"  , children: ["· " , d.spot]}, void 0, true, {fileName: _jsxFileName, lineNumber: 28}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 28}, this)
                , _jsxDEV('div', { className: "mt-1", children: 
                  (d.cats || []).map(cat => _jsxDEV('span', { className: c.pill, children: cat}, cat, false, {fileName: _jsxFileName, lineNumber: 30}, this))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 29}, this)
                , d.needsChange && _jsxDEV('div', { className: "text-[0.85rem] text-[var(--muted)] mt-1 italic"   , children: "needs change" }, void 0, false, {fileName: _jsxFileName, lineNumber: 32}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 27}, this)
              , can("write") && (
                _jsxDEV('button', { onClick: () => database.del(d._id), className: "text-[0.85rem] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)]"    , children: "Remove"}, void 0, false, {fileName: _jsxFileName, lineNumber: 35}, this)
              )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 26}, this)
          }, d._id, false, {fileName: _jsxFileName, lineNumber: 25}, this)
        ))
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 18}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 14}, this)
  )
}

function SignupForm({ c, database }) {
  const [name, setName] = React.useState("")
  const [spot, setSpot] = React.useState("Table")
  const [cats, setCats] = React.useState([])
  const [needsChange, setNeedsChange] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState([])
  const [loadingSug, setLoadingSug] = React.useState(false)

  const toggleCat = (cat) => setCats((cs) => cs.includes(cat) ? cs.filter(x => x !== cat) : [...cs, cat])

  async function suggest() {
    setLoadingSug(true)
    try {
      const res = await callAI(`A neighbor is selling these categories at a garage sale: ${cats.join(", ") || "nothing yet"}. Suggest 4 complementary item types they might also bring.`, {
        schema: { properties: { items: { type: "array", items: { type: "string" } } } }
      })
      setSuggestions(JSON.parse(res).items || [])
    } finally { setLoadingSug(false) }
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    await database.put({ type: "signup", name: name.trim(), spot, cats, needsChange, createdAt: Date.now() })
    setName(""); setCats([]); setNeedsChange(false); setSuggestions([])
  }

  return (
    _jsxDEV('form', { className: "space-y-4", onSubmit: submit, children: [
      _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "Your name" }, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
        , _jsxDEV('input', { className: c.input, value: name, onChange: (e) => setName(e.target.value), placeholder: "Jane from #12"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 76}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
      , _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "Spot type" }, void 0, false, {fileName: _jsxFileName, lineNumber: 79}, this)
        , _jsxDEV('div', { className: "flex gap-2" , children: 
          ["Table", "Blanket"].map(s => (
            _jsxDEV('button', { type: "button", onClick: () => setSpot(s),
              className: c.btnGhost + (spot === s ? " bg-[var(--ink)] text-[var(--paper)]" : ""), children: s}, s, false, {fileName: _jsxFileName, lineNumber: 82}, this)
          ))
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 78}, this)
      , _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "What you're selling"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this)
        , _jsxDEV('div', { className: "flex flex-wrap" , children: 
          CATEGORIES.map(cat => (
            _jsxDEV('button', { type: "button", onClick: () => toggleCat(cat),
              className: c.pill + " cursor-pointer " + (cats.includes(cat) ? "bg-[var(--ink)] text-[var(--paper)]" : ""), children: cat}, cat, false, {fileName: _jsxFileName, lineNumber: 91}, this)
          ))
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this)
        , suggestions.length > 0 && (
          _jsxDEV('div', { className: "mt-2 text-base text-[var(--muted)]"  , children: ["Also consider: "  , suggestions.join(", ")]}, void 0, true, {fileName: _jsxFileName, lineNumber: 96}, this)
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
      , _jsxDEV('label', { className: "flex items-center gap-2 text-base"   , children: [
        _jsxDEV('input', { type: "checkbox", checked: needsChange, onChange: (e) => setNeedsChange(e.target.checked),}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this ), " I'll need change ($1s & $5s)"
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 99}, this)
      , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
        _jsxDEV('button', { type: "submit", className: c.btn, children: "Claim my spot"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this)
        , _jsxDEV('button', { type: "button", onClick: suggest, disabled: loadingSug, className: c.btnGhost, children: 
          loadingSug ? (
            _jsxDEV('svg', { className: "animate-spin inline" , width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 106}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 106}, this)
          ) : "What else are you selling?"
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 73}, this)
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("block-sale-board")
  const saleDoc = useDocument({ _id: "sale-details", neighborhood: "", date: "", address: "" })
  const sale = saleDoc.doc
  const [editingSale, setEditingSale] = React.useState(false)

  const c = {
    page: "min-h-screen bg-[var(--bg)] text-[var(--ink)] font-[Helvetica_Neue,Helvetica,Arial,sans-serif]",
    header: "border-b-4 border-double border-[var(--ink)] px-4 py-6 bg-[var(--paper)]",
    eyebrow: "text-sm uppercase tracking-[0.3em] text-[var(--muted)]",
    title: "text-4xl md:text-5xl font-bold tracking-tight mt-1",
    tagline: "italic text-[var(--muted)] mt-2 text-base",
    main: "max-w-3xl mx-auto px-5 py-6 space-y-8",
    section: "border border-[var(--rule)] bg-[var(--paper)] p-6",
    h2: "text-[1.4rem] font-bold uppercase tracking-wider border-b border-[var(--rule)] pb-2 mb-4",
    btn: "min-h-[44px] px-6 py-3 bg-[var(--ink)] text-[var(--paper)] font-semibold uppercase tracking-wide text-base hover:opacity-80 disabled:opacity-50",
    btnGhost: "min-h-[44px] px-6 py-3 border border-[var(--ink)] text-[var(--ink)] text-base uppercase tracking-wide hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50",
    input: "w-full min-h-[44px] px-3 py-2 bg-[var(--bg)] border border-[var(--rule)] text-base text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]",
    label: "block text-[0.85rem] uppercase tracking-wider text-[var(--muted)] mb-1",
    row: "border-b border-[var(--rule)] py-3 last:border-0",
    pill: "inline-block px-3 py-1 text-[0.85rem] border border-[var(--rule)] mr-1 mb-1",
  }

  return (
    _jsxDEV(_Fragment, { children: [
      _jsxDEV('style', { children: `
        :root {
          --bg: #f5f2ea;
          --paper: #ffffff;
          --ink: #111111;
          --muted: #6b6b6b;
          --rule: #cfc8b8;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #0e0e0e;
            --paper: #161616;
            --ink: #f1ede2;
            --muted: #9a9a9a;
            --rule: #3a3a3a;
          }
        }
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this)
      , _jsxDEV('div', { className: c.page, children: [
        _jsxDEV(‘header’, { id: "app-header", className: c.header, style: {
            position: "relative",
            background: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.6)), url(‘https://images.unsplash.com/photo-1563018172-de687e951983?w=1920&q=80&fit=crop’) center/cover",
            color: "white", padding: "0", minHeight: "60vh", display: "flex", alignItems: "flex-end"
          }, children: [
          _jsxDEV(‘div’, { className: "max-w-3xl mx-auto w-full" , style: { padding: "3rem 1.5rem" }, children: [
            _jsxDEV(‘div’, { className: c.eyebrow, style: { color: "rgba(255,255,255,0.8)" }, children: "The Neighborhood Edition"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
            , _jsxDEV(‘h1’, { style: { color: "white", fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: "900", lineHeight: "1.05", letterSpacing: "-0.02em", marginTop: "0.5rem", fontFamily: "Georgia, ‘Times New Roman’, serif", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }, children: "One link. Everyone’s in."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this)
            , _jsxDEV(‘p’, { style: { color: "rgba(255,255,255,0.8)", fontSize: "clamp(1rem, 2.5vw, 1.3rem)", marginTop: "1rem", maxWidth: "500px", lineHeight: "1.5" }, children: "Your neighborhood’s Saturday sale — sign up, claim a spot, show up."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 160}, this)
          , _jsxDEV(‘div’, { style: {
            position: ‘absolute’, bottom: ‘0.75rem’, right: ‘1rem’,
            fontSize: ‘0.7rem’, color: ‘rgba(255,255,255,0.5)’,
            textShadow: ‘0 1px 3px rgba(0,0,0,0.5)’
          }, children: [
            "Photo by ", _jsxDEV(‘a’, { href: "https://unsplash.com/@simone_pellegrini?utm_source=vibes_diy&utm_medium=referral",
              style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ },
              target: "_blank", rel: "noopener noreferrer", children: "Simone Pellegrini"}, void 0, false, {fileName: _jsxFileName}, this),
            " on ", _jsxDEV(‘a’, { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
              style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ },
              target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
          ]}, void 0, true, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)

        , _jsxDEV('main', { id: "app", className: c.main, children: [
          _jsxDEV('section', { id: "sale-header", className: c.section, children: [
            _jsxDEV('h2', { className: c.h2, children: "Sale Details" }, void 0, false, {fileName: _jsxFileName, lineNumber: 169}, this)
            , editingSale && can("write") ? (
              _jsxDEV('form', { onSubmit: (e) => { e.preventDefault(); saleDoc.save(); setEditingSale(false) }, className: "space-y-3", children: [
                _jsxDEV('div', { children: [
                  _jsxDEV('label', { className: c.label, children: "Neighborhood"}, void 0, false, {fileName: _jsxFileName, lineNumber: 173}, this)
                  , _jsxDEV('input', { className: c.input, value: sale.neighborhood, onChange: (e) => saleDoc.merge({ neighborhood: e.target.value }), placeholder: "Maple Heights" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this )
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 172}, this)
                , _jsxDEV('div', { children: [
                  _jsxDEV('label', { className: c.label, children: "Date"}, void 0, false, {fileName: _jsxFileName, lineNumber: 177}, this)
                  , _jsxDEV('input', { className: c.input, value: sale.date, onChange: (e) => saleDoc.merge({ date: e.target.value }), placeholder: "Sat, Oct 18 · 8a–2p"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 178}, this )
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 176}, this)
                , _jsxDEV('div', { children: [
                  _jsxDEV('label', { className: c.label, children: "Meet at" }, void 0, false, {fileName: _jsxFileName, lineNumber: 181}, this)
                  , _jsxDEV('input', { className: c.input, value: sale.address, onChange: (e) => saleDoc.merge({ address: e.target.value }), placeholder: "412 Elm Street"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this )
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 180}, this)
                , _jsxDEV('button', { type: "submit", className: c.btn, children: "Save"}, void 0, false, {fileName: _jsxFileName, lineNumber: 184}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 171}, this)
            ) : (
              _jsxDEV(_Fragment, { children: [
                _jsxDEV('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4"   , children: [
                  _jsxDEV('div', { children: [_jsxDEV('div', { className: c.label, children: "Neighborhood"}, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this), _jsxDEV('div', { className: "text-lg font-semibold" , children: sale.neighborhood || "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 189}, this)
                  , _jsxDEV('div', { children: [_jsxDEV('div', { className: c.label, children: "Date"}, void 0, false, {fileName: _jsxFileName, lineNumber: 190}, this), _jsxDEV('div', { className: "text-lg font-semibold" , children: sale.date || "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 190}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 190}, this)
                  , _jsxDEV('div', { children: [_jsxDEV('div', { className: c.label, children: "Meet at" }, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this), _jsxDEV('div', { className: "text-lg font-semibold" , children: sale.address || "—"}, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 191}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 188}, this)
                , can("write") && (
                  _jsxDEV('div', { className: "mt-4", children: 
                    _jsxDEV('button', { className: c.btnGhost, onClick: () => setEditingSale(true), children: "Edit details" }, void 0, false, {fileName: _jsxFileName, lineNumber: 195}, this)
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 194}, this)
                )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 187}, this)
            )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 168}, this)

          , _jsxDEV('section', { id: "signup-form", className: c.section, children: [
            _jsxDEV('h2', { className: c.h2, children: "Sign Up Your Spot"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 203}, this)
            , _jsxDEV(SignupForm, { c: c, database: database,}, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 202}, this)

          , _jsxDEV('section', { id: "roster", className: c.section, children: [
            _jsxDEV('h2', { className: c.h2, children: "The Roster" }, void 0, false, {fileName: _jsxFileName, lineNumber: 212}, this)
            , _jsxDEV(Roster, { c: c, useLiveQuery: useLiveQuery, database: database, can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 213}, this )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 211}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 158}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
  )
}