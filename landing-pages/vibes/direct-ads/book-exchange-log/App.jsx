const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const EXAMPLE_BOOKS = [
  { _id: "ex1", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", genre: "Nature", status: "in-box" },
  { _id: "ex2", title: "The Warmth of Other Suns", author: "Isabel Wilkerson", genre: "History", status: "in-box" },
  { _id: "ex3", title: "A Gentleman in Moscow", author: "Amor Towles", genre: "Fiction", status: "in-box" },
]

function BookCard({ book, canWrite, onTake }) {
  return (
    _jsxDEV('li', { style: {
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "1.25rem", background: "#fff", border: "1px solid #d1e8da",
      borderRadius: "6px", gap: "1rem"
    }, children: [
      _jsxDEV('div', { children: [
        _jsxDEV('div', { style: { fontWeight: 600, color: "#1a3a2a", fontSize: "1.1rem" }, children: book.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 20}, this)
        , _jsxDEV('div', { style: { fontSize: "1rem", color: "#5a7a6a", marginTop: "0.15rem" }, children: [
          book.author ? `by ${book.author}` : "author unknown"
          , book.genre ? ` · ${book.genre}` : ""
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 21}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 19}, this)
      , canWrite && (
        _jsxDEV('button', { onClick: () => onTake(book), style: {
          flexShrink: 0, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", padding: "0.75rem 1.5rem", minHeight: "44px",
          border: "1.5px solid #2d6a4f", borderRadius: "4px",
          background: "transparent", color: "#2d6a4f", cursor: "pointer"
        }, children: "Take"}, void 0, false, {fileName: _jsxFileName, lineNumber: 27}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 14}, this)
  )
}

function LogLine({ log }) {
  const verb = log.action === "left" ? "left" : "took"
  return (
    _jsxDEV('li', { style: { fontSize: "1rem", color: "#5a7a6a", padding: "0.5rem 0", borderBottom: "1px solid #eef5f1" }, children: [
      _jsxDEV('span', { style: { fontWeight: 600, color: "#2d6a4f" }, children: log.by}, void 0, false, {fileName: _jsxFileName, lineNumber: 42}, this)
      , " ", verb, " " , _jsxDEV('em', { style: { color: "#1a3a2a" }, children: log.bookTitle}, void 0, false, {fileName: _jsxFileName, lineNumber: 43}, this)
      , _jsxDEV('span', { style: { color: "#9ab8a6", marginLeft: "0.5rem", fontSize: "0.85rem" }, children: 
        new Date(log.createdAt).toLocaleDateString()
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 44}, this)
      , log.note && (
        _jsxDEV('div', { style: { marginTop: "0.2rem", paddingLeft: "0.75rem", borderLeft: "2px solid #d1e8da",
          color: "#5a7a6a", fontStyle: "italic" }, children: ["\"", log.note, "\""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 48}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 41}, this)
  )
}

export default function App() {
  const { viewer, can, isViewerPending, ViewerTag } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("little-free-library-v2")
  const { doc: newBook, merge: mergeNewBook, submit: submitNewBook } = useDocument({
    type: "book", title: "", author: "", genre: "", status: "in-box", createdAt: Date.now(),
  })
  const [suggesting, setSuggesting] = React.useState(false)
  const { docs: books } = useLiveQuery("type", { key: "book", descending: true })
  const { docs: logs } = useLiveQuery("type", { key: "log", descending: true })
  const realInBox = books.filter((b) => b.status === "in-box")
  const inBox = realInBox.length > 0 ? realInBox : EXAMPLE_BOOKS
  const isExample = realInBox.length === 0

  async function handleSuggest() {
    if (!newBook.title.trim()) return
    setSuggesting(true)
    try {
      const res = await callAI(
        `Given the book title "${newBook.title}", suggest the most likely author and genre.`,
        { schema: { properties: { author: { type: "string" }, genre: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      mergeNewBook({ author: parsed.author || newBook.author, genre: parsed.genre || newBook.genre })
    } finally { setSuggesting(false) }
  }

  async function handleAddBook(e) {
    e.preventDefault()
    if (!newBook.title.trim()) return
    const res = await database.put({ ...newBook, createdAt: Date.now() })
    await database.put({
      type: "log", action: "left", bookTitle: newBook.title, bookId: res.id,
      by: _optionalChain([viewer, 'optionalAccess', _ => _.displayName]) || _optionalChain([viewer, 'optionalAccess', _2 => _2.userSlug]) || "a neighbor", createdAt: Date.now(),
    })
    submitNewBook()
  }

  async function markTaken(book) {
    await database.put({ ...book, status: "taken", takenAt: Date.now() })
    await database.put({
      type: "log", action: "took", bookTitle: book.title, bookId: book._id,
      by: _optionalChain([viewer, 'optionalAccess', _3 => _3.displayName]) || _optionalChain([viewer, 'optionalAccess', _4 => _4.userSlug]) || "a neighbor", createdAt: Date.now(),
    })
  }

  const input = {
    width: "100%", background: "#fff", border: "1.5px solid #c8ddd3",
    borderRadius: "5px", padding: "0.75rem 1rem", fontSize: "1rem",
    color: "#1a3a2a", outline: "none", minHeight: "44px", boxSizing: "border-box",
  }
  const label = { display: "block", fontSize: "0.85rem", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a7a6a", marginBottom: "0.3rem" }
  const sectionHead = {
    fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    color: "#2d6a4f", marginBottom: "0.75rem", paddingBottom: "0.5rem",
    borderBottom: "1.5px solid #d1e8da"
  }

  return (
    _jsxDEV('div', { style: { minHeight: "100vh", background: "#f0f7f3", fontFamily: "'Inter', system-ui, sans-serif",
      color: "#1a3a2a", paddingBottom: "4rem" }, children: [

      _jsxDEV('header', { style: {
        position: "relative",
        background: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1768467040905-aa7081a2a8a2?w=1920&q=80&fit=crop') center/cover no-repeat`,
        color: "#f0f7f3", padding: "0", textAlign: "center",
        minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"
      }, children: [
        _jsxDEV('h1', { style: { fontWeight: 800, fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1.05, letterSpacing: "-0.02em", textShadow: "0 2px 20px rgba(0,0,0,0.5)", maxWidth: "700px", padding: "0 1.5rem" }, children: "What's in the box right now."
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 120}, this)
        , _jsxDEV('p', { style: { fontSize: "clamp(1rem, 2.5vw, 1.3rem)", opacity: 0.88, marginTop: "1rem", letterSpacing: "0.02em",
          textShadow: "0 2px 20px rgba(0,0,0,0.5)", maxWidth: "500px", padding: "0 1.5rem", color: "#d4e8dc" }, children: "Track it. Take it. Leave one back."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 123}, this)
        , _jsxDEV('div', { style: { fontSize: "0.9rem", opacity: 0.75, marginTop: "1rem", background: "rgba(255,255,255,0.15)", padding: "0.5rem 1.25rem", borderRadius: "999px", backdropFilter: "blur(4px)" }, children:
          isExample ? "example books" : `${inBox.length} book${inBox.length !== 1 ? "s" : ""} available`
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 126}, this)
        , (!isViewerPending && !viewer) && (
          _jsxDEV('div', { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", marginTop: "1.75rem" }, children: [
            _jsxDEV(ViewerTag, { style: { background: '#2d6a4f', border: 'none', color: '#f0efeb', borderRadius: '0.5rem', padding: '0.9rem 2.4rem', fontSize: '1.15rem', fontWeight: 700, boxShadow: '0 4px 18px rgba(0,0,0,0.4)', cursor: 'pointer' } }, void 0, false, {fileName: _jsxFileName}, this)
            , _jsxDEV('p', { style: { fontSize: "0.95rem", color: "#d4e8dc", opacity: 0.9, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }, children: "Sign in to leave and take books from the box."}, void 0, false, {fileName: _jsxFileName}, this)
          ]}, void 0, true, {fileName: _jsxFileName}, this)
        )
        , _jsxDEV('div', { style: {
          position: 'absolute', bottom: '0.75rem', right: '1rem',
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }, children: [
          "Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@maks_sobo?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Sobolev Maksim"}, void 0, false, {fileName: _jsxFileName}, this),
          " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117}, this)

      , _jsxDEV('main', { style: { maxWidth: "600px", margin: "0 auto", padding: "1.25rem 1rem", display: "flex",
        flexDirection: "column", gap: "1.25rem" }, children: [

        /* Inventory */
        _jsxDEV('section', { style: { background: "#eaf3ee", border: "1.5px solid #c8ddd3", borderRadius: "8px", padding: "1.25rem 1.5rem" }, children: [
          _jsxDEV('div', { style: { ...sectionHead, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            _jsxDEV('span', { children: ["Currently in the Box ("    , isExample ? "example" : inBox.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 137}, this)
            , isExample && _jsxDEV('span', { style: { fontSize: "0.85rem", color: "#9ab8a6", fontWeight: 400, letterSpacing: "0.05em" }, children: "sample data" }, void 0, false, {fileName: _jsxFileName, lineNumber: 138}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 136}, this)
          , _jsxDEV('ul', { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }, children: 
            inBox.map((book) => (
              _jsxDEV(BookCard, { book: book, canWrite: !isExample && can("write"), onTake: markTaken,}, book._id, false, {fileName: _jsxFileName, lineNumber: 142}, this )
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this)
          , isExample && (
            _jsxDEV('p', { style: { fontSize: "0.9rem", color: "#9ab8a6", marginTop: "0.75rem", fontStyle: "italic" }, children: "Add a real book above to get started."

            }, void 0, false, {fileName: _jsxFileName, lineNumber: 146}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 135}, this)

        /* Add a book */
        , _jsxDEV('section', { style: { background: "#fff", border: "1.5px solid #c8ddd3", borderRadius: "8px", padding: "1.25rem 1.5rem" }, children: [
          _jsxDEV('div', { style: sectionHead, children: "Leave a Book"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 154}, this)
          , !can("write") ? (
            _jsxDEV('div', { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.9rem" }, children: [
              _jsxDEV('p', { style: { fontSize: "1rem", color: "#5a7a6a", margin: 0 }, children: "Browsing as a visitor. Sign in to add and take books from the box."
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 156}, this)
              , (!isViewerPending && !viewer) && _jsxDEV(ViewerTag, { style: { background: '#2d6a4f', border: 'none', color: '#f0efeb', borderRadius: '0.5rem', padding: '0.85rem 2.2rem', fontSize: '1.05rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', cursor: 'pointer' } }, void 0, false, {fileName: _jsxFileName}, this)
            ]}, void 0, true, {fileName: _jsxFileName}, this)
          ) : (
            _jsxDEV('form', { onSubmit: handleAddBook, style: { display: "flex", flexDirection: "column", gap: "1rem" }, children: [
              _jsxDEV('div', { children: [
                _jsxDEV('label', { style: label, children: "Title"}, void 0, false, {fileName: _jsxFileName, lineNumber: 162}, this)
                , _jsxDEV('input', { style: input, placeholder: "e.g. Station Eleven"  ,
                  value: newBook.title, onChange: (e) => mergeNewBook({ title: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 161}, this)
              , _jsxDEV('div', { style: { display: "flex", gap: "0.5rem", alignItems: "flex-end" }, children: [
                _jsxDEV('div', { style: { flex: 1 }, children: [
                  _jsxDEV('label', { style: label, children: "Author"}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)
                  , _jsxDEV('input', { style: input, placeholder: "e.g. Emily St. John Mandel"    ,
                    value: newBook.author, onChange: (e) => mergeNewBook({ author: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 169}, this )
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this)
                , _jsxDEV('button', { type: "button", onClick: handleSuggest,
                  disabled: suggesting || !newBook.title.trim(),
                  style: { flexShrink: 0, padding: "0.75rem 1.5rem", minHeight: "44px", fontSize: "1rem",
                    fontWeight: 700, border: "1.5px solid #c8ddd3", borderRadius: "5px",
                    background: "transparent", color: "#5a7a6a", cursor: "pointer",
                    opacity: (suggesting || !newBook.title.trim()) ? 0.4 : 1 }, children: 
                  suggesting ? "…" : "Suggest"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
              , _jsxDEV('div', { children: [
                _jsxDEV('label', { style: label, children: "Genre (optional)" }, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this)
                , _jsxDEV('input', { style: input, placeholder: "e.g. Fiction" ,
                  value: newBook.genre, onChange: (e) => mergeNewBook({ genre: e.target.value }),}, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 181}, this)
              , _jsxDEV('button', { type: "submit", disabled: !newBook.title.trim(), style: {
                background: "#2d6a4f", color: "#fff", border: "none", borderRadius: "5px",
                padding: "0.75rem 1.5rem", fontWeight: 700, fontSize: "1rem", minHeight: "44px",
                cursor: "pointer", opacity: !newBook.title.trim() ? 0.5 : 1
              }, children: "Drop a book"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 186}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 160}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 153}, this)

        /* Activity log */
        , logs.length > 0 && (
          _jsxDEV('section', { style: { background: "#eaf3ee", border: "1.5px solid #c8ddd3", borderRadius: "8px", padding: "1.25rem 1.5rem" }, children: [
            _jsxDEV('div', { style: sectionHead, children: "Recent Activity" }, void 0, false, {fileName: _jsxFileName, lineNumber: 198}, this)
            , _jsxDEV('ul', { style: { listStyle: "none", margin: 0, padding: 0 }, children: 
              logs.slice(0, 12).map((log) => _jsxDEV(LogLine, { log: log,}, log._id, false, {fileName: _jsxFileName, lineNumber: 200}, this ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 199}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 197}, this)
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 131}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 114}, this)
  )
}
