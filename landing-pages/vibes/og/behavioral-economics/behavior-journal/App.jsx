const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const CONCEPTS = [
  "Prospect Theory","Loss Aversion","Present Bias","Hyperbolic Discounting",
  "Bounded Rationality","Framing Effects","Reference-Dependent Preferences",
  "Heuristics & Biases","Social Preferences","Endowment Effect","Intertemporal Choice"
]

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("beh-econ-journal")
  const { doc, merge, submit } = useDocument({
    type: "entry", story: "", concept: "", defense: "",
    createdAt: Date.now(), feedback: null, authorSlug: "", authorName: "",
  })
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!doc.story.trim() || !doc.concept || !doc.defense.trim()) return
    setIsLoading(true)
    try {
      const res = await callAI(
        `A behavioral econ student logged this story: "${doc.story}". They chose the concept "${doc.concept}" and defended it: "${doc.defense}". As a Socratic tutor, respond with: (1) what ${doc.concept} actually predicts, (2) a probing clarifying question that challenges whether their pick is the best fit or just the most famous one, (3) an alternative concept they should consider with rationale.`,
        { schema: { properties: {
          explanation: { type: "string" },
          clarifyingQuestion: { type: "string" },
          alternativeConcept: { type: "string" },
          alternativeRationale: { type: "string" },
        } } }
      )
      const feedback = JSON.parse(res)
      await database.put({
        ...doc, feedback,
        authorSlug: _optionalChain([viewer, 'optionalAccess', _ => _.userSlug]) || "anon",
        authorName: _optionalChain([viewer, 'optionalAccess', _2 => _2.displayName]) || _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]) || "Anonymous",
        avatarUrl: _optionalChain([viewer, 'optionalAccess', _4 => _4.avatarUrl]) || "",
      })
      merge({ story: "", concept: "", defense: "", feedback: null })
    } finally { setIsLoading(false) }
  }

  async function suggestExample() {
    setIsSuggesting(true)
    try {
      const res = await callAI(
        "Generate a short, casual real-world behavioral economics story (2-3 sentences) a college student might observe, plus the most fitting concept from this list: " + CONCEPTS.join(", ") + ", plus a one-paragraph defense.",
        { schema: { properties: { story: { type: "string" }, concept: { type: "string" }, defense: { type: "string" } } } }
      )
      const s = JSON.parse(res)
      merge({ story: s.story, concept: s.concept, defense: s.defense })
    } finally { setIsSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1f4a] to-[#1a1230] text-white font-['Nunito',sans-serif] pb-24",
    header: "sticky top-0 z-10 bg-[#1a1230]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3",
    title: "font-['Fredoka',sans-serif] text-xl font-bold text-[#f5d76e]",
    tagline: "text-xs text-white/60 ml-auto",
    main: "max-w-2xl mx-auto px-4 py-4 space-y-4",
    section: "bg-[#3a2870]/40 border border-white/10 rounded-2xl p-4 shadow-lg",
    h2: "font-['Fredoka',sans-serif] text-lg font-semibold text-[#a8e6cf] mb-3",
    input: "w-full bg-[#1a1230]/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#f5d76e]",
    textarea: "w-full bg-[#1a1230]/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 min-h-[80px] focus:outline-none focus:border-[#f5d76e]",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#6b4ec7] hover:bg-[#7d5dd6] active:bg-[#5a3fb0] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2",
    btnGold: "min-h-[44px] px-4 py-3 rounded-xl bg-[#f5d76e] hover:bg-[#f7e08a] text-[#2a1f4a] font-bold transition disabled:opacity-50",
    chip: "px-2 py-1 rounded-full text-xs font-semibold",
    row: "bg-[#1a1230]/40 border border-white/5 rounded-xl p-3",
    label: "block text-sm font-semibold text-white/80 mb-1",
    hint: "text-xs text-white/50",
  }

  const { docs: allEntries } = useLiveQuery("type", { key: "entry" })
  const conceptCounts = {}
  allEntries.forEach(d => { if (d.concept) conceptCounts[d.concept] = (conceptCounts[d.concept]||0)+1 })
  const maxCount = Math.max(1, ...Object.values(conceptCounts))

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('span', { className: "text-2xl", children: "🧠"}, void 0, false, {fileName: _jsxFileName, lineNumber: 85}, this)
        , _jsxDEV('h1', { className: c.title, children: "BehavioralEcon Journal" }, void 0, false, {fileName: _jsxFileName, lineNumber: 86}, this)
        , _jsxDEV('span', { className: c.tagline, children: "build intuition, not flashcards"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 87}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 84}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "new-entry", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Log a behavior"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
          , !can("write") ? (
            _jsxDEV('div', { className: "space-y-3", children: [
              _jsxDEV('p', { className: "text-white/70 text-sm mb-3", children: "See how it works — observe a real behavioral economics moment, pick the concept, and get Socratic tutor feedback." }, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)
              , _jsxDEV('div', { className: "bg-[#1a1230]/60 border border-white/10 rounded-xl p-4 space-y-2", children: [
                _jsxDEV('p', { className: "text-white/80 text-sm italic", children: "\"My roommate refused to sell her hoodie for $40 but wouldn't pay $40 to replace it if it were lost.\""}, void 0, false, {fileName: _jsxFileName, lineNumber: 94}, this)
                , _jsxDEV('p', { className: "text-xs text-[#a8e6cf]", children: "Concept: Endowment Effect — we value things we own more than identical things we don't."}, void 0, false, {fileName: _jsxFileName, lineNumber: 95}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 94}, this)
              , _jsxDEV('a', { href: "https://vibes.diy/vibe/edu/behavior-journal", target: "_blank", rel: "noopener noreferrer", className: "inline-block min-h-[44px] px-6 py-3 rounded-xl bg-[#f5d76e] text-[#2a1f4a] font-bold hover:bg-[#f7e08a] transition text-center", children: "Try it yourself →"}, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
          ) : (
          _jsxDEV('form', { onSubmit: handleSave, className: "space-y-3", children: [
            _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "What happened?" }, void 0, false, {fileName: _jsxFileName, lineNumber: 97}, this)
              , _jsxDEV('textarea', { className: c.textarea, value: doc.story, onChange: e=>merge({story:e.target.value}), placeholder: "My roommate refused to sell her hoodie for $40 but wouldn't pay $40 to replace it..."               ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 96}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Which concept explains it?"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 101}, this)
              , _jsxDEV('select', { className: c.input, value: doc.concept, onChange: e=>merge({concept:e.target.value}), children: [
                _jsxDEV('option', { value: "", children: "Pick a concept..."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this)
                , CONCEPTS.map(k => _jsxDEV('option', { value: k, children: k}, k, false, {fileName: _jsxFileName, lineNumber: 104}, this))
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 100}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: ["Why does it fit? "    , _jsxDEV('span', { className: c.hint, children: "(one paragraph)" }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 108}, this)
              , _jsxDEV('textarea', { className: c.textarea, value: doc.defense, onChange: e=>merge({defense:e.target.value}), placeholder: "Because she values what she owns more than identical items she doesn't..."           ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 107}, this)
            , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
              _jsxDEV('button', { type: "submit", className: c.btnGold, disabled: isLoading, children: [
                isLoading && _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
                , isLoading ? "Asking tutor..." : "Save & ask the tutor"
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 112}, this)
              , _jsxDEV('button', { type: "button", className: c.btn, onClick: suggestExample, disabled: isSuggesting, children: [
                isSuggesting && _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this), "Suggest example"

              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 116}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 95}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)
        , _jsxDEV('section', { id: "dashboard", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Your concept pattern"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 125}, this)
          , _jsxDEV('p', { className: c.hint + " mb-2", children: "Which concepts you reach for — and which you haven't tried yet."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
          , _jsxDEV('div', { className: "flex flex-wrap gap-2"  , children: 
            CONCEPTS.map(k => {
              const n = conceptCounts[k] || 0
              const tone = n === 0 ? "bg-white/5 text-white/40 border border-dashed border-white/20"
                        : n === maxCount && n > 1 ? "bg-[#f5d76e] text-[#2a1f4a]"
                        : "bg-[#6b4ec7]/60 text-white"
              return _jsxDEV('span', { className: "px-2 py-1 rounded-full text-xs font-semibold " + tone, children: [k, " · "  , n]}, k, true, {fileName: _jsxFileName, lineNumber: 133}, this)
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 124}, this)
        , _jsxDEV('section', { id: "journal", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Your journal" }, void 0, false, {fileName: _jsxFileName, lineNumber: 138}, this)
          , _jsxDEV('div', { className: "space-y-3", children: [
            allEntries.length === 0 && (
              _jsxDEV('p', { className: c.hint, children: "No entries yet. Log your first behavior above."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
            )
            , allEntries.slice().sort((a,b)=>b.createdAt-a.createdAt).map(d => (
              _jsxDEV('div', { className: c.row, children: [
                _jsxDEV('div', { className: "flex items-center gap-2 mb-2"   , children: [
                  d.avatarUrl && _jsxDEV('img', { src: d.avatarUrl, alt: "", className: "w-6 h-6 rounded-full"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 146}, this )
                  , _jsxDEV('span', { className: "text-xs text-white/60" , children: d.authorName || "Anon"}, void 0, false, {fileName: _jsxFileName, lineNumber: 147}, this)
                  , _jsxDEV('span', { className: c.chip + " bg-[#6b4ec7] text-white ml-auto", children: d.concept}, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 145}, this)
                , _jsxDEV('p', { className: "text-white mb-2" , children: ["\"", d.story, "\""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 150}, this)
                , _jsxDEV('p', { className: "text-xs text-white/70 italic mb-2"   , children: ["Defense: " , d.defense]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
                , d.feedback && (
                  _jsxDEV('div', { className: "bg-[#1a1230]/60 rounded-lg p-3 mt-2 border-l-2 border-[#a8e6cf] space-y-2"      , children: [
                    _jsxDEV('p', { className: "text-sm text-[#a8e6cf] font-semibold"  , children: "Tutor:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 154}, this)
                    , _jsxDEV('p', { className: "text-sm text-white/90" , children: d.feedback.explanation}, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
                    , _jsxDEV('p', { className: "text-sm text-[#f5d76e]" , children: ["❓ " , d.feedback.clarifyingQuestion]}, void 0, true, {fileName: _jsxFileName, lineNumber: 156}, this)
                    , d.feedback.alternativeConcept && (
                      _jsxDEV('p', { className: "text-xs text-white/70" , children: ["Also consider "  , _jsxDEV('strong', { children: d.feedback.alternativeConcept}, void 0, false, {fileName: _jsxFileName, lineNumber: 158}, this), ": " , d.feedback.alternativeRationale]}, void 0, true, {fileName: _jsxFileName, lineNumber: 158}, this)
                    )
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 153}, this)
                )
              ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 144}, this)
            ))
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 137}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 89}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 83}, this)
  )
}