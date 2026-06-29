import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("recon-grid-ops");
  const { doc: newTask, merge: mergeTask, submit: submitTask, reset: resetTask } = useDocument({
    type: "task",
    parcelId: "",
    taskType: "Subdivision Plat Review",
    layers: "zoning, FEMA, easements",
    status: "queued",
    report: null,
    createdAt: Date.now(),
  });
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function analyzeAndSubmit(e) {
    e.preventDefault();
    if (!newTask.parcelId.trim()) return;
    setIsAnalyzing(true);
    try {
      const resp = await callAI(
        `You are a county GIS compliance analyzer. Parcel ${newTask.parcelId}, task: ${newTask.taskType}, layers: ${newTask.layers}. Return a structured conflict report and, for floodplain determinations, a draft letter.`,
        { schema: { properties: {
          conflicts: { type: "array", items: { type: "object", properties: {
            category: { type: "string" }, severity: { type: "string" }, detail: { type: "string" }
          }}},
          recommendations: { type: "array", items: { type: "string" } },
          letter: { type: "string" },
        }}}
      );
      const report = JSON.parse(resp);
      await database.put({ ...newTask, report, createdAt: Date.now() });
      resetTask();
    } finally { setIsAnalyzing(false); }
  }

  async function suggestTaskExample() {
    setIsSuggesting(true);
    try {
      const resp = await callAI("Suggest a realistic county GIS workflow task example.", {
        schema: { properties: { parcelId: { type: "string" }, taskType: { type: "string" }, layers: { type: "string" } } }
      });
      const ex = JSON.parse(resp);
      mergeTask({ parcelId: ex.parcelId, taskType: ex.taskType, layers: ex.layers });
    } finally { setIsSuggesting(false); }
  }

  const c = {
    page: "min-h-screen bg-black text-[#f5f6f8] font-mono",
    header: "sticky top-0 z-10 bg-black/90 backdrop-blur border-b border-[#3a4252] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-bold tracking-wider text-[#f5f6f8] uppercase",
    tag: "text-[10px] text-[#7a8499] uppercase tracking-widest",
    avatar: "w-8 h-8 rounded-full border border-[#3a4252]",
    main: "px-4 py-4 space-y-4 max-w-3xl mx-auto pb-24",
    section: "bg-[#101421]/80 border border-[#3a4252] rounded-md p-4",
    h2: "text-sm font-bold uppercase tracking-widest text-[#e6483a] mb-3 flex items-center gap-2",
    dot: "inline-block w-2 h-2 bg-[#e6483a] rounded-full",
    input: "w-full bg-black border border-[#3a4252] rounded px-3 py-3 text-sm text-[#f5f6f8] placeholder-[#7a8499] focus:outline-none focus:border-[#e6483a] min-h-[44px]",
    select: "w-full bg-black border border-[#3a4252] rounded px-3 py-3 text-sm text-[#f5f6f8] min-h-[44px]",
    btn: "bg-[#e6483a] text-black font-bold uppercase tracking-wider text-xs px-4 py-3 rounded min-h-[44px] hover:bg-[#ff5a4a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
    btnGhost: "bg-transparent border border-[#3a4252] text-[#f5f6f8] text-xs uppercase tracking-wider px-3 py-2 rounded hover:border-[#e6483a]",
    row: "border border-[#3a4252] rounded p-3 bg-black/40 space-y-1",
    label: "block text-[10px] uppercase tracking-widest text-[#7a8499] mb-1",
    badge: "inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-[#3a4252] text-[#7a8499]",
    badgeHot: "inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#e6483a] text-black font-bold",
    readonly: "text-xs text-[#7a8499] italic",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>◆ Recon Grid</div>
          <div className={c.tag}>County GIS Operations Console</div>
        </div>
        {viewer && (
          <div className="flex items-center gap-2">
            <span className={c.tag}>{viewer.displayName ?? viewer.userSlug}</span>
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="new-task" className={c.section}>
          <h2 className={c.h2}><span className={c.dot}></span>New Workflow Task</h2>
          {can("write") ? (
            <form onSubmit={analyzeAndSubmit} className="space-y-3">
              <div>
                <label className={c.label}>Parcel ID</label>
                <input className={c.input} value={newTask.parcelId} onChange={(e) => mergeTask({ parcelId: e.target.value })} placeholder="e.g. 045-12-038-001" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Task Type</label>
                  <select className={c.select} value={newTask.taskType} onChange={(e) => mergeTask({ taskType: e.target.value })}>
                    <option>Subdivision Plat Review</option>
                    <option>Floodplain Determination</option>
                    <option>Hazard Buffer Check</option>
                    <option>Environmental Overlay</option>
                  </select>
                </div>
                <div>
                  <label className={c.label}>Layers</label>
                  <input className={c.input} value={newTask.layers} onChange={(e) => mergeTask({ layers: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="submit" disabled={isAnalyzing} className={c.btn}>
                  {isAnalyzing && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>}
                  {isAnalyzing ? "Analyzing…" : "Initiate Task"}
                </button>
                <button type="button" disabled={isSuggesting} onClick={suggestTaskExample} className={c.btnGhost}>
                  {isSuggesting ? "…" : "Suggest Example"}
                </button>
              </div>
            </form>
          ) : (
            <p className={c.readonly}>Read-only view — contact the office for write access to initiate tasks.</p>
          )}
        </section>

        <section id="task-queue" className={c.section}>
          <h2 className={c.h2}><span className={c.dot}></span>Workflow Queue</h2>
          <TaskQueue c={c} database={database} useLiveQuery={useLiveQuery} can={can} />
        </section>

        <section id="adhoc-requests" className={c.section}>
          <h2 className={c.h2}><span className={c.dot}></span>Ad-Hoc Map Requests</h2>
          <AdhocRequests c={c} database={database} useLiveQuery={useLiveQuery} can={can} />
        </section>

        <section id="layer-versions" className={c.section}>
          <h2 className={c.h2}><span className={c.dot}></span>Layer Version Log</h2>
          <LayerVersions c={c} database={database} useLiveQuery={useLiveQuery} can={can} />
        </section>

        <section id="backlog-dashboard" className={c.section}>
          <h2 className={c.h2}><span className={c.dot}></span>Backlog Dashboard</h2>
          <BacklogDashboard c={c} useLiveQuery={useLiveQuery} />
        </section>
      </main>
    </div>
  )
}

function BacklogDashboard({ c, useLiveQuery }) {
  const { docs: tasks } = useLiveQuery("type", { key: "task" });
  const { docs: adhoc } = useLiveQuery("type", { key: "adhoc" });
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const counts = { queued: 0, "in-review": 0, flagged: 0, complete: 0, "adhoc-pending": 0, "adhoc-delivered": 0 };
    tasks.forEach((t) => { if (counts[t.status] !== undefined) counts[t.status]++; });
    adhoc.forEach((a) => { counts[a.status === "delivered" ? "adhoc-delivered" : "adhoc-pending"]++; });
    const data = Object.entries(counts).map(([status, count]) => ({ status, count }));
    const W = 320, H = 180, m = { t: 10, r: 10, b: 50, l: 28 };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`).style("width", "100%").style("height", "auto");
    const x = d3.scaleBand().domain(data.map((d) => d.status)).range([m.l, W - m.r]).padding(0.2);
    const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, (d) => d.count))]).range([H - m.b, m.t]);
    svg.selectAll("rect").data(data).enter().append("rect")
      .attr("x", (d) => x(d.status)).attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth()).attr("height", (d) => H - m.b - y(d.count))
      .attr("fill", "#e6483a");
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x))
      .selectAll("text").attr("fill", "#7a8499").attr("transform", "rotate(-35)").style("text-anchor", "end").style("font-size", "8px");
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4))
      .selectAll("text").attr("fill", "#7a8499").style("font-size", "9px");
    svg.selectAll(".domain, .tick line").attr("stroke", "#3a4252");
  }, [tasks, adhoc]);

  const total = tasks.length + adhoc.length;
  const openAdhoc = adhoc.filter((a) => a.status === "pending").length;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="border border-[#3a4252] rounded p-2"><div className="text-xs text-[#7a8499]">TASKS</div><div className="text-xl font-bold text-[#e6483a]">{tasks.length}</div></div>
        <div className="border border-[#3a4252] rounded p-2"><div className="text-xs text-[#7a8499]">AD-HOC OPEN</div><div className="text-xl font-bold text-[#e6483a]">{openAdhoc}</div></div>
        <div className="border border-[#3a4252] rounded p-2"><div className="text-xs text-[#7a8499]">TOTAL</div><div className="text-xl font-bold text-[#e6483a]">{total}</div></div>
      </div>
      <svg ref={ref} />
    </div>
  );
}

function LayerVersions({ c, database, useLiveQuery, can }) {
  const { docs } = useLiveQuery("type", { key: "layer", descending: true, limit: 10 });
  const [layer, setLayer] = React.useState("");
  const [version, setVersion] = React.useState("");
  async function log() {
    if (!layer.trim()) return;
    await database.put({ type: "layer", layer, version, loggedAt: Date.now() });
    setLayer(""); setVersion("");
  }
  return (
    <div className="space-y-3">
      {can("write") && (
        <div className="grid grid-cols-2 gap-3">
          <input className={c.input} value={layer} onChange={(e) => setLayer(e.target.value)} placeholder="Layer name (e.g. FEMA NFHL)" />
          <input className={c.input} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version / date" />
        </div>
      )}
      {can("write") && <button onClick={log} className={c.btn}>Log Version</button>}
      <ul className="space-y-2">
        {docs.length === 0 && <li className={c.row}><div className={c.tag}>No versions logged.</div></li>}
        {docs.map((d) => (
          <li key={d._id} className={c.row}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">{d.layer}</span>
              <span className={c.badge}>{d.version}</span>
            </div>
            <div className={c.tag}>{new Date(d.loggedAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdhocRequests({ c, database, useLiveQuery, can }) {
  const { docs } = useLiveQuery("type", { key: "adhoc", descending: true });
  const [requester, setRequester] = React.useState("");
  const [subject, setSubject] = React.useState("");
  async function queueIt() {
    if (!requester.trim() || !subject.trim()) return;
    await database.put({ type: "adhoc", requester, subject, status: "pending", openedAt: Date.now() });
    setRequester(""); setSubject("");
  }
  async function closeIt(d) {
    await database.put({ ...d, status: "delivered", closedAt: Date.now() });
  }
  return (
    <div className="space-y-3">
      {can("write") ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <input className={c.input} value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Requester (official)" />
            <input className={c.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Map subject" />
          </div>
          <button onClick={queueIt} className={c.btn}>Queue Request</button>
        </>
      ) : (
        <p className={c.readonly}>Read-only view of ad-hoc requests.</p>
      )}
      <ul className="space-y-2 mt-2">
        {docs.length === 0 && <li className={c.row}><div className={c.tag}>No ad-hoc requests yet.</div></li>}
        {docs.map((d) => {
          const ageHrs = ((d.closedAt || Date.now()) - d.openedAt) / 3600000;
          return (
            <li key={d._id} className={c.row}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{d.subject}</span>
                <span className={d.status === "delivered" ? c.badge : c.badgeHot}>{d.status}</span>
              </div>
              <div className={c.tag}>{d.requester} · {ageHrs.toFixed(1)}h {d.status === "delivered" ? "turnaround" : "open"}</div>
              {can("write") && d.status === "pending" && (
                <button onClick={() => closeIt(d)} className={c.btnGhost + " mt-2"}>Mark Delivered</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TaskQueue({ c, database, useLiveQuery, can }) {
  const { docs } = useLiveQuery("type", { key: "task", descending: true });
  const [openId, setOpenId] = React.useState(null);
  const statuses = ["queued", "in-review", "flagged", "complete"];
  if (!docs.length) return <p className={c.readonly}>No tasks yet.</p>;
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d._id} className={c.row}>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setOpenId(openId === d._id ? null : d._id)} className="text-sm font-bold text-left flex-1">
              Parcel {d.parcelId}
            </button>
            <span className={d.status === "complete" ? c.badge : c.badgeHot}>{d.status}</span>
          </div>
          <div className={c.tag}>{d.taskType} · {d.layers}</div>
          {openId === d._id && (
            <div className="mt-3 space-y-2 border-t border-[#3a4252] pt-3">
              {d.report?.conflicts?.map((cf, i) => (
                <div key={i} className="text-xs">
                  <span className={c.badgeHot}>{cf.severity}</span> <strong>{cf.category}:</strong> <span className="text-[#c4cad6]">{cf.detail}</span>
                </div>
              ))}
              {d.report?.recommendations?.length > 0 && (
                <div className="text-xs text-[#c4cad6]"><strong>Recommendations:</strong> {d.report.recommendations.join("; ")}</div>
              )}
              {d.report?.letter && (
                <details className="text-xs"><summary className="cursor-pointer text-[#e6483a]">Draft letter</summary><pre className="whitespace-pre-wrap mt-2 text-[#c4cad6]">{d.report.letter}</pre></details>
              )}
              {can("write") && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {statuses.map((s) => (
                    <button key={s} onClick={() => database.put({ ...d, status: s })} className={c.btnGhost}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}