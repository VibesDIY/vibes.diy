const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function GuestForm({ database, c }) {
  const [form, setForm] = React.useState({ name: "", street: "", city: "", state: "", zip: "", country: "USA" })
  const [normalized, setNormalized] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const update = (k, v) => setForm({ ...form, [k]: v })

  async function suggestExample() {
    setIsLoading(true)
    try {
      const r = await callAI("Generate one realistic example US mailing address for demo purposes.", {
        schema: { properties: { name: { type: "string" }, street: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip: { type: "string" }, country: { type: "string" } } }
      })
      setForm(JSON.parse(r))
    } finally {
      setIsLoading(false)
    }
  }

  async function validate(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.street.trim()) return
    setIsLoading(true)
    try {
      const r = await callAI(
        `Normalize and standardize this mailing address. Fix capitalization, standardize state to 2-letter code if US, ensure proper formatting. Input: ${JSON.stringify(form)}`,
        { schema: { properties: { name: { type: "string" }, street: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip: { type: "string" }, country: { type: "string" } } } }
      )
      setNormalized(JSON.parse(r))
    } finally {
      setIsLoading(false)
    }
  }

  async function confirmSave(addr) {
    await database.put({ type: "submission", ...addr, createdAt: Date.now() })
    setForm({ name: "", street: "", city: "", state: "", zip: "", country: "USA" })
    setNormalized(null)
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  const Spinner = () => (
    _jsxDEV('svg', { className: "animate-spin inline-block" , width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: 
      _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 51}, this )
    }, void 0, false, {fileName: _jsxFileName, lineNumber: 50}, this)
  )

  if (done) {
    return (
      _jsxDEV('div', { className: "text-center py-4" , children: [
        _jsxDEV('p', { className: "text-lg font-medium" , children: "Thanks! Your address has been saved."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 58}, this)
        , _jsxDEV('button', { className: c.btnSecondary + " mt-3", onClick: () => setDone(false), children: "Submit another" }, void 0, false, {fileName: _jsxFileName, lineNumber: 59}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 57}, this)
    )
  }

  if (normalized) {
    return (
      _jsxDEV('div', { className: "space-y-3", children: [
        _jsxDEV('p', { className: c.muted, children: "Does this look right?"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 67}, this)
        , _jsxDEV('div', { className: "border border-[var(--border)] rounded-md p-4 bg-[var(--hover-bg)] text-base leading-relaxed"      , children: [
          _jsxDEV('div', { children: _jsxDEV('strong', { children: normalized.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 69}, this)}, void 0, false, {fileName: _jsxFileName, lineNumber: 69}, this)
          , _jsxDEV('div', { children: normalized.street}, void 0, false, {fileName: _jsxFileName, lineNumber: 70}, this)
          , _jsxDEV('div', { children: [normalized.city, ", " , normalized.state, " " , normalized.zip]}, void 0, true, {fileName: _jsxFileName, lineNumber: 71}, this)
          , _jsxDEV('div', { children: normalized.country}, void 0, false, {fileName: _jsxFileName, lineNumber: 72}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 68}, this)
        , _jsxDEV('div', { className: "flex gap-2 flex-wrap"  , children: [
          _jsxDEV('button', { className: c.btn, onClick: () => confirmSave(normalized), children: "Looks good, submit"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 75}, this)
          , _jsxDEV('button', { className: c.btnSecondary, onClick: () => setNormalized(null), children: "Edit"}, void 0, false, {fileName: _jsxFileName, lineNumber: 76}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 74}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 66}, this)
    )
  }

  return (
    _jsxDEV('form', { className: "space-y-3", onSubmit: validate, children: [
      _jsxDEV('div', { children: [
        _jsxDEV('div', { className: "flex items-center justify-between mb-1"   , children: [
          _jsxDEV('label', { className: c.label + " mb-0", children: "Full name" }, void 0, false, {fileName: _jsxFileName, lineNumber: 86}, this)
          , _jsxDEV('button', { type: "button", onClick: suggestExample, disabled: isLoading, className: "text-sm underline text-[var(--muted)] hover:text-[var(--text)]"   , children: "Fill example"

          }, void 0, false, {fileName: _jsxFileName, lineNumber: 87}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 85}, this)
        , _jsxDEV('input', { className: c.input, placeholder: "Jane Doe" , value: form.name, onChange: (e) => update("name", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 91}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 84}, this)
      , _jsxDEV('div', { children: [
        _jsxDEV('label', { className: c.label, children: "Street address" }, void 0, false, {fileName: _jsxFileName, lineNumber: 94}, this)
        , _jsxDEV('input', { className: c.input, placeholder: "123 Main St, Apt 4"    , value: form.street, onChange: (e) => update("street", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 95}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
      , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: [
        _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "City"}, void 0, false, {fileName: _jsxFileName, lineNumber: 99}, this)
          , _jsxDEV('input', { className: c.input, placeholder: "Portland", value: form.city, onChange: (e) => update("city", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 98}, this)
        , _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "State / Region"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this)
          , _jsxDEV('input', { className: c.input, placeholder: "OR", value: form.state, onChange: (e) => update("state", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 97}, this)
      , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: [
        _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "Postal code" }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
          , _jsxDEV('input', { className: c.input, placeholder: "97201", value: form.zip, onChange: (e) => update("zip", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 110}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 108}, this)
        , _jsxDEV('div', { children: [
          _jsxDEV('label', { className: c.label, children: "Country"}, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
          , _jsxDEV('input', { className: c.input, placeholder: "USA", value: form.country, onChange: (e) => update("country", e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 114}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 112}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 107}, this)
      , _jsxDEV('button', { type: "submit", disabled: isLoading, className: c.btn, children: 
        isLoading ? _jsxDEV(_Fragment, { children: [_jsxDEV(Spinner, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 118}, this ), " Validating..." ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 118}, this) : "Add my address"
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 83}, this)
  )
}

export default function App() {
  const { viewer, can, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery, useDocument } = useFireproof("address-roundup")
  const { docs: submissions } = useLiveQuery("type", { key: "submission", descending: true })
  const settingsQuery = useLiveQuery("type", { key: "settings", limit: 1 })
  const settings = settingsQuery.docs[0] || { expected: 0 }
  const [copyStatus, setCopyStatus] = React.useState("")

  async function saveExpected(n) {
    const existing = settingsQuery.docs[0]
    await database.put({ ...(existing || {}), type: "settings", expected: Number(n) || 0 })
  }

  async function copyAll() {
    const text = submissions.map(s =>
      `${s.name}\n${s.street}\n${s.city}, ${s.state} ${s.zip}\n${s.country}`
    ).join("\n\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("Copied!")
      setTimeout(() => setCopyStatus(""), 2000)
    } catch (e2) {
      setCopyStatus("Copy failed")
    }
  }

  const c = {
    page: "min-h-screen bg-[var(--page-bg)] text-[var(--text)] font-[Helvetica_Neue,Helvetica,Arial,sans-serif]",
    header: "border-b border-[var(--border)] bg-[var(--card-bg)] px-4 py-5 sticky top-0 z-10",
    title: "text-2xl font-bold tracking-tight text-[var(--text)]",
    tagline: "text-base text-[var(--muted)] mt-1",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section: "bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-5",
    h2: "text-xl font-bold text-[var(--text)] mb-3",
    btn: "min-h-[44px] px-6 py-3 rounded-md bg-[var(--accent)] text-[var(--accent-text)] text-base font-semibold hover:opacity-90 disabled:opacity-50 transition",
    btnSecondary: "min-h-[44px] px-6 py-3 rounded-md bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text)] text-base font-semibold hover:bg-[var(--hover-bg)]",
    input: "w-full min-h-[44px] px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--input-bg)] text-base text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
    label: "block text-base font-medium text-[var(--text)] mb-1",
    row: "border-b border-[var(--border)] py-3 last:border-b-0",
    muted: "text-base text-[var(--muted)]",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('style', { children: `
        :root {
          --page-bg: #f8f7f4;
          --card-bg: #ffffff;
          --text: #1a1a1a;
          --muted: #6b6b6b;
          --border: #d8d6d0;
          --accent: #1a1a1a;
          --accent-text: #ffffff;
          --input-bg: #ffffff;
          --hover-bg: #f0efeb;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --page-bg: #14141a;
            --card-bg: #1e1e26;
            --text: #f0efeb;
            --muted: #9a9a9a;
            --border: #2e2e38;
            --accent: #f0efeb;
            --accent-text: #14141a;
            --input-bg: #14141a;
            --hover-bg: #26262f;
          }
        }
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)

      , _jsxDEV('div', { style: {
          position: 'relative',
          background: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1738898179451-b5fc497f9f8e?w=1920&q=80&fit=crop') center/cover no-repeat",
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          textAlign: 'center',
        }, children: [
        _jsxDEV('h1', { style: { fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: '700', color: 'white', letterSpacing: '-0.03em', lineHeight: '1.1', maxWidth: '600px', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Sixty addresses. Zero group texts." }, void 0, false, {fileName: _jsxFileName, lineNumber: 196}, this)
        , _jsxDEV('p', { style: { fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', color: 'rgba(255,255,255,0.85)', marginTop: '1rem', maxWidth: '480px', lineHeight: '1.5', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "You announced a date. Now collect every address without chasing a single person." }, void 0, false, {fileName: _jsxFileName, lineNumber: 197}, this)
        , _jsxDEV('div', { style: {
          position: 'absolute', bottom: '0.75rem', right: '1rem',
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }, children: [
          "Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@micahchaffin?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Micah & Sammie Chaffin"}, void 0, false, {fileName: _jsxFileName}, this),
          " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 195}, this)

      , (!isViewerPending && !viewer) && (
        _jsxDEV('div', { className: "max-w-2xl mx-auto px-4 pt-6"  , children:
          _jsxDEV('div', { className: "flex flex-col items-center gap-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6 text-center"        , children: [
            _jsxDEV(ViewerTag, { style: { background: '#14141a', border: 'none', color: '#f0efeb', borderRadius: '0.5rem', padding: '0.9rem 2.2rem', fontSize: '1.15rem', fontWeight: 700, boxShadow: '0 4px 18px rgba(0,0,0,0.25)', cursor: 'pointer' } }, void 0, false, {fileName: _jsxFileName}, this)
            , _jsxDEV('p', { className: c.muted, children: "Sign in to add your mailing address from this one shared link."        }, void 0, false, {fileName: _jsxFileName}, this)
          ]}, void 0, true, {fileName: _jsxFileName}, this)
        }, void 0, false, {fileName: _jsxFileName}, this)
      )

      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "host-controls", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Host Controls" }, void 0, false, {fileName: _jsxFileName, lineNumber: 202}, this)
          , can("write") ? (
            _jsxDEV('div', { className: "space-y-4", children: [
              _jsxDEV('div', { children: [
                _jsxDEV('label', { className: c.label, children: "Expected guests" }, void 0, false, {fileName: _jsxFileName, lineNumber: 206}, this)
                , _jsxDEV('input', {
                  type: "number",
                  className: c.input,
                  placeholder: "e.g. 50" ,
                  value: settings.expected,
                  onChange: (e) => saveExpected(e.target.value),
                  min: "0",}, void 0, false, {fileName: _jsxFileName, lineNumber: 207}, this
                )
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 205}, this)
              , _jsxDEV('div', { className: "flex items-center justify-between gap-3 flex-wrap"    , children: [
                _jsxDEV('p', { className: c.muted, children: [
                  submissions.length, " of "  , settings.expected || "?", " responded"
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 217}, this)
                , _jsxDEV('button', { className: c.btnSecondary, onClick: copyAll, disabled: submissions.length === 0, children: 
                  copyStatus || "Copy all addresses"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 220}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 216}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 204}, this)
          ) : (
            _jsxDEV('p', { className: c.muted, children: [
              submissions.length, " " , submissions.length === 1 ? "guest has" : "guests have", " responded so far."
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 226}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 201}, this)

        , _jsxDEV('section', { id: "guest-form", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "Submit Your Address"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 233}, this)
          , _jsxDEV(GuestForm, { database: database, c: c,}, void 0, false, {fileName: _jsxFileName, lineNumber: 234}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 232}, this)

        , _jsxDEV('section', { id: "roster", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: ["Submitted Addresses "
              , submissions.length > 0 && _jsxDEV('span', { className: c.muted + " font-normal", children: ["(", submissions.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 239}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 238}, this)
          , !can("write") ? (
            _jsxDEV('p', { className: c.muted, children: "Only the host can view the full address list."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 242}, this)
          ) : submissions.length === 0 ? (
            _jsxDEV('ul', { children: 
              _jsxDEV('li', { className: c.row, children: [
                _jsxDEV('div', { className: "font-medium", children: "No submissions yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 246}, this)
                , _jsxDEV('div', { className: c.muted, children: "Addresses will appear here as guests submit them."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 247}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 245}, this)
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 244}, this)
          ) : (
            _jsxDEV('ul', { children: 
              submissions.map((s) => (
                _jsxDEV('li', { className: c.row, children: 
                  _jsxDEV('div', { className: "flex items-start justify-between gap-2"   , children: [
                    _jsxDEV('div', { className: "text-base leading-relaxed" , children: [
                      _jsxDEV('div', { className: "font-semibold text-lg" , children: s.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 256}, this)
                      , _jsxDEV('div', { children: s.street}, void 0, false, {fileName: _jsxFileName, lineNumber: 257}, this)
                      , _jsxDEV('div', { children: [s.city, ", " , s.state, " " , s.zip]}, void 0, true, {fileName: _jsxFileName, lineNumber: 258}, this)
                      , _jsxDEV('div', { className: c.muted, children: s.country}, void 0, false, {fileName: _jsxFileName, lineNumber: 259}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 255}, this)
                    , _jsxDEV('button', {
                      onClick: () => database.del(s._id),
                      className: "text-sm text-[var(--muted)] hover:text-[var(--text)] underline shrink-0"    ,
                      'aria-label': "Remove submission" ,
 children: "Remove"

                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 261}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 254}, this)
                }, s._id, false, {fileName: _jsxFileName, lineNumber: 253}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 251}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 237}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 200}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this)
  )
}