const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const STANDARDS = {
  "Autumn Leaves": { key: "E minor", chords: ["Am7","D7","Gmaj7","Cmaj7","F#m7b5","B7","Em7","Em7"] },
  "All the Things You Are": { key: "Ab major", chords: ["Fm7","Bbm7","Eb7","Abmaj7","Dbmaj7","G7","Cmaj7","Cmaj7"] },
  "So What": { key: "D dorian", chords: ["Dm7","Dm7","Dm7","Dm7","Ebm7","Ebm7","Dm7","Dm7"] },
  "Giant Steps": { key: "B major", chords: ["Bmaj7","D7","Gmaj7","Bb7","Ebmaj7","Am7","D7","Gmaj7"] },
}

function BookmarksList({ c, database }) {
  const { useLiveQuery } = useFireproof("jazz-improv-explainer")
  const { docs } = useLiveQuery("type", { key: "bookmark", descending: true, limit: 20 })
  if (docs.length === 0) return _jsxDEV('p', { className: "text-xs text-[#8a8a8a] italic"  , children: "No bookmarks yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 15}, this)
  return (
    _jsxDEV('ul', { className: "space-y-3", children: 
      docs.map((d) => (
        _jsxDEV('li', { className: "border-l-2 border-[#b8924a] pl-3 py-1"   , children: [
          _jsxDEV('div', { className: "flex items-center justify-between gap-2"   , children: [
            _jsxDEV('div', { className: "text-sm", children: [_jsxDEV('span', { className: "text-[#d4a857] font-bold" , children: d.chord}, void 0, false, {fileName: _jsxFileName, lineNumber: 21}, this), " " , _jsxDEV('span', { className: "text-[#8a8a8a]", children: ["· " , d.standard, " · "  , d.scaleName]}, void 0, true, {fileName: _jsxFileName, lineNumber: 21}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 21}, this)
            , _jsxDEV('button', { onClick: () => database.del(d._id), className: "text-xs text-[#8a8a8a] hover:text-[#d4a857] uppercase"   , children: "remove"}, void 0, false, {fileName: _jsxFileName, lineNumber: 22}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 20}, this)
          , _jsxDEV('p', { className: "text-xs text-[#a8a8a8] italic mt-1"   , children: d.listening}, void 0, false, {fileName: _jsxFileName, lineNumber: 24}, this)
        ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 19}, this)
      ))
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 17}, this)
  )
}

function LessonPanel({ session, database, c }) {
  const [isLoading, setIsLoading] = React.useState(false)
  const { useLiveQuery } = useFireproof("jazz-improv-explainer")
  const { docs: lessons } = useLiveQuery("lessonKey", { key: `${session.standard}::${session.selectedChord}` })
  const lesson = lessons[0]

  async function generate() {
    if (!session.selectedChord) return
    setIsLoading(true)
    try {
      const prompt = `You are a jazz pedagogy advisor. The student is studying the chord ${session.selectedChord} in the standard "${session.standard}" (key: ${STANDARDS[session.standard].key}). Explain in plain language for a new jazz student.`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            scaleName: { type: "string", description: "Primary scale or mode (e.g. D Dorian)" },
            intervalFormula: { type: "string", description: "Interval formula like 1-2-b3-4-5-6-b7" },
            bebopApproach: { type: "string", description: "How a bebop improviser navigates this chord" },
            modalApproach: { type: "string", description: "Miles Davis modal approach over this harmony" },
            freeApproach: { type: "string", description: "How a free improviser might treat this chord" },
            rhythmTips: { type: "string", description: "Rhythm, call-and-response, motivic development tips" },
            listening: { type: "string", description: "One recommended recording: artist, album, track" },
          },
        },
      })
      const data = JSON.parse(res)
      await database.put({
        type: "lesson",
        lessonKey: `${session.standard}::${session.selectedChord}`,
        standard: session.standard,
        chord: session.selectedChord,
        ...data,
        createdAt: Date.now(),
        authorUserSlug: "visitor",
        authorDisplayName: "visitor",
      })
    } finally { setIsLoading(false) }
  }

  async function bookmark() {
    if (!lesson) return
    await database.put({ ...lesson, _id: undefined, type: "bookmark", createdAt: Date.now() })
  }

  if (!session.selectedChord) return _jsxDEV('p', { className: "text-sm text-[#8a8a8a] italic"  , children: "Tap a chord above to begin."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 74}, this)

  return (
    _jsxDEV('div', { className: "space-y-3", children: [
      _jsxDEV('div', { className: "flex items-center justify-between gap-2"   , children: [
        _jsxDEV('p', { className: "text-[#d4a857] font-bold text-lg"  , children: [session.selectedChord, " " , _jsxDEV('span', { className: "text-xs text-[#8a8a8a] font-normal"  , children: ["in " , session.standard]}, void 0, true, {fileName: _jsxFileName, lineNumber: 79}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 79}, this)
        , _jsxDEV('button', { onClick: generate, disabled: isLoading, className: c.btn, children: 
            isLoading ? (
              _jsxDEV('svg', { className: "animate-spin w-4 h-4 inline"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 82}, this)
            ) : lesson ? "Regenerate" : "Generate Lesson"
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 78}, this)
      , lesson && (
        _jsxDEV('div', { className: "space-y-3 text-sm" , children: [
          _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Scale: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this), _jsxDEV('span', { className: "text-[#f0d8a0]", children: lesson.scaleName}, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this), " " , _jsxDEV('span', { className: "text-[#8a8a8a]", children: ["(", lesson.intervalFormula, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
          , _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Bebop: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this), _jsxDEV('span', { children: lesson.bebopApproach}, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 89}, this)
          , _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Modal: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 90}, this), _jsxDEV('span', { children: lesson.modalApproach}, void 0, false, {fileName: _jsxFileName, lineNumber: 90}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)
          , _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Free: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this), _jsxDEV('span', { children: lesson.freeApproach}, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 91}, this)
          , _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Rhythm & Phrasing: "   }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this), _jsxDEV('span', { children: lesson.rhythmTips}, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 92}, this)
          , _jsxDEV('div', { children: [_jsxDEV('span', { className: "text-[#b8924a] font-bold uppercase text-xs tracking-wider"    , children: "Listen: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this), _jsxDEV('span', { className: "italic", children: lesson.listening}, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
          , _jsxDEV('button', { onClick: bookmark, className: c.btn, children: "Bookmark"}, void 0, false, {fileName: _jsxFileName, lineNumber: 94}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 77}, this)
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("jazz-improv-explainer")
  const { docs: stateDocs } = useLiveQuery("type", { key: "session-state" })
  // Default to "Autumn Leaves" so the chord grid is always visible on load
  const session = stateDocs[0] || { type: "session-state", standard: "Autumn Leaves", selectedChord: null }
  const selectStandard = (name) => database.put({ ...session, _id: session._id || "session", type: "session-state", standard: name, selectedChord: null })

  const c = {
    page: "min-h-screen bg-[#0f0f0f] text-[#e6e6e6] font-serif",
    header: "bg-[#2d2d2d] border-b-2 border-[#b8924a] px-4 py-5 sticky top-0 z-10 shadow-lg",
    title: "text-2xl md:text-3xl font-bold tracking-widest text-[#d4a857] uppercase",
    tagline: "text-xs text-[#8a8a8a] mt-1 tracking-wider uppercase",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    section: "bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-5 shadow-md",
    sectionTitle: "text-lg font-bold text-[#d4a857] uppercase tracking-wider mb-4 border-b border-[#3a3a3a] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-[#5a3a1a] hover:bg-[#7a4a20] text-[#f0d8a0] border border-[#b8924a] rounded uppercase tracking-wider text-sm font-semibold transition",
    btnActive: "min-h-[44px] px-4 py-3 bg-[#b8924a] text-[#1a1a1a] border border-[#d4a857] rounded uppercase tracking-wider text-sm font-bold",
    chord: "min-h-[60px] px-3 py-3 bg-[#252525] hover:bg-[#333] border border-[#4a4a4a] hover:border-[#b8924a] rounded text-center text-[#f0d8a0] font-semibold transition",
    avatar: "w-8 h-8 rounded-full border border-[#b8924a]",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: 
        _jsxDEV('div', { className: "flex items-center justify-between"  , children: 
          _jsxDEV('div', { children: [
            _jsxDEV('h1', { className: c.title, children: "Opus Cabinet" }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
            , _jsxDEV('p', { className: c.tagline, children: "A Jazz Improvisation Salon"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this)
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "standard-picker", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Choose a Standard"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 133}, this)
          , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: 
              Object.keys(STANDARDS).map((name) => (
                _jsxDEV('button', { onClick: () => selectStandard(name), className: session.standard === name ? c.btnActive : c.btn, children: name}, name, false, {fileName: _jsxFileName, lineNumber: 136}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 134}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 132}, this)
        , _jsxDEV('section', { id: "progression", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Chord Progression" }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
          , session.standard ? (
            _jsxDEV(_Fragment, { children: [
              _jsxDEV('p', { className: "text-xs text-[#8a8a8a] mb-3 italic"   , children: [session.standard, " · Key of "    , STANDARDS[session.standard].key, " · Tap a chord."    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 144}, this)
              , _jsxDEV('div', { className: "grid grid-cols-4 gap-2"  , children: 
                STANDARDS[session.standard].chords.map((ch, i) => (
                  _jsxDEV('button', {

                    onClick: () => database.put({ ...session, _id: session._id || "session", selectedChord: ch }),
                    className: session.selectedChord === ch ? c.btnActive : c.chord,
 children: ch}, i, false, {fileName: _jsxFileName, lineNumber: 147}, this)
                ))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 145}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 143}, this)
          ) : (
            _jsxDEV('p', { className: "text-sm text-[#8a8a8a] italic"  , children: "Select a standard above to see its changes."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 156}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 140}, this)
        , _jsxDEV('section', { id: "lesson", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Improvisation Lesson" }, void 0, false, {fileName: _jsxFileName, lineNumber: 160}, this)
          , _jsxDEV(LessonPanel, { session: session, database: database, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)
        , _jsxDEV('section', { id: "bookmarks", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Saved Insights" }, void 0, false, {fileName: _jsxFileName, lineNumber: 164}, this)
          , _jsxDEV(BookmarksList, { c: c, database: database,}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 163}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 122}, this)
  )
}