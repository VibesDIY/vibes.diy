import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  const [activeRfpId, setActiveRfpId] = useState(null);
  
  const { database, useLiveQuery } = useFireproof("procurement-dossier");
  
  const { docs: rfps } = useLiveQuery("type", { key: "rfp", descending: true });
  const { docs: criteria } = useLiveQuery((doc) => doc.type === 'criterion' ? doc.rfpId : undefined, { key: activeRfpId || "none" });
  const { docs: vendors } = useLiveQuery((doc) => doc.type === 'vendor' ? doc.rfpId : undefined, { key: activeRfpId || "none" });
  const { docs: scores } = useLiveQuery((doc) => doc.type === 'score' ? doc.rfpId : undefined, { key: activeRfpId || "none" });

  const [newRfpName, setNewRfpName] = useState("");
  const [newCriterionName, setNewCriterionName] = useState("");
  const [newCriterionWeight, setNewCriterionWeight] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  
  const [evaluatingTarget, setEvaluatingTarget] = useState(null); // { vendorId, criterionId }
  const [evalScoreNum, setEvalScoreNum] = useState("");
  const [evalJustification, setEvalJustification] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const initRfp = async () => {
    if (!newRfpName.trim()) return;
    const ok = await database.put({ type: 'rfp', title: newRfpName.trim(), status: 'open', createdAt: Date.now() });
    setNewRfpName("");
    setActiveRfpId(ok.id);
  };

  const addVendor = async () => {
    if (!newVendorName.trim() || !activeRfpId) return;
    await database.put({ type: 'vendor', rfpId: activeRfpId, name: newVendorName.trim(), createdAt: Date.now() });
    setNewVendorName("");
  };

  const addCriterion = async (name, weight) => {
    if (!name.trim() || !activeRfpId) return;
    const w = parseInt(weight, 10);
    if (isNaN(w) || w <= 0) return;
    await database.put({ type: 'criterion', rfpId: activeRfpId, name: name.trim(), weight: w, createdAt: Date.now() });
    setNewCriterionName("");
    setNewCriterionWeight("");
  };

  const commitEvaluation = async () => {
    if (!evaluatingTarget || !evalScoreNum || !activeRfpId) return;
    const val = parseInt(evalScoreNum, 10);
    if (val < 1 || val > 5) return;
    
    // Find existing to overwrite, or create new
    const existing = scores.find(s => s.vendorId === evaluatingTarget.vendorId && s.criterionId === evaluatingTarget.criterionId);
    
    await database.put({
      _id: existing?._id,
      type: 'score',
      rfpId: activeRfpId,
      vendorId: evaluatingTarget.vendorId,
      criterionId: evaluatingTarget.criterionId,
      score: val,
      note: evalJustification.trim(),
      updatedAt: Date.now()
    });
    
    setEvaluatingTarget(null);
    setEvalScoreNum("");
    setEvalJustification("");
  };

  const activeRfp = rfps.find(r => r._id === activeRfpId);
  const totalWeightStr = criteria.reduce((sum, c) => sum + c.weight, 0);

  const calculateMatrix = () => {
    return vendors.map(v => {
      let totalObj = 0;
      const vendorScores = {};
      criteria.forEach(c => {
        const s = scores.find(sx => sx.vendorId === v._id && sx.criterionId === c._id);
        const val = s ? s.score : 0;
        vendorScores[c._id] = s;
        totalObj += val * (c.weight / 100);
      });
      return { vendor: v, total: totalObj.toFixed(2), scoreMap: vendorScores };
    }).sort((a, b) => b.total - a.total); // strictly descending auto-rank
  };
  
  const rankedMatrix = calculateMatrix();

  const handlePrint = () => window.print();

  const generateAIBaseline = async () => {
    if (!activeRfp) return;
    setIsLoadingAI(true);
    try {
      const prompt = `Generate 4 strict evaluation criteria with percentage weights for a procurement RFP titled "${activeRfp.title}". Weights must sum to 100 exactly. Return simple JSON.`;
      const res = await callAI(prompt, {
        schema: {
          properties: {
             criteria: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, weight: { type: 'number' }}}}
          }
        }
      });
      const data = JSON.parse(res);
      for (const item of data.criteria || []) {
        await addCriterion(item.name, item.weight);
      }
    } finally {
      setIsLoadingAI(false);
    }
  };

  const c = {
    page: "min-h-screen flex flex-col items-center p-4 md:p-8 bg-[oklch(0.16_0_0)] text-[oklch(1_0_0)] font-mono",
    container: "w-full max-w-5xl flex flex-col gap-8",
    header: "w-full flex justify-between items-end pb-4 mb-4 border-b border-[oklch(0.28_0.03_257)]",
    title: "font-display text-4xl uppercase tracking-tighter",
    section: "flex flex-col gap-4 mb-8 w-full",
    sectionHeader: "font-display text-xl uppercase pb-2 border-b border-[oklch(0.28_0.03_257)]",
    card: "p-4 md:p-6 flex flex-col gap-6 border border-[oklch(0.28_0.03_257)] bg-[oklch(0_0_0)] rounded-none",
    formRow: "flex flex-col md:flex-row gap-4 items-end",
    inputGroup: "flex flex-col gap-1 w-full flex-1",
    label: "text-xs uppercase tracking-widest",
    input: "w-full p-2 outline-none border-b border-[oklch(0.28_0.03_257)] bg-transparent text-[oklch(1_0_0)] focus:border-[oklch(1_0_0)] transition-colors resize-none placeholder:text-gray-600 rounded-none",
    btn: "px-4 py-2 font-display uppercase text-sm text-center cursor-pointer transition-colors border border-[oklch(0.28_0.03_257)] inline-flex items-center justify-center whitespace-nowrap hover:bg-[oklch(1_0_0)] hover:text-[oklch(0_0_0)] active:translate-y-px",
    btnAi: "px-2 py-1 font-display text-xs uppercase cursor-pointer border border-[oklch(0.28_0.03_257)] flex items-center justify-center gap-2 hover:bg-[oklch(1_0_0)] hover:text-[oklch(0_0_0)]",
    tableWrapper: "w-full overflow-x-auto border border-[oklch(0.28_0.03_257)] bg-[oklch(0_0_0)]",
    table: "w-full border-collapse text-sm text-left",
    th: "p-3 font-display uppercase text-xs border-b border-r border-[oklch(0.28_0.03_257)] last:border-r-0 whitespace-nowrap bg-[oklch(0.16_0_0)]",
    td: "p-0 border-b border-r border-[oklch(0.28_0.03_257)] last:border-r-0 min-w-[120px]",
    cellInteractive: "w-full h-full p-3 flex flex-col gap-1 cursor-pointer outline-none hover:bg-[#1a1a2e] active:bg-[#000] transition-colors text-left",
    scoreMuted: "text-xs uppercase opacity-50",
    scoreActive: "text-sm",
    rankRow: "border border-[oklch(0.28_0.03_257)] px-3 gap-4 py-2 flex items-center justify-between hover:border-[oklch(1_0_0)] transition-colors",
  };

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;500;700&display=optional');
        .font-display { font-family: 'Archivo Black', sans-serif; letter-spacing: -0.02em; }
        .font-mono { font-family: 'Roboto Mono', monospace; }
        @media print { body { background: white !important; color: black !important; } }
      `}</style>
      <div className={c.container}>
        <header className={`${c.header} print:hidden`}>
          <h1 className={`${c.title} cursor-pointer hover:opacity-75`} onClick={() => setActiveRfpId(null)}>Procurement Dossier</h1>
          <button className={c.btn} onClick={() => setActiveRfpId(null)}>[ Return ]</button>
        </header>

        <main className="w-full flex flex-col gap-8">
          {/* CATALOGUE VIEW */}
          <section className={c.section}>
            <h2 className={c.sectionHeader}>Exhibit 00 / Catalogue</h2>
            <div className={c.card}>
              {rfps.length === 0 && <span className={c.label}>No ledgers available.</span>}
              {rfps.map(r => (
                <div key={r._id} className={c.rankRow}>
                  <div className="flex flex-col">
                    <span className="font-bold">{r.title}</span>
                    <span className={c.label}>Status: {r.status}</span>
                  </div>
                  <button className={c.btn} onClick={() => setActiveRfpId(r._id)}>[ Open ]</button>
                </div>
              ))}
            </div>
          </section>

          {/* ACTIVE DOSSIER VIEW */}
          {!activeRfpId ? (
            <section className={c.section}>
               <h2 className={c.sectionHeader}>Exhibit 01 / Directive Assignment</h2>
               <div className={c.card}>
                 <div className={c.formRow}>
                   <div className={c.inputGroup}>
                     <label className={c.label}>Briefing Title</label>
                     <input className={c.input} placeholder="e.g. Enterprise CRM..." value={newRfpName} onChange={e=>setNewRfpName(e.target.value)} />
                   </div>
                   <button className={c.btn} onClick={initRfp}>[ Initialize ]</button>
                 </div>
               </div>
            </section>
          ) : (
          <div className="flex flex-col gap-12 mt-4 block-print">
            <header className="flex justify-between items-center bg-[oklch(1_0_0)] text-black p-4 uppercase px-6 print:block border-b-4 border-black mb-8 hidden print:flex">
               <div className="font-display text-2xl">FINAL DETERMINATION: {activeRfp?.title}</div>
               <div>AUTHORIZED PURVIEW</div>
            </header>
            

            <section className={`${c.section} print:hidden`}>
              <div className="flex justify-between items-end border-b border-[oklch(0.28_0.03_257)] pb-2 mb-2">
                <h2 className="font-display text-xl uppercase">Exhibit 01 / Matrix Criteria</h2>
                <button disabled={isLoadingAI} className={c.btnAi} onClick={generateAIBaseline}>
                   {isLoadingAI ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span> : "AI Baseline"}
                </button>
              </div>
              <div className={c.card}>
                <div className={c.formRow}>
                  <div className={c.inputGroup}>
                    <label className={c.label}>Criterion</label>
                    <input className={c.input} value={newCriterionName} onChange={e=>setNewCriterionName(e.target.value)} placeholder="Security..." />
                  </div>
                  <div className={`${c.inputGroup} max-w-[100px]`}>
                    <label className={c.label}>Weight %</label>
                    <input className={c.input} type="number" value={newCriterionWeight} onChange={e=>setNewCriterionWeight(e.target.value)} placeholder="20" />
                  </div>
                  <button className={c.btn} onClick={()=>addCriterion(newCriterionName, newCriterionWeight)}>[ Append ]</button>
                </div>
                
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex justify-between uppercase text-[10px] tracking-widest px-2 opacity-50">
                    <span>Active Definition</span>
                    <span>Current Distribution: {totalWeightStr}%</span>
                  </div>
                  {criteria.map(cr => (
                    <div key={cr._id} className={c.rankRow}>
                      <span className="font-bold">{cr.name}</span>
                      <span className="font-display">{cr.weight}%</span>
                    </div>
                  ))}
                  {criteria.length === 0 && <span className={c.label}>No criteria asserted.</span>}
                </div>
              </div>
            </section>

            <section className={`${c.section} print:hidden`}>
              <h2 className={c.sectionHeader}>Exhibit 02 / Vendor Submissions</h2>
              <div className={c.card}>
                <div className={c.formRow}>
                  <div className={c.inputGroup}>
                    <label className={c.label}>Vendor Entity</label>
                    <input className={c.input} value={newVendorName} onChange={e=>setNewVendorName(e.target.value)} placeholder="Acme Corp..." />
                  </div>
                  <button className={c.btn} onClick={addVendor}>[ Register ]</button>
                </div>
              </div>
            </section>

            <section className={c.section}>
              <div className="flex justify-between items-end border-b border-[oklch(0.28_0.03_257)] pb-2 mb-2 flex-wrap gap-4">
                <h2 className="font-display text-xl uppercase">Exhibit 03 / Evaluation Ledger</h2>
                <button className={`${c.btnAi} print:hidden`} onClick={handlePrint}>Export Summary</button>
              </div>
              <div className={c.tableWrapper}>
                <table className={c.table}>
                  <thead>
                    <tr>
                      <th className={`${c.th} sticky left-0 z-10 w-[200px]`}>Entity / Rank</th>
                      <th className={c.th}>Net Score</th>
                      {criteria.map(c => (
                         <th key={c._id} className={c.th}>{c.name} ({c.weight}%)</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankedMatrix.length === 0 && (
                      <tr><td colSpan={100} className="p-4 text-center text-xs opacity-50">Matrix empty. Append nodes.</td></tr>
                    )}
                    {rankedMatrix.map((row, idx) => (
                      <tr key={row.vendor._id}>
                        <td className={`${c.td} sticky left-0 z-10 bg-[oklch(0.16_0_0)] md:bg-transparent`}>
                           <div className="p-3 flex justify-between items-center bg-[oklch(0_0_0)] w-full h-full border border-[oklch(0.28_0.03_257)] border-t-0 border-l-0 border-r-0">
                             <span className="font-bold uppercase truncate">{row.vendor.name}</span>
                             <span className="text-[10px] opacity-70">#{idx+1}</span>
                           </div>
                        </td>
                        <td className={c.td}><div className="p-3 font-display text-lg bg-[oklch(0.16_0_0)] h-full">{row.total}</div></td>
                        {criteria.map(cr => {
                           const s = row.scoreMap[cr._id];
                           return (
                             <td key={cr._id} className={c.td}>
                               <button 
                                 className={`${c.cellInteractive} ${evaluatingTarget?.vendorId === row.vendor._id && evaluatingTarget?.criterionId === cr._id ? 'bg-[oklch(1_0_0)] text-black' : ''}`}
                                 onClick={() => {
                                    setEvaluatingTarget({ vendorId: row.vendor._id, criterionId: cr._id, vName: row.vendor.name, cName: cr.name });
                                    setEvalScoreNum(s ? s.score : "");
                                    setEvalJustification(s ? s.note : "");
                                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                 }}
                               >
                                 <span className={s ? c.scoreActive : c.scoreMuted}>{s ? `${s.score} / 5` : '- / 5'}</span>
                                 <span className="text-[10px] opacity-70 truncate max-w-[120px] print:whitespace-normal">{s ? s.note : 'Awaiting'}</span>
                               </button>
                             </td>
                           )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SCORING ENTRY */}
            {evaluatingTarget && (
              <section className={`${c.section} print:hidden`}>
                <h2 className={c.sectionHeader}>Exhibit 04 / Active Evaluation</h2>
                <div className={`${c.card} border-[oklch(1_0_0)]`}>
                  <div className="text-sm font-display uppercase mb-2 text-[oklch(1_0_0)]">Evaluating: {evaluatingTarget.vName} — {evaluatingTarget.cName}</div>
                  <div className={c.formRow}>
                    <div className={`${c.inputGroup} max-w-[100px]`}>
                      <label className={c.label}>Score (1-5)</label>
                      <input className={c.input} type="number" min="1" max="5" value={evalScoreNum} onChange={e=>setEvalScoreNum(e.target.value)} />
                    </div>
                    <div className={c.inputGroup}>
                      <label className={c.label}>Justification Note</label>
                      <input className={c.input} placeholder="Rationalize the score assignment..." value={evalJustification} onChange={e=>setEvalJustification(e.target.value)} />
                    </div>
                    <button className={c.btn} onClick={commitEvaluation}>[ Commit ]</button>
                    <button className={`${c.btn} opacity-50`} onClick={()=>setEvaluatingTarget(null)}>[ Drop ]</button>
                  </div>
                </div>
              </section>
            )}

          </div>
          )}
        </main>
      </div>
    </div>
  );
}