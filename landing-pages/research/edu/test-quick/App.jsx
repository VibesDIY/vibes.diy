import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("vibes-diagnostic-lab")
  const { docs: results } = useLiveQuery("createdAt", { descending: true })
  const [isDbLoading, setIsDbLoading] = React.useState(false)
  const [isAiLoading, setIsAiLoading] = React.useState(false)

  async function runDbTest() {
    setIsDbLoading(true)
    try {
      const token = Math.random().toString(36).slice(2, 10)
      const { id } = await database.put({ kind: "db-test", token, createdAt: Date.now() })
      const readBack = await database.get(id)
      await database.put({
        kind: "result",
        type: "db",
        status: readBack.token === token ? "PASS" : "FAIL",
        message: `Wrote & read token ${token}`,
        createdAt: Date.now(),
      })
    } catch (e) {
      await database.put({ kind: "result", type: "db", status: "FAIL", message: e.message, createdAt: Date.now() })
    } finally {
      setIsDbLoading(false)
    }
  }

  async function runAiCheck() {
    setIsAiLoading(true)
    try {
      const raw = await callAI("Return a short health check. Status should be 'ok'. Greeting should be a one-line friendly hello.", {
        schema: { properties: { status: { type: "string" }, greeting: { type: "string" } } },
      })
      const data = JSON.parse(raw)
      await database.put({
        kind: "result",
        type: "ai",
        status: data.status === "ok" ? "PASS" : "FAIL",
        message: data.greeting,
        createdAt: Date.now(),
      })
    } catch (e) {
      await database.put({ kind: "result", type: "ai", status: "FAIL", message: e.message, createdAt: Date.now() })
    } finally {
      setIsAiLoading(false)
    }
  }

  async function clearResults() {
    for (const d of results) await database.del(d._id)
  }

  const Spinner = () => (
    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )

  const c = {
    page: "min-h-screen bg-[#0a0a0f] text-[#ecebf0] font-mono p-4 md:p-6",
    header: "border-b border-[#2a2a35] pb-4 mb-6 flex items-center justify-between",
    title: "text-xl md:text-2xl font-bold tracking-tight text-[#ecebf0]",
    tag: "text-xs text-[#9a98a8] uppercase tracking-widest mt-1",
    avatar: "w-8 h-8 rounded-full border border-[#2a2a35]",
    main: "max-w-2xl mx-auto space-y-6",
    section: "bg-[#13131a] border border-[#2a2a35] rounded-lg p-4 md:p-5",
    h2: "text-sm uppercase tracking-widest text-[#e94e3b] font-bold mb-3",
    btn: "min-h-[44px] px-4 py-3 bg-[#e94e3b] hover:bg-[#d13e2c] disabled:opacity-50 text-white rounded font-bold uppercase tracking-wide text-sm w-full md:w-auto",
    btnAlt: "min-h-[44px] px-4 py-3 bg-[#2a2a35] hover:bg-[#33333f] text-[#ecebf0] rounded font-bold uppercase tracking-wide text-sm w-full md:w-auto",
    row: "border-l-2 border-[#2a2a35] pl-3 py-2 text-sm",
    muted: "text-[#9a98a8] text-sm",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>VIBES DIAGNOSTIC LAB</h1>
          <p className={c.tag}>CLI environment check</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>
      <main id="app" className={c.main}>
        <section id="db-test" className={c.section}>
          <h2 className={c.h2}>Database Test</h2>
          <p className={c.muted}>Writes a doc, reads it back, confirms Fireproof persistence.</p>
          {can("write") ? (
            <div className="mt-3 flex flex-col md:flex-row gap-2">
              <button className={c.btn} onClick={runDbTest} disabled={isDbLoading}>
                {isDbLoading ? <><Spinner /> Running...</> : "Run DB Test"}
              </button>
              <button className={c.btnAlt} onClick={clearResults} disabled={isDbLoading || isAiLoading}>Clear Results</button>
            </div>
          ) : (
            <p className={c.muted}>Read-only view — contact the owner for write access.</p>
          )}
        </section>
        <section id="ai-check" className={c.section}>
          <h2 className={c.h2}>AI Round-Trip Check</h2>
          <p className={c.muted}>Calls the hosted LLM with a schema, expects {`{status, greeting}`}.</p>
          {can("write") ? (
            <div className="mt-3">
              <button className={c.btn} onClick={runAiCheck} disabled={isAiLoading}>
                {isAiLoading ? <><Spinner /> Calling LLM...</> : "Run AI Check"}
              </button>
            </div>
          ) : (
            <p className={c.muted}>Read-only view — contact the owner for write access.</p>
          )}
        </section>
        <section id="results-feed" className={c.section}>
          <h2 className={c.h2}>Results Feed</h2>
          {results.filter(r => r.kind === "result").length === 0 ? (
            <p className={c.muted}>No checks yet. Run a test above.</p>
          ) : (
            <ul className="space-y-2">
              {results.filter(r => r.kind === "result").map(r => (
                <li key={r._id} className={c.row} style={{ borderLeftColor: r.status === "PASS" ? "#4ade80" : "#e94e3b" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs uppercase tracking-widest">[{r.type}] {r.status}</span>
                    <span className="text-xs text-[#9a98a8]">{new Date(r.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[#ecebf0] mt-1 break-words">{r.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}