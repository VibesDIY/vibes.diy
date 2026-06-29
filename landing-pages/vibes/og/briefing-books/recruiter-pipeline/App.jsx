import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

const PIPELINE_STAGES = [
  "SOURCED",
  "PHONE-SCREEN",
  "TAKE-HOME",
  "ONSITE",
  "OFFER",
  "CLOSED-WIN",
  "CLOSED-LOSS"
];

export default function App() {
  const [activeDossierId, setActiveDossierId] = useState(null);
  
  const { useLiveQuery, database } = useFireproof("dossier-tracker");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const { docs: candidates } = useLiveQuery("type", { key: "candidate", descending: true });
  const { docs: stageMoves } = useLiveQuery("type", { key: "stage_move", descending: true });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const activeCount = candidates.filter(c => !["CLOSED-WIN", "CLOSED-LOSS"].includes(c.stage)).length;
  const movedThisWeekCount = stageMoves.filter(m => m.timestamp > oneWeekAgo).length;
  const lostThisWeekCount = candidates.filter(c => c.stage === "CLOSED-LOSS" && c.lastTouch > oneWeekAgo).length;

  const [newDraft, setNewDraft] = useState({
    name: "",
    role: "",
    source: "",
    stage: "SOURCED"
  });

  const generateRandomCandidate = async () => {
    setIsGenerating(true);
    try {
      const resp = await callAI("Generate a realistic candidate for a tech job. Include name, role (e.g. Frontend Engineer, Product Manager), and source (e.g. LinkedIn, Referral, Inbound).", {
        schema: {
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            source: { type: "string" }
          }
        }
      });
      const data = JSON.parse(resp);
      setNewDraft({ ...newDraft, name: data.name, role: data.role, source: data.source });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStageChange = async (cand, newStage) => {
    const ts = Date.now();
    await database.put({ ...cand, stage: newStage, lastTouch: ts });
    await database.put({
      type: "stage_move",
      candidateId: cand._id,
      fromStage: cand.stage,
      toStage: newStage,
      timestamp: ts
    });
  };

  const handleFileDossier = async (e) => {
    e.preventDefault();
    if (!newDraft.name.trim()) return;
    
    const ts = Date.now();
    const candidateDoc = {
      type: "candidate",
      name: newDraft.name.toUpperCase(),
      role: newDraft.role.toUpperCase(),
      source: newDraft.source.toUpperCase(),
      stage: newDraft.stage,
      lastTouch: ts,
      nextAction: "REVIEW PROFILE",
      createdAt: ts
    };
    
    const res = await database.put(candidateDoc);
    await database.put({
      type: "stage_move",
      candidateId: res.id,
      fromStage: "INITIAL",
      toStage: newDraft.stage,
      timestamp: ts
    });
    
    setNewDraft({ name: "", role: "", source: "", stage: "SOURCED" });
  };

  const c = {
    page: "min-h-screen p-4 md:p-8 flex flex-col font-mono bg-[oklch(0.16_0_0)] text-[oklch(1_0_0)]",
    header: "py-6 mb-8 flex flex-col md:flex-row justify-between items-baseline border-b border-[oklch(0.28_0.03_257)] pb-4",
    brand: "text-2xl uppercase",
    brandSub: "text-xs mt-1 tracking-widest",
    exhibit: "mb-12 border border-[oklch(0.28_0.03_257)] bg-[oklch(0_0_0)] p-6 flex flex-col gap-4",
    exhibitTitle: "text-sm uppercase mb-4",
    metricsGrid: "grid grid-cols-1 md:grid-cols-3 gap-6",
    metricBox: "p-4 border border-[oklch(0.28_0.03_257)] flex flex-col gap-2",
    metricValue: "text-4xl",
    metricLabel: "text-xs uppercase",
    tableWrapper: "w-full overflow-x-auto",
    table: "w-full text-xs text-left border-collapse",
    th: "p-3 border-b border-[oklch(0.28_0.03_257)] uppercase whitespace-nowrap",
    td: "p-3 border-b border-[oklch(0.28_0.03_257)] whitespace-nowrap",
    inputGroup: "flex flex-col gap-1 mb-4",
    label: "text-[10px] uppercase",
    input: "pb-1 pt-2 w-full outline-none bg-transparent border-b border-[oklch(0.28_0.03_257)] focus:border-[oklch(1_0_0)] transition-colors",
    buttonRow: "flex gap-4 mt-4",
    button: "px-6 py-2 font-display text-sm uppercase border border-[oklch(0.28_0.03_257)] hover:bg-[oklch(1_0_0)] hover:text-[oklch(0_0_0)] transition-colors duration-200"
  };

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;500&display=optional');
          body { font-family: 'Roboto Mono', monospace; }
          .font-display { font-family: 'Archivo Black', sans-serif; letter-spacing: -0.02em; }
        `}
      </style>
      <div className={c.page}>
        <header className={c.header}>
          {activeDossierId && (
             <button className={`${c.button} border-none hover:bg-transparent hover:text-[oklch(0.5_0_0)]`} onClick={() => setActiveDossierId(null)}>
               [ &lt; RETURN TO DIRECTORY ]
             </button>
          )}
          <div>
            <h1 className={`${c.brand} font-display`}>Pipeline Dossier</h1>
            <p className={c.brandSub}>CONFIDENTIAL // INTERNAL USE ONLY</p>
          </div>
          <div className="text-xs">LAST SYNC: {new Date().toLocaleDateString()}</div>
        </header>

        {!activeDossierId ? (
          <>
            <section id="metrics" className={c.exhibit}>
              <h2 className={`${c.exhibitTitle} font-display`}>EXHIBIT 01: WEEKLY METRICS</h2>
          <div className={c.metricsGrid}>
            <div className={c.metricBox}>
              <div className={c.metricLabel}>TOTAL ACTIVE DOSSIERS</div>
              <div className={`${c.metricValue} font-display`}>{activeCount.toString().padStart(2, '0')}</div>
            </div>
            <div className={c.metricBox}>
              <div className={c.metricLabel}>DOSSIERS MOVED THIS WEEK</div>
              <div className={`${c.metricValue} font-display`}>{movedThisWeekCount.toString().padStart(2, '0')}</div>
            </div>
            <div className={c.metricBox}>
              <div className={c.metricLabel}>CLOSED-LOSS THIS WEEK</div>
              <div className={`${c.metricValue} font-display`}>{lostThisWeekCount.toString().padStart(2, '0')}</div>
            </div>
          </div>
        </section>

        <section id="pipeline" className={c.exhibit}>
          <h2 className={`${c.exhibitTitle} font-display`}>EXHIBIT 02: ACTIVE DOSSIERS</h2>
          <div className={c.tableWrapper}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>CANDIDATE</th>
                  <th className={c.th}>ROLE</th>
                  <th className={c.th}>STAGE</th>
                  <th className={c.th}>LAST TOUCH</th>
                  <th className={c.th}>NEXT ACTION</th>
                  <th className={c.th}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 && (
                  <tr><td colSpan="6" className={`${c.td} text-center opacity-50`}>NO DOSSIERS FILED</td></tr>
                )}
                {candidates.map((cand) => {
                  const isStale = cand.lastTouch < sevenDaysAgo && !["CLOSED-WIN", "CLOSED-LOSS"].includes(cand.stage);
                  return (
                    <tr key={cand._id}>
                      <td className={c.td}>{cand.name}</td>
                      <td className={c.td}>{cand.role}</td>
                      <td className={c.td}>{cand.stage}</td>
                      <td className={`${c.td} ${isStale ? "text-[oklch(0.5_0.1_20)]" : ""}`}>
                        {new Date(cand.lastTouch).toISOString().split('T')[0]} {isStale && "(! STALE)"}
                      </td>
                      <td className={c.td}>
                         <input
                           className="bg-transparent border-none outline-none w-full"
                           value={cand.nextAction || ""}
                           onChange={e => database.put({...cand, nextAction: e.target.value})}
                           placeholder="NONE"
                         />
                      </td>
                      <td className={c.td}>
                        <button className={`${c.button} py-1 px-3 text-xs`} onClick={() => setActiveDossierId(cand._id)}>[ VIEW ]</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="add-candidate" className={c.exhibit}>
          <div className="flex justify-between items-baseline mb-4 border-b border-transparent">
            <h2 className={`${c.exhibitTitle} font-display mb-0`}>EXHIBIT 03: NEW DOSSIER ENTRY</h2>
            <button type="button" onClick={generateRandomCandidate} disabled={isGenerating} className="text-[10px] text-[oklch(0.28_0.03_257)] hover:text-white uppercase">
              {isGenerating ? "[ DECRYPTING... ]" : "[ INGEST SAMPLE ]"}
            </button>
          </div>
          <form onSubmit={handleFileDossier}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={c.inputGroup}>
                <label className={c.label}>CANDIDATE NAME</label>
                <input type="text" className={c.input} placeholder="LAST, FIRST" value={newDraft.name} onChange={e => setNewDraft({...newDraft, name: e.target.value})} required />
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>ROLE / REQ</label>
                <input type="text" className={c.input} placeholder="TARGET POSITION" value={newDraft.role} onChange={e => setNewDraft({...newDraft, role: e.target.value})} required />
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>SOURCE</label>
                <input type="text" className={c.input} placeholder="E.G. LINKEDIN" value={newDraft.source} onChange={e => setNewDraft({...newDraft, source: e.target.value})} />
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>INITIAL STAGE</label>
                <select className={`${c.input} appearance-none text-[oklch(1_0_0)]`} value={newDraft.stage} onChange={e => setNewDraft({...newDraft, stage: e.target.value})}>
                  {PIPELINE_STAGES.map(s => <option key={s} value={s} className="bg-[oklch(0.16_0_0)]">{s}</option>)}
                </select>
              </div>
            </div>
            <div className={c.buttonRow}>
              <button type="submit" className={c.button}>[ FILE DOSSIER ]</button>
            </div>
          </form>
        </section>
        </>
        ) : (
          (() => {
            const active = candidates.find(c => c._id === activeDossierId);
            if (!active) return null;
            const history = stageMoves.filter(m => m.candidateId === activeDossierId).sort((a,b) => b.timestamp - a.timestamp);
            
            return (
              <div className="flex flex-col gap-8">
                <section className={c.exhibit}>
                  <h2 className={`${c.exhibitTitle} font-display`}>SUBJECT: {active.name}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className={c.label}>ROLE</div>
                      <div className="text-sm">{active.role}</div>
                    </div>
                    <div>
                      <div className={c.label}>SOURCE</div>
                      <div className="text-sm">{active.source}</div>
                    </div>
                    <div>
                      <div className={c.label}>CURRENT STAGE</div>
                      <div className="text-sm">{active.stage}</div>
                    </div>
                    <div>
                      <div className={c.label}>FILE CREATED</div>
                      <div className="text-sm">{new Date(active.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className={c.inputGroup}>
                     <label className={c.label}>UPDATE STAGE</label>
                     <div className="flex flex-wrap gap-2 mt-1">
                        {PIPELINE_STAGES.map(s => (
                          <button 
                            key={s} 
                            onClick={() => handleStageChange(active, s)}
                            className={`px-3 py-1 font-display text-xs border border-[oklch(0.28_0.03_257)] transition-colors ${active.stage === s ? "bg-[oklch(1_0_0)] text-black" : "hover:bg-[oklch(0.5_0_0)]"}`}
                          >
                            {s}
                          </button>
                        ))}
                     </div>
                  </div>
                </section>

                <section className={c.exhibit}>
                  <h2 className={`${c.exhibitTitle} font-display`}>AUDIT LOG </h2>
                  <div className={c.tableWrapper}>
                    <table className={c.table}>
                      <thead>
                        <tr>
                          <th className={c.th}>TIMESTAMP</th>
                          <th className={c.th}>FROM</th>
                          <th className={c.th}>TO</th>
                        </tr>
                      </thead>
                      <tbody>
                         {history.map(m => (
                           <tr key={m._id}>
                             <td className={c.td}>{new Date(m.timestamp).toLocaleString()}</td>
                             <td className={c.td}>{m.fromStage}</td>
                             <td className={c.td}>{m.toStage}</td>
                           </tr>
                         ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}