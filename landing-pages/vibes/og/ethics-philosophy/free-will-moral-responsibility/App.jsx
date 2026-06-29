const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const SCENARIOS = [
  { id: "hungry-thief", title: "The Hungry Thief", text: "A man raised in deep poverty steals food and medicine to feed his ailing mother." },
  { id: "under-the-gun", title: "Under the Gun", text: "A woman, threatened with the death of her child, drives the getaway car in a robbery." },
  { id: "addicts-hand", title: "The Addict's Hand", text: "An addict in withdrawal lashes out and wounds a family member who tried to intervene." },
  { id: "executives-ledger", title: "The Executive's Ledger", text: "A CEO suppresses safety data to protect quarterly earnings; three workers later die." },
];

export default function App() {
  const { database, useLiveQuery } = useFireproof("crucible-of-judgment");
  const [selectedId, setSelectedId] = React.useState(SCENARIOS[0].id);
  const selected = SCENARIOS.find(s => s.id === selectedId);
  const [moral, setMoral] = React.useState("");
  const [legal, setLegal] = React.useState("");
  const [reasoning, setReasoning] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);

  const c = {
    page: "min-h-screen bg-[oklch(0.06_0_0)] text-[oklch(0.90_0_0)] font-['Cinzel',serif]",
    header: "border-b border-[oklch(0.40_0_0)] bg-gradient-to-b from-[oklch(0.22_0.04_25)] to-[oklch(0.08_0_0)] px-6 py-5 sticky top-0 z-10",
    title: "text-2xl md:text-3xl font-['Cinzel_Decorative',serif] font-bold tracking-wider text-[oklch(0.97_0.07_100)]",
    tagline: "text-xs text-[oklch(0.55_0_0)] mt-1 tracking-widest uppercase",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[oklch(0.40_0_0)] bg-[oklch(0.17_0_0)] rounded-sm p-5 shadow-2xl",
    h2: "text-lg font-['Cinzel_Decorative',serif] tracking-wider text-[oklch(0.73_0.10_78)] mb-4 border-b border-[oklch(0.40_0_0)] pb-2",
    btn: "min-h-[44px] px-4 py-3 bg-[oklch(0.32_0.10_25)] hover:bg-[oklch(0.20_0.07_22)] border border-[oklch(0.73_0.10_78)] text-[oklch(0.97_0.07_100)] tracking-wider text-sm transition rounded-sm disabled:opacity-50",
    input: "w-full min-h-[44px] px-3 py-2 bg-[oklch(0.06_0_0)] border border-[oklch(0.40_0_0)] text-[oklch(0.90_0_0)] rounded-sm focus:border-[oklch(0.73_0.10_78)] outline-none",
    card: "border border-[oklch(0.40_0_0)] bg-[oklch(0.06_0_0)] p-4 rounded-sm hover:border-[oklch(0.73_0.10_78)] cursor-pointer transition",
    muted: "text-[oklch(0.55_0_0)] text-sm",
    parchment: "bg-[oklch(0.78_0.05_70)] text-[oklch(0.27_0.04_45)] p-4 rounded-sm border border-[oklch(0.40_0_0)] leading-relaxed",
    gold: "text-[oklch(0.73_0.10_78)]",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('link', { href: "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;500;600&display=optional", rel: "stylesheet",}, void 0, false, {fileName: _jsxFileName, lineNumber: 39}, this )
      , _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Crucible of Judgment"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this)
        , _jsxDEV('p', { className: c.tagline, children: "A Ledger of Moral Reckoning"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 42}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 40}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "scenarios", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Scenarios" }, void 0, false, {fileName: _jsxFileName, lineNumber: 46}, this)
          , _jsxDEV('p', { className: c.muted + " mb-4", children: "Select a case to enter the chamber of judgment."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 47}, this)
          , _jsxDEV('div', { className: "grid gap-3" , children: 
            SCENARIOS.map(s => (
              _jsxDEV('div', {

                onClick: () => setSelectedId(s.id),
                className: c.card + (selectedId === s.id ? " border-[oklch(0.73_0.10_78)] bg-[oklch(0.20_0.07_22)]" : ""),
 children: [
                _jsxDEV('h3', { className: c.gold + " text-sm tracking-wider", children: s.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 55}, this)
                , _jsxDEV('p', { className: "text-sm mt-2" , children: s.text}, void 0, false, {fileName: _jsxFileName, lineNumber: 56}, this)
              ]}, s.id, true, {fileName: _jsxFileName, lineNumber: 50}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 45}, this)
        , _jsxDEV('section', { id: "chamber", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Chamber" }, void 0, false, {fileName: _jsxFileName, lineNumber: 62}, this)
          , _jsxDEV('div', { className: c.parchment + " mb-5 font-['Cinzel',serif]", children: 
            _jsxDEV('p', { className: "italic", children: selected.text}, void 0, false, {fileName: _jsxFileName, lineNumber: 64}, this)
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 63}, this)
          , _jsxDEV('form', {
            className: "space-y-4",
            onSubmit: async (e) => {
              e.preventDefault();
              if (!moral || !legal) return;
              await database.put({
                type: "judgment",
                scenarioId: selectedId,
                moral, legal, reasoning,
                authorSlug: "visitor",
                authorName: "Anonymous",
                createdAt: Date.now(),
              });
              setMoral(""); setLegal(""); setReasoning("");
            },
 children: [
            _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.gold + " text-sm tracking-wider block mb-2", children: "Is the person morally responsible?"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 83}, this)
              , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: 
                ["Fully", "Partially", "Not at all"].map(v => (
                  _jsxDEV('button', { type: "button", onClick: () => setMoral(v), className: c.btn + (moral === v ? " bg-[oklch(0.20_0.07_22)] ring-2 ring-[oklch(0.97_0.07_100)]" : ""), children: v}, v, false, {fileName: _jsxFileName, lineNumber: 86}, this)
                ))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 84}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 82}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.gold + " text-sm tracking-wider block mb-2", children: "Should they be held legally accountable?"     }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
              , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: 
                ["Yes", "Mitigated", "No"].map(v => (
                  _jsxDEV('button', { type: "button", onClick: () => setLegal(v), className: c.btn + (legal === v ? " bg-[oklch(0.20_0.07_22)] ring-2 ring-[oklch(0.97_0.07_100)]" : ""), children: v}, v, false, {fileName: _jsxFileName, lineNumber: 94}, this)
                ))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.gold + " text-sm tracking-wider block mb-2", children: "Your reasoning" }, void 0, false, {fileName: _jsxFileName, lineNumber: 99}, this)
              , _jsxDEV('textarea', { value: reasoning, onChange: e => setReasoning(e.target.value), className: c.input + " min-h-[100px]", placeholder: "Why did you judge as you did?"      ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 98}, this)
            , _jsxDEV('button', { type: "submit", disabled: !moral || !legal, className: c.btn + " w-full", children: "Render Verdict" }, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 66}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 61}, this)
        , _jsxDEV('section', { id: "judgments", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Collective Ledger"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 106}, this)
          , _jsxDEV('p', { className: c.muted + " mb-4", children: "Verdicts rendered by other souls on this case."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
          , (() => {
            const { docs } = useLiveQuery("scenarioId", { key: selectedId });
            const judgments = docs.filter(d => d.type === "judgment").sort((a, b) => b.createdAt - a.createdAt);
            if (judgments.length === 0) {
              return _jsxDEV('p', { className: c.muted + " text-xs italic", children: "No verdicts yet — be the first to judge."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this);
            }
            return (
              _jsxDEV('ul', { className: "space-y-3", children: 
                judgments.map(j => (
                  _jsxDEV('li', { className: c.card + " cursor-default hover:border-[oklch(0.40_0_0)]", children: [
                    _jsxDEV('div', { className: "flex items-center gap-2 mb-2"   , children: [
                      j.authorAvatar && _jsxDEV('img', { src: j.authorAvatar, alt: "", className: "w-6 h-6 rounded-full border border-[oklch(0.40_0_0)]"    ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this )
                      , _jsxDEV('span', { className: c.gold + " text-xs tracking-wider", children: j.authorName}, void 0, false, {fileName: _jsxFileName, lineNumber: 120}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 118}, this)
                    , _jsxDEV('div', { className: "text-xs space-y-1" , children: [
                      _jsxDEV('p', { children: [_jsxDEV('span', { className: c.muted, children: "Moral:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this), " " , _jsxDEV('span', { className: c.gold, children: j.moral}, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 123}, this)
                      , _jsxDEV('p', { children: [_jsxDEV('span', { className: c.muted, children: "Legal:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this), " " , _jsxDEV('span', { className: c.gold, children: j.legal}, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 124}, this)
                      , j.reasoning && _jsxDEV('p', { className: "italic mt-2 text-[oklch(0.90_0_0)]"  , children: ["\"", j.reasoning, "\""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 122}, this)
                  ]}, j._id, true, {fileName: _jsxFileName, lineNumber: 117}, this)
                ))
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 115}, this)
            );
          })()
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 105}, this)
        , _jsxDEV('section', { id: "frameworks", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Three Frameworks"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 134}, this)
          , _jsxDEV('p', { className: c.muted + " mb-4", children: "Summon the philosophers to weigh this case."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this)
          , (() => {
            const { docs: analyses } = useLiveQuery("scenarioId", { key: selectedId });
            const analysis = analyses.find(d => d.type === "analysis");
            const invoke = async () => {
              setAnalyzing(true);
              try {
                const res = await callAI(
                  `Analyze this moral case through three frameworks. Case: "${selected.text}"\n\nFor each of compatibilism, hard incompatibilism, and libertarian free will, give a verdict on moral responsibility (Fully/Partially/Not at all), a verdict on legal accountability (Yes/Mitigated/No), and a concise argument (2-3 sentences).`,
                  { schema: { properties: {
                    compatibilism: { type: "object", properties: { moral: { type: "string" }, legal: { type: "string" }, argument: { type: "string" } } },
                    hardIncompatibilism: { type: "object", properties: { moral: { type: "string" }, legal: { type: "string" }, argument: { type: "string" } } },
                    libertarian: { type: "object", properties: { moral: { type: "string" }, legal: { type: "string" }, argument: { type: "string" } } },
                  }}}
                );
                const parsed = JSON.parse(res);
                await database.put({ type: "analysis", scenarioId: selectedId, ...parsed, createdAt: Date.now() });
              } finally { setAnalyzing(false); }
            };
            const frameworks = analysis ? [
              { key: "compatibilism", name: "Compatibilism", data: analysis.compatibilism },
              { key: "hardIncompatibilism", name: "Hard Incompatibilism", data: analysis.hardIncompatibilism },
              { key: "libertarian", name: "Libertarian Free Will", data: analysis.libertarian },
            ] : null;
            return (
              _jsxDEV(_Fragment, { children: [
                _jsxDEV('button', { onClick: invoke, disabled: analyzing, className: c.btn + " w-full mb-4 flex items-center justify-center gap-2", children: 
                  analyzing ? (
                    _jsxDEV(_Fragment, { children: [
                      _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 164}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 164}, this), "Consulting the philosophers..."

                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 163}, this)
                  ) : analysis ? "Re-invoke Analysis" : "Invoke Analysis"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
                , _jsxDEV('div', { className: "space-y-3", children: 
                  frameworks ? frameworks.map(f => (
                    _jsxDEV('div', { className: c.card + " cursor-default hover:border-[oklch(0.40_0_0)]", children: [
                      _jsxDEV('h3', { className: c.gold + " text-sm tracking-wider mb-2", children: f.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
                      , _jsxDEV('div', { className: "text-xs space-y-1 mb-2"  , children: [
                        _jsxDEV('p', { children: [_jsxDEV('span', { className: c.muted, children: "Moral:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this), " " , _jsxDEV('span', { className: c.gold, children: _optionalChain([f, 'access', _ => _.data, 'optionalAccess', _2 => _2.moral])}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 174}, this)
                        , _jsxDEV('p', { children: [_jsxDEV('span', { className: c.muted, children: "Legal:"}, void 0, false, {fileName: _jsxFileName, lineNumber: 175}, this), " " , _jsxDEV('span', { className: c.gold, children: _optionalChain([f, 'access', _3 => _3.data, 'optionalAccess', _4 => _4.legal])}, void 0, false, {fileName: _jsxFileName, lineNumber: 175}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 175}, this)
                      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 173}, this)
                      , _jsxDEV('p', { className: "text-sm italic text-[oklch(0.90_0_0)] leading-relaxed"   , children: _optionalChain([f, 'access', _5 => _5.data, 'optionalAccess', _6 => _6.argument])}, void 0, false, {fileName: _jsxFileName, lineNumber: 177}, this)
                    ]}, f.key, true, {fileName: _jsxFileName, lineNumber: 171}, this)
                  )) : (
                    _jsxDEV('p', { className: c.muted + " text-xs italic", children: "The frameworks await invocation."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 180}, this)
                  )
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 169}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 160}, this)
            );
          })()
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 133}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 44}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 38}, this)
  );
}