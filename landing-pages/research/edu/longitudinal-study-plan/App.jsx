import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function AuditPanel({ c, can, useLiveQuery, database, logDecision, viewer }) {
  const { docs: log } = useLiveQuery("type", { key: "audit", descending: true, limit: 50 });
  const { docs: specDocs } = useLiveQuery("type", { key: "spec" });
  const { docs: outcomes } = useLiveQuery("type", { key: "outcome", descending: true });
  const { docs: diagDocs } = useLiveQuery("type", { key: "diagnostics" });
  const [exported, setExported] = React.useState("");

  function buildExport() {
    const spec = specDocs[0] || {};
    const diag = diagDocs[0] || {};
    const text = `PRE-ANALYSIS PLAN
==================
Generated: ${new Date().toISOString()}
Registered by: ${viewer?.displayName || viewer?.userSlug || "anonymous"}

1. MODEL SPECIFICATION
Level-1: ${spec.level1 || "(unspecified)"}
Higher levels: ${spec.levelsHigher || "(unspecified)"}
Model family: ${spec.modelFamily || "(unspecified)"}
Justification:
${spec.justification || "(unspecified)"}

2. OUTCOMES & HETEROGENEITY
${outcomes.map((o) => `[${o.kind}] ${o.label}\n  ${o.definition || ""}`).join("\n\n") || "(none registered)"}

3. DIAGNOSTICS & ROBUSTNESS
Residual triggers: ${diag.residualTriggers || "(unspecified)"}
Parallel-trends probes: ${diag.parallelTrends || "(unspecified)"}
Triangulation: ${diag.triangulation || "(unspecified)"}
Threshold: ${diag.threshold || "(unspecified)"}

4. AUDIT TRAIL (${log.length} entries)
${log.map((e) => `${new Date(e.at).toISOString()}  ${e.by}  ${e.summary}`).join("\n")}
`;
    setExported(text);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {can("write") && <button className={c.btn} onClick={buildExport}>Generate Registry Export</button>}
        {can("write") && <button className={c.btnGhost} onClick={() => logDecision("Manual checkpoint", {})}>Log checkpoint</button>}
      </div>
      {exported && (
        <textarea readOnly className={c.textarea + " min-h-[200px]"} value={exported} />
      )}
      <div>
        <div className={c.label}>Immutable decision log</div>
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {log.length === 0 && <li className={c.readonly}>No decisions logged yet.</li>}
          {log.map((e) => (
            <li key={e._id} className={c.row}>
              <div className={c.meta}>{new Date(e.at).toISOString()} · {e.by}</div>
              <div className="text-xs">{e.summary}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DiagnosticsPanel({ c, can, useDocument, aiBusy, setAiBusy, aiOut, critique, Spinner, logDecision }) {
  const { doc, merge, save } = useDocument({ _id: "diag:main", type: "diagnostics", residualTriggers: "", parallelTrends: "", triangulation: "", threshold: "" });

  if (!can("write")) {
    return (
      <div className="space-y-2 text-xs">
        <div><div className={c.meta}>Residual triggers</div>{doc.residualTriggers || <span className={c.readonly}>(not set)</span>}</div>
        <div><div className={c.meta}>Parallel-trends probes</div>{doc.parallelTrends || <span className={c.readonly}>(not set)</span>}</div>
        <div><div className={c.meta}>Triangulation</div>{doc.triangulation || <span className={c.readonly}>(not set)</span>}</div>
        <div><div className={c.meta}>Threshold</div>{doc.threshold || <span className={c.readonly}>(not set)</span>}</div>
        <p className={c.readonly}>Read-only view — contact the owner for write access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={c.label}>Residual patterns that would trigger re-specification</label>
        <textarea className={c.textarea} value={doc.residualTriggers} onChange={(e) => merge({ residualTriggers: e.target.value })} placeholder="e.g., systematic heteroskedasticity by district, ICC > 0.30..." />
      </div>
      <div>
        <label className={c.label}>Parallel-trends probes (DiD identification)</label>
        <textarea className={c.textarea} value={doc.parallelTrends} onChange={(e) => merge({ parallelTrends: e.target.value })} placeholder="e.g., event-study plot of pre-treatment leads, placebo treatment..." />
      </div>
      <div>
        <label className={c.label}>Mixed-methods triangulation strategy</label>
        <textarea className={c.textarea} value={doc.triangulation} onChange={(e) => merge({ triangulation: e.target.value })} placeholder="How qualitative codes integrate with quantitative findings..." />
      </div>
      <div>
        <label className={c.label}>Threshold for meaningful effect</label>
        <input className={c.input} value={doc.threshold} onChange={(e) => merge({ threshold: e.target.value })} placeholder="e.g., p < 0.01 AND effect size ≥ 0.10 SD" />
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={c.btn} onClick={async () => { await save(); await logDecision("Saved diagnostics plan", {}); }}>Save Diagnostics Plan</button>
        <button className={c.btnGhost} disabled={aiBusy.diag} onClick={() => critique("diag", JSON.stringify(doc))}>{aiBusy.diag ? <><Spinner />Reviewing...</> : "Request AI Critique"}</button>
        <button className={c.btnGhost} disabled={aiBusy.diag} onClick={async () => {
          setAiBusy((b) => ({ ...b, diag: true }));
          try {
            const r = await callAI("Suggest example pre-specified residual triggers, parallel-trends probes, mixed-methods triangulation, and effect threshold for a staggered DiD multilevel education study.", { schema: { properties: { residualTriggers: { type: "string" }, parallelTrends: { type: "string" }, triangulation: { type: "string" }, threshold: { type: "string" } } } });
            merge(JSON.parse(r));
          } finally { setAiBusy((b) => ({ ...b, diag: false })); }
        }}>{aiBusy.diag ? <Spinner /> : "Suggest ideas"}</button>
      </div>
      {aiOut.diag && (
        <div className={c.row}>
          {aiOut.diag.concerns?.length > 0 && <div className="mb-2"><div className={c.meta}>Concerns</div><ul className="list-disc ml-5 text-xs">{aiOut.diag.concerns.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
          {aiOut.diag.suggestions?.length > 0 && <div><div className={c.meta}>Suggestions</div><ul className="list-disc ml-5 text-xs">{aiOut.diag.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}

function OutcomesPanel({ c, can, database, useDocument, useLiveQuery, aiBusy, setAiBusy, aiOut, setAiOut, critique, Spinner, logDecision, viewer }) {
  const { doc, merge, submit } = useDocument({ type: "outcome", kind: "primary outcome", label: "", definition: "", createdAt: Date.now() });
  const { docs: outcomes } = useLiveQuery("type", { key: "outcome", descending: true });

  async function onAdd(e) {
    e.preventDefault();
    if (!doc.label.trim()) return;
    await submit();
    await logDecision(`Added ${doc.kind}: ${doc.label}`, { kind: doc.kind });
  }
  async function suggest() {
    setAiBusy((b) => ({ ...b, outcomes: true }));
    try {
      const r = await callAI("Suggest one outcome or heterogeneity entry for a longitudinal multi-school education intervention study. Return label, kind (primary outcome | secondary outcome | interaction / heterogeneity term), and definition.", { schema: { properties: { kind: { type: "string" }, label: { type: "string" }, definition: { type: "string" } } } });
      const p = JSON.parse(r);
      merge(p);
    } finally { setAiBusy((b) => ({ ...b, outcomes: false })); }
  }

  if (!can("write")) {
    return (
      <div>
        <ul className="space-y-2">{outcomes.map((o) => (<li key={o._id} className={c.row}><div className={c.meta}>{o.kind}</div>{o.label}</li>))}</ul>
        <p className={c.readonly + " mt-3"}>Read-only view — contact the owner for write access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select className={c.input} value={doc.kind} onChange={(e) => merge({ kind: e.target.value })}>
            <option>primary outcome</option>
            <option>secondary outcome</option>
            <option>interaction / heterogeneity term</option>
          </select>
          <input className={c.input} value={doc.label} onChange={(e) => merge({ label: e.target.value })} placeholder="Label" />
        </div>
        <textarea className={c.textarea} value={doc.definition} onChange={(e) => merge({ definition: e.target.value })} placeholder="Definition, measurement, expected direction..." />
        <div className="flex gap-2 flex-wrap">
          <button type="submit" className={c.btn}>Add Entry</button>
          <button type="button" className={c.btnGhost} disabled={aiBusy.outcomes} onClick={suggest}>{aiBusy.outcomes ? <><Spinner />Thinking...</> : "Suggest ideas"}</button>
          <button type="button" className={c.btnGhost} disabled={aiBusy.outcomesReview} onClick={async () => {
            setAiBusy((b) => ({ ...b, outcomesReview: true }));
            try { await critique("outcomes", JSON.stringify(outcomes.map((o) => ({ kind: o.kind, label: o.label, definition: o.definition })))); }
            finally { setAiBusy((b) => ({ ...b, outcomesReview: false })); }
          }}>{aiBusy.outcomesReview ? <><Spinner />Reviewing...</> : "Critique list"}</button>
        </div>
      </form>
      <ul className="space-y-2 mt-2">
        {outcomes.length === 0 && <li className={c.readonly}>No outcomes logged yet.</li>}
        {outcomes.map((o) => (
          <li key={o._id} className={c.row}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className={c.meta}>{o.kind}</div>
                <div className="font-bold">{o.label}</div>
                {o.definition && <div className="text-xs text-[#9aa8b8] mt-1">{o.definition}</div>}
              </div>
              <button className="text-[10px] uppercase tracking-wider text-[#9aa8b8] hover:text-white" onClick={() => database.del(o._id)}>delete</button>
            </div>
          </li>
        ))}
      </ul>
      {aiOut.outcomes && (
        <div className={c.row}>
          {aiOut.outcomes.concerns?.length > 0 && <div className="mb-2"><div className={c.meta}>Concerns</div><ul className="list-disc ml-5 text-xs">{aiOut.outcomes.concerns.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
          {aiOut.outcomes.suggestions?.length > 0 && <div><div className={c.meta}>Suggestions</div><ul className="list-disc ml-5 text-xs">{aiOut.outcomes.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useDocument, useLiveQuery } = useFireproof("pap-dossier");
  const [aiBusy, setAiBusy] = React.useState({});
  const [aiOut, setAiOut] = React.useState({});

  const spec = useDocument({ _id: "spec:main", type: "spec", level1: "", levelsHigher: "", modelFamily: "HLM — random effects at school & district", justification: "" });
  const { doc: specDoc, merge: mergeSpec, save: saveSpec } = spec;

  async function logDecision(summary, payload) {
    await database.put({ type: "audit", summary, payload, at: Date.now(), by: viewer?.userSlug || "anonymous" });
  }

  async function critique(section, content) {
    setAiBusy((b) => ({ ...b, [section]: true }));
    try {
      const res = await callAI(
        `You are a senior methodologist reviewing the ${section} of a pre-analysis plan for a 4-year longitudinal study (students nested in classrooms in schools in districts; staggered school-level assignment). Critique consistency, flag pitfalls, and suggest robustness checks. Content:\n\n${content}`,
        { schema: { properties: { strengths: { type: "array", items: { type: "string" } }, concerns: { type: "array", items: { type: "string" } }, suggestions: { type: "array", items: { type: "string" } } } } }
      );
      const parsed = JSON.parse(res);
      setAiOut((o) => ({ ...o, [section]: parsed }));
      await database.put({ type: "review", section, review: parsed, at: Date.now(), by: viewer?.userSlug || "anonymous" });
    } catch (e) {
      setAiOut((o) => ({ ...o, [section]: { concerns: ["Review failed: " + e.message] } }));
    } finally {
      setAiBusy((b) => ({ ...b, [section]: false }));
    }
  }

  const Spinner = () => (
    <svg className="animate-spin inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>
  );

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4a5a] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-xl md:text-2xl font-black tracking-tight uppercase",
    subtitle: "text-xs text-[#9aa8b8] mt-1 tracking-wider uppercase",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a5a] bg-black p-4 md:p-5 rounded",
    h2: "text-sm font-black uppercase tracking-widest text-white mb-3 pb-2 border-b border-[#3a4a5a]",
    label: "block text-[10px] uppercase tracking-widest text-[#9aa8b8] mb-1",
    input: "w-full bg-[#1a1a1a] border border-[#3a4a5a] text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-white rounded",
    textarea: "w-full bg-[#1a1a1a] border border-[#3a4a5a] text-white px-3 py-2 text-sm font-mono min-h-[88px] focus:outline-none focus:border-white rounded",
    btn: "min-h-[44px] px-4 py-2 bg-white text-black text-xs uppercase tracking-widest font-black rounded hover:bg-[#e0e0e0] disabled:opacity-40 disabled:cursor-not-allowed",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#3a4a5a] text-white text-xs uppercase tracking-widest hover:border-white rounded",
    row: "border border-[#3a4a5a] bg-[#0a0a0a] p-3 rounded text-sm",
    meta: "text-[10px] text-[#6a7888] uppercase tracking-wider",
    readonly: "text-xs text-[#9aa8b8] italic",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className={c.title}>Pre-Analysis Plan // Dossier</h1>
            <p className={c.subtitle}>Longitudinal Intervention Study · 80 Schools · 12 Districts</p>
          </div>
          {viewer && (
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-9 h-9 rounded-full border border-[#3a4a5a]" />
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="hierarchy" className={c.section}>
          <h2 className={c.h2}>01 · Data Hierarchy & Model Specification</h2>
          {!can("write") ? (
            <p className={c.readonly}>Read-only view — contact the owner for write access.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={c.label}>Level-1 variables (student-year)</label>
                <input className={c.input} value={specDoc.level1} onChange={(e) => mergeSpec({ level1: e.target.value })} placeholder="e.g., outcome score, baseline achievement, attendance" />
              </div>
              <div>
                <label className={c.label}>Level-2 / Level-3 / Level-4 (classroom / school / district)</label>
                <textarea className={c.textarea} value={specDoc.levelsHigher} onChange={(e) => mergeSpec({ levelsHigher: e.target.value })} placeholder="List variables at each level..." />
              </div>
              <div>
                <label className={c.label}>Model family</label>
                <select className={c.input} value={specDoc.modelFamily} onChange={(e) => mergeSpec({ modelFamily: e.target.value })}>
                  <option>HLM — random effects at school & district</option>
                  <option>Two-way fixed effects (school + year)</option>
                  <option>Mixed: school FE + district RE</option>
                </select>
              </div>
              <div>
                <label className={c.label}>Justification (substantive + statistical)</label>
                <textarea className={c.textarea} value={specDoc.justification} onChange={(e) => mergeSpec({ justification: e.target.value })} placeholder="Defend the choice on identifying assumptions, variance components, and policy interpretability..." />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className={c.btn} onClick={async () => { await saveSpec(); await logDecision("Saved model specification", { modelFamily: specDoc.modelFamily }); }}>Save Specification</button>
                <button className={c.btnGhost} disabled={aiBusy.spec} onClick={() => critique("spec", JSON.stringify(specDoc))}>
                  {aiBusy.spec ? <><Spinner />Reviewing...</> : "Request AI Critique"}
                </button>
                <button className={c.btnGhost} disabled={aiBusy.spec} onClick={async () => {
                  setAiBusy((b) => ({ ...b, spec: true }));
                  try {
                    const r = await callAI("Suggest example variables and a model-family justification for a 4-level nested education study (student/classroom/school/district) with staggered school-level assignment.", { schema: { properties: { level1: { type: "string" }, levelsHigher: { type: "string" }, justification: { type: "string" } } } });
                    const p = JSON.parse(r);
                    mergeSpec(p);
                  } finally { setAiBusy((b) => ({ ...b, spec: false })); }
                }}>{aiBusy.spec ? <Spinner /> : "Suggest ideas"}</button>
              </div>
              {aiOut.spec && (
                <div className={c.row}>
                  {aiOut.spec.strengths?.length > 0 && <div className="mb-2"><div className={c.meta}>Strengths</div><ul className="list-disc ml-5 text-xs">{aiOut.spec.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
                  {aiOut.spec.concerns?.length > 0 && <div className="mb-2"><div className={c.meta}>Concerns</div><ul className="list-disc ml-5 text-xs">{aiOut.spec.concerns.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
                  {aiOut.spec.suggestions?.length > 0 && <div><div className={c.meta}>Suggestions</div><ul className="list-disc ml-5 text-xs">{aiOut.spec.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
                </div>
              )}
            </div>
          )}
        </section>

        <section id="outcomes" className={c.section}>
          <h2 className={c.h2}>02 · Outcomes & Heterogeneity Terms</h2>
          <OutcomesPanel c={c} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} aiBusy={aiBusy} setAiBusy={setAiBusy} aiOut={aiOut} setAiOut={setAiOut} critique={critique} logDecision={logDecision} Spinner={Spinner} viewer={viewer} />
        </section>

        <section id="diagnostics" className={c.section}>
          <h2 className={c.h2}>03 · Diagnostics & Robustness Checks</h2>
          <DiagnosticsPanel c={c} can={can} useDocument={useDocument} aiBusy={aiBusy} setAiBusy={setAiBusy} aiOut={aiOut} critique={critique} logDecision={logDecision} Spinner={Spinner} />
        </section>

        <section id="audit" className={c.section}>
          <h2 className={c.h2}>04 · Audit Log & Registry Export</h2>
          <AuditPanel c={c} can={can} useLiveQuery={useLiveQuery} database={database} logDecision={logDecision} viewer={viewer} />
        </section>
      </main>
    </div>
  );
}