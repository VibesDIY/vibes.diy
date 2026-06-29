const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useDocument, useLiveQuery } = useFireproof("shelf-wishes");
  const { doc: wish, merge: mergeWish, submit: submitWish, reset: resetWish } = useDocument({
    type: "wish",
    title: "",
    author: "",
    tags: [],
    blurb: "",
    fulfilled: false,
    createdAt: Date.now(),
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function handleAddWish(e) {
    e.preventDefault();
    if (!wish.title.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(
        `Book: "${wish.title}" by ${wish.author || "unknown"}. Give 3 short genre tags and a one-sentence blurb.`,
        { schema: { properties: { tags: { type: "array", items: { type: "string" } }, blurb: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      await database.put({
        ...wish,
        tags: parsed.tags || [],
        blurb: parsed.blurb || "",
        createdAt: Date.now(),
        postedBy: _nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _ => _.userSlug]), () => ( "anonymous")),
        postedName: _nullishCoalesce(_nullishCoalesce(_optionalChain([viewer, 'optionalAccess', _2 => _2.displayName]), () => ( _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]))), () => ( "anonymous")),
      });
      resetWish();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSuggest() {
    setIsSuggesting(true);
    try {
      const res = await callAI(
        "Suggest one realistic book a community member might wish for at a little free library. Return title and author.",
        { schema: { properties: { title: { type: "string" }, author: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      mergeWish({ title: parsed.title || "", author: parsed.author || "" });
    } finally {
      setIsSuggesting(false);
    }
  }

  const c = {
    page: "min-h-screen bg-[var(--bg)] text-[var(--ink)] font-[Helvetica_Neue,Helvetica,Arial,sans-serif]",
    header: "border-b-2 border-[var(--ink)] px-5 py-6 bg-[var(--paper)]",
    title: "text-3xl md:text-4xl font-bold tracking-tight uppercase",
    tagline: "text-sm italic mt-1 text-[var(--muted)]",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-8",
    section: "border border-[var(--rule)] bg-[var(--paper)] p-5 rounded-sm",
    h2: "text-xl font-bold uppercase tracking-wide border-b border-[var(--rule)] pb-2 mb-3",
    input: "w-full border border-[var(--rule)] bg-[var(--bg)] px-3 py-3 min-h-[44px] text-base rounded-sm",
    btn: "min-h-[44px] px-6 py-3 bg-[var(--ink)] text-[var(--paper)] font-semibold uppercase tracking-wide text-base rounded-sm disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-3 border border-[var(--rule)] text-base rounded-sm",
    row: "border-b border-[var(--rule)] py-3 last:border-b-0",
    muted: "text-base text-[var(--muted)]",
    tag: "inline-block text-sm border border-[var(--rule)] px-2 py-0.5 mr-1 mb-1 rounded-sm",
  };

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `
        :root { --bg:#f7f5ef; --paper:#fffdf7; --ink:#161513; --muted:#5b574e; --rule:#d8d2c2; --accent:#7a1f1a; }
        @media (prefers-color-scheme: dark) {
          :root { --bg:#14130f; --paper:#1c1b17; --ink:#f1ece0; --muted:#a8a294; --rule:#3a362d; --accent:#d98a7a; }
        }
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 77}, this)
      , _jsxDEV('header', { id: "app-header", style: {
        background: `linear-gradient(rgba(22,21,19,0.45), rgba(22,21,19,0.65)), url('https://images.unsplash.com/photo-1780400889616-303fff7ddcf1?w=1920&q=80&fit=crop') center/cover no-repeat`,
        padding: "0", textAlign: "center", borderBottom: "2px solid var(--ink)",
        minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        position: "relative"
      }, children: [
        _jsxDEV('h1', { style: { color: "#f7f5ef", textShadow: "0 2px 20px rgba(0,0,0,0.5)", fontWeight: 700, fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1.1, fontStyle: "italic", maxWidth: "600px", padding: "0 1.5rem" }, children: "What are you hoping for?" }, void 0, false, {fileName: _jsxFileName, lineNumber: 84}, this)
        , _jsxDEV('p', { style: { fontSize: "clamp(1rem, 2.5vw, 1.3rem)", color: "#e8e4d8", marginTop: "1rem", fontStyle: "italic", textShadow: "0 2px 20px rgba(0,0,0,0.5)", maxWidth: "500px", padding: "0 1.5rem" }, children: "Post what book you want. The steward marks it found."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 85}, this)
        , viewer && _jsxDEV('p', { style: { fontSize: "1rem", color: "#d8d2c2", marginTop: "1rem" }, children: ["Signed in as "   , _nullishCoalesce(viewer.displayName, () => ( viewer.userSlug))]}, void 0, true, {fileName: _jsxFileName, lineNumber: 86}, this)
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@haberdoedas?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Haberdoedas" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 83}, this)

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "post-wish", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Post a Wish"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this)
          , !can("write") ? (
            _jsxDEV('p', { className: c.muted, children: "Read-only view — contact the library steward for write access to post wishes."            }, void 0, false, {fileName: _jsxFileName, lineNumber: 93}, this)
          ) : (
            _jsxDEV('form', { className: "space-y-3", onSubmit: handleAddWish, children: [
              _jsxDEV('input', {
                className: c.input,
                placeholder: "Book title" ,
                value: wish.title,
                onChange: (e) => mergeWish({ title: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 96}, this
              )
              , _jsxDEV('input', {
                className: c.input,
                placeholder: "Author",
                value: wish.author,
                onChange: (e) => mergeWish({ author: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this
              )
              , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
                _jsxDEV('button', { type: "submit", className: c.btn, disabled: isLoading || !wish.title.trim(), children: 
                  isLoading ? (
                    _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: 
                      _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" , strokeLinecap: "round",}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this )
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 111}, this)
                  ) : "Post a wish"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
                , _jsxDEV('button', { type: "button", className: c.btnGhost, onClick: handleSuggest, disabled: isSuggesting, children: 
                  isSuggesting ? "Thinking..." : "Suggest example"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 116}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 108}, this)
              , _jsxDEV('p', { className: c.muted, children: "We'll auto-tag genres and add a short blurb."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 120}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 95}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 90}, this)

        , _jsxDEV('section', { id: "wish-feed", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Current Wishes" }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
          , _jsxDEV(WishFeed, { c: c, database: database, useLiveQuery: useLiveQuery, can: can,}, void 0, false, {fileName: _jsxFileName, lineNumber: 127}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 125}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 89}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 76}, this)
  );
}

function WishFeed({ c, database, useLiveQuery, can }) {
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const wishes = docs.filter((d) => d.type === "wish");
  if (wishes.length === 0) {
    return _jsxDEV('p', { className: c.muted, children: "No wishes yet — be the first to add one."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 138}, this);
  }
  return (
    _jsxDEV('ul', { children: 
      wishes.map((w) => (
        _jsxDEV('li', { className: c.row, children: 
          _jsxDEV('div', { className: "flex justify-between items-start gap-3"   , children: [
            _jsxDEV('div', { className: "flex-1", children: [
              _jsxDEV('strong', { style: { textDecoration: w.fulfilled ? "line-through" : "none" }, children: w.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 146}, this)
              , w.author && _jsxDEV('div', { className: c.muted, children: ["by " , w.author]}, void 0, true, {fileName: _jsxFileName, lineNumber: 147}, this)
              , w.blurb && _jsxDEV('p', { className: "text-sm mt-1" , children: w.blurb}, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
              , _optionalChain([w, 'access', _4 => _4.tags, 'optionalAccess', _5 => _5.length]) > 0 && (
                _jsxDEV('div', { className: "mt-2", children: 
                  w.tags.map((t) => _jsxDEV('span', { className: c.tag, children: t}, t, false, {fileName: _jsxFileName, lineNumber: 151}, this))
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 150}, this)
              )
              , w.fulfilled && _jsxDEV('div', { className: "text-xs mt-1 font-bold uppercase"   , style: { color: "var(--accent)" }, children: "Fulfilled"}, void 0, false, {fileName: _jsxFileName, lineNumber: 154}, this)
              , _jsxDEV('div', { className: c.muted, style: { fontSize: "0.85rem", marginTop: 4 }, children: ["posted by "  , w.postedName || "anonymous"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 155}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 145}, this)
            , can("write") && (
              _jsxDEV('div', { className: "flex flex-col gap-1"  , children: [
                _jsxDEV('button', {
                  className: c.btnGhost,
                  onClick: () => database.put({ ...w, fulfilled: !w.fulfilled }),
 children: 
                  w.fulfilled ? "Reopen" : "Fulfilled"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 159}, this)
                , _jsxDEV('button', { className: c.btnGhost, onClick: () => database.del(w._id), children: "Remove"}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 158}, this)
            )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 144}, this)
        }, w._id, false, {fileName: _jsxFileName, lineNumber: 143}, this)
      ))
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 141}, this)
  );
}