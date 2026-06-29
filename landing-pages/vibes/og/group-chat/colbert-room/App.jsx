const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery } = useFireproof("colbert-bits");
  const { docs: bits } = useLiveQuery("createdAt", { descending: true });
  const [topic, setTopic] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function generateBit(e) {
    _optionalChain([e, 'optionalAccess', _ => _.preventDefault, 'call', _2 => _2()]);
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Write a short Stephen Colbert-style satirical monologue about this topic: "${topic}". Use his signature deadpan-to-absurd escalation, a comedic build, and a sharp punchline. Keep it under 150 words.`,
        { schema: { properties: {
          title: { type: "string", description: "Headline-style title for the bit" },
          monologue: { type: "string", description: "The monologue text" },
          rating: { type: "number", description: "Comedic rating 1-10" },
        }}}
      );
      const data = JSON.parse(res);
      await database.put({
        topic: topic.trim(),
        title: data.title,
        monologue: data.monologue,
        rating: data.rating,
        createdAt: Date.now(),
        authorSlug: _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]),
        authorName: _nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _4 => _4.displayName]), () => ( _optionalChain([viewer, 'optionalAccess', _5 => _5.userSlug]))),
      });
      setTopic("");
    } finally { setIsLoading(false); }
  }

  async function suggestTopic() {
    setIsSuggesting(true);
    try {
      const res = await callAI("Suggest one juicy, absurd, or mundane topic for a satirical late-night monologue. Just the topic, one sentence.",
        { schema: { properties: { topic: { type: "string" } } } });
      setTopic(JSON.parse(res).topic);
    } finally { setIsSuggesting(false); }
  }

  const c = {
    page: "min-h-screen bg-[#f4f1ea] text-[#1a1a1a] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]",
    header: "bg-[#1a1a1a] text-[#f4f1ea] px-5 py-6 border-b-4 border-[#c8102e]",
    title: "text-3xl font-bold tracking-tight",
    tagline: "text-sm text-[#c8c8c8] mt-1 italic",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section: "bg-white border border-[#1a1a1a] rounded-sm p-5 shadow-sm",
    h2: "text-xl font-bold mb-3 border-b-2 border-[#c8102e] pb-1",
    input: "w-full border border-[#1a1a1a] rounded-sm p-3 text-base min-h-[44px] bg-[#fdfcf8]",
    textarea: "w-full border border-[#1a1a1a] rounded-sm p-3 text-base bg-[#fdfcf8] min-h-[100px]",
    btn: "bg-[#c8102e] text-white px-5 py-3 rounded-sm font-bold min-h-[44px] disabled:opacity-50 hover:bg-[#a00d24]",
    btnGhost: "text-[#c8102e] text-sm underline",
    card: "border-l-4 border-[#c8102e] bg-[#fdfcf8] p-4 mb-3",
    cardTitle: "text-lg font-bold mb-2",
    cardBody: "text-sm leading-relaxed whitespace-pre-wrap",
    punchline: "text-sm font-bold italic text-[#c8102e] mt-3 pt-3 border-t border-[#c8102e]/30 leading-relaxed",
    meta: "text-xs text-[#666] mt-2 flex justify-between items-center",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "The Late Show Bit"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 71}, this)
        , _jsxDEV('p', { className: c.tagline, children: "Your group chat, but with a writers' room."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 72}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 70}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "submit-topic", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Drop a topic"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 76}, this)
          , !can("write") ? (
            _jsxDEV('div', { className: "space-y-4" , children: [
              _jsxDEV('p', { className: "text-sm text-[#666] italic" , children: "Drop any topic — group chat drama, yesterday's news, your boss's parking spot — and the writers' room turns it into a Colbert-style monologue."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this)
              , _jsxDEV('div', { className: "space-y-2" , children: [
                _jsxDEV('p', { className: "text-xs font-bold uppercase tracking-widest text-[#c8102e]" , children: "Example topics"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this)
                , _jsxDEV('div', { className: "flex flex-wrap gap-2" , children: [
                  "My neighbor's leaf blower at 7am",
                  "Congress debating pizza toppings",
                  "The office fridge mystery smell",
                  "Airlines charging for oxygen next",
                ].map((t) => _jsxDEV('span', { className: "inline-block bg-[#f4f1ea] border border-[#c8102e]/40 text-[#1a1a1a] text-xs px-3 py-1 rounded-sm" , children: t }, t, false, {fileName: _jsxFileName, lineNumber: 78}, this))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 78}, this)
              , _jsxDEV('p', { className: "text-xs text-[#999]" , children: "Share this link with friends so they can submit topics."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 78}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 78}, this)
          ) : (
            _jsxDEV('form', { className: "space-y-3", onSubmit: generateBit, children: [
              _jsxDEV('textarea', {
                className: c.textarea,
                placeholder: "Paste a group chat message or type any topic — dinner plans, sports takes, family drama…"               ,
                value: topic,
                onChange: (e) => setTopic(e.target.value),
                disabled: isLoading,}, void 0, false, {fileName: _jsxFileName, lineNumber: 81}, this
              )
              , _jsxDEV('div', { className: "flex items-center justify-between gap-3"   , children: [
                _jsxDEV('button', { type: "button", className: c.btnGhost, onClick: suggestTopic, disabled: isSuggesting || isLoading, children: 
                  isSuggesting ? "Thinking…" : "Need an idea?"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this)
                , _jsxDEV('button', { type: "submit", className: c.btn, disabled: isLoading || !topic.trim(), children: 
                  isLoading ? (
                    _jsxDEV('span', { className: "inline-flex items-center gap-2"  , children: [
                      _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 95}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 95}, this), "Writing…"

                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 94}, this)
                  ) : "Get the take"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 80}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 75}, this)
        , _jsxDEV('section', { id: "timeline", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Past takes" }, void 0, false, {fileName: _jsxFileName, lineNumber: 105}, this)
          , bits.length === 0 ? (
            _jsxDEV('div', { className: "py-6 text-center space-y-3"  , children: [
              _jsxDEV('p', { className: "text-4xl" , children: "🎤" }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
              , _jsxDEV('p', { className: "text-base font-bold text-[#1a1a1a]" , children: "The writers' room is empty." }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
              , _jsxDEV('p', { className: "text-sm text-[#666]" , children: "Drop a topic above — the AI will write you a full Colbert-style monologue complete with a rating." }, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 107}, this)
          ) : (
            _jsxDEV('div', { children: 
              bits.map((bit) => (
                _jsxDEV('article', { className: c.card, children: [
                  _jsxDEV('h3', { className: c.cardTitle, children: bit.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
                  , _jsxDEV('p', { className: "text-xs text-[#888] italic mb-2"   , children: ["on: " , bit.topic]}, void 0, true, {fileName: _jsxFileName, lineNumber: 113}, this)
                  , _jsxDEV('p', { className: c.cardBody, children: (() => { const paras = (bit.monologue || "").split(/\n\n+/); return paras.length > 1 ? paras.slice(0, -1).join("\n\n") : bit.monologue; })()}, void 0, false, {fileName: _jsxFileName, lineNumber: 114}, this)
                  , bit.monologue && bit.monologue.split(/\n\n+/).length > 1 && _jsxDEV('p', { className: c.punchline, children: ["🎤  " , bit.monologue.split(/\n\n+/).slice(-1)[0]]}, void 0, true, {fileName: _jsxFileName, lineNumber: 114}, this)
                  , _jsxDEV('div', { className: c.meta, children: [
                    _jsxDEV('span', { children: ["Rating: " , bit.rating, "/10 " , bit.authorName ? `• by ${bit.authorName}` : ""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 116}, this)
                    , can("write") && (
                      _jsxDEV('button', { onClick: () => database.del(bit._id), className: c.btnGhost, 'aria-label': "Delete bit" , children: 
                        _jsxDEV('svg', { width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsxDEV('path', { d: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"                 ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this)
                      }, void 0, false, {fileName: _jsxFileName, lineNumber: 118}, this)
                    )
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
                ]}, bit._id, true, {fileName: _jsxFileName, lineNumber: 111}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 104}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 69}, this)
  );
}