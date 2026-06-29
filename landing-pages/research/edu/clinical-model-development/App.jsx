import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useDocument, useLiveQuery } = useFireproof("sepsis-dossier");

  const taskDoc = useDocument({ _id: "task-definition", indexTime: "", window: "", outcome: "", criteria: "", critique: null });
  const [taskLoading, setTaskLoading] = React.useState(false);

  async function reviewTask() {
    setTaskLoading(true);
    try {
      const res = await callAI(
        `Critique this sepsis prediction task definition for regulatory readiness. Index: ${taskDoc.doc.indexTime}. Window: ${taskDoc.doc.window}. Outcome: ${taskDoc.doc.outcome}. Criteria: ${taskDoc.doc.criteria}.`,
        { schema: { properties: { completeness: { type: "number" }, gaps: { type: "array", items: { type: "string" } }, regulatoryNotes: { type: "string" } } } }
      );
      taskDoc.merge({ critique: JSON.parse(res) });
      await taskDoc.save();
    } finally { setTaskLoading(false); }
  }

  async function suggestTask() {
    setTaskLoading(true);
    try {
      const res = await callAI("Suggest a rigorous sepsis-6h prediction task definition for an inpatient EHR model.", {
        schema: { properties: { indexTime: { type: "string" }, window: { type: "string" }, outcome: { type: "string" }, criteria: { type: "string" } } }
      });
      taskDoc.merge(JSON.parse(res));
    } finally { setTaskLoading(false); }
  }

  const featDoc = useDocument({ type: "feature", name: "", source: "", window: "", missing: "", plausibility: "" });
  const { docs: features } = useLiveQuery("type", { key: "feature" });
  const [featLoading, setFeatLoading] = React.useState(false);

  async function suggestFeature() {
    setFeatLoading(true);
    try {
      const res = await callAI("Suggest one clinically valuable derived feature for a sepsis-6h EHR risk model. Be specific.", {
        schema: { properties: { name: { type: "string" }, source: { type: "string" }, window: { type: "string" }, missing: { type: "string" }, plausibility: { type: "string" } } }
      });
      featDoc.merge(JSON.parse(res));
    } finally { setFeatLoading(false); }
  }

  const cvDoc = useDocument({ _id: "cv-protocol", protocol: "" });
  const algoDoc = useDocument({ type: "algorithm", name: "", hyperparams: "", rationale: "" });
  const { docs: algos } = useLiveQuery("type", { key: "algorithm" });

  async function suggestAlgo() {
    const res = await callAI("Suggest one candidate ML algorithm for a sepsis-6h risk model with rationale and tradeoff.", {
      schema: { properties: { name: { type: "string" }, hyperparams: { type: "string" }, rationale: { type: "string" } } }
    });
    algoDoc.merge(JSON.parse(res));
  }

  const evalDoc = useDocument({ type: "evaluation", algo: "", auroc: "", auprc: "", calibration: "", netBenefit: "", subgroup: "" });
  const { docs: evals } = useLiveQuery("type", { key: "evaluation" });
  const chartRef = React.useRef(null);

  const cardDoc = useDocument({ _id: "model-card", recommendation: "", limitations: "", subpops: "", monitoring: "", critique: null });
  const [cardLoading, setCardLoading] = React.useState(false);

  async function reviewCard() {
    setCardLoading(true);
    try {
      const res = await callAI(
        `Critique this sepsis model card for clinical advisory board readiness. Recommendation: ${cardDoc.doc.recommendation}. Limitations: ${cardDoc.doc.limitations}. Subpops: ${cardDoc.doc.subpops}. Monitoring: ${cardDoc.doc.monitoring}. Context: ${features.length} features, ${algos.length} algorithms compared, ${evals.length} evaluations.`,
        { schema: { properties: { completeness: { type: "number" }, gaps: { type: "array", items: { type: "string" } }, regulatoryNotes: { type: "string" } } } }
      );
      cardDoc.merge({ critique: JSON.parse(res) });
      await cardDoc.save();
    } finally { setCardLoading(false); }
  }

  React.useEffect(() => {
    if (!chartRef.current || evals.length === 0) return;
    const el = chartRef.current;
    el.innerHTML = "";
    const W = el.clientWidth, H = 220, m = { t: 10, r: 10, b: 28, l: 36 };
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5)).attr("color", "#666");
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5)).attr("color", "#666");
    svg.append("line").attr("x1", x(0)).attr("y1", y(0)).attr("x2", x(1)).attr("y2", y(1)).attr("stroke", "#3a4a5c").attr("stroke-dasharray", "3 3");
    const colors = d3.schemeCategory10;
    evals.forEach((e, i) => {
      const auc = parseFloat(e.auroc) || 0.5;
      // synthetic ROC from AUROC using a power curve
      const pts = d3.range(0, 1.01, 0.05).map(fpr => [fpr, Math.pow(fpr, (1 - auc) / auc)]);
      const line = d3.line().x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveMonotoneX);
      svg.append("path").datum(pts).attr("d", line).attr("fill", "none").attr("stroke", colors[i % 10]).attr("stroke-width", 2);
      svg.append("text").attr("x", W - m.r - 8).attr("y", m.t + 14 + i * 14).attr("text-anchor", "end").attr("fill", colors[i % 10]).attr("font-size", 10).text(`${e.algo} ${auc.toFixed(2)}`);
    });
    svg.append("text").attr("x", W / 2).attr("y", H - 6).attr("text-anchor", "middle").attr("fill", "#888").attr("font-size", 10).text("FPR");
    svg.append("text").attr("transform", `translate(10,${H/2}) rotate(-90)`).attr("text-anchor", "middle").attr("fill", "#888").attr("font-size", 10).text("TPR");
  }, [evals]);

  const Spinner = () => <svg className="animate-spin inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>;

  const c = {
    page: "min-h-screen bg-[#1a1a1a] text-white font-mono",
    header: "border-b border-[#3a4a5c] bg-black px-4 py-5 sticky top-0 z-10",
    title: "text-2xl font-black tracking-tight uppercase",
    titleFont: { fontFamily: "'Archivo Black', sans-serif" },
    subtitle: "text-xs text-gray-400 mt-1 tracking-widest uppercase",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "border border-[#3a4a5c] bg-black p-5 rounded-sm",
    sectionTitle: "text-sm font-bold uppercase tracking-widest text-white mb-4 pb-2 border-b border-[#3a4a5c]",
    label: "block text-xs uppercase tracking-wider text-gray-400 mb-1",
    input: "w-full bg-[#1a1a1a] border border-[#3a4a5c] text-white px-3 py-2 text-sm focus:outline-none focus:border-white",
    textarea: "w-full bg-[#1a1a1a] border border-[#3a4a5c] text-white px-3 py-2 text-sm focus:outline-none focus:border-white min-h-[80px]",
    btn: "min-h-[44px] px-4 py-2 bg-white text-black text-xs uppercase tracking-widest font-bold hover:bg-gray-200 disabled:opacity-40",
    btnGhost: "min-h-[44px] px-4 py-2 border border-[#3a4a5c] text-white text-xs uppercase tracking-widest hover:border-white",
    row: "border border-[#3a4a5c] p-3 mb-2 bg-[#0d0d0d]",
    pill: "inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[#3a4a5c]",
    readonly: "text-xs text-gray-500 italic",
  }

  return (
    <div className={c.page} style={{ fontFamily: "'Roboto Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={c.titleFont}>SEPSIS RISK MODEL · DOSSIER</h1>
        <div className={c.subtitle}>Inpatient · 6h Prediction Window · Clinical Decision Record</div>
        {viewer && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <img src={viewer.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            <span>{viewer.displayName ?? viewer.userSlug}</span>
            <span className={c.pill}>{can("write") ? "EDITOR" : "READ-ONLY"}</span>
          </div>
        )}
      </header>

      <main id="app" className={c.main}>
        <section id="task-definition" className={c.section}>
          <h2 className={c.sectionTitle}>§1 · Prediction Task Definition</h2>
          <div className="space-y-3">
            <div>
              <label className={c.label}>Index Time</label>
              {can("write") ? (
                <input className={c.input} value={taskDoc.doc.indexTime} onChange={(e) => taskDoc.merge({ indexTime: e.target.value })} placeholder="e.g. every hour after ICU admission" />
              ) : <div className={c.readonly}>{taskDoc.doc.indexTime || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Prediction Window</label>
              {can("write") ? (
                <input className={c.input} value={taskDoc.doc.window} onChange={(e) => taskDoc.merge({ window: e.target.value })} placeholder="e.g. 6 hours forward" />
              ) : <div className={c.readonly}>{taskDoc.doc.window || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Outcome Definition</label>
              {can("write") ? (
                <textarea className={c.textarea} value={taskDoc.doc.outcome} onChange={(e) => taskDoc.merge({ outcome: e.target.value })} placeholder="Sepsis-3: suspected infection + SOFA Δ≥2 within window" />
              ) : <div className={c.readonly}>{taskDoc.doc.outcome || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Inclusion / Exclusion</label>
              {can("write") ? (
                <textarea className={c.textarea} value={taskDoc.doc.criteria} onChange={(e) => taskDoc.merge({ criteria: e.target.value })} placeholder="Include: adults ≥18 admitted >24h. Exclude: comfort-care." />
              ) : <div className={c.readonly}>{taskDoc.doc.criteria || "—"}</div>}
            </div>
            {can("write") && (
              <div className="flex gap-2 pt-2 flex-wrap">
                <button className={c.btn} onClick={() => taskDoc.save()} disabled={taskLoading}>Save Task</button>
                <button className={c.btnGhost} onClick={reviewTask} disabled={taskLoading}>{taskLoading ? <><Spinner/> Reviewing…</> : "AI Review"}</button>
                <button className={c.btnGhost} onClick={suggestTask} disabled={taskLoading}>Suggest</button>
              </div>
            )}
            {taskDoc.doc.critique && (
              <div className="mt-3 border-l-2 border-white pl-3 text-xs space-y-1">
                <div><span className={c.pill}>SCORE {taskDoc.doc.critique.completeness}/10</span></div>
                <div className="text-gray-300"><strong className="text-white">Gaps:</strong> {taskDoc.doc.critique.gaps?.join("; ")}</div>
                <div className="text-gray-300"><strong className="text-white">Reg:</strong> {taskDoc.doc.critique.regulatoryNotes}</div>
              </div>
            )}
          </div>
        </section>

        <section id="feature-engineering" className={c.section}>
          <h2 className={c.sectionTitle}>§2 · Feature Engineering · {features.length} defined</h2>
          {can("write") && (
            <form onSubmit={featDoc.submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input className={c.input} value={featDoc.doc.name} onChange={(e) => featDoc.merge({ name: e.target.value })} placeholder="Feature name (e.g. HR_max_6h)" />
                <input className={c.input} value={featDoc.doc.source} onChange={(e) => featDoc.merge({ source: e.target.value })} placeholder="Source (vitals/labs/meds)" />
              </div>
              <input className={c.input} value={featDoc.doc.window} onChange={(e) => featDoc.merge({ window: e.target.value })} placeholder="Time window aggregate" />
              <input className={c.input} value={featDoc.doc.missing} onChange={(e) => featDoc.merge({ missing: e.target.value })} placeholder="Missing-data convention" />
              <textarea className={c.textarea} value={featDoc.doc.plausibility} onChange={(e) => featDoc.merge({ plausibility: e.target.value })} placeholder="Clinical plausibility" />
              <div className="flex gap-2">
                <button type="submit" className={c.btn} disabled={featLoading}>Add Feature</button>
                <button type="button" className={c.btnGhost} onClick={suggestFeature} disabled={featLoading}>{featLoading ? <><Spinner/> …</> : "Suggest"}</button>
              </div>
            </form>
          )}
          <div className="pt-3 space-y-2">
            {features.length === 0 && <div className={c.readonly}>No features documented yet.</div>}
            {features.map((f) => (
              <div key={f._id} className={c.row}>
                <div className="flex justify-between items-start">
                  <strong>{f.name}</strong>
                  <div className="flex gap-1 items-center">
                    <span className={c.pill}>{f.source}</span>
                    {can("write") && <button className="text-xs text-gray-500 hover:text-white ml-2" onClick={() => database.del(f._id)}>×</button>}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">{f.window} · {f.missing}</div>
                {f.plausibility && <div className="text-xs text-gray-500 mt-1 italic">{f.plausibility}</div>}
              </div>
            ))}
          </div>
        </section>

        <section id="candidate-models" className={c.section}>
          <h2 className={c.sectionTitle}>§3 · Candidate Models · {algos.length} algorithms</h2>
          <div className="space-y-3">
            <div>
              <label className={c.label}>Cross-Validation Protocol</label>
              {can("write") ? (
                <>
                  <textarea className={c.textarea} value={cvDoc.doc.protocol} onChange={(e) => cvDoc.merge({ protocol: e.target.value })} placeholder="Patient-level grouped k-fold, temporal split…" />
                  <button className={c.btnGhost + " mt-1"} onClick={() => cvDoc.save()}>Save Protocol</button>
                </>
              ) : <div className={c.readonly}>{cvDoc.doc.protocol || "—"}</div>}
            </div>
            {can("write") && (
              <form onSubmit={algoDoc.submit} className="border-t border-[#3a4a5c] pt-3">
                <label className={c.label}>Add Candidate Algorithm</label>
                <div className="grid grid-cols-2 gap-2">
                  <input className={c.input} value={algoDoc.doc.name} onChange={(e) => algoDoc.merge({ name: e.target.value })} placeholder="Algorithm" />
                  <input className={c.input} value={algoDoc.doc.hyperparams} onChange={(e) => algoDoc.merge({ hyperparams: e.target.value })} placeholder="Hyperparameter range" />
                </div>
                <textarea className={c.textarea + " mt-2"} value={algoDoc.doc.rationale} onChange={(e) => algoDoc.merge({ rationale: e.target.value })} placeholder="Rationale & tradeoff" />
                <div className="flex gap-2 mt-2">
                  <button type="submit" className={c.btn}>Add Algorithm</button>
                  <button type="button" className={c.btnGhost} onClick={suggestAlgo}>Suggest</button>
                </div>
              </form>
            )}
            <div className="space-y-2 pt-2">
              {algos.length === 0 && <div className={c.readonly}>No candidate algorithms yet.</div>}
              {algos.map((a) => (
                <div key={a._id} className={c.row}>
                  <div className="flex justify-between items-start">
                    <strong>{a.name}</strong>
                    {can("write") && <button className="text-xs text-gray-500 hover:text-white" onClick={() => database.del(a._id)}>×</button>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{a.hyperparams}</div>
                  <div className="text-xs text-gray-500 mt-1 italic">{a.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="evaluation" className={c.section}>
          <h2 className={c.sectionTitle}>§4 · Evaluation · {evals.length} runs</h2>
          {can("write") && (
            <form onSubmit={evalDoc.submit} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={c.input} value={evalDoc.doc.algo} onChange={(e) => evalDoc.merge({ algo: e.target.value })} placeholder="Algorithm" />
                <input className={c.input} value={evalDoc.doc.auroc} onChange={(e) => evalDoc.merge({ auroc: e.target.value })} placeholder="AUROC (0.84)" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className={c.input} value={evalDoc.doc.auprc} onChange={(e) => evalDoc.merge({ auprc: e.target.value })} placeholder="AUPRC" />
                <input className={c.input} value={evalDoc.doc.calibration} onChange={(e) => evalDoc.merge({ calibration: e.target.value })} placeholder="Cal. slope" />
                <input className={c.input} value={evalDoc.doc.netBenefit} onChange={(e) => evalDoc.merge({ netBenefit: e.target.value })} placeholder="NB @ 5%" />
              </div>
              <input className={c.input} value={evalDoc.doc.subgroup} onChange={(e) => evalDoc.merge({ subgroup: e.target.value })} placeholder="Subgroup" />
              <button type="submit" className={c.btn}>Record Evaluation</button>
            </form>
          )}
          <div className="mt-3 border border-[#3a4a5c] p-3 bg-[#0d0d0d]">
            <div className={c.label}>ROC Comparison</div>
            <div ref={chartRef} className="w-full" />
            {evals.length === 0 && <div className="text-xs text-gray-500 py-6 text-center">No evaluations recorded.</div>}
          </div>
          <div className="mt-3 space-y-1">
            {evals.map(e => (
              <div key={e._id} className="text-xs flex justify-between border-b border-[#1a2230] py-1">
                <span><strong>{e.algo}</strong> · {e.subgroup || "overall"}</span>
                <span className="text-gray-400">AUROC {e.auroc} · cal {e.calibration} · NB {e.netBenefit}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="model-card" className={c.section}>
          <h2 className={c.sectionTitle}>§5 · Model Card · Advisory Board Artifact</h2>
          <div className="space-y-3">
            <div>
              <label className={c.label}>Recommended Model & Threshold</label>
              {can("write") ? (
                <textarea className={c.textarea} value={cardDoc.doc.recommendation} onChange={(e) => cardDoc.merge({ recommendation: e.target.value })} placeholder="Recommend L2 logistic regression at threshold 0.18…" />
              ) : <div className={c.readonly}>{cardDoc.doc.recommendation || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Known Limitations</label>
              {can("write") ? (
                <textarea className={c.textarea} value={cardDoc.doc.limitations} onChange={(e) => cardDoc.merge({ limitations: e.target.value })} placeholder="Underperforms in patients <40…" />
              ) : <div className={c.readonly}>{cardDoc.doc.limitations || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Subpopulation Performance</label>
              {can("write") ? (
                <textarea className={c.textarea} value={cardDoc.doc.subpops} onChange={(e) => cardDoc.merge({ subpops: e.target.value })} placeholder="Age ≥65: AUROC 0.86. Age <40: 0.74…" />
              ) : <div className={c.readonly}>{cardDoc.doc.subpops || "—"}</div>}
            </div>
            <div>
              <label className={c.label}>Post-Deployment Monitoring</label>
              {can("write") ? (
                <textarea className={c.textarea} value={cardDoc.doc.monitoring} onChange={(e) => cardDoc.merge({ monitoring: e.target.value })} placeholder="Monthly calibration audit; alert if Brier drift > 0.02…" />
              ) : <div className={c.readonly}>{cardDoc.doc.monitoring || "—"}</div>}
            </div>
            {can("write") && (
              <div className="flex gap-2 pt-2 flex-wrap">
                <button className={c.btn} onClick={() => cardDoc.save()} disabled={cardLoading}>Save Model Card</button>
                <button className={c.btnGhost} onClick={reviewCard} disabled={cardLoading}>{cardLoading ? <><Spinner/> Reviewing…</> : "Full AI Review"}</button>
              </div>
            )}
            {cardDoc.doc.critique && (
              <div className="mt-3 border-l-2 border-white pl-3 text-xs space-y-1">
                <div><span className={c.pill}>SCORE {cardDoc.doc.critique.completeness}/10</span></div>
                <div className="text-gray-300"><strong className="text-white">Gaps:</strong> {cardDoc.doc.critique.gaps?.join("; ")}</div>
                <div className="text-gray-300"><strong className="text-white">Regulatory:</strong> {cardDoc.doc.critique.regulatoryNotes}</div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}