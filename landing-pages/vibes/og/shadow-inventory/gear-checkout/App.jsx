App.jsx
import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedGear, setSelectedGear] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [gearLabelForm, setGearLabelForm] = useState({ serial: "", version: "" });
  const [actionForm, setActionForm] = useState({ status: "OUT", holder: "", project: "", note: "" });

  const { useLiveQuery, database } = useFireproof("gear-ledger-prod-v1");
  
  const { docs: gearDocs } = useLiveQuery("type", { key: "gear", descending: true });
  
  // Custom index for logs to sort chronologically by timestamp
  const { docs: logDocs } = useLiveQuery(
    (doc) => { if (doc.type === "log" && doc.gearId) return [doc.gearId, doc.timestamp]; return null; },
    { prefix: [selectedGear?._id || ""] }
  );

  const displayedGear = activeFilter === "ALL" ? gearDocs : gearDocs.filter(d => d.status === activeFilter);

  async function handleRegister(e) {
    e.preventDefault();
    if (!gearLabelForm.serial.trim()) return;
    
    const result = await database.put({
      type: "gear",
      serial: gearLabelForm.serial.toUpperCase(),
      version: gearLabelForm.version.toUpperCase(),
      status: "RACK",
      holder: "",
      project: "",
      note: "INITIAL REGISTRATION",
      updatedAt: Date.now()
    });

    await database.put({
      type: "log",
      gearId: result.id,
      action: "REGISTER",
      holder: "SYSTEM",
      project: "N/A",
      note: "Initial hardware registration",
      timestamp: Date.now()
    });

    setGearLabelForm({ serial: "", version: "" });
  }

  async function handleCustodyAction(e) {
    e.preventDefault();
    if (!selectedGear) return;
    
    setActionLoading(true);
    try {
      await database.put({
        ...selectedGear,
        status: actionForm.status,
        holder: actionForm.status === "RACK" ? "" : actionForm.holder,
        project: actionForm.status === "RACK" ? "" : actionForm.project,
        note: actionForm.note || `${actionForm.status} UPDATE`,
        updatedAt: Date.now()
      });

      await database.put({
        type: "log",
        gearId: selectedGear._id,
        action: actionForm.status,
        holder: actionForm.status === "RACK" ? "WAREHOUSE" : actionForm.holder,
        project: actionForm.project,
        note: actionForm.note,
        timestamp: Date.now()
      });

      setActionForm({ status: "OUT", holder: "", project: "", note: "" });
    } finally {
      setActionLoading(false);
      setSelectedGear(null); // Close modal
    }
  }

  const c = {
    page: "relative min-h-screen bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)] overflow-x-hidden",
    ambient: "fixed inset-0 pointer-events-none z-0 bg-grid",
    layout: "relative z-10 w-full max-w-[920px] mx-auto p-4 md:px-8 py-12 flex flex-col gap-8",
    nav: "flex items-center justify-between p-4 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] box-border",
    logoGroup: "flex items-center gap-2",
    logoBoxRed: "w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)]",
    logoBoxYellow: "w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)]",
    logoBoxGreen: "w-3 h-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]",
    logoBrand: "font-bold tracking-[-0.02em] uppercase text-[oklch(0.15_0.02_280)] whitespace-nowrap",
    navRight: "flex items-center gap-3",
    navChip: "px-3 py-1.5 text-[0.75rem] font-bold uppercase tracking-[0.05em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] cursor-pointer hover:-translate-x-[2px] hover:-translate-y-[2px] transition-transform shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    
    heroCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] relative flex flex-col overflow-hidden shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    heroAccentBar: "flex h-[6px] w-full border-b-[3px] border-[oklch(0.15_0.02_280)]",
    heroAccentSegmentRed: "flex-1 bg-[oklch(0.55_0.24_28)]",
    heroAccentSegmentYellow: "flex-1 bg-[oklch(0.85_0.18_85)]",
    heroAccentSegmentGreen: "flex-1 bg-[oklch(0.62_0.19_145)]",
    heroAccentSegmentBlue: "flex-1 bg-[oklch(0.52_0.18_255)]",
    heroContent: "p-8 md:p-10 flex flex-col gap-4",
    heroTitle: "text-4xl md:text-5xl font-bold uppercase tracking-[-0.02em] relative z-10",
    heroTitleShadow: "absolute top-[5px] left-[5px] text-4xl md:text-5xl font-bold uppercase tracking-[-0.02em] text-[oklch(0.55_0.24_28)] opacity-50 z-0",
    heroSub: "max-w-md text-[0.82rem] text-[oklch(0.15_0.02_280)] font-medium leading-relaxed relative z-10",

    statGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] flex flex-col overflow-hidden shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    statHeader1: "px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white",
    statHeader2: "px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]",
    statHeader3: "px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]",
    statHeader4: "px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.50_0.02_280)] text-white",
    statBody: "p-4 text-3xl font-mono font-bold flex items-baseline gap-1.5 text-[oklch(0.15_0.02_280)]",
    statUnit: "text-[0.65rem] font-sans font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)]",

    mainGrid: "grid grid-cols-1 gap-8",
    
    formCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] p-6 flex flex-col gap-5 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    formLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[oklch(0.50_0.02_280)]",
    inputBox: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] px-3 py-2 w-full text-[0.82rem] font-mono font-bold text-[oklch(0.15_0.02_280)] focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all duration-150",
    selectBox: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 w-full text-[0.82rem] font-bold uppercase focus:outline-none cursor-pointer appearance-none bg-[oklch(1.00_0_0)] text-[oklch(0.15_0.02_280)]",
    btnRow: "flex flex-wrap gap-3 mt-3",
    btnPrimary: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.55_0.24_28)] text-white px-5 py-2.5 text-[0.8rem] font-bold uppercase tracking-[0.08em] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-transform duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed",
    btnSecondary: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] px-4 py-2.5 text-[0.8rem] font-bold uppercase tracking-[0.08em] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-transform duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed",
    btnGhost: "px-4 py-2.5 text-[0.8rem] font-bold uppercase tracking-[0.08em] transition-transform duration-150 border-[3px] border-transparent rounded-[4px] bg-[oklch(1.00_0_0)] text-[oklch(0.15_0.02_280)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:border-[oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer",
    
    tableCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden flex flex-col overflow-x-auto",
    table: "w-full text-left border-collapse min-w-[600px]",
    th: "px-4 py-3 text-[0.7rem] uppercase tracking-[0.15em] font-bold border-b-[2px] border-[oklch(0.15_0.02_280)] text-[oklch(0.50_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    td: "px-4 py-3 text-[0.82rem] border-b-[1px] border-[oklch(0.50_0.02_280)] text-[oklch(0.15_0.02_280)]",
    tdMono: "px-4 py-3 text-[0.85rem] border-b-[1px] border-[oklch(0.50_0.02_280)] font-mono font-bold text-[oklch(0.15_0.02_280)]",
    tr: "cursor-pointer group transition-colors duration-0 hover:bg-[oklch(0.85_0.18_85)]",
    badgeRack: "px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] inline-flex items-center shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    badgeOut: "px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] inline-flex items-center shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    badgeField: "px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.55_0.24_28)] text-white inline-flex items-center shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    badgeRetired: "px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.50_0.02_280)] text-white inline-flex items-center shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    
    modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(0.15_0.02_280/0.6)] backdrop-blur-none",
    modalCard: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] w-full max-w-lg flex flex-col overflow-hidden relative bg-[oklch(1.00_0_0)] shadow-[8px_8px_0px_oklch(0.15_0.02_280)] transform scale-100",
    modalBar: "px-5 py-3 border-b-[3px] border-[oklch(0.15_0.02_280)] flex justify-between items-center font-bold tracking-[0.05em] uppercase text-sm bg-[oklch(0.52_0.18_255)] text-white",
    modalBody: "p-6 flex flex-col gap-8 max-h-[75vh] overflow-y-auto",
    closeBtn: "cursor-pointer hover:scale-125 transition-transform font-mono font-bold text-lg leading-none active:scale-90",
    modalActionCard: "border-[3px] border-[oklch(0.15_0.02_280)] p-5 rounded-[4px] bg-[oklch(0.96_0.01_90)] flex flex-col gap-4 shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    logEntry: "border-l-[3px] border-[oklch(0.15_0.02_280)] pl-5 py-1 flex flex-col gap-1.5 relative",
    logDot: "absolute w-3 h-3 rounded-[4px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] -left-[9px] top-1.5"
  }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
      .font-sans { font-family: 'Space Grotesk', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      .bg-grid {
        background-image: linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
        background-size: 60px 60px;
      }
      @keyframes popZ { 0% { transform: translate(0,0); box-shadow: 4px 4px 0px oklch(0.15 0.02 280); } 100% { transform: translate(-2px,-2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); } }
      @keyframes slamZ { 0% { transform: translate(-2px,-2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); } 100% { transform: translate(2px,2px); box-shadow: 0px 0px 0px oklch(0.15 0.02 280); } }
      @keyframes driftBounce { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-20px) rotate(10deg); } }
      @keyframes driftSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .anim-drift-1 { animation: driftBounce 8s ease-in-out infinite; }
      .anim-drift-2 { animation: driftSpin 12s linear infinite; }
    `}</style>
    <div className={`${c.page} font-sans`}>
      
      {/* Ambient Decoration */}
      <div className={c.ambient}>
         <div className="absolute top-[10%] left-[5%] w-[40px] h-[40px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] rounded-full opacity-20 anim-drift-1" />
         <div className="absolute top-[40%] right-[8%] w-[60px] h-[60px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] opacity-25 anim-drift-2" />
         <div className="absolute bottom-[15%] left-[15%] w-[30px] h-[30px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] rotate-45 opacity-20 anim-drift-1" />
         <div className="absolute bottom-[25%] right-[20%] w-[50px] h-[50px] border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] rounded-full opacity-[0.15] anim-drift-2" />
      </div>

      <div className={c.layout}>
        
        {/* Nav Bar */}
        <nav className={c.nav}>
          <div className={c.logoGroup}>
            <div className={c.logoBoxRed} />
            <div className={c.logoBoxYellow} />
            <div className={c.logoBoxGreen} />
            <span className={c.logoBrand}>GearSync</span>
          </div>
          <div className={c.navRight}>
            <button onClick={() => setActiveFilter("ALL")} className={`${c.navChip} ${activeFilter === "ALL" ? "bg-[oklch(0.15_0.02_280)] text-white" : ""}`}>All</button>
            <button onClick={() => setActiveFilter("RACK")} className={`${c.navChip} ${activeFilter === "RACK" ? "bg-[oklch(0.15_0.02_280)] text-white" : ""}`}>Rack</button>
            <button onClick={() => setActiveFilter("OUT")} className={`${c.navChip} ${activeFilter === "OUT" ? "bg-[oklch(0.15_0.02_280)] text-white" : ""}`}>Out</button>
            <button onClick={() => setActiveFilter("FIELD")} className={`${c.navChip} ${activeFilter === "FIELD" ? "bg-[oklch(0.15_0.02_280)] text-white" : ""}`}>Field</button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className={c.heroCard}>
          <div className={c.heroAccentBar}>
            <div className={c.heroAccentSegmentRed}></div>
            <div className={c.heroAccentSegmentYellow}></div>
            <div className={c.heroAccentSegmentGreen}></div>
            <div className={c.heroAccentSegmentBlue}></div>
          </div>
          <div className={c.heroContent}>
             <div className="relative">
               <h1 className={c.heroTitleShadow} aria-hidden="true">Master Ledger</h1>
               <h1 className={c.heroTitle}>Master Ledger</h1>
             </div>
             <p className={c.heroSub}>Track hardware lifecycles with strict custody chains. Secure assets. Know their state.</p>
          </div>
        </section>

        {/* Stat Row */}
        <section className={c.statGrid}>
           <div className={c.statCard}>
             <div className={c.statHeader1}>Active Field</div>
             <div className={c.statBody}>{gearDocs.filter(d => d.status === "FIELD").length} <span className={c.statUnit}>Units</span></div>
           </div>
           <div className={c.statCard}>
             <div className={c.statHeader2}>Checked Out</div>
             <div className={c.statBody}>{gearDocs.filter(d => d.status === "OUT").length} <span className={c.statUnit}>Units</span></div>
           </div>
           <div className={c.statCard}>
             <div className={c.statHeader3}>On Rack</div>
             <div className={c.statBody}>{gearDocs.filter(d => d.status === "RACK").length} <span className={c.statUnit}>Units</span></div>
           </div>
           <div className={c.statCard}>
             <div className={c.statHeader4}>Retired</div>
             <div className={c.statBody}>{gearDocs.filter(d => d.status === "RETIRED").length} <span className={c.statUnit}>Units</span></div>
           </div>
        </section>

        {/* Content Grid */}
        <section className={c.mainGrid}>
            
            {/* Quick Add Form */}
            <form className={c.formCard} onSubmit={handleRegister}>
               <h3 className="font-bold uppercase tracking-tight text-sm text-[oklch(0.15_0.02_280)]">Register New Gear</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                 <div className="flex flex-col gap-1.5">
                   <label className={c.formLabel}>Serial Number</label>
                   <input 
                     className={c.inputBox} 
                     placeholder="E.G. SN-99A0X"
                     value={gearLabelForm.serial}
                     onChange={(e) => setGearLabelForm(prev => ({ ...prev, serial: e.target.value }))}
                   />
                 </div>
                 <div className="flex flex-col gap-1.5">
                   <label className={c.formLabel}>Hardware Version</label>
                   <div className="flex gap-2">
                     <input 
                       className={c.inputBox} 
                       placeholder="E.G. MK-3" 
                       value={gearLabelForm.version}
                       onChange={(e) => setGearLabelForm(prev => ({ ...prev, version: e.target.value }))}
                     />
                     <button type="button" className={c.btnSecondary} onClick={async () => {
                       setAiLoading(true);
                       try {
                         const resp = await callAI("Suggest a tough sounding, highly technical but short fictional hardware version string like 'V4-T', 'MK-7.X', 'REV-B'. Just return the string.", {
                           schema: { properties: { version: { type: "string" } } }
                         });
                         const data = JSON.parse(resp);
                         setGearLabelForm(prev => ({ ...prev, version: data.version }));
                       } finally { setAiLoading(false); }
                     }} disabled={aiLoading}>
                       {aiLoading ? (
                          <svg className="animate-spin h-4 w-4 text-[oklch(0.15_0.02_280)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                       ) : "AI"}
                     </button>
                   </div>
                 </div>
               </div>
               <div className={c.btnRow}>
                 <button type="submit" className={c.btnPrimary}>Register Unit</button>
               </div>
            </form>

            {/* Ledger Table */}
            <div className={c.tableCard}>
                <table className={c.table}>
                  <thead>
                    <tr>
                      <th className={c.th}>Status</th>
                      <th className={c.th}>Serial</th>
                      <th className={c.th}>Version</th>
                      <th className={c.th}>Current Holder / Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedGear.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-sm uppercase text-[oklch(0.50_0.02_280)] font-bold">No gear entries found</td></tr>
                    )}
                    {displayedGear.map(gear => (
                      <tr key={gear._id} className={c.tr} onClick={() => setSelectedGear(gear)}>
                        <td className={c.td}>
                          {gear.status === "RACK" && <span className={c.badgeRack}>RACK</span>}
                          {gear.status === "OUT" && <span className={c.badgeOut}>OUT</span>}
                          {gear.status === "FIELD" && <span className={c.badgeField}>FIELD</span>}
                          {gear.status === "RETIRED" && <span className={c.badgeRetired}>RETIRED</span>}
                        </td>
                        <td className={c.tdMono}>{gear.serial}</td>
                        <td className={c.tdMono}>{gear.version}</td>
                        <td className={c.td}>
                           <div className="font-bold">{gear.holder || "--"}</div>
                           {gear.project && <div className="text-[0.65rem] text-[oklch(0.50_0.02_280)] font-mono uppercase mt-0.5">{gear.project}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>

        </section>

      </div>

      {/* Detail Modal */}
      {selectedGear && (
        <div className={c.modalOverlay}>
          <div className={c.modalCard}>
            <div className={c.modalBar}>
              <span>Unit Lineage: {selectedGear.serial}</span>
              <button className={c.closeBtn} onClick={() => setSelectedGear(null)}>[X]</button>
            </div>
            <div className={c.modalBody}>
               
               <form onSubmit={handleCustodyAction} className={c.modalActionCard}>
                  <h4 className={c.formLabel + " border-b-[2px] border-[oklch(0.15_0.02_280)] pb-1"}>Update Custody State</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                     <select 
                        className={c.selectBox}
                        value={actionForm.status}
                        onChange={(e) => setActionForm(prev => ({ ...prev, status: e.target.value }))}
                     >
                       <option value="OUT">CHECK OUT</option>
                       <option value="FIELD">DEPLOY TO FIELD</option>
                       <option value="RACK">RETURN TO RACK</option>
                       <option value="RETIRED">RETIRE UNIT</option>
                     </select>
                     <input 
                        className={c.inputBox} 
                        placeholder={actionForm.status === "RACK" ? "N/A" : "HOLDER NAME"} 
                        value={actionForm.holder}
                        onChange={(e) => setActionForm(prev => ({ ...prev, holder: e.target.value }))}
                        disabled={actionForm.status === "RACK" || actionForm.status === "RETIRED"}
                     />
                     <div className="flex gap-2 relative col-span-1 sm:col-span-2">
                       <input 
                          className={c.inputBox} 
                          placeholder={actionForm.status === "RACK" ? "N/A" : "PROJECT CODE"} 
                          value={actionForm.project}
                          onChange={(e) => setActionForm(prev => ({ ...prev, project: e.target.value }))}
                          disabled={actionForm.status === "RACK" || actionForm.status === "RETIRED"}
                       />
                       <button 
                          type="button" 
                          className={c.btnSecondary} 
                          disabled={actionForm.status === "RACK" || actionForm.status === "RETIRED" || aiLoading}
                          onClick={async () => {
                            setAiLoading(true);
                            try {
                              const resp = await callAI("Suggest a covert, military-sounding operation codename (e.g. OPERATION WINTER STORM, KINETIC ECHO). Return just the name.", {
                                schema: { properties: { project: { type: "string" } } }
                              });
                              setActionForm(prev => ({ ...prev, project: JSON.parse(resp).project.toUpperCase() }));
                            } finally { setAiLoading(false); }
                          }}>
                          {aiLoading ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> : "AI CODE"}
                       </button>
                     </div>
                     <input 
                        className={`${c.inputBox} col-span-1 sm:col-span-2`} 
                        placeholder="ETA / NOTE" 
                        value={actionForm.note}
                        onChange={(e) => setActionForm(prev => ({ ...prev, note: e.target.value }))}
                     />
                  </div>
                  <div className={c.btnRow}>
                    <button type="submit" className={c.btnPrimary} disabled={actionLoading}>
                      {actionLoading ? "SAVING..." : "COMMIT UPDATE"}
                    </button>
                  </div>
               </form>

               <div className="flex flex-col gap-4 pl-3">
                 <h4 className={c.formLabel + " text-[oklch(0.50_0.02_280)]"}>Ledger History</h4>
                 
                 {logDocs.length === 0 ? (
                    <div className="text-xs font-mono text-[oklch(0.50_0.02_280)]">NO HISTORY LOGGED.</div>
                 ) : (
                   logDocs.map(log => (
                     <div key={log._id} className={c.logEntry}>
                       <div className={c.logDot}></div>
                       <div className="text-[0.65rem] font-mono font-bold tracking-[0.05em] text-[oklch(0.50_0.02_280)] uppercase flex justify-between">
                         <span>{new Date(log.timestamp).toLocaleString()}</span>
                         <span className={log.action === 'RACK' ? 'text-[oklch(0.62_0.19_145)]' : 'text-[oklch(0.55_0.24_28)]'}>[{log.action}]</span>
                       </div>
                       <div className="text-[0.82rem] font-bold text-[oklch(0.15_0.02_280)] mt-0.5 uppercase">
                          {log.action === "REGISTER" ? "Initial Hardware Registration" : `Assigned to ${log.holder || 'SYS'}`}
                       </div>
                       {log.project && <div className="text-[0.7rem] font-mono text-[oklch(0.52_0.18_255)] uppercase font-bold">{log.project}</div>}
                       {log.note && <div className="text-[0.75rem] text-[oklch(0.15_0.02_280)] opacity-90 leading-tight border-t-[1px] border-dashed border-[oklch(0.50_0.02_280)] pt-1 mt-1">{log.note}</div>}
                     </div>
                   ))
                 )}
               </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}