const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

function ConvergenceMap({ dilemma, useLiveQuery, canWrite, database, c }) {
  const { docs } = useLiveQuery("dilemmaId", { key: dilemma.id })
  const analyses = docs.filter(d => d.reasoning)
  const [synthesis, setSynthesis] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)

  async function synthesize() {
    setIsLoading(true)
    try {
      const text = analyses.map(a => `${a.framework}: ${a.reasoning}`).join("\n\n")
      const res = await callAI(
        `Dilemma: ${dilemma.q}\n\nAnalyses drafted across three frameworks:\n${text}\n\nIdentify where the frameworks converge, where they diverge, and why the divergence matters morally.`,
        { schema: { properties: {
          convergencePoints: { type: "array", items: { type: "string" } },
          divergencePoints: { type: "array", items: { type: "string" } },
          whyItMatters: { type: "string" },
        }}}
      )
      setSynthesis(JSON.parse(res))
    } finally { setIsLoading(false) }
  }

  if (analyses.length < 2) return _jsxDEV('p', { className: c.muted, children: "Draft at least two framework analyses to map convergence."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 27}, this)

  return (
    _jsxDEV('div', { className: "space-y-4", children: [
      _jsxDEV('p', { className: c.muted, children: [analyses.length, " of 3 lenses drafted."    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 31}, this)
      , canWrite && (
        _jsxDEV('button', { onClick: synthesize, disabled: isLoading, className: c.btnAccent + " inline-flex items-center gap-2", children: [
          isLoading && _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 34}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 34}, this)
          , isLoading ? "Weaving…" : "Reveal Tensions"
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 33}, this)
      )
      , synthesis && (
        _jsxDEV('div', { className: "space-y-3 text-sm" , children: [
          _jsxDEV('div', { children: [
            _jsxDEV('p', { className: c.pill, children: "Convergence"}, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this)
            , _jsxDEV('ul', { className: "list-disc list-inside mt-2 space-y-1 text-[#e6e6e6]"    , children: 
              _optionalChain([synthesis, 'access', _ => _.convergencePoints, 'optionalAccess', _2 => _2.map, 'call', _3 => _3((p, i) => _jsxDEV('li', { children: p}, i, false, {fileName: _jsxFileName, lineNumber: 43}, this))])
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 42}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 40}, this)
          , _jsxDEV('div', { children: [
            _jsxDEV('p', { className: c.pill, children: "Divergence"}, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
            , _jsxDEV('ul', { className: "list-disc list-inside mt-2 space-y-1 text-[#e6e6e6]"    , children: 
              _optionalChain([synthesis, 'access', _4 => _4.divergencePoints, 'optionalAccess', _5 => _5.map, 'call', _6 => _6((p, i) => _jsxDEV('li', { children: p}, i, false, {fileName: _jsxFileName, lineNumber: 49}, this))])
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 46}, this)
          , _jsxDEV('div', { className: "border-t border-[#3d2f15] pt-3"  , children: [
            _jsxDEV('p', { className: c.pill, children: "Why It Matters"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 53}, this)
            , _jsxDEV('p', { className: "mt-2 text-[#f5e9c8] italic"  , children: synthesis.whyItMatters}, void 0, false, {fileName: _jsxFileName, lineNumber: 54}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 52}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 39}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 30}, this)
  )
}

function FrameworkPanel({ framework, dilemma, database, useLiveQuery, canWrite, c }) {
  const docId = `analysis-${dilemma.id}-${framework.key}`
  const { docs } = useLiveQuery("_id", { key: docId })
  const existing = docs[0] || { _id: docId, reasoning: "", critique: null }
  const [draft, setDraft] = React.useState(null)
  const value = _nullishCoalesce(draft, () => ( existing.reasoning))
  const [isLoading, setIsLoading] = React.useState(false)

  async function critique() {
    setIsLoading(true)
    try {
      const others = await database.query("_id", { prefix: `analysis-${dilemma.id}-` })
      const peers = others.rows
        .map(r => r.doc)
        .filter(d => d && d._id !== docId && d.reasoning)
        .map(d => `${d._id.split("-").pop()}: ${d.reasoning}`)
        .join("\n\n")
      const prompt = `You are a Socratic ethics interlocutor. The dilemma: "${dilemma.q}"\n\nThe user's ${framework.name} analysis:\n${value}\n\nOther framework drafts:\n${peers || "(none yet)"}\n\nReturn structured critique that pushes them to confront moral complexity.`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            clarityScore: { type: "number", description: "1-10 clarity of moral reasoning" },
            unstatedAssumptions: { type: "array", items: { type: "string" } },
            steelmanCounter: { type: "string", description: "Strongest counterargument from same framework" },
            convergenceNote: { type: "string", description: "How this conclusion compares to other lenses drafted" },
          },
        },
      })
      const critiqueData = JSON.parse(res)
      await database.put({ ...existing, reasoning: value, critique: critiqueData, dilemmaId: dilemma.id, framework: framework.key })
    } finally {
      setIsLoading(false)
    }
  }

  async function saveDraft() {
    await database.put({ ...existing, reasoning: value, dilemmaId: dilemma.id, framework: framework.key })
    setDraft(null)
  }

  return (
    _jsxDEV('div', { className: "border border-[#3d2f15] p-4 bg-[#0f0f0f]"   , children: [
      _jsxDEV('span', { className: c.pill, children: framework.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this)
      , _jsxDEV('p', { className: c.muted + " mt-2", children: framework.prompt}, void 0, false, {fileName: _jsxFileName, lineNumber: 105}, this)
      , _jsxDEV(_Fragment, { children: [
        _jsxDEV('textarea', {
          className: c.input + " mt-3 min-h-[120px]",
          placeholder: "Compose your reasoning…"  ,
          value: value,
          onChange: e => setDraft(e.target.value),
          onBlur: saveDraft,}, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this
        )
        , _jsxDEV('button', { onClick: critique, disabled: isLoading || !value.trim(), className: c.btnAccent + " mt-3 inline-flex items-center gap-2", children: [
          isLoading && _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 115}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 115}, this)
          , isLoading ? "Consulting…" : "Summon Socratic Critique"
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 114}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
      , existing.critique && (
        _jsxDEV('div', { className: "mt-4 border-t border-[#3d2f15] pt-4 space-y-2 text-sm"     , children: [
          _jsxDEV('p', { children: _jsxDEV('span', { className: c.pill, children: ["Clarity " , existing.critique.clarityScore, "/10"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 121}, this)
          , _jsxDEV('p', { children: _jsxDEV('strong', { className: "text-[#d4af5a]", children: "Unstated assumptions:" }, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this)
          , _jsxDEV('ul', { className: "list-disc list-inside text-[#e6e6e6] space-y-1"   , children: 
            _optionalChain([existing, 'access', _7 => _7.critique, 'access', _8 => _8.unstatedAssumptions, 'optionalAccess', _9 => _9.map, 'call', _10 => _10((a, i) => _jsxDEV('li', { children: a}, i, false, {fileName: _jsxFileName, lineNumber: 124}, this))])
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this)
          , _jsxDEV('p', { children: [_jsxDEV('strong', { className: "text-[#d4af5a]", children: "Steelman counter:" }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this), " " , _jsxDEV('span', { className: "text-[#e6e6e6]", children: existing.critique.steelmanCounter}, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 126}, this)
          , _jsxDEV('p', { children: [_jsxDEV('strong', { className: "text-[#d4af5a]", children: "Convergence:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this), " " , _jsxDEV('span', { className: "text-[#e6e6e6]", children: existing.critique.convergenceNote}, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 127}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 120}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 103}, this)
  )
}

const DILEMMAS = [
  { id: "factory-farming", title: "Factory Farming & Animal Welfare", q: "Is the industrial production of animals for food morally permissible given the suffering involved?" },
  { id: "global-poverty", title: "Wealthy Nations & Global Poverty", q: "What obligations do affluent individuals and nations have to those in extreme poverty abroad?" },
  { id: "climate-future", title: "Climate Change & Future Generations", q: "How should we weigh present costs against harms to people not yet born?" },
  { id: "autonomous-weapons", title: "Autonomous Weapons Development", q: "Should machines be permitted to make lethal targeting decisions without human judgment in the loop?" },
  { id: "ai-sentencing", title: "AI in Criminal Sentencing", q: "Should algorithmic risk assessment guide judicial sentencing decisions?" },
]

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("elder-codex")
  const { doc: state } = useDocument({ _id: "current-case", dilemmaId: null })
  const current = DILEMMAS.find(d => d.id === state.dilemmaId)

  const c = {
    page: "min-h-screen bg-[#0f0f0f] text-[#e6e6e6] font-serif",
    header: "border-b border-[#5c4a1f] bg-gradient-to-b from-[#1a1612] to-[#0f0f0f] px-4 py-6 sticky top-0 z-10",
    title: "text-2xl md:text-3xl tracking-[0.2em] uppercase text-[#d4af5a] text-center",
    tagline: "text-xs tracking-[0.3em] uppercase text-[#8a7544] text-center mt-2",
    viewer: "flex items-center gap-2 justify-end text-xs text-[#8a7544] mt-2",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#5c4a1f] bg-[#1a1612] rounded-sm p-5 shadow-[0_0_20px_rgba(0,0,0,0.4)]",
    h2: "text-lg tracking-[0.2em] uppercase text-[#d4af5a] border-b border-[#3d2f15] pb-2 mb-4",
    btn: "min-h-[44px] px-4 py-3 bg-[#2a2010] hover:bg-[#5c4a1f] border border-[#d4af5a] text-[#f5e9c8] tracking-widest uppercase text-sm transition-colors disabled:opacity-50",
    btnAccent: "min-h-[44px] px-4 py-3 bg-[#5a1e1e] hover:bg-[#7a2828] border border-[#d4af5a] text-[#f5e9c8] tracking-widest uppercase text-sm transition-colors disabled:opacity-50",
    input: "w-full bg-[#0f0f0f] border border-[#5c4a1f] text-[#e6e6e6] p-3 rounded-sm focus:outline-none focus:border-[#d4af5a]",
    pill: "inline-block px-3 py-1 text-xs tracking-widest uppercase border border-[#5c4a1f] text-[#d4af5a]",
    muted: "text-[#8a7544] text-sm italic",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cinzel+Decorative:wght@700&display=optional');`}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this)
      , _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "The Elder Codex"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this)
        , _jsxDEV('p', { className: c.tagline, children: "Applied Ethics · Case Studies"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "dilemma-select", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "I · Choose Your Dilemma"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
          , _jsxDEV('p', { className: c.muted, children: "Five cases await examination. Select one to begin."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 173}, this)
          , _jsxDEV('div', { className: "grid gap-2 mt-4"  , children: 
            DILEMMAS.map(d => (
              _jsxDEV('button', {

                onClick: () => database.put({ ...state, _id: "current-case", dilemmaId: d.id }),
                className: state.dilemmaId === d.id ? c.btnAccent : c.btn,
 children: 
                d.title
              }, d.id, false, {fileName: _jsxFileName, lineNumber: 176}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this)
          , current ? (
            _jsxDEV('div', { className: "mt-5 p-4 border border-[#3d2f15] bg-[#0f0f0f]"    , children: [
              _jsxDEV('span', { className: c.pill, children: "Active Case" }, void 0, false, {fileName: _jsxFileName, lineNumber: 187}, this)
              , _jsxDEV('p', { className: "mt-3 text-[#f5e9c8]" , children: current.q}, void 0, false, {fileName: _jsxFileName, lineNumber: 188}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 186}, this)
          ) : (
            _jsxDEV('p', { className: c.muted + " mt-4", children: "No case selected."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 171}, this)
        , _jsxDEV('section', { id: "framework-analyses", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "II · The Three Lenses"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 195}, this)
          , !current ? (
            _jsxDEV('p', { className: c.muted, children: "Choose a dilemma above to begin drafting."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 197}, this)
          ) : (
            _jsxDEV('div', { className: "space-y-6", children: 
              [
                { key: "utilitarian", name: "Utilitarian", prompt: "What action maximizes overall welfare?" },
                { key: "deontological", name: "Deontological", prompt: "What duties or rights are at stake?" },
                { key: "virtue", name: "Virtue Ethics", prompt: "What would a person of good character do?" },
              ].map(f => (
                _jsxDEV(FrameworkPanel, {

                  framework: f,
                  dilemma: current,
                  database: database,
                  useLiveQuery: useLiveQuery,
                  canWrite: true,
                  c: c,}, f.key, false, {fileName: _jsxFileName, lineNumber: 205}, this
                )
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 199}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 194}, this)
        , _jsxDEV('section', { id: "convergence-map", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "III · Convergence & Divergence"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 219}, this)
          , !current ? (
            _jsxDEV('p', { className: c.muted, children: "Awaiting case selection."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this)
          ) : (
            _jsxDEV(ConvergenceMap, { dilemma: current, useLiveQuery: useLiveQuery, canWrite: true, database: database, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 223}, this )
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 218}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 170}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 164}, this)
  )
}