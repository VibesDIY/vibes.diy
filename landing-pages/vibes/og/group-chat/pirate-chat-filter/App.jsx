const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ThreadList({ c, copyPirate }) {
  const { useLiveQuery } = useFireproof("pirate-translator")
  const { docs } = useLiveQuery("createdAt", { descending: true, limit: 100 })
  if (!docs.length) return (
    _jsxDEV('div', { className: "space-y-3", children: [
      _jsxDEV('p', { className: c.empty, style: c.emptyStyle, children: "No translations yet. Be the first to set sail!"        }, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
      _jsxDEV('li', { className: c.row + " opacity-60 list-none", style: c.rowStyle, children: [
        _jsxDEV('div', { className: "text-[10px] uppercase tracking-widest mb-1", style: { color: "#4a9b8e" }, children: "Example" }, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
        _jsxDEV('div', { className: c.rowGrid, children: [
          _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.rowLabel, style: c.rowLabelStyle, children: "Original"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
            _jsxDEV('div', { className: c.rowOriginal, style: c.rowOriginalStyle, children: "Hey, are you coming to the party tonight?"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this),
          _jsxDEV('div', { children: [
            _jsxDEV('div', { className: c.rowLabel, style: c.rowLabelStyle, children: "Pirate"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
            _jsxDEV('div', { className: c.rowPirate, style: c.rowPirateStyle, children: "Ahoy, be ye joinin' the festivities this eve?"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
            _jsxDEV('div', { className: c.rowExclaim, style: c.rowExclaimStyle, children: "— Shiver me timbers, it be a grand time!"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this),
        _jsxDEV('div', { className: c.rowMeta, style: c.rowMetaStyle, children: [
          _jsxDEV('span', { className: c.author, style: c.authorStyle, children: "sample crew"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
          _jsxDEV('button', { className: c.btnSmall, style: c.btnSmallStyle, onClick: () => copyPirate("Ahoy, be ye joinin' the festivities this eve?"), children: [
            _jsxDEV('svg', { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              _jsxDEV('rect', { x: "9", y: "9", width: "13", height: "13", rx: "2"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this),
              _jsxDEV('path', { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this), "Copy Pirate"
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this)
  )
  return (
    _jsxDEV('ul', { className: "space-y-3", children:
      docs.map((d) => (
        _jsxDEV('li', { className: c.row, style: c.rowStyle, children: [
          _jsxDEV('div', { className: c.rowGrid, children: [
            _jsxDEV('div', { children: [
              _jsxDEV('div', { className: c.rowLabel, style: c.rowLabelStyle, children: "Original"}, void 0, false, {fileName: _jsxFileName, lineNumber: 16}, this)
              , _jsxDEV('div', { className: c.rowOriginal, style: c.rowOriginalStyle, children: d.original}, void 0, false, {fileName: _jsxFileName, lineNumber: 17}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 15}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('div', { className: c.rowLabel, style: c.rowLabelStyle, children: "Pirate"}, void 0, false, {fileName: _jsxFileName, lineNumber: 20}, this)
              , _jsxDEV('div', { className: c.rowPirate, style: c.rowPirateStyle, children: d.pirate}, void 0, false, {fileName: _jsxFileName, lineNumber: 21}, this)
              , d.exclamation && _jsxDEV('div', { className: c.rowExclaim, style: c.rowExclaimStyle, children: ["— " , d.exclamation]}, void 0, true, {fileName: _jsxFileName, lineNumber: 22}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 19}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 14}, this)
          , _jsxDEV('div', { className: c.rowMeta, style: c.rowMetaStyle, children: [
            _jsxDEV('span', { className: c.author, style: c.authorStyle, children: [
              d.authorAvatarUrl && _jsxDEV('img', { src: d.authorAvatarUrl, alt: "", className: c.avatar, style: c.avatarStyle,}, void 0, false, {fileName: _jsxFileName, lineNumber: 27}, this )
              , d.authorDisplayName || "Anonymous"
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 26}, this)
            , _jsxDEV('button', { className: c.btnSmall, style: c.btnSmallStyle, onClick: () => copyPirate(d.pirate), children: [
              _jsxDEV('svg', { width: "14", height: "14", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                _jsxDEV('rect', { x: "9", y: "9", width: "13", height: "13", rx: "2",}, void 0, false, {fileName: _jsxFileName, lineNumber: 32}, this )
                , _jsxDEV('path', { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"                ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 33}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 31}, this), "Copy"

            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 30}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 25}, this)
        ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 13}, this)
      ))
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 11}, this)
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("pirate-translator")
  const { doc, merge, reset } = useDocument({ original: "" })
  const [isLoading, setIsLoading] = React.useState(false)

  async function handleTranslate(e) {
    e.preventDefault()
    if (!doc.original.trim() || isLoading) return
    setIsLoading(true)
    try {
      const res = await callAI(
        `Translate this message into pirate dialect. Also give a short pirate exclamation that fits the mood.\n\nMessage: ${doc.original}`,
        { schema: { properties: { pirate: { type: "string" }, exclamation: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      await database.put({
        type: "translation",
        original: doc.original,
        pirate: parsed.pirate,
        exclamation: parsed.exclamation,
        createdAt: Date.now(),
        authorUserSlug: _nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _ => _.userSlug]), () => ( "anon")),
        authorDisplayName: _nullishCoalesce(_nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _2 => _2.displayName]), () => ( _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]))), () => ( "Anonymous")),
        authorAvatarUrl: _nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _4 => _4.avatarUrl]), () => ( "")),
      })
      reset()
    } finally {
      setIsLoading(false)
    }
  }

  async function copyPirate(text) {
    try { await navigator.clipboard.writeText(text) } catch (e2) {}
  }

  const c = {
    page: "min-h-screen pb-32",
    pageStyle: { background: "linear-gradient(160deg, #1a0e08 0%, #2c1810 40%, #3a2010 100%)", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#f4e4c1" },
    header: "sticky top-0 z-10 px-4 py-3 shadow-2xl border-b-4",
    headerStyle: { background: "#1a0e08", borderColor: "#c8a45a", boxShadow: "0 4px 20px rgba(0,0,0,0.8)" },
    title: "text-2xl font-bold tracking-wider",
    titleStyle: { fontFamily: "'Georgia', serif", color: "#c8a45a", textShadow: "0 2px 8px rgba(200,164,90,0.4)" },
    tagline: "text-sm mt-0.5",
    taglineStyle: { color: "#4a9b8e", fontFamily: "'Georgia', serif", fontStyle: "italic" },
    main: "px-3 py-4 max-w-2xl mx-auto space-y-4",
    section: "rounded-xl p-4 shadow-2xl border-2",
    sectionStyle: { background: "linear-gradient(135deg, #3d1f0d 0%, #4a2c17 100%)", borderColor: "#c8a45a", boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,164,90,0.2)" },
    sectionTitle: "text-lg font-bold mb-3 uppercase tracking-widest",
    sectionTitleStyle: { color: "#c8a45a", fontFamily: "'Georgia', serif", textShadow: "0 1px 4px rgba(0,0,0,0.5)" },
    input: "w-full rounded-lg border-2 px-3 py-3 min-h-[80px] focus:outline-none",
    inputStyle: { background: "#1a0e08", color: "#f4e4c1", borderColor: "#c8a45a", fontFamily: "'Georgia', serif", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)" },
    btn: "w-full min-h-[48px] rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2",
    btnStyle: { background: "#c8a45a", color: "#1a0e08", borderColor: "#a07830", fontFamily: "'Georgia', serif", boxShadow: "0 4px 12px rgba(200,164,90,0.3)" },
    btnSmall: "min-h-[44px] px-5 rounded-md text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 shadow-md border-2",
    btnSmallStyle: { background: "#4a9b8e", color: "#1a0e08", borderColor: "#3a7a6e", fontFamily: "'Georgia', serif" },
    row: "rounded-lg p-3 border-l-4 space-y-2",
    rowStyle: { background: "linear-gradient(135deg, #1a0e08 0%, #2a1808 100%)", borderLeftColor: "#c8a45a", boxShadow: "inset 0 1px 0 rgba(200,164,90,0.1)" },
    rowGrid: "grid grid-cols-1 md:grid-cols-2 gap-2",
    rowLabel: "text-[10px] uppercase tracking-widest",
    rowLabelStyle: { color: "#4a9b8e" },
    rowOriginal: "text-sm",
    rowOriginalStyle: { color: "#f4e4c1" },
    rowPirate: "text-sm font-medium",
    rowPirateStyle: { color: "#c8a45a" },
    rowExclaim: "italic text-xs",
    rowExclaimStyle: { color: "#8b6b45", fontStyle: "italic" },
    rowMeta: "flex items-center justify-between gap-2 pt-2 border-t",
    rowMetaStyle: { borderColor: "#c8a45a22" },
    author: "flex items-center gap-2 text-xs",
    authorStyle: { color: "#4a9b8e" },
    avatar: "w-6 h-6 rounded-full border",
    avatarStyle: { borderColor: "#c8a45a" },
    empty: "text-center py-8 text-sm italic",
    emptyStyle: { color: "#8b6b45" },
    readonly: "text-center py-4 text-sm italic",
    readonlyStyle: { color: "#4a9b8e" },
  }

  return (
    _jsxDEV('div', { className: c.page, style: c.pageStyle, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, style: c.headerStyle, children: [
        _jsxDEV('h1', { className: c.title, style: c.titleStyle, children: "⚓ PIRATE TRANSLATOR"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
        , _jsxDEV('p', { className: c.tagline, style: c.taglineStyle, children: "~ real-time pirate dialect thread"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "translate-input", className: c.section, style: c.sectionStyle, children: [
          _jsxDEV('h2', { className: c.sectionTitle, style: c.sectionTitleStyle, children: "Drop Yer Message"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
          , can("write") ? (
            _jsxDEV('form', { className: "space-y-3", onSubmit: handleTranslate, children: [
              _jsxDEV('textarea', {
                className: c.input,
                style: c.inputStyle,
                placeholder: "Paste a landlubber message here...",
                value: doc.original,
                onChange: (e) => merge({ original: e.target.value }),
                disabled: isLoading,}, void 0, false, {fileName: _jsxFileName, lineNumber: 115}, this
              )
              , _jsxDEV('button', { type: "submit", className: c.btn, style: c.btnStyle, disabled: isLoading || !doc.original.trim(), children:
                isLoading ? (
                  _jsxDEV(_Fragment, { children: [
                    _jsxDEV('svg', { className: "animate-spin", width: "20", height: "20", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children:
                      _jsxDEV('path', { d: "M21 12a9 9 0 1 1-6.219-8.56"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this )
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 125}, this), "Translating..."

                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 124}, this)
                ) : "⚓ Translate to Pirate"
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 114}, this)
          ) : (
            _jsxDEV('p', { className: c.readonly, style: c.readonlyStyle, children: "Read-only view — contact the owner for write access to translate."          }, void 0, false, {fileName: _jsxFileName, lineNumber: 134}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
        , _jsxDEV('section', { id: "live-thread", className: c.section, style: c.sectionStyle, children: [
          _jsxDEV('h2', { className: c.sectionTitle, style: c.sectionTitleStyle, children: "The Crew's Thread"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 138}, this)
          , _jsxDEV(ThreadList, { c: c, copyPirate: copyPirate,}, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 137}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 110}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 105}, this)
  )
}