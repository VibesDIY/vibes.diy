import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ReportSection({ c, can, useLiveQuery, database }) {
  const { docs: targets } = useLiveQuery("type", { key: "target" });
  const { docs: projects } = useLiveQuery("type", { key: "project" });
  const { docs: inventory } = useLiveQuery("type", { key: "inventory" });
  const { docs: reports } = useLiveQuery("type", { key: "report", descending: true });
  const [loading, setLoading] = React.useState(false);

  async function draft() {
    setLoading(true);
    try {
      const ctx = `Targets: ${targets.map(t => `${t.name} (${t.sector})`).join("; ")}. Projects: ${projects.map(p => `${p.name} [${p.status}]`).join("; ")}. Inventory: ${inventory.map(i => `${i.sector}=${i.mtco2e}`).join(", ")}.`;
      const r = await callAI(`Draft a concise council-ready climate action summary based on: ${ctx}`, {
        schema: { properties: { title: { type: "string" }, narrative: { type: "string" } } }
      });
      const p = JSON.parse(r);
      await database.put({ type: "report", title: p.title, narrative: p.narrative, createdAt: Date.now() });
    } finally { setLoading(false); }
  }

  return (
    <section id="report" className={c.section}>
      <h2 className={c.h2}>Council Reports ({reports.length})</h2>
      {can("write") && (
        <button onClick={draft} disabled={loading} className={`${c.btn} mb-3 flex items-center gap-2`}>
          {loading ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> Drafting...</> : "Draft AI Report"}
        </button>
      )}
      {reports.length === 0 && <p className={c.muted}>No reports yet.</p>}
      {reports.map((r) => (
        <div key={r._id} className={c.row}>
          <div className="font-semibold">{r.title}</div>
          <p className="text-sm mt-2 whitespace-pre-wrap">{r.narrative}</p>
          <div className={c.muted + " mt-2"}>{new Date(r.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </section>
  );
}

function InventorySection({ c, can, useDocument, useLiveQuery }) {
  const year = new Date().getFullYear();
  const { doc, merge, submit } = useDocument({ type: "inventory", year, sector: "Buildings", mtco2e: 0 });
  const { docs } = useLiveQuery("type", { key: "inventory" });
  const thisYear = docs.filter((d) => d.year === year);
  const total = thisYear.reduce((s, d) => s + (d.mtco2e || 0), 0);

  return (
    <section id="inventory" className={c.section}>
      <h2 className={c.h2}>GHG Inventory {year}</h2>
      {can("write") && (
        <form onSubmit={submit} className="space-y-2 mb-3">
          <div className="flex gap-2">
            <select className={c.input} value={doc.sector} onChange={(e) => merge({ sector: e.target.value })}>
              <option>Buildings</option><option>Transportation</option><option>Waste</option><option>Electricity</option>
            </select>
            <input className={c.input} type="number" placeholder="MTCO2e" value={doc.mtco2e} onChange={(e) => merge({ mtco2e: +e.target.value })} />
          </div>
          <button type="submit" className={c.btn}>Log Sector</button>
        </form>
      )}
      <div className="mb-2">
        <div className={c.badge}>Total {year}: {total.toLocaleString()} MTCO2e</div>
      </div>
      {thisYear.map((d) => (
        <div key={d._id} className={c.row}>
          <div className="font-semibold">{d.sector}</div>
          <div className={c.muted}>{d.mtco2e?.toLocaleString()} MTCO2e</div>
        </div>
      ))}
    </section>
  );
}

function ProjectsSection({ c, can, useDocument, useLiveQuery, database }) {
  const { doc, merge, submit } = useDocument({ type: "project", name: "", lead: "", budget: 0, status: "Planned", target: "" });
  const { docs } = useLiveQuery("type", { key: "project", descending: true });
  const { docs: targets } = useLiveQuery("type", { key: "target" });
  const [loading, setLoading] = React.useState(false);

  async function suggest() {
    setLoading(true);
    try {
      const r = await callAI("Suggest a realistic municipal climate project with name, department lead role, budget USD, and a target sector.", {
        schema: { properties: { name: { type: "string" }, lead: { type: "string" }, budget: { type: "number" }, target: { type: "string" } } }
      });
      const p = JSON.parse(r);
      merge({ name: p.name, lead: p.lead, budget: p.budget, target: p.target });
    } finally { setLoading(false); }
  }

  return (
    <section id="projects" className={c.section}>
      <h2 className={c.h2}>Project Portfolio ({docs.length})</h2>
      {can("write") && (
        <form onSubmit={submit} className="space-y-2 mb-3">
          <input className={c.input} placeholder="Project name" value={doc.name} onChange={(e) => merge({ name: e.target.value })} />
          <input className={c.input} placeholder="Department lead" value={doc.lead} onChange={(e) => merge({ lead: e.target.value })} />
          <div className="flex gap-2">
            <input className={c.input} type="number" placeholder="Budget $" value={doc.budget} onChange={(e) => merge({ budget: +e.target.value })} />
            <select className={c.input} value={doc.target} onChange={(e) => merge({ target: e.target.value })}>
              <option value="">Link target...</option>
              {targets.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={c.btn}>Add Project</button>
            <button type="button" onClick={suggest} disabled={loading} className={c.btnGhost}>
              {loading ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg> : "AI suggest"}
            </button>
          </div>
        </form>
      )}
      <div>
        {docs.length === 0 && <p className={c.muted}>No projects yet.</p>}
        {docs.map((d) => (
          <div key={d._id} className={c.row}>
            <div className="font-semibold">{d.name}</div>
            <div className={c.muted}>Lead: {d.lead} · ${d.budget?.toLocaleString()} · {d.target || "unlinked"}</div>
            <div className="mt-2 flex gap-2 items-center">
              <span className={c.badge}>{d.status}</span>
              {can("write") && (
                <button onClick={() => database.put({ ...d, status: d.status === "Planned" ? "Active" : d.status === "Active" ? "Complete" : "Planned" })} className={c.btnGhost}>
                  Advance
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TargetsSection({ c, can, useDocument, useLiveQuery }) {
  const { doc, merge, submit } = useDocument({ type: "target", name: "", sector: "Buildings", value: 0 });
  const { docs } = useLiveQuery("type", { key: "target", descending: true });
  return (
    <section id="targets" className={c.section}>
      <h2 className={c.h2}>Climate Targets ({docs.length})</h2>
      {can("write") && (
        <form onSubmit={submit} className="space-y-2 mb-3">
          <input className={c.input} placeholder="Target name" value={doc.name} onChange={(e) => merge({ name: e.target.value })} />
          <div className="flex gap-2">
            <select className={c.input} value={doc.sector} onChange={(e) => merge({ sector: e.target.value })}>
              <option>Buildings</option><option>Transportation</option><option>Waste</option>
              <option>Electricity</option><option>Heat resilience</option><option>Flood resilience</option>
            </select>
            <input className={c.input} type="number" placeholder="Target %" value={doc.value} onChange={(e) => merge({ value: +e.target.value })} />
          </div>
          <button type="submit" className={c.btn}>Add Target</button>
        </form>
      )}
      <div>
        {docs.length === 0 && <p className={c.muted}>No targets yet.</p>}
        {docs.map((d) => (
          <div key={d._id} className={c.row}>
            <div className="font-semibold">{d.name}</div>
            <div className={c.muted}>{d.sector} · Target: {d.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("civic-climate");

  const c = {
    page: "min-h-screen bg-[oklch(0.10_0.003_264)] text-[oklch(0.93_0.005_264)] font-mono",
    header: "sticky top-0 z-10 bg-[oklch(0.16_0.003_264)] border-b border-[oklch(0.24_0.003_264)] px-4 py-3 flex items-center justify-between",
    title: "text-lg font-bold tracking-wide",
    tagline: "text-xs text-[oklch(0.63_0.008_264)]",
    main: "px-4 py-4 space-y-4 max-w-3xl mx-auto pb-24",
    section: "bg-[oklch(0.16_0.003_264)] border border-[oklch(0.24_0.003_264)] rounded p-4",
    h2: "text-sm uppercase tracking-widest text-[oklch(0.63_0.008_264)] mb-3",
    btn: "min-h-[44px] px-4 py-2 bg-[oklch(0.53_0.22_25)] hover:bg-[oklch(0.45_0.19_25)] text-white rounded font-semibold text-sm",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[oklch(0.24_0.003_264)] rounded text-sm hover:bg-[oklch(0.19_0.003_264)]",
    input: "w-full min-h-[44px] px-3 py-2 bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)] rounded text-sm focus:outline-none focus:border-[oklch(0.53_0.22_25)]",
    row: "p-3 bg-[oklch(0.19_0.003_264)] border border-[oklch(0.24_0.003_264)] rounded mb-2",
    muted: "text-[oklch(0.63_0.008_264)] text-xs",
    avatar: "w-8 h-8 rounded-full border border-[oklch(0.24_0.003_264)]",
    badge: "inline-block px-2 py-0.5 text-xs rounded bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)]",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>CivicClimate Ops</h1>
          <p className={c.tagline}>Municipal climate action workflow</p>
        </div>
        {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
      </header>

      <main id="app" className={c.main}>
        <TargetsSection c={c} can={can} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <ProjectsSection c={c} can={can} useDocument={useDocument} useLiveQuery={useLiveQuery} database={database} />

        <InventorySection c={c} can={can} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <ReportSection c={c} can={can} useLiveQuery={useLiveQuery} database={database} />
      </main>
    </div>
  );
}