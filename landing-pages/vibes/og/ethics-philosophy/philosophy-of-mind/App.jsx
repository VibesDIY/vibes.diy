const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("codex-of-mind")
  const [selected, setSelected] = React.useState(null)
  const [loadingOracle, setLoadingOracle] = React.useState(false)
  const [reflectionText, setReflectionText] = React.useState("")
  const [discussionText, setDiscussionText] = React.useState("")

  const positions = [
    { id: "substance-dualism", name: "Substance Dualism", sub: "Mind and body are two distinct substances. (Descartes)" },
    { id: "property-dualism", name: "Property Dualism", sub: "One substance, two kinds of properties: physical and mental." },
    { id: "identity-theory", name: "Identity Theory", sub: "Mental states just are brain states." },
    { id: "functionalism", name: "Functionalism", sub: "Mind is defined by causal-functional role, not substrate." },
    { id: "eliminative-materialism", name: "Eliminative Materialism", sub: "Folk-psychological mental states do not exist." },
  ]
  const experiments = [
    { id: "marys-room", name: "Mary's Room", sub: "The colorblind scientist who knows all physical facts about color." },
    { id: "chinese-room", name: "Chinese Room", sub: "Searle's argument against strong AI and pure symbol manipulation." },
    { id: "philosophical-zombies", name: "Philosophical Zombies", sub: "Beings physically identical to us, but with no inner experience." },
    { id: "brain-in-a-vat", name: "Brain in a Vat", sub: "Could all your experience be the output of a disembodied brain?" },
  ]

  const { docs: oracleDocs } = useLiveQuery("topicId", { key: _optionalChain([selected, 'optionalAccess', _ => _.id]), descending: true })
  const { docs: reflections } = useLiveQuery("type", { key: "reflection", descending: true, limit: 20 })
  const { docs: discussions } = useLiveQuery("type", { key: "discussion", descending: true, limit: 20 })

  async function summonOracle(topic) {
    setLoadingOracle(true)
    try {
      const prompt = `As a Socratic interlocutor in philosophy of mind, analyze "${topic.name}" (${topic.sub}). Provide a plain-language explanation, the strongest argument for it, the strongest objection against it, and a probing follow-up question.`
      const res = await callAI(prompt, {
        schema: {
          properties: {
            explanation: { type: "string" },
            strongestArgument: { type: "string" },
            strongestObjection: { type: "string" },
            followUpQuestion: { type: "string" },
          },
        },
      })
      const parsed = JSON.parse(res)
      await database.put({
        type: "oracle",
        topicId: topic.id,
        topicName: topic.name,
        ...parsed,
        createdAt: Date.now(),
        authorSlug: "visitor",
        authorName: "Anonymous",
      })
    } finally {
      setLoadingOracle(false)
    }
  }

  async function postReflection(e) {
    e.preventDefault()
    if (!reflectionText.trim() || !selected) return
    await database.put({
      type: "reflection",
      topicId: selected.id,
      topicName: selected.name,
      body: reflectionText.trim(),
      createdAt: Date.now(),
      authorSlug: "visitor",
      authorName: "Anonymous",
    })
    setReflectionText("")
  }

  async function postDiscussion(e) {
    e.preventDefault()
    if (!discussionText.trim()) return
    await database.put({
      type: "discussion",
      body: discussionText.trim(),
      createdAt: Date.now(),
      authorSlug: "visitor",
      authorName: "Anonymous",
    })
    setDiscussionText("")
  }

  const Spinner = () => (
    _jsxDEV('svg', { className: c.spinner, viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: 
      _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this )
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this)
  )

  const c = {
    page: "min-h-screen bg-[oklch(0.06_0_0)] text-[oklch(0.90_0_0)] font-['Cinzel',serif]",
    header: "border-b border-[oklch(0.40_0_0)] bg-gradient-to-b from-[oklch(0.20_0.04_270)] to-[oklch(0.08_0_0)] px-5 py-6 sticky top-0 z-10",
    title: "text-2xl md:text-3xl tracking-[0.2em] text-[oklch(0.97_0.07_100)] font-['Cinzel_Decorative',serif] font-bold",
    tagline: "text-xs md:text-sm text-[oklch(0.55_0_0)] tracking-widest mt-1 uppercase",
    viewer: "flex items-center gap-2 text-xs text-[oklch(0.55_0_0)] mt-3",
    avatar: "w-7 h-7 rounded-full border border-[oklch(0.73_0.10_78)]",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    section: "border border-[oklch(0.40_0_0)] bg-[oklch(0.17_0_0)] rounded-sm p-5 shadow-[0_0_30px_oklch(0.20_0.07_22/0.3)]",
    h2: "text-lg md:text-xl tracking-[0.25em] text-[oklch(0.73_0.10_78)] font-['Cinzel_Decorative',serif] uppercase border-b border-[oklch(0.40_0_0)] pb-3 mb-4",
    btn: "min-h-[44px] px-4 py-3 bg-[oklch(0.32_0.10_25)] hover:bg-[oklch(0.20_0.07_22)] border border-[oklch(0.73_0.10_78)] text-[oklch(0.97_0.07_100)] tracking-widest text-sm uppercase transition rounded-sm disabled:opacity-50",
    btnGhost: "min-h-[44px] px-3 py-2 bg-[oklch(0.30_0_0)] hover:bg-[oklch(0.40_0_0)] border border-[oklch(0.40_0_0)] text-[oklch(0.90_0_0)] text-xs tracking-wider uppercase rounded-sm",
    input: "w-full bg-[oklch(0.06_0_0)] border border-[oklch(0.40_0_0)] focus:border-[oklch(0.73_0.10_78)] outline-none p-3 text-[oklch(0.90_0_0)] rounded-sm",
    chip: "text-left p-3 border border-[oklch(0.40_0_0)] hover:border-[oklch(0.73_0.10_78)] bg-[oklch(0.06_0_0)] hover:bg-[oklch(0.20_0.07_22)] rounded-sm transition",
    chipTitle: "text-[oklch(0.97_0.07_100)] text-sm tracking-wider font-['Cinzel_Decorative',serif]",
    chipSub: "text-xs text-[oklch(0.55_0_0)] mt-1 normal-case tracking-normal",
    card: "border border-[oklch(0.40_0_0)] bg-[oklch(0.06_0_0)] p-4 rounded-sm space-y-2",
    label: "text-xs tracking-widest text-[oklch(0.73_0.10_78)] uppercase",
    body: "text-sm text-[oklch(0.90_0_0)] leading-relaxed normal-case tracking-normal",
    muted: "text-xs text-[oklch(0.55_0_0)] italic",
    parchment: "bg-[oklch(0.78_0.05_70)] text-[oklch(0.27_0.04_45)] p-3 rounded-sm text-sm leading-relaxed",
    spinner: "animate-spin w-4 h-4 inline-block",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-3",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cinzel+Decorative:wght@400;700&display=optional');`}, void 0, false, {fileName: _jsxFileName, lineNumber: 120}, this)
      , _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Codex of Mind"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this)
        , _jsxDEV('p', { className: c.tagline, children: "On the Problem of Brain & Consciousness"      }, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "positions", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Five Positions"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
          , _jsxDEV('p', { className: c.muted, children: "Choose a stance to consult the oracle below."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 128}, this)
          , _jsxDEV('div', { className: c.grid2 + " mt-3", children: 
            positions.map((p) => (
              _jsxDEV('button', {

                onClick: () => setSelected(p),
                className: c.chip + (_optionalChain([selected, 'optionalAccess', _2 => _2.id]) === p.id ? " border-[oklch(0.97_0.07_100)] bg-[oklch(0.20_0.07_22)]" : ""),
 children: [
                _jsxDEV('div', { className: c.chipTitle, children: p.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 136}, this)
                , _jsxDEV('div', { className: c.chipSub, children: p.sub}, void 0, false, {fileName: _jsxFileName, lineNumber: 137}, this)
              ]}, p.id, true, {fileName: _jsxFileName, lineNumber: 131}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 129}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 126}, this)
        , _jsxDEV('section', { id: "experiments", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Thought Experiments" }, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
          , _jsxDEV('p', { className: c.muted, children: "The crucibles in which the positions are tested."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this)
          , _jsxDEV('div', { className: c.grid2 + " mt-3", children: 
            experiments.map((p) => (
              _jsxDEV('button', {

                onClick: () => setSelected(p),
                className: c.chip + (_optionalChain([selected, 'optionalAccess', _3 => _3.id]) === p.id ? " border-[oklch(0.97_0.07_100)] bg-[oklch(0.20_0.07_22)]" : ""),
 children: [
                _jsxDEV('div', { className: c.chipTitle, children: p.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
                , _jsxDEV('div', { className: c.chipSub, children: p.sub}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this)
              ]}, p.id, true, {fileName: _jsxFileName, lineNumber: 147}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 145}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 142}, this)
        , _jsxDEV('section', { id: "oracle", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Socratic Oracle"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 159}, this)
          , !selected ? (
            _jsxDEV('p', { className: c.muted, children: "Select a position or thought experiment above to consult the oracle."          }, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
          ) : (
            _jsxDEV('div', { className: "space-y-3", children: [
              _jsxDEV('div', { className: "flex items-center justify-between flex-wrap gap-2"    , children: [
                _jsxDEV('div', { className: c.chipTitle, children: selected.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this)
                , _jsxDEV('button', { onClick: () => summonOracle(selected), disabled: loadingOracle, className: c.btn, children: 
                  loadingOracle ? _jsxDEV(_Fragment, { children: [_jsxDEV(Spinner, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this ), " " , _jsxDEV('span', { className: "ml-2", children: "Summoning…"}, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this) : "Summon Oracle"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 166}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 164}, this)
              , oracleDocs.length === 0 && _jsxDEV('p', { className: c.muted, children: "No oracle responses yet for this topic."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 170}, this)
              , oracleDocs.map((d) => (
                _jsxDEV('div', { className: c.card, children: [
                  _jsxDEV('div', { children: [
                    _jsxDEV('div', { className: c.label, children: "Explanation"}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this)
                    , _jsxDEV('div', { className: c.body, children: d.explanation}, void 0, false, {fileName: _jsxFileName, lineNumber: 175}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 173}, this)
                  , _jsxDEV('div', { children: [
                    _jsxDEV('div', { className: c.label, children: "Strongest Argument For"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 178}, this)
                    , _jsxDEV('div', { className: c.body, children: d.strongestArgument}, void 0, false, {fileName: _jsxFileName, lineNumber: 179}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 177}, this)
                  , _jsxDEV('div', { children: [
                    _jsxDEV('div', { className: c.label, children: "Strongest Objection" }, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this)
                    , _jsxDEV('div', { className: c.body, children: d.strongestObjection}, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 181}, this)
                  , _jsxDEV('div', { className: c.parchment, children: [
                    _jsxDEV('span', { className: "font-bold uppercase tracking-widest text-xs"   , children: "Consider: " }, void 0, false, {fileName: _jsxFileName, lineNumber: 186}, this)
                    , d.followUpQuestion
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 185}, this)
                  , _jsxDEV('div', { className: c.muted, children: ["— summoned by "   , d.authorName]}, void 0, true, {fileName: _jsxFileName, lineNumber: 189}, this)
                ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 172}, this)
              ))
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 163}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 158}, this)
        , _jsxDEV('section', { id: "reflections", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Reflections"}, void 0, false, {fileName: _jsxFileName, lineNumber: 196}, this)
          , selected ? (
            _jsxDEV('form', { onSubmit: postReflection, className: "space-y-2 mb-4" , children: [
              _jsxDEV('div', { className: c.label, children: ["Reflect on "  , selected.name]}, void 0, true, {fileName: _jsxFileName, lineNumber: 199}, this)
              , _jsxDEV('textarea', {
                value: reflectionText,
                onChange: (e) => setReflectionText(e.target.value),
                placeholder: "What does this position illuminate or obscure?"      ,
                rows: 3,
                className: c.input + " normal-case tracking-normal",}, void 0, false, {fileName: _jsxFileName, lineNumber: 200}, this
              )
              , _jsxDEV('button', { type: "submit", className: c.btn, children: "Inscribe"}, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 198}, this)
          ) : (
            _jsxDEV('p', { className: c.muted, children: "Select a topic to reflect upon."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 210}, this)
          )
          , _jsxDEV('div', { className: "space-y-2", children: [
            reflections.length === 0 && _jsxDEV('p', { className: c.muted, children: "No reflections yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 213}, this)
            , reflections.map((r) => (
              _jsxDEV('div', { className: c.card, children: [
                _jsxDEV('div', { className: "flex items-center gap-2"  , children: [
                  r.authorAvatar && _jsxDEV('img', { src: r.authorAvatar, alt: "", className: "w-6 h-6 rounded-full border border-[oklch(0.40_0_0)]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 217}, this )
                  , _jsxDEV('span', { className: c.label, children: r.authorName}, void 0, false, {fileName: _jsxFileName, lineNumber: 218}, this)
                  , _jsxDEV('span', { className: c.muted, children: ["on " , r.topicName]}, void 0, true, {fileName: _jsxFileName, lineNumber: 219}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 216}, this)
                , _jsxDEV('div', { className: c.body, children: r.body}, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this)
              ]}, r._id, true, {fileName: _jsxFileName, lineNumber: 215}, this)
            ))
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 212}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 195}, this)
        , _jsxDEV('section', { id: "discussion", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Open Questions" }, void 0, false, {fileName: _jsxFileName, lineNumber: 227}, this)
          , _jsxDEV('form', { onSubmit: postDiscussion, className: "space-y-2 mb-4" , children: [
            _jsxDEV('input', {
              value: discussionText,
              onChange: (e) => setDiscussionText(e.target.value),
              placeholder: "Pose a question to the assembly…"     ,
              className: c.input + " normal-case tracking-normal",}, void 0, false, {fileName: _jsxFileName, lineNumber: 229}, this
            )
            , _jsxDEV('button', { type: "submit", className: c.btn, children: "Post Question" }, void 0, false, {fileName: _jsxFileName, lineNumber: 235}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 228}, this)
          , _jsxDEV('div', { className: "space-y-2", children: [
            discussions.length === 0 && _jsxDEV('p', { className: c.muted, children: "No questions posed yet."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 238}, this)
            , discussions.map((d) => (
              _jsxDEV('div', { className: c.card, children: [
                _jsxDEV('div', { className: "flex items-center gap-2"  , children: [
                  d.authorAvatar && _jsxDEV('img', { src: d.authorAvatar, alt: "", className: "w-6 h-6 rounded-full border border-[oklch(0.40_0_0)]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 242}, this )
                  , _jsxDEV('span', { className: c.label, children: d.authorName}, void 0, false, {fileName: _jsxFileName, lineNumber: 243}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 241}, this)
                , _jsxDEV('div', { className: c.body, children: d.body}, void 0, false, {fileName: _jsxFileName, lineNumber: 245}, this)
              ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 240}, this)
            ))
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 237}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 226}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 119}, this)
  )
}