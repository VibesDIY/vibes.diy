const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ShiftColumn({ id, shift, label, title, subtitle, c, signups, database, useDocument, can }) {
  const { doc, merge, submit } = useDocument({ name: "", shift, createdAt: Date.now() });
  const writable = can("write");
  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc.name.trim()) return;
    submit();
  };
  return (
    _jsxDEV('section', { id: id, className: c.section, children: [
      _jsxDEV('div', { children: [
        _jsxDEV('div', { className: c.shiftLabel, children: label}, void 0, false, {fileName: _jsxFileName, lineNumber: 16}, this)
        , _jsxDEV('div', { className: c.shiftTitle, children: title}, void 0, false, {fileName: _jsxFileName, lineNumber: 17}, this)
        , _jsxDEV('div', { className: c.count, children: [subtitle, " · "  , signups.length, " signed up"  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 18}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 15}, this)
      , writable ? (
        _jsxDEV('form', { onSubmit: onSubmit, className: "flex flex-col gap-2"  , children: [
          _jsxDEV('input', {
            className: c.input,
            placeholder: "Your name" ,
            value: doc.name,
            onChange: (e) => merge({ name: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 22}, this
          )
          , _jsxDEV('button', { type: "submit", className: c.btn, children: "Join the crew"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 28}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 21}, this)
      ) : (
        _jsxDEV('p', { className: c.readonly, children: "Read-only view — contact the organizer for write access."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 31}, this)
      )
      , _jsxDEV('ul', { className: "flex flex-col" , children: 
        signups.length === 0 ? (
          _jsxDEV('li', { className: c.empty, children: "No one yet — be the first."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 35}, this)
        ) : signups.map(s => (
          _jsxDEV('li', { className: c.row, children: [
            _jsxDEV('span', { className: c.name, children: s.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 38}, this)
            , writable && (
              _jsxDEV('button', { className: c.removeBtn, onClick: () => database.del(s._id), children: "remove"}, void 0, false, {fileName: _jsxFileName, lineNumber: 40}, this)
            )
          ]}, s._id, true, {fileName: _jsxFileName, lineNumber: 37}, this)
        ))
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 33}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 14}, this)
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { useLiveQuery, useDocument, database } = useFireproof("block-party-crew");
  const { docs: allSignups } = useLiveQuery("shift");

  const c = {
    page: "min-h-screen bg-[var(--bg)] text-[var(--ink)] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]",
    header: "border-b-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-5",
    title: "text-3xl font-bold tracking-tight",
    tagline: "text-sm text-[var(--muted)] mt-1 italic",
    main: "max-w-5xl mx-auto p-4 grid gap-4 md:grid-cols-3",
    section: "border border-[var(--ink)] bg-[var(--surface)] p-5 flex flex-col gap-3 min-h-[280px]",
    shiftLabel: "text-sm uppercase tracking-widest text-[var(--muted)]",
    shiftTitle: "text-2xl font-bold",
    count: "text-sm text-[var(--muted)]",
    input: "w-full border border-[var(--ink)] bg-[var(--bg)] px-3 py-3 text-base min-h-[44px]",
    btn: "border border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)] px-6 py-3 min-h-[44px] font-semibold text-base hover:bg-[var(--accent)]",
    row: "flex items-center justify-between border-b border-[var(--rule)] py-2",
    name: "text-base",
    removeBtn: "text-sm underline text-[var(--muted)] hover:text-[var(--ink)]",
    empty: "text-base text-[var(--muted)] italic py-4",
    readonly: "text-sm text-[var(--muted)] italic",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `
        :root {
          --bg: #f4f1ea;
          --surface: #fffdf7;
          --ink: #1a1a1a;
          --muted: #6b6b6b;
          --rule: #d4cfc2;
          --accent: #8b1e1e;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #14110d;
            --surface: #1f1c17;
            --ink: #f0ece2;
            --muted: #9a9486;
            --rule: #3a352d;
            --accent: #c97c7c;
          }
        }
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
      , _jsxDEV('header', { id: "app-header", style: {
        background: `linear-gradient(rgba(26,26,26,0.35), rgba(26,26,26,0.6)), url('https://images.unsplash.com/photo-1537111355507-1f73d87ecadf?w=1920&q=80&fit=crop') center/cover no-repeat`,
        padding: "0", textAlign: "center", borderBottom: "2px solid var(--ink)",
        minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        position: "relative",
      }, children: [
        _jsxDEV('h1', { style: { color: "#f4f1ea", textShadow: "0 2px 20px rgba(0,0,0,0.5)", fontWeight: 800, fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: "700px", padding: "0 1.5rem" }, children: "Saturday's almost here."    }, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this)
        , _jsxDEV('p', { style: { fontSize: "clamp(1rem, 2.5vw, 1.3rem)", color: "#e8e4d8", marginTop: "1rem", textShadow: "0 2px 20px rgba(0,0,0,0.5)", maxWidth: "550px", padding: "0 1.5rem" }, children: "Sign up for setup, claim your job, check the permit list."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 97}, this)
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@tomsekula?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Tom Sekula" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 95}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV(ShiftColumn, {
          id: "shift-setup",
          shift: "setup",
          label: "Saturday · 9:00 AM"   ,
          title: "Setup Crew" ,
          subtitle: "Tables, tents, signs"  ,
          c: c,
          signups: allSignups.filter(d => d.shift === "setup"),
          database: database,
          useDocument: useDocument,
          can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this
        )
        , _jsxDEV(ShiftColumn, {
          id: "shift-event",
          shift: "event",
          label: "Saturday · 12:00 PM"   ,
          title: "Event Crew" ,
          subtitle: "Greeters, grill, games"  ,
          c: c,
          signups: allSignups.filter(d => d.shift === "event"),
          database: database,
          useDocument: useDocument,
          can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this
        )
        , _jsxDEV(ShiftColumn, {
          id: "shift-teardown",
          shift: "teardown",
          label: "Saturday · 5:00 PM"   ,
          title: "Teardown Crew" ,
          subtitle: "Pack up, sweep, haul"   ,
          c: c,
          signups: allSignups.filter(d => d.shift === "teardown"),
          database: database,
          useDocument: useDocument,
          can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 99}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
  );
}