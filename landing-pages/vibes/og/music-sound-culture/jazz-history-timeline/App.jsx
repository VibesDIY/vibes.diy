const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const DECADES = ["1920s", "1930s", "1940s", "1950s", "1960s", "1970s"]

function Annotations({ c, decade, database, useLiveQuery, useDocument }) {
  const { docs } = useLiveQuery("annotationDecade", { key: decade })
  const { doc, merge, submit } = useDocument({
    type: "annotation",
    annotationDecade: decade,
    text: "",
    authorSlug: "visitor",
    authorName: "visitor",
    authorAvatar: "",
    createdAt: Date.now(),
  })

  React.useEffect(() => { merge({ annotationDecade: decade }) }, [decade])

  return (
    _jsxDEV('section', { id: "annotations", className: c.section, children: [
      _jsxDEV('h2', { className: c.sectionTitle, children: ["Annotations · "  , decade]}, void 0, true, {fileName: _jsxFileName, lineNumber: 23}, this)
      , _jsxDEV('form', { onSubmit: (e) => { e.preventDefault(); if (doc.text.trim()) submit() }, className: "space-y-2", children: [
          _jsxDEV('input', { className: c.input, value: doc.text, onChange: (e) => merge({ text: e.target.value }), placeholder: "Add a note about this era..."     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 25}, this )
          , _jsxDEV('button', { type: "submit", className: c.btn, children: "Save Note" }, void 0, false, {fileName: _jsxFileName, lineNumber: 26}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 24}, this)
      , _jsxDEV('ul', { className: c.list + " mt-3", children: [
        docs.length === 0 && _jsxDEV('li', { className: c.muted, children: "No annotations yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 29}, this)
        , docs.map((a) => (
          _jsxDEV('li', { className: c.row, children: [
            _jsxDEV('div', { className: "flex items-center gap-2 mb-1"   , children: [
              a.authorAvatar && _jsxDEV('img', { src: a.authorAvatar, alt: "", className: "w-5 h-5 rounded-full"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 33}, this )
              , _jsxDEV('span', { className: "text-xs text-[#d4a857] font-bold"  , children: a.authorName}, void 0, false, {fileName: _jsxFileName, lineNumber: 34}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 32}, this)
            , _jsxDEV('p', { className: c.body, children: a.text}, void 0, false, {fileName: _jsxFileName, lineNumber: 36}, this)
          ]}, a._id, true, {fileName: _jsxFileName, lineNumber: 31}, this)
        ))
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 28}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 22}, this)
  )
}

function Bookmarks({ c, database, useLiveQuery }) {
  const { docs } = useLiveQuery("type", { key: "bookmark" })
  return (
    _jsxDEV('section', { id: "bookmarks", className: c.section, children: [
      _jsxDEV('h2', { className: c.sectionTitle, children: "Bookmarks"}, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
      , docs.length === 0 ? (
        _jsxDEV('p', { className: c.muted, children: "No bookmarks yet. Add notes above and revisit favorite eras."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 50}, this)
      ) : (
        _jsxDEV('ul', { className: c.list, children: 
          docs.map((b) => (
            _jsxDEV('li', { className: c.row, children: [
              _jsxDEV('div', { className: "font-bold text-[#d4a857]" , children: b.label}, void 0, false, {fileName: _jsxFileName, lineNumber: 55}, this)
              , _jsxDEV('div', { className: c.body, children: b.decade}, void 0, false, {fileName: _jsxFileName, lineNumber: 56}, this)
            ]}, b._id, true, {fileName: _jsxFileName, lineNumber: 54}, this)
          ))
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 52}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 47}, this)
  )
}

function EraPanel({ c, decade, database, useLiveQuery, isGenerating, setIsGenerating }) {
  const { docs } = useLiveQuery("decade", { key: decade })
  // Fall back to seed data for 1920s so the app is never empty on first paint
  const era = docs.find((d) => d.type === "era") || (decade === "1920s" ? SEED_1920S : null)

  async function generate() {
    setIsGenerating(true)
    try {
      const prompt = `You are a jazz historian. For the ${decade}, provide a detailed account of jazz music and its relationship to Black American life. Cover key recordings, landmark musicians, notable venues, important cities, and the social/political context (migration, civil rights, cultural change). Connect the music's innovations to what was happening in society.`
      const response = await callAI(prompt, {
        schema: {
          properties: {
            summary: { type: "string", description: "Overview of the decade's jazz innovations and social significance" },
            recordings: { type: "array", items: { type: "object", properties: { title: { type: "string" }, artist: { type: "string" }, year: { type: "string" }, note: { type: "string" } } } },
            musicians: { type: "array", items: { type: "object", properties: { name: { type: "string" }, instrument: { type: "string" }, contribution: { type: "string" } } } },
            venues: { type: "array", items: { type: "object", properties: { name: { type: "string" }, city: { type: "string" }, significance: { type: "string" } } } },
            cities: { type: "array", items: { type: "string" } },
            socialContext: { type: "string", description: "What was changing in Black American life and how the music reflected and shaped it" },
          },
        },
      })
      const data = JSON.parse(response)
      await database.put({ type: "era", decade, ...data, createdAt: Date.now() })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    _jsxDEV('section', { id: "era-panel", className: c.section, children: [
      _jsxDEV('h2', { className: c.sectionTitle, children: ["The " , decade]}, void 0, true, {fileName: _jsxFileName, lineNumber: 94}, this)
      , !era ? (
        _jsxDEV('div', { children: [
          _jsxDEV('p', { className: c.muted, children: ["No era loaded yet for the "      , decade, "."]}, void 0, true, {fileName: _jsxFileName, lineNumber: 97}, this)
          , _jsxDEV('button', { onClick: generate, disabled: isGenerating, className: c.btn + " mt-3 inline-flex items-center gap-2", children: [
              isGenerating && (
                _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this)
              )
              , isGenerating ? "Researching..." : "Generate Era"
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 98}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 96}, this)
      ) : (
        _jsxDEV('div', { className: "space-y-4", children: [
          _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Overview"}, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
            , _jsxDEV('p', { className: c.body, children: era.summary}, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 107}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Social Context" }, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
            , _jsxDEV('p', { className: c.body, children: era.socialContext}, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Key Recordings" }, void 0, false, {fileName: _jsxFileName, lineNumber: 116}, this)
            , _jsxDEV('ul', { className: c.list, children: 
              _optionalChain([era, 'access', _ => _.recordings, 'optionalAccess', _2 => _2.map, 'call', _3 => _3((r, i) => (
                _jsxDEV('li', { className: c.row, children: [
                  _jsxDEV('div', { className: "font-bold text-[#d4a857]" , children: [r.title, " " , _jsxDEV('span', { className: "text-[#8a8a8a] font-normal" , children: ["(", r.year, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 120}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 120}, this)
                  , _jsxDEV('div', { className: c.body, children: [r.artist, " — "  , r.note]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)
                ]}, i, true, {fileName: _jsxFileName, lineNumber: 119}, this)
              ))])
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Musicians"}, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
            , _jsxDEV('ul', { className: c.list, children: 
              _optionalChain([era, 'access', _4 => _4.musicians, 'optionalAccess', _5 => _5.map, 'call', _6 => _6((m, i) => (
                _jsxDEV('li', { className: c.row, children: [
                  _jsxDEV('div', { className: "font-bold text-[#d4a857]" , children: [m.name, " " , _jsxDEV('span', { className: "text-[#8a8a8a] font-normal" , children: ["— " , m.instrument]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)
                  , _jsxDEV('div', { className: c.body, children: m.contribution}, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this)
                ]}, i, true, {fileName: _jsxFileName, lineNumber: 130}, this)
              ))])
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 128}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 126}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Venues"}, void 0, false, {fileName: _jsxFileName, lineNumber: 138}, this)
            , _jsxDEV('ul', { className: c.list, children: 
              _optionalChain([era, 'access', _7 => _7.venues, 'optionalAccess', _8 => _8.map, 'call', _9 => _9((v, i) => (
                _jsxDEV('li', { className: c.row, children: [
                  _jsxDEV('div', { className: "font-bold text-[#d4a857]" , children: [v.name, " " , _jsxDEV('span', { className: "text-[#8a8a8a] font-normal" , children: ["— " , v.city]}, void 0, true, {fileName: _jsxFileName, lineNumber: 142}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 142}, this)
                  , _jsxDEV('div', { className: c.body, children: v.significance}, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
                ]}, i, true, {fileName: _jsxFileName, lineNumber: 141}, this)
              ))])
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 137}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.label, children: "Cities"}, void 0, false, {fileName: _jsxFileName, lineNumber: 149}, this)
            , _jsxDEV('p', { className: c.body, children: _optionalChain([era, 'access', _10 => _10.cities, 'optionalAccess', _11 => _11.join, 'call', _12 => _12(" • ")])}, void 0, false, {fileName: _jsxFileName, lineNumber: 150}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 148}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
  )
}

const SEED_1920S = {
  type: "era",
  decade: "1920s",
  _id: "era-1920s-seed",
  summary: "The 1920s marked jazz's emergence from New Orleans into a national phenomenon. Louis Armstrong's Hot Five and Hot Seven recordings redefined improvisation as personal expression. Duke Ellington arrived in New York and began shaping a distinctly orchestral vision of jazz at the Cotton Club.",
  socialContext: "The Great Migration carried hundreds of thousands of Black Americans from the South to northern cities, planting jazz in Chicago, New York, and Detroit. The Harlem Renaissance celebrated Black artistic achievement while record labels discovered a mass market in 'race records.'",
  recordings: [
    { title: "West End Blues", artist: "Louis Armstrong & His Hot Five", year: "1928", note: "Armstrong's opening cadenza set a new standard for jazz virtuosity." },
    { title: "East St. Louis Toodle-Oo", artist: "Duke Ellington", year: "1926", note: "Ellington's signature theme, blending blues growl with orchestral color." },
    { title: "Black Bottom Stomp", artist: "Jelly Roll Morton's Red Hot Peppers", year: "1926", note: "Masterclass in New Orleans ensemble interplay and arranged spontaneity." },
  ],
  musicians: [
    { name: "Louis Armstrong", instrument: "Trumpet / Vocals", contribution: "Transformed jazz from ensemble music into a soloist's art." },
    { name: "Duke Ellington", instrument: "Piano / Bandleader", contribution: "Built an orchestra as a compositional instrument unlike any other." },
    { name: "Sidney Bechet", instrument: "Soprano Saxophone / Clarinet", contribution: "Pioneered the soprano sax as a lead voice with fierce vibrato." },
  ],
  venues: [
    { name: "Cotton Club", city: "Harlem, New York", significance: "Ellington's residency broadcast jazz to white radio audiences nationwide." },
    { name: "Savoy Ballroom", city: "Harlem, New York", significance: "The 'Home of Happy Feet' — integrated dance hall and birthplace of Lindy Hop." },
  ],
  cities: ["New Orleans", "Chicago", "New York", "Kansas City"],
  createdAt: 0,
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("jazz-timeline")
  const [selectedDecade, setSelectedDecade] = React.useState("1920s")
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Seed 1920s content on first load so the app shows real data immediately
  React.useEffect(() => {
    database.get("era-1920s-seed").catch(() => database.put(SEED_1920S))
  }, [])

  const c = {
    page: "min-h-screen bg-[#0f0f0f] text-[#e5e5e5] font-serif",
    header: "bg-[#2d2d2d] border-b-4 border-[#b8923d] px-4 py-5 sticky top-0 z-10",
    title: "text-2xl md:text-3xl font-bold text-[#d4a857] tracking-wide text-center",
    tagline: "text-xs text-[#8a8a8a] text-center mt-1 italic",
    main: "max-w-3xl mx-auto p-4 space-y-5",
    section: "bg-[#1a1a1a] border border-[#3a3a3a] rounded-md p-4 shadow-lg",
    sectionTitle: "text-lg font-bold text-[#d4a857] border-b border-[#3a3a3a] pb-2 mb-3",
    decadeRow: "flex flex-wrap gap-2",
    decadeBtn: "flex-1 min-w-[80px] min-h-[44px] px-3 py-2 bg-[#222] border border-[#4a3a1a] rounded text-[#d4a857] font-bold hover:bg-[#2d2d2d]",
    decadeBtnActive: "flex-1 min-w-[80px] min-h-[44px] px-3 py-2 bg-[#b8923d] border border-[#b8923d] rounded text-[#0f0f0f] font-bold",
    btn: "min-h-[44px] px-4 py-2 bg-[#b8923d] text-[#0f0f0f] font-bold rounded hover:bg-[#d4a857] disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 bg-transparent border border-[#4a3a1a] text-[#d4a857] rounded hover:bg-[#222]",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#0f0f0f] border border-[#3a3a3a] rounded text-[#e5e5e5]",
    list: "space-y-2",
    row: "p-3 bg-[#222] border-l-2 border-[#b8923d] rounded",
    label: "text-xs uppercase tracking-wider text-[#8a8a8a]",
    body: "text-sm text-[#d0d0d0] leading-relaxed",
    muted: "text-sm text-[#8a8a8a] italic",
    readonly: "text-xs text-[#8a8a8a] italic",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Jazz History Timeline"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 188}, this)
        , _jsxDEV('p', { className: c.tagline, children: "Recordings, players, places, and the world that made them"        }, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 187}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "decade-picker", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Pick a Decade"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 193}, this)
          , _jsxDEV('div', { className: c.decadeRow, children: 
            DECADES.map((d) => (
              _jsxDEV('button', {

                onClick: () => setSelectedDecade(d),
                className: selectedDecade === d ? c.decadeBtnActive : c.decadeBtn,
 children: 
                d
              }, d, false, {fileName: _jsxFileName, lineNumber: 196}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 194}, this)
          , _jsxDEV('p', { className: c.muted + " mt-3", children: "Tap an era to explore its sounds and stories."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 205}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 192}, this)
        , _jsxDEV(EraPanel, {
          c: c,
          decade: selectedDecade,
          database: database,
          useLiveQuery: useLiveQuery,
          isGenerating: isGenerating,
          setIsGenerating: setIsGenerating,}, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this
        )
        , _jsxDEV(Annotations, { c: c, decade: selectedDecade, database: database, useLiveQuery: useLiveQuery, useDocument: useDocument,}, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this )
        , _jsxDEV(Bookmarks, { c: c, database: database, useLiveQuery: useLiveQuery,}, void 0, false, {fileName: _jsxFileName, lineNumber: 216}, this )
        , _jsxDEV('button', {
          onClick: () => database.put({ type: "bookmark", decade: selectedDecade, label: `Favorite: ${selectedDecade}`, createdAt: Date.now() }),
          className: c.btnGhost + " w-full",
 children: ["Bookmark the "
            , selectedDecade
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 217}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 191}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 186}, this)
  )
}