import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const themeStyle = `
:root {
  --background: #fff;
  --accent: #666;
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.14);
  --surface: rgba(255, 255, 255, 0.85);
  --primary: #666;
  --secondary: #666;
  --warning: #f59e0b;
  --success: #22c55e;
  --error: #ef4444;
  --font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --font-size-base: 1rem;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
  --accent-text: #fafafa;
  --raised: rgba(255, 255, 255, 0.55);
}
@media (prefers-color-scheme: dark) {
  :root {
    --accent: #999999;
    --border: rgba(255, 255, 255, 0.18);
    --background: #0f0f0f;
    --text-primary: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --surface: rgba(255, 255, 255, 0.04);
    --primary: #999999;
    --secondary: #999999;
    --accent-text: #0a0a0a;
    --raised: rgba(255, 255, 255, 0.06);
  }
}
`

function drawChart(svgEl, rows) {
  const svg = d3.select(svgEl)
  svg.selectAll("*").remove()
  if (rows.length === 0) return

  const width = svgEl.clientWidth || 360
  const rowH = 44
  const height = rows.length * rowH + 20
  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("height", height)

  const maxVotes = d3.max(rows, r => r.votes) || 1
  const labelW = 140
  const trendW = 28
  const x = d3.scaleLinear().domain([0, maxVotes]).range([0, width - labelW - trendW - 40])

  const g = svg.append("g").attr("transform", `translate(${labelW},10)`)

  rows.forEach((r, i) => {
    const y = i * rowH
    // rank + name (left)
    svg.append("text")
      .attr("x", labelW - 8).attr("y", y + 10 + rowH / 2)
      .attr("text-anchor", "end")
      .attr("fill", "var(--text-primary)")
      .attr("font-size", "13").attr("font-weight", "bold")
      .text(`${i + 1}. ${r.name}`)

    // bar
    g.append("rect")
      .attr("x", 0).attr("y", y + 8).attr("height", rowH - 16)
      .attr("width", x(r.votes))
      .attr("fill", "var(--text-primary)")
      .attr("rx", 2)

    // vote count
    g.append("text")
      .attr("x", x(r.votes) + 6).attr("y", y + rowH / 2 + 4)
      .attr("fill", "var(--text-primary)")
      .attr("font-size", "12").attr("font-weight", "bold")
      .text(r.votes)

    // trend arrow
    const tx = width - labelW - trendW - 4
    let arrow = "—", color = "var(--text-secondary)"
    if (r.trend === "up") { arrow = "▲"; color = "var(--success)" }
    else if (r.trend === "down") { arrow = "▼"; color = "var(--error)" }
    else if (r.trend === "new") { arrow = "★"; color = "var(--warning)" }
    g.append("text")
      .attr("x", tx).attr("y", y + rowH / 2 + 4)
      .attr("fill", color).attr("font-size", "13")
      .text(arrow)
  })
}

function RankingChart({ database, useLiveQuery, currentWeek }) {
  const { docs: players } = useLiveQuery("type", { key: "player" })
  const { docs: allVotes } = useLiveQuery("type", { key: "vote" })
  const svgRef = React.useRef(null)

  const rows = React.useMemo(() => {
    const tally = (week) => {
      const counts = {}
      for (const v of allVotes) if (v.week === week) counts[v.playerId] = (counts[v.playerId] || 0) + 1
      return counts
    }
    const cur = tally(currentWeek)
    const prev = tally(currentWeek - 1)

    const prevRanked = Object.entries(prev).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const curRanked = players
      .map(p => ({ id: p._id, name: p.name, votes: cur[p._id] || 0 }))
      .sort((a, b) => b.votes - a.votes)

    return curRanked.map((r, i) => {
      const prevIdx = prevRanked.indexOf(r.id)
      let trend = "flat"
      if (currentWeek === 1) trend = "flat"
      else if (prevIdx === -1 && r.votes > 0) trend = "new"
      else if (prevIdx > i) trend = "up"
      else if (prevIdx < i && prevIdx !== -1) trend = "down"
      return { ...r, trend }
    }).filter(r => r.votes > 0 || players.length <= 8)
  }, [allVotes, players, currentWeek])

  React.useEffect(() => {
    if (svgRef.current) drawChart(svgRef.current, rows)
  }, [rows])

  const c = {
    section: "border-b-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]",
    heading: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-[var(--font-family)] flex justify-between",
    empty: "text-[var(--text-secondary)] italic text-sm py-8 text-center",
    svg: "w-full",
    legend: "flex gap-3 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-2",
  }

  return (
    <section id="ranking" className={c.section}>
      <h2 className={c.heading}>
        <span>Power Ranking</span>
        <span>{allVotes.filter(v => v.week === currentWeek).length} votes</span>
      </h2>
      {rows.length === 0 ? (
        <div className={c.empty}>No players yet</div>
      ) : (
        <>
          <svg ref={svgRef} className={c.svg} />
          <div className={c.legend}>
            <span style={{ color: "var(--success)" }}>▲ Up</span>
            <span style={{ color: "var(--error)" }}>▼ Down</span>
            <span style={{ color: "var(--warning)" }}>★ New</span>
          </div>
        </>
      )}
    </section>
  )
}

function VoteBooth({ database, useLiveQuery, viewer, currentWeek }) {
  const { docs: players } = useLiveQuery("type", { key: "player" })
  const { docs: allVotes } = useLiveQuery("type", { key: "vote" })
  const myVote = viewer
    ? allVotes.find(v => v.voterHandle === viewer.userHandle && v.week === currentWeek)
    : null

  async function vote(playerId) {
    if (!viewer) return
    if (myVote) {
      await database.put({ ...myVote, playerId, votedAt: Date.now() })
    } else {
      await database.put({
        type: "vote",
        voterHandle: viewer.userHandle,
        playerId,
        week: currentWeek,
        votedAt: Date.now(),
      })
    }
  }

  const c = {
    section: "border-b-[length:var(--border-width)] border-[var(--border)] p-[var(--spacing)]",
    heading: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-[var(--font-family)]",
    empty: "text-[var(--text-secondary)] italic text-sm py-4",
    grid: "grid grid-cols-2 gap-2",
    btn: "min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-left",
    btnActive: "min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius-sm)] text-sm text-left font-bold",
    status: "text-xs uppercase tracking-[0.15em] text-[var(--success)] mb-3",
  }

  if (!viewer) {
    return (
      <section id="vote-booth" className={c.section}>
        <h2 className={c.heading}>Cast Your MVP Vote · Week {currentWeek}</h2>
        <div className={c.empty}>Sign in to vote</div>
      </section>
    )
  }

  if (players.length === 0) {
    return (
      <section id="vote-booth" className={c.section}>
        <h2 className={c.heading}>Cast Your MVP Vote · Week {currentWeek}</h2>
        <div className={c.empty}>Add players to the roster first</div>
      </section>
    )
  }

  return (
    <section id="vote-booth" className={c.section}>
      <h2 className={c.heading}>Cast Your MVP Vote · Week {currentWeek}</h2>
      {myVote && <div className={c.status}>✓ Voted — tap another to change</div>}
      <div className={c.grid}>
        {players.map(p => (
          <button
            key={p._id}
            onClick={() => vote(p._id)}
            className={myVote?.playerId === p._id ? c.btnActive : c.btn}
          >
            <div>{p.name}</div>
            {p.team && <div className="text-xs opacity-60 uppercase tracking-wider">{p.team}</div>}
          </button>
        ))}
      </div>
    </section>
  )
}

function RosterManager({ database, useLiveQuery, useDocument, viewer, ViewerTag }) {
  const { docs: players } = useLiveQuery("type", { key: "player" })
  const { doc, merge, submit, reset } = useDocument({
    type: "player",
    name: "",
    team: "",
    createdBy: viewer?.userHandle || "",
    createdAt: Date.now(),
  })
  const [suggesting, setSuggesting] = React.useState(false)

  async function suggest() {
    setSuggesting(true)
    try {
      const taken = players.map(p => p.name).join(", ")
      const res = await callAI(
        `Suggest a current NBA MVP candidate not in this list: ${taken || "(empty)"}. Return name and team.`,
        { schema: { properties: { name: { type: "string" }, team: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      merge({ name: parsed.name, team: parsed.team })
    } catch (e) { console.error(e) }
    finally { setSuggesting(false) }
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!doc.name.trim()) return
    submit()
  }

  const c = {
    section: "p-[var(--spacing)]",
    heading: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-[var(--font-family)]",
    empty: "text-[var(--text-secondary)] italic text-sm py-4",
    form: "flex flex-col gap-2 mb-4",
    inputRow: "flex gap-2",
    input: "flex-1 min-h-[44px] px-3 py-2 border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] rounded-[var(--radius-sm)]",
    btnRow: "flex gap-2",
    btnPrimary: "flex-1 min-h-[44px] px-4 py-2 bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius-sm)] text-sm uppercase tracking-[0.15em] font-bold disabled:opacity-40",
    btnSecondary: "min-h-[44px] px-4 py-2 border-[length:var(--border-width)] border-[var(--text-primary)] text-[var(--text-primary)] rounded-[var(--radius-sm)] text-sm uppercase tracking-[0.15em] font-bold disabled:opacity-40 flex items-center gap-2",
    list: "divide-y-[length:var(--border-width)] divide-[var(--border)] border-y-[length:var(--border-width)] border-[var(--border)]",
    item: "flex items-center justify-between py-3 px-1",
    playerInfo: "flex flex-col",
    playerName: "font-bold",
    playerTeam: "text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]",
    delBtn: "text-xs text-[var(--error)] uppercase tracking-[0.15em] min-h-[44px] px-3",
    spinner: "animate-spin h-4 w-4",
    addedBy: "text-[10px] text-[var(--text-secondary)] mt-1",
  }

  return (
    <section id="roster" className={c.section}>
      <h2 className={c.heading}>Roster ({players.length})</h2>
      {viewer ? (
        <form onSubmit={onSubmit} className={c.form}>
          <div className={c.inputRow}>
            <input
              className={c.input}
              placeholder="Player name"
              value={doc.name}
              onChange={e => merge({ name: e.target.value })}
            />
            <input
              className={c.input}
              placeholder="Team"
              value={doc.team}
              onChange={e => merge({ team: e.target.value })}
            />
          </div>
          <div className={c.btnRow}>
            <button type="submit" className={c.btnPrimary} disabled={!doc.name.trim()}>Add Player</button>
            <button type="button" onClick={suggest} className={c.btnSecondary} disabled={suggesting}>
              {suggesting ? (
                <svg className={c.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              ) : "Suggest"}
            </button>
          </div>
        </form>
      ) : (
        <div className={c.empty}>Sign in to add players</div>
      )}
      {players.length === 0 ? (
        <div className={c.empty}>No players yet</div>
      ) : (
        <ul className={c.list}>
          {players.map(p => (
            <li key={p._id} className={c.item}>
              <div className={c.playerInfo}>
                <span className={c.playerName}>{p.name}</span>
                {p.team && <span className={c.playerTeam}>{p.team}</span>}
                {p.createdBy && <ViewerTag userHandle={p.createdBy} />}
              </div>
              {viewer && (viewer.userHandle === p.createdBy) && (
                <button className={c.delBtn} onClick={() => database.del(p._id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function useApp() {
  return useFireproof("hoops-mvp")
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()
  const { database, useLiveQuery, useDocument } = useApp()

  const { docs: weekDocs } = useLiveQuery("type", { key: "weekMeta" })
  const currentWeek = weekDocs[0]?.week || 1

  async function advanceWeek() {
    const existing = weekDocs[0]
    if (existing) {
      await database.put({ ...existing, week: existing.week + 1 })
    } else {
      await database.put({ type: "weekMeta", week: 2 })
    }
  }

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "border-b-[length:var(--border-width)] border-[var(--text-primary)] p-[var(--spacing)] bg-[var(--surface)] sticky top-0 z-10 backdrop-blur",
    titleRow: "flex items-center justify-between gap-3",
    title: "text-2xl font-bold tracking-tight",
    subtitle: "text-xs uppercase tracking-[0.3em] text-[var(--text-secondary)] mt-1",
    main: "max-w-2xl mx-auto",
  }

  if (isViewerPending) return <div className={c.page} />

  return (
    <>
      <style>{themeStyle}</style>
      <div className={c.page}>
        <header id="app-header" className={c.header}>
          <div className={c.titleRow}>
            <div>
              <h1 className={c.title}>Hoops MVP Weekly</h1>
              <div className={c.subtitle}>Power Ranking · Week {currentWeek}</div>
            </div>
            <ViewerTag />
          </div>
          {isOwner && (
            <button
              onClick={advanceWeek}
              className="mt-3 w-full min-h-[44px] px-4 py-2 border-[length:var(--border-width)] border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--background)] rounded-[var(--radius-sm)] text-sm uppercase tracking-[0.2em] font-bold"
            >
              Advance to Week {currentWeek + 1}
            </button>
          )}
        </header>
        <main id="app" className={c.main}>
          <RankingChart database={database} useLiveQuery={useLiveQuery} currentWeek={currentWeek} />
          <VoteBooth database={database} useLiveQuery={useLiveQuery} viewer={viewer} currentWeek={currentWeek} />
          <RosterManager database={database} useLiveQuery={useLiveQuery} useDocument={useDocument} viewer={viewer} ViewerTag={ViewerTag} />
        </main>
      </div>
    </>
  )
}