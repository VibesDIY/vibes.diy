const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function GiftList({ c, database, useLiveQuery, can }) {
  const { docs: gifts } = useLiveQuery("type", { key: "gift", descending: true });
  const { docs: claims } = useLiveQuery("type", { key: "claim" });
  const [claimNames, setClaimNames] = React.useState({});

  async function claimGift(giftId) {
    const name = (claimNames[giftId] || "").trim();
    if (!name) return;
    await database.put({ type: "claim", giftId, name, createdAt: Date.now() });
    setClaimNames((s) => ({ ...s, [giftId]: "" }));
  }

  if (!gifts.length) {
    return (
      _jsxDEV('section', { className: c.section, children: [
        _jsxDEV('h2', { className: c.h2, children: "The list" }, void 0, false, {fileName: _jsxFileName, lineNumber: 20}, this)
        , _jsxDEV('p', { className: c.muted, children: ["No gifts yet. "   , can("write") ? "Add one above." : "Check back soon."]}, void 0, true, {fileName: _jsxFileName, lineNumber: 21}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 19}, this)
    );
  }

  return (
    _jsxDEV('section', { className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: ["The list ("  , gifts.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 28}, this)
      , _jsxDEV('ul', { className: "space-y-3", children: 
        gifts.map((g) => {
          const giftClaims = claims.filter((cl) => cl.giftId === g._id);
          const remaining = Math.max(0, (g.quantity || 1) - giftClaims.length);
          return (
            _jsxDEV('li', { className: c.row, children: [
              _jsxDEV('div', { className: "flex justify-between items-start gap-3"   , children: [
                _jsxDEV('div', { className: "flex-1", children: [
                  _jsxDEV('div', { className: "font-semibold", children: 
                    g.link ? _jsxDEV('a', { href: g.link, target: "_blank", rel: "noreferrer", className: "underline decoration-[oklch(0.72_0.15_75)]" , children: g.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 38}, this) : g.name
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 37}, this)
                  , _jsxDEV('div', { className: c.muted, children: [g.price && `${g.price} · `, remaining, " of "  , g.quantity || 1, " open" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 40}, this)
                  , g.note && _jsxDEV('div', { className: c.muted + " mt-1 italic", children: g.note}, void 0, false, {fileName: _jsxFileName, lineNumber: 41}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 36}, this)
                , can("write") && (
                  _jsxDEV('button', { onClick: () => database.del(g._id), className: "text-[0.85rem] text-[oklch(0.50_0.04_290)] hover:text-[oklch(0.72_0.15_75)]"  , children: "remove"}, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
                )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 35}, this)
              , giftClaims.length > 0 && (
                _jsxDEV('div', { className: "mt-2 flex flex-wrap gap-2"   , children: 
                  giftClaims.map((cl) => (
                    _jsxDEV('span', { className: "text-[0.85rem] px-3 py-1 rounded-full bg-[oklch(0.55_0.18_300/0.2)] text-[oklch(0.93_0.02_80)] border border-[oklch(0.55_0.18_300/0.4)]"       , children:
                      cl.name
                    }, cl._id, false, {fileName: _jsxFileName, lineNumber: 50}, this)
                  ))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 48}, this)
              )
              , remaining > 0 && (
                _jsxDEV('div', { className: "flex gap-2 mt-3"  , children: [
                  _jsxDEV('input', {
                    className: c.input,
                    placeholder: "Your name to claim"   ,
                    value: claimNames[g._id] || "",
                    onChange: (e) => setClaimNames((s) => ({ ...s, [g._id]: e.target.value })),
                    onKeyDown: (e) => { if (e.key === "Enter") claimGift(g._id); },}, void 0, false, {fileName: _jsxFileName, lineNumber: 58}, this
                  )
                  , _jsxDEV('button', { className: c.btnGhost, onClick: () => claimGift(g._id), disabled: !(claimNames[g._id] || "").trim(), children: "I got this one"}, void 0, false, {fileName: _jsxFileName, lineNumber: 65}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 57}, this)
              )
            ]}, g._id, true, {fileName: _jsxFileName, lineNumber: 34}, this)
          );
        })
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 29}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 27}, this)
  );
}

export default function App() {
  const { viewer, can, isViewerPending, ViewerTag } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("gift-registry");
  const { doc: newGift, merge: mergeGift, submit: submitGift } = useDocument({
    type: "gift", name: "", price: "", quantity: 1, link: "", note: "", createdAt: Date.now()
  });
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function suggest() {
    if (!newGift.name.trim()) return;
    setIsSuggesting(true);
    try {
      const { callAI } = await import("call-ai");
      const res = await callAI(`Suggest a typical price (USD) and a one-sentence shopping tip for this gift: "${newGift.name}"`, {
        schema: { properties: { price: { type: "string" }, note: { type: "string" } } }
      });
      const parsed = JSON.parse(res);
      mergeGift({ price: parsed.price || newGift.price, note: parsed.note || newGift.note });
    } finally { setIsSuggesting(false); }
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)] font-['Inter',sans-serif]",
    header: "sticky top-0 z-10 backdrop-blur bg-[oklch(0.08_0.03_280/0.85)] border-b border-[oklch(0.65_0.15_80/0.12)] px-5 py-4",
    title: "text-2xl font-bold tracking-tight font-['Space_Mono',monospace] text-[oklch(0.72_0.15_75)]",
    tagline: "text-base text-[oklch(0.50_0.04_290)] mt-1",
    main: "max-w-2xl mx-auto px-5 py-6 space-y-6 pb-24",
    section: "bg-[oklch(0.12_0.03_280/0.7)] border border-[oklch(0.65_0.15_80/0.12)] rounded-2xl p-6",
    h2: "text-[1.4rem] font-bold mb-3 font-['Space_Mono',monospace] text-[oklch(0.93_0.02_80)]",
    input: "w-full bg-[oklch(0.08_0.03_280)] border border-[oklch(0.65_0.15_80/0.12)] rounded-lg px-3 py-3 min-h-[44px] text-base text-[oklch(0.93_0.02_80)] placeholder:text-[oklch(0.50_0.04_290)] focus:outline-none focus:border-[oklch(0.72_0.15_75)]",
    btn: "min-h-[44px] px-6 py-3 rounded-lg bg-[oklch(0.72_0.15_75)] text-base text-[oklch(0.10_0.03_280)] font-semibold hover:brightness-110 disabled:opacity-50",
    btnGhost: "min-h-[44px] px-6 py-3 rounded-lg border border-[oklch(0.65_0.15_80/0.12)] text-base text-[oklch(0.93_0.02_80)] hover:bg-[oklch(0.12_0.03_280/0.7)] disabled:opacity-50",
    btnPurple: "min-h-[44px] px-6 py-3 rounded-lg bg-[oklch(0.55_0.18_300)] text-white text-base font-medium hover:brightness-110 disabled:opacity-50",
    row: "border border-[oklch(0.65_0.15_80/0.12)] rounded-xl p-5 bg-[oklch(0.08_0.03_280/0.5)]",
    muted: "text-base text-[oklch(0.50_0.04_290)]",
    label: "block text-[0.85rem] uppercase tracking-wide text-[oklch(0.50_0.04_290)] mb-1 font-['Space_Mono',monospace]",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Mono:wght@400;700&display=optional');`}, void 0, false, {fileName: _jsxFileName, lineNumber: 116}, this)
      , _jsxDEV('header', { id: "app-header", className: c.header, style: {
          background: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.65)), url('https://images.unsplash.com/photo-1640116682712-94bf1c17abe2?w=1920&q=80&fit=crop') center/cover",
          padding: "0", borderBottom: "none", minHeight: "60vh", display: "flex", alignItems: "flex-end", position: "relative"
        }, children: [
        _jsxDEV('div', { style: { padding: "3rem 1.5rem", width: "100%" }, children: [
        _jsxDEV('h1', { style: { color: "#f0c040", fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: "900", lineHeight: "1", letterSpacing: "-0.03em", fontFamily: "'Space Mono', monospace", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }, children: "Dibs." }, void 0, false, {fileName: _jsxFileName, lineNumber: 118}, this)
        , _jsxDEV('p', { style: { color: "rgba(255,255,255,0.8)", fontSize: "clamp(1rem, 2.5vw, 1.3rem)", marginTop: "1rem", maxWidth: "500px", lineHeight: "1.5" }, children: "One list. Everyone claims a gift. No duplicates. No awkward asks."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 119}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117.5}, this)
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@p_pixels_p?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Patrick Pahlke" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        (!isViewerPending && !viewer) && (
        _jsxDEV('div', { className: "flex flex-col items-center gap-3 my-2"  , children: [
          _jsxDEV(ViewerTag, { style: { background: '#f0c040', border: 'none', color: '#1a1a1a', borderRadius: '0.5rem', padding: '0.9rem 2.2rem', fontSize: '1.15rem', fontWeight: 700, fontFamily: "'Space Mono', monospace", boxShadow: '0 4px 18px rgba(0,0,0,0.35)' } }, void 0, false, {fileName: _jsxFileName}, this)
          , _jsxDEV('p', { className: "text-sm opacity-70"  , children: "Sign in to add gifts and call dibs on what you'll bring."     }, void 0, false, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName}, this)
        )
        , can("write") && (
        _jsxDEV('section', { id: "add-gift", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Add a gift"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this)
          , _jsxDEV('form', { className: "space-y-3", onSubmit: (e) => { e.preventDefault(); if (newGift.name.trim()) submitGift(); }, children: [
            _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Gift name" }, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this)
              , _jsxDEV('div', { className: "flex gap-2" , children: [
                _jsxDEV('input', { className: c.input, placeholder: "e.g. Cast iron skillet"   , value: newGift.name, onChange: (e) => mergeGift({ name: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 129}, this )
                , _jsxDEV('button', { type: "button", className: c.btnPurple, onClick: suggest, disabled: isSuggesting || !newGift.name.trim(), children: 
                  isSuggesting ? (
                    _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this)
                  ) : "Suggest"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 130}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 128}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 126}, this)
            , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: [
              _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Price"}, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this)
                , _jsxDEV('input', { className: c.input, placeholder: "$45", value: newGift.price, onChange: (e) => mergeGift({ price: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 138}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Quantity"}, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
                , _jsxDEV('input', { className: c.input, type: "number", min: "1", value: newGift.quantity, onChange: (e) => mergeGift({ quantity: parseInt(e.target.value) || 1 }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 142}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 137}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Link (optional)" }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
              , _jsxDEV('input', { className: c.input, placeholder: "https://...", value: newGift.link, onChange: (e) => mergeGift({ link: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 149}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 147}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('label', { className: c.label, children: "Note"}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
              , _jsxDEV('input', { className: c.input, placeholder: "Any color works"  , value: newGift.note, onChange: (e) => mergeGift({ note: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 153}, this )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
            , _jsxDEV('button', { type: "submit", className: c.btn, disabled: !newGift.name.trim(), children: "Add to registry"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 123}, this)
        )
        , _jsxDEV(GiftList, { c: c, database: database, useLiveQuery: useLiveQuery, can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 159}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 115}, this)
  )
}