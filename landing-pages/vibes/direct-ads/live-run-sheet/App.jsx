const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("run-of-show");
  const { docs: cues } = useLiveQuery((doc) => [_nullishCoalesce(doc.cueNumber, () => ( 999))], { });
  const { doc: newCue, merge: mergeCue, submit: submitCue } = useDocument({
    cueNumber: "",
    time: "",
    description: "",
    department: "",
    status: "standby",
    createdAt: Date.now(),
  });
  const [aiLoading, setAiLoading] = React.useState(false);
  const [eventType, setEventType] = React.useState("");

  const DEMO_CUES = [
    { _id: "demo-1", cueNumber: "1", time: "18:30", description: "Doors open — house music up", department: "Audio", status: "fired" },
    { _id: "demo-2", cueNumber: "2", time: "19:00", description: "House lights to half", department: "LX", status: "fired" },
    { _id: "demo-3", cueNumber: "3", time: "19:05", description: "Welcome video playback — 90 sec", department: "Video", status: "fired" },
    { _id: "demo-4", cueNumber: "4", time: "19:08", description: "Intro music fade, mic check speaker 1", department: "Audio", status: "standby" },
    { _id: "demo-5", cueNumber: "5", time: "19:10", description: "Stage lights full — opening remarks", department: "LX", status: "standby" },
    { _id: "demo-6", cueNumber: "6", time: "19:45", description: "Lower house, roll keynote slides", department: "Video", status: "standby" },
    { _id: "demo-7", cueNumber: "7", time: "20:15", description: "Break music in — house lights up 70%", department: "Audio", status: "standby" },
    { _id: "demo-8", cueNumber: "8", time: "20:30", description: "Hold for Q&A — roving mic ready", department: "SM", status: "standby" },
  ];
  const displayCues = cues.length > 0 ? cues : DEMO_CUES;

  function cycleStatus(cue) {
    if (!can("write")) return;
    const next = cue.status === "standby" ? "fired" : cue.status === "fired" ? "skipped" : "standby";
    database.put({ ...cue, status: next, firedAt: next === "fired" ? Date.now() : null });
  }

  function statusStyle(s) {
    if (s === "fired") return { background: "oklch(0.85 0.30 140)", color: "oklch(0.07 0 0)" };
    if (s === "skipped") return { background: "oklch(0.60 0 0)", color: "oklch(0.95 0 0)" };
    return { background: "oklch(0.66 0.10 75)", color: "oklch(0.07 0 0)" };
  }

  async function suggestCue() {
    if (!eventType.trim()) return;
    setAiLoading(true);
    try {
      const res = await callAI(`Generate a single realistic production cue for this event type: ${eventType}. Pick a cue number not in this list: ${cues.map(c=>c.cueNumber).join(",")}.`, {
        schema: { properties: {
          cueNumber: { type: "string" },
          time: { type: "string", description: "HH:MM 24h" },
          description: { type: "string" },
          department: { type: "string", description: "LX, Audio, Video, SM, FOH" },
        }}
      });
      const parsed = JSON.parse(res);
      mergeCue(parsed);
    } finally { setAiLoading(false); }
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.98_0_0)] text-[oklch(0.28_0_0)] font-sans pb-24",
    header: "sticky top-0 z-10 bg-[oklch(0.28_0.05_240)] text-[oklch(0.95_0_0)] px-4 py-3 border-b-4 border-[oklch(0.58_0.20_35)] shadow-md",
    title: "text-xl font-bold tracking-tight uppercase",
    tagline: "text-sm text-[oklch(0.82_0.005_265)] mt-0.5",
    viewerChip: "flex items-center gap-2 text-sm",
    avatar: "w-7 h-7 rounded-full border-2 border-[oklch(0.58_0.20_35)]",
    main: "px-4 py-4 space-y-4 max-w-2xl mx-auto",
    section: "bg-[oklch(0.93_0.003_265)] border border-[oklch(0.82_0.005_265)] rounded-lg p-5 shadow-sm",
    sectionTitle: "text-base font-bold uppercase tracking-wider text-[oklch(0.28_0.05_240)] mb-3 flex items-center gap-2",
    sectionDot: "w-2 h-2 rounded-full bg-[oklch(0.58_0.20_35)]",
    input: "w-full px-3 py-3 min-h-[44px] bg-white border border-[oklch(0.82_0.005_265)] rounded text-base focus:outline-none focus:border-[oklch(0.58_0.20_35)]",
    label: "block text-sm font-semibold uppercase tracking-wide text-[oklch(0.55_0_0)] mb-1",
    btnPrimary: "w-full px-6 py-3 min-h-[44px] bg-[oklch(0.58_0.20_35)] text-white font-bold uppercase tracking-wide text-base rounded hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2",
    btnGhost: "px-4 py-3 min-h-[44px] text-sm uppercase tracking-wide font-semibold text-[oklch(0.28_0.05_240)] border border-[oklch(0.82_0.005_265)] rounded hover:bg-white",
    cueRow: "flex items-center gap-3 p-4 bg-white border border-[oklch(0.82_0.005_265)] rounded min-h-[64px] active:bg-[oklch(0.93_0.003_265)]",
    cueNum: "font-mono font-bold text-lg text-[oklch(0.28_0.05_240)] w-12 shrink-0",
    cueBody: "flex-1 min-w-0",
    cueDesc: "text-base font-medium truncate",
    cueMeta: "text-sm text-[oklch(0.55_0_0)] mt-0.5",
    statusBadge: "px-3 py-1.5 text-sm font-bold uppercase tracking-wide rounded shrink-0 min-w-[72px] text-center",
    readonly: "text-sm text-[oklch(0.55_0_0)] italic px-3 py-2",
    spinner: "w-4 h-4 animate-spin",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV(‘div’, { id: "app-header", style: {
          position: ‘relative’,
          background: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.7)), url(‘https://images.unsplash.com/photo-1763480708634-cd8de0549987?w=1920&q=80&fit=crop’) center/cover no-repeat",
          minHeight: ‘60vh’,
          display: ‘flex’,
          flexDirection: ‘column’,
          alignItems: ‘center’,
          justifyContent: ‘center’,
          padding: ‘3rem 1.5rem’,
          textAlign: ‘center’,
          borderBottom: ‘4px solid oklch(0.58 0.20 35)’,
        }, children: [
          _jsxDEV(‘h1’, { style: { fontSize: ‘clamp(2.5rem, 8vw, 5rem)’, fontWeight: ‘800’, letterSpacing: ‘0.04em’, textTransform: ‘uppercase’, color: ‘white’, lineHeight: ‘1.1’, textShadow: ‘0 2px 20px rgba(0,0,0,0.5)’ }, children: "Every cue. Every phone." }, void 0, false, {fileName: _jsxFileName, lineNumber: 92}, this)
          , _jsxDEV(‘p’, { style: { fontSize: ‘clamp(1rem, 2.5vw, 1.3rem)’, color: ‘rgba(255,255,255,0.85)’, marginTop: ‘1rem’, maxWidth: ‘460px’, lineHeight: ‘1.5’, textShadow: ‘0 2px 20px rgba(0,0,0,0.5)’ }, children: "The run of show, live on every crew member’s screen." }, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)
          , viewer && (
            _jsxDEV(‘div’, { style: { display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, gap: ‘0.5rem’, marginTop: ‘1.5rem’ }, children: [
              _jsxDEV(‘img’, { src: viewer.avatarUrl, alt: viewer.userSlug, className: c.avatar,}, void 0, false, {fileName: _jsxFileName, lineNumber: 97}, this )
              , _jsxDEV(‘span’, { style: { color: ‘rgba(255,255,255,0.8)’, fontSize: ‘0.875rem’ }, children: _nullishCoalesce(viewer.displayName, () => ( viewer.userSlug))}, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 96}, this)
          )
          , _jsxDEV(‘div’, { style: {
            position: ‘absolute’, bottom: ‘0.75rem’, right: ‘1rem’,
            fontSize: ‘0.7rem’, color: ‘rgba(255,255,255,0.5)’,
            textShadow: ‘0 1px 3px rgba(0,0,0,0.5)’
          }, children: [
            "Photo by ", _jsxDEV(‘a’, { href: "https://unsplash.com/@nathanpellerin?utm_source=vibes_diy&utm_medium=referral",
              style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ },
              target: "_blank", rel: "noopener noreferrer", children: "Nathan Pellerin"}, void 0, false, {fileName: _jsxFileName}, this),
            " on ", _jsxDEV(‘a’, { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
              style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ },
              target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
          ]}, void 0, true, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 89}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "cue-board", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [
            _jsxDEV('span', { className: c.sectionDot,}, void 0, false, {fileName: _jsxFileName, lineNumber: 107}, this), "Cue Board"
            , _jsxDEV('span', { className: "ml-auto text-sm font-normal normal-case text-[oklch(0.55_0_0)]"    , children: [displayCues.filter(x=>x.status==="fired").length, "/", displayCues.length, " fired" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 108}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 106}, this)
          , _jsxDEV('ul', { className: "space-y-2", children: 
              displayCues.map((cue) => (
                _jsxDEV('li', { children: 
                  _jsxDEV('button', {
                    type: "button",
                    onClick: () => cycleStatus(cue),
                    disabled: !can("write"),
                    className: c.cueRow + " w-full text-left disabled:cursor-not-allowed",
 children: [
                    _jsxDEV('span', { className: c.cueNum, children: ["Q", cue.cueNumber]}, void 0, true, {fileName: _jsxFileName, lineNumber: 119}, this)
                    , _jsxDEV('div', { className: c.cueBody, children: [
                      _jsxDEV('div', { className: c.cueDesc, children: cue.description}, void 0, false, {fileName: _jsxFileName, lineNumber: 121}, this)
                      , _jsxDEV('div', { className: c.cueMeta, children: [cue.time, " · "  , cue.department]}, void 0, true, {fileName: _jsxFileName, lineNumber: 122}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 120}, this)
                    , _jsxDEV('span', { className: c.statusBadge, style: statusStyle(cue.status), children: cue.status}, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 113}, this)
                }, cue._id, false, {fileName: _jsxFileName, lineNumber: 112}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 110}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 105}, this)

        , _jsxDEV('section', { id: "add-cue", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: [_jsxDEV('span', { className: c.sectionDot,}, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this), "Add Cue" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 132}, this)
          , _jsxDEV('form', { onSubmit: (e) => { e.preventDefault(); if (can("write")) submitCue(); }, className: "space-y-3", children: [
            _jsxDEV('div', { className: "flex gap-2" , children: [
              _jsxDEV('input', {
                type: "text",
                placeholder: "Event type (e.g. church service)"    ,
                value: eventType,
                onChange: (e) => setEventType(e.target.value),
                disabled: !can("write"),
                className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this
              )
              , _jsxDEV('button', { type: "button", onClick: suggestCue, disabled: aiLoading || !eventType.trim() || !can("write"), className: c.btnGhost + " shrink-0 whitespace-nowrap", children: 
                aiLoading ? (
                  _jsxDEV('svg', { className: c.spinner, viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 145}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 145}, this)
                ) : "AI Suggest"
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 134}, this)
            , _jsxDEV('div', { className: "grid grid-cols-2 gap-2"  , children: [
              _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Cue #" }, void 0, false, {fileName: _jsxFileName, lineNumber: 151}, this)
                , _jsxDEV('input', { type: "text", value: newCue.cueNumber, onChange: (e) => mergeCue({ cueNumber: e.target.value }), disabled: !can("write"), className: c.input, placeholder: "9",}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 150}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Time"}, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
                , _jsxDEV('input', { type: "text", value: newCue.time, onChange: (e) => mergeCue({ time: e.target.value }), disabled: !can("write"), className: c.input, placeholder: "20:45",}, void 0, false, {fileName: _jsxFileName, lineNumber: 156}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 154}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 149}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Description"}, void 0, false, {fileName: _jsxFileName, lineNumber: 160}, this)
              , _jsxDEV('input', { type: "text", value: newCue.description, onChange: (e) => mergeCue({ description: e.target.value }), disabled: !can("write"), className: c.input, placeholder: "House lights to half"   ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 161}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Department"}, void 0, false, {fileName: _jsxFileName, lineNumber: 164}, this)
              , _jsxDEV('input', { type: "text", value: newCue.department, onChange: (e) => mergeCue({ department: e.target.value }), disabled: !can("write"), className: c.input, placeholder: "LX / Audio / Video / SM"      ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 163}, this)
            , _jsxDEV('button', { type: "submit", disabled: !can("write"), className: c.btnPrimary + " disabled:opacity-50 disabled:cursor-not-allowed", children: "Add a cue" }, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 133}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 104}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
  )
}