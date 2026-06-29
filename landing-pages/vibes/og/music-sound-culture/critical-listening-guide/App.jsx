const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

function AddRecordingForm({ database, c }) {
  const { useDocument } = useFireproof("jazz-guide");
  const { doc, merge, submit } = useDocument({ type: "recording", title: "", artist: "", year: "", ensemble: "" });
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function suggest() {
    setIsSuggesting(true);
    try {
      const response = await callAI("Suggest one landmark jazz recording (not Kind of Blue or West End Blues — be creative across eras from 1920s to 1970s).", {
        schema: { properties: { title: { type: "string" }, artist: { type: "string" }, year: { type: "string" }, ensemble: { type: "string", description: "ensemble type e.g. Hot Five, Quartet, Orchestra" } } }
      });
      const data = JSON.parse(response);
      merge(data);
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    _jsxDEV('form', { onSubmit: submit, className: "space-y-3", children: [
      _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "Title"}, void 0, false, {fileName: _jsxFileName, lineNumber: 26}, this)
        , _jsxDEV('input', { className: c.input, value: doc.title, onChange: e => merge({ title: e.target.value }), placeholder: "West End Blues"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 27}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 25}, this)
      , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: [
        _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "Artist"}, void 0, false, {fileName: _jsxFileName, lineNumber: 31}, this)
          , _jsxDEV('input', { className: c.input, value: doc.artist, onChange: e => merge({ artist: e.target.value }), placeholder: "Louis Armstrong" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 32}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 30}, this)
        , _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "Year"}, void 0, false, {fileName: _jsxFileName, lineNumber: 35}, this)
          , _jsxDEV('input', { className: c.input, value: doc.year, onChange: e => merge({ year: e.target.value }), placeholder: "1928",}, void 0, false, {fileName: _jsxFileName, lineNumber: 36}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 34}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 29}, this)
      , _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "Ensemble"}, void 0, false, {fileName: _jsxFileName, lineNumber: 40}, this)
        , _jsxDEV('input', { className: c.input, value: doc.ensemble, onChange: e => merge({ ensemble: e.target.value }), placeholder: "Hot Five" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 39}, this)
      , _jsxDEV('button', { type: "submit", className: c.btn, children: "Add Recording" }, void 0, false, {fileName: _jsxFileName, lineNumber: 43}, this)
      , _jsxDEV('button', { type: "button", onClick: suggest, disabled: isSuggesting, className: c.btnAlt, children: 
        isSuggesting ? "Thinking..." : "Suggest a landmark recording"
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 24}, this)
  );
}

const SEED_RECORDINGS = [
  { _id: "rec-west-end-blues", type: "recording", title: "West End Blues", artist: "Louis Armstrong", year: "1928", ensemble: "Hot Five" },
  { _id: "rec-so-what", type: "recording", title: "So What", artist: "Miles Davis", year: "1959", ensemble: "Kind of Blue Quintet" },
  { _id: "rec-giant-steps", type: "recording", title: "Giant Steps", artist: "John Coltrane", year: "1960", ensemble: "Quartet" },
]

export default function App() {
  const { database, useLiveQuery } = useFireproof("jazz-guide");
  const { docs: recordingsFromDb } = useLiveQuery("type", { key: "recording", descending: true });
  // Show seed recordings immediately so the catalog is never empty on first paint
  const recordings = recordingsFromDb.length > 0 ? recordingsFromDb : SEED_RECORDINGS;
  const { docs: selectedDocs } = useLiveQuery("type", { key: "selection" });
  const selection = selectedDocs[0];
  const { docs: guides } = useLiveQuery("recordingId", { key: _optionalChain([selection, 'optionalAccess', _ => _.recordingId]) });
  const guide = guides[0];
  const selectedRecording = recordings.find(r => r._id === _optionalChain([selection, 'optionalAccess', _2 => _2.recordingId]));
  const [isGenerating, setIsGenerating] = React.useState(false);

  async function selectRecording(id) {
    if (selection) await database.put({ ...selection, recordingId: id });
    else await database.put({ type: "selection", recordingId: id });
  }

  async function generateGuide(rec) {
    setIsGenerating(true);
    try {
      const prompt = `You are a jazz musicology analyst. Provide a detailed critical listening guide for "${rec.title}" by ${rec.artist} (${rec.year}, ${rec.ensemble}). Be specific and musically literate.`;
      const response = await callAI(prompt, {
        schema: {
          properties: {
            instrumentation: { type: "string", description: "Instruments present and ensemble texture (homophonic, polyphonic, call-and-response, etc.)" },
            form: { type: "string", description: "Formal structure: 12-bar blues, AABA, modal, free, etc., with measure counts" },
            soloMap: { type: "string", description: "Solo order with chorus counts and stylistic notes per soloist" },
            rhythmSection: { type: "string", description: "How rhythm section supports soloists: walking bass, comping style, drum approach" },
            melodyImprov: { type: "string", description: "Relationship between composed melody and improvised material - paraphrase, motivic development, harmonic substitution" },
            historicalContext: { type: "string", description: "What this recording reveals about its historical moment in jazz" },
          },
        },
      });
      const data = JSON.parse(response);
      await database.put({ type: "guide", recordingId: rec._id, ...data, createdAt: Date.now() });
    } finally {
      setIsGenerating(false);
    }
  }

  const c = {
    page: "min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-serif",
    header: "bg-[#2d2d2d] border-b-4 border-[#6b4a2b] px-4 py-5 sticky top-0 z-10 shadow-lg",
    title: "text-2xl md:text-3xl font-bold tracking-widest text-[#d4a857] text-center",
    tagline: "text-xs text-[#8a8a8a] text-center mt-1 tracking-wide",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    section: "bg-[#1f1f1f] border border-[#3a3a3a] rounded-md p-5 shadow-md",
    h2: "text-lg font-bold text-[#d4a857] tracking-wider mb-4 border-b border-[#3a3a3a] pb-2",
    btn: "bg-[#6b4a2b] hover:bg-[#8a5f37] text-[#f5e6c8] px-4 py-3 rounded min-h-[44px] font-semibold tracking-wide transition disabled:opacity-50",
    btnAlt: "bg-[#2d3a5a] hover:bg-[#3a4a6f] text-[#e5e5e5] px-3 py-2 rounded min-h-[44px] text-sm transition",
    input: "w-full bg-[#0a0a0a] border border-[#3a3a3a] rounded px-3 py-3 text-[#e5e5e5] focus:border-[#d4a857] focus:outline-none min-h-[44px]",
    card: "bg-[#161616] border border-[#3a3a3a] rounded p-4 hover:border-[#d4a857] cursor-pointer transition",
    label: "text-xs uppercase tracking-widest text-[#8a8a8a] mb-1 block",
    guideLabel: "text-xs uppercase tracking-widest text-[#d4a857] font-bold",
    guideText: "text-sm text-[#c8c8c8] leading-relaxed mt-1",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "OPUS CABINET" }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
        , _jsxDEV('p', { className: c.tagline, children: "· a critical listening guide for jazz ·"       }, void 0, false, {fileName: _jsxFileName, lineNumber: 110}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 108}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "catalog", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "The Catalog" }, void 0, false, {fileName: _jsxFileName, lineNumber: 114}, this)
          , _jsxDEV('div', { className: "space-y-3", children: [
            recordings.length === 0 && (
              _jsxDEV('p', { className: "text-sm text-[#8a8a8a] italic text-center"   , children: "No recordings yet. Add one below."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)
            )
            , recordings.map(r => (
              _jsxDEV('div', { onClick: () => selectRecording(r._id), className: `${c.card} ${_optionalChain([selection, 'optionalAccess', _3 => _3.recordingId]) === r._id ? "border-[#d4a857]" : ""}`, children: [
                _jsxDEV('div', { className: c.label, children: [r.year, " · "  , r.ensemble]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)
                , _jsxDEV('div', { className: "text-[#e5e5e5] font-semibold" , children: [r.title, " — "  , r.artist]}, void 0, true, {fileName: _jsxFileName, lineNumber: 122}, this)
              ]}, r._id, true, {fileName: _jsxFileName, lineNumber: 120}, this)
            ))
            , recordings.length > 0 && _jsxDEV('p', { className: "text-xs text-[#8a8a8a] italic text-center pt-2"    , children: "Tap a recording to load its listening guide."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 125}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 113}, this)
        , _jsxDEV('section', { id: "selected", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Listening Guide" }, void 0, false, {fileName: _jsxFileName, lineNumber: 129}, this)
          , !selectedRecording ? (
            _jsxDEV('p', { className: "text-sm text-[#8a8a8a] italic text-center py-6"    , children: "Select a recording from the catalog above."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 131}, this)
          ) : (
            _jsxDEV('div', { className: "space-y-4", children: [
              _jsxDEV('div', { children: [
                _jsxDEV('div', { className: "text-xl text-[#d4a857] font-bold"  , children: selectedRecording.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this)
                , _jsxDEV('div', { className: "text-sm text-[#c8c8c8]" , children: [selectedRecording.artist, " · "  , selectedRecording.year]}, void 0, true, {fileName: _jsxFileName, lineNumber: 136}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 134}, this)
              , !guide ? (
                _jsxDEV('div', { className: "text-center py-4" , children: [
                  _jsxDEV('p', { className: "text-sm text-[#8a8a8a] mb-3 italic"   , children: "No guide yet for this recording."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this)
                  , _jsxDEV('button', { className: c.btn, onClick: () => generateGuide(selectedRecording), disabled: isGenerating, children: 
                    isGenerating ? (
                      _jsxDEV('span', { className: "flex items-center gap-2 justify-center"   , children: [
                        _jsxDEV('svg', { className: "animate-spin w-4 h-4"  , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this), "Analyzing..."

                      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 143}, this)
                    ) : "Generate Listening Guide"
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
              ) : (
                _jsxDEV('div', { className: "space-y-4 pt-2" , children: 
                  [
                    ["Instrumentation & Ensemble Texture", guide.instrumentation],
                    ["Formal Structure", guide.form],
                    ["Solo Map", guide.soloMap],
                    ["Rhythm Section", guide.rhythmSection],
                    ["Melody ↔ Improvisation", guide.melodyImprov],
                    ["Historical Moment", guide.historicalContext],
                  ].map(([label, text]) => (
                    _jsxDEV('div', { children: [
                      _jsxDEV('div', { className: c.guideLabel, children: label}, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this)
                      , _jsxDEV('div', { className: c.guideText, children: text}, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this)
                    ]}, label, true, {fileName: _jsxFileName, lineNumber: 160}, this)
                  ))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 151}, this)
              )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 133}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 128}, this)
        , _jsxDEV('section', { id: "add-recording", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Add to Catalog"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 171}, this)
          , _jsxDEV(AddRecordingForm, { database: database, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 170}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 112}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 107}, this)
  );
}