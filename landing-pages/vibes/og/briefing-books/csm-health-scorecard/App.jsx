import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

// Include external fonts from Google
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;500&display=optional";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("csm-dossier-db");
  const [activeTab, setActiveTab] = useState("roster");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [touchNotes, setTouchNotes] = useState("");

  // Global Config
  const { doc: config, merge: mergeConfig, save: saveConfig } = useDocument({
    _id: "global-config",
    type: "config",
    weights: { usage: 20, touch: 30, nps: 20, ticket: 15, renewal: 15 }
  });

  // Current selected customer
  const { doc: activeCustomer } = useDocument({ 
    _id: selectedCustomerId || "stub", 
    type: "customer" 
  });

  // New Customer Form
  const { doc: newCustomer, merge: mergeNewCustomer, submit: submitNewCustomer } = useDocument({
    type: "customer",
    name: "",
    industry: "",
    signals: { usage: 50, touch: 50, nps: 50, ticket: 50, renewal: 50 }
  });

  const { docs: customers } = useLiveQuery("type", { key: "customer" });
  const { docs: touches } = useLiveQuery("customerId", { key: selectedCustomerId || "stub", descending: true });

  const getBadgeColor = (score) => {
    if (score < 50) return "text-[#ff4444] border-[#ff4444] shadow-[0_0_8px_inset_#ff444433]";
    if (score < 75) return "text-[#ffaa00] border-[#ffaa00] shadow-[0_0_8px_inset_#ffaa0033]";
    return "text-[#00cc66] border-[#00cc66] shadow-[0_0_8px_inset_#00cc6633]";
  };

  const c = {
    page: "min-h-screen bg-[#292929] text-[#ffffff] font-['Roboto_Mono',monospace] p-4 flex flex-col gap-6 md:p-8 max-w-4xl mx-auto selection:bg-[#ffffff] selection:text-[#000000]",
    header: "border-b border-[#3c3e4a] pb-4 mb-4 flex justify-between items-end flex-wrap gap-4",
    title: "text-3xl font-['Archivo_Black'] uppercase tracking-tighter text-[#ffffff]",
    nav: "flex gap-2 text-sm font-['Archivo_Black']",
    navItem: "px-2 py-1 uppercase cursor-pointer hover:bg-[#ffffff] hover:text-[#000000] transition-colors",
    exhibitHeader: "text-xs font-['Archivo_Black'] tracking-widest uppercase mb-4 border-b border-[#3c3e4a] pb-2 flex justify-between text-[#a0a5b5]",
    card: "border border-[#3c3e4a] bg-[#000000] p-4 md:p-6 flex flex-col gap-4 shadow-[4px_4px_0px_#3c3e4a]",
    row: "flex justify-between items-center py-3 border-b border-[#3c3e4a] last:border-0 cursor-pointer hover:bg-[#111111] transition-colors",
    button: "border border-[#3c3e4a] font-['Archivo_Black'] px-4 py-2 uppercase tracking-widest text-sm flex items-center justify-center transition-colors min-w-[120px] hover:bg-[#ffffff] hover:text-[#000000] hover:border-[#ffffff]",
    buttonGhost: "font-['Archivo_Black'] px-4 py-2 uppercase tracking-widest text-sm flex items-center justify-center min-w-[120px] text-[#a0a5b5] hover:text-[#ffffff]",
    input: "w-full bg-transparent border-b border-[#3c3e4a] outline-none py-2 text-sm text-[#ffffff] placeholder-[#555866] focus:border-[#ffffff] transition-colors",
    table: "w-full text-left border-collapse border border-[#3c3e4a]",
    th: "border border-[#3c3e4a] p-2 text-xs uppercase font-['Archivo_Black'] text-[#a0a5b5] bg-[#0a0a0a]",
    td: "border border-[#3c3e4a] p-2 text-sm",
    label: "text-xs uppercase tracking-wider block mb-1 text-[#a0a5b5] font-bold",
    scoreBadge: "px-2 py-1 text-xs border border-[#3c3e4a] uppercase font-bold tracking-wider",
    rangeInput: "w-full h-1 bg-[#3c3e4a] rounded-none appearance-none cursor-pointer accent-[#ffffff]",
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    await submitNewCustomer();
    setActiveTab("roster");
  };

  async function handleSaveWeights(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await saveConfig();
      setActiveTab("roster");
    } finally {
      setIsLoading(false);
    }
  }

  function recalculateScore(signals, activeWeights) {
    if (!signals || !activeWeights) return 0;
    const w = activeWeights;
    const s = signals;
    return Math.round(
      (s.usage * w.usage + s.touch * w.touch + s.nps * w.nps + s.ticket * w.ticket + s.renewal * w.renewal) / 100
    );
  }

  const handleLogTouch = async (e) => {
    e.preventDefault();
    if (!touchNotes.trim() || !selectedCustomerId) return;
    setIsLoading(true);

    try {
      const prompt = `Analyze these executive touch notes: "${touchNotes}". 
      Return JSON with:
      - sentiment (0 to 100 scale, where 100 is excellent)
      - usageEstimate (0 to 100 scale, 100 is increasing usage)
      - summary (short 1 sentence summary)`;
      
      const response = await callAI(prompt, {
        schema: {
          properties: {
            sentiment: { type: "number" },
            usageEstimate: { type: "number" },
            summary: { type: "string" }
          }
        }
      });
      
      const parsed = JSON.parse(response);

      // Save the touch record
      await database.put({
        type: "touch",
        customerId: selectedCustomerId,
        date: new Date().toISOString(),
        notes: touchNotes,
        summary: parsed.summary,
        sentiment: parsed.sentiment
      });

      // Update customer signals based on AI extraction
      if (activeCustomer) {
        await database.put({
          ...activeCustomer,
          signals: {
            ...activeCustomer.signals,
            touch: Math.round((activeCustomer.signals.touch + parsed.sentiment) / 2),
            usage: Math.round((activeCustomer.signals.usage + parsed.usageEstimate) / 2)
          }
        });
      }

      setTouchNotes("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={c.page}>
      <header className={c.header}>
        <div>
          <div className="text-xs uppercase tracking-widest mb-1">Global Customer Intelligence</div>
          <h1 className={c.title}>Briefing Dossier</h1>
        </div>
        <nav className={c.nav}>
          <button onClick={() => { setActiveTab("roster"); setSelectedCustomerId(null); }} className={`${c.navItem} ${activeTab === 'roster' ? 'bg-[#ffffff] text-[#000000]' : ''}`}>
            [ Roster ]
          </button>
          <button onClick={() => { setActiveTab("config"); setSelectedCustomerId(null); }} className={`${c.navItem} ${activeTab === 'config' ? 'bg-[#ffffff] text-[#000000]' : ''}`}>
            [ Config ]
          </button>
        </nav>
      </header>

      <main>
        {activeTab === "config" && (
          <section id="config" className={c.card}>
            <div className={c.exhibitHeader}>
              <span>Exhibit 01: Scoring Weights</span>
              <span>// CONFIDENTIAL</span>
            </div>
            <form onSubmit={handleSaveWeights} className="flex flex-col gap-6">
              <p className="text-sm">Adjust signal parameters. Global health scores will recalculate upon commit.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(config.weights).map((key) => (
                  <div key={key}>
                    <label className={c.label}>{key} Weight</label>
                    <input 
                      type="range" 
                      className={c.rangeInput} 
                      min="0" max="100" 
                      value={config.weights[key]} 
                      onChange={(e) => mergeConfig({ weights: { ...config.weights, [key]: parseInt(e.target.value, 10) } })}
                    />
                    <div className="text-right text-xs mt-1">{config.weights[key]}%</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <button type="submit" className={c.button} disabled={isLoading}>
                  {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full mr-2" /> : "[ COMMIT ]"}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "roster" && !selectedCustomerId && (
          <div className="flex flex-col gap-6">
            <section id="roster" className={c.card}>
              <div className={c.exhibitHeader}>
                <span>Exhibit 02: Active Roster</span>
                <button onClick={() => setActiveTab("add-customer")} className="text-xs uppercase">[ + ADD ]</button>
              </div>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Entity</th>
                    <th className={c.th}>Industry</th>
                    <th className={c.th}>Health</th>
                    <th className={c.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr><td colSpan="4" className={`${c.td} text-center py-8 text-[#a0a5b5]`}>NO ENTRIES FOUND.</td></tr>
                  ) : (
                    customers.map((cust) => {
                      const score = recalculateScore(cust.signals, config.weights);
                      return (
                        <tr key={cust._id} className={c.row} onClick={() => setSelectedCustomerId(cust._id)}>
                          <td className={c.td}>{cust.name}</td>
                          <td className={c.td}>{cust.industry}</td>
                          <td className={c.td}>{score} / 100</td>
                          <td className={c.td}>
                            <span className={`${c.scoreBadge} ${getBadgeColor(score)}`}>
                              {score < 50 ? 'CRITICAL' : score < 75 ? 'WARNING' : 'SECURE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {activeTab === "add-customer" && (
          <section id="add-customer" className={c.card}>
            <div className={c.exhibitHeader}>
              <span>Exhibit 02A: New Entity Entry</span>
            </div>
            <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
              <div>
                <label className={c.label}>Entity Name</label>
                <input required type="text" className={c.input} placeholder="e.g. Initech" value={newCustomer.name} onChange={(e) => mergeNewCustomer({ name: e.target.value })} />
              </div>
              <div>
                <label className={c.label}>Industry</label>
                <input required type="text" className={c.input} placeholder="e.g. Software" value={newCustomer.industry} onChange={(e) => mergeNewCustomer({ industry: e.target.value })} />
              </div>
              <div className="flex gap-4 items-center justify-end mt-4">
                <button type="button" className={`${c.buttonGhost} text-xs text-[#a0a5b5] mr-auto`} disabled={isLoading} onClick={async () => {
                  setIsLoading(true);
                  try {
                    const res = await callAI("Generate a random B2B customer name and industry.", { schema: { properties: { name: { type: "string" }, industry: { type: "string" } } } });
                    const p = JSON.parse(res);
                    mergeNewCustomer({ name: p.name, industry: p.industry, signals: { usage: Math.floor(Math.random()*100), touch: Math.floor(Math.random()*100), nps: Math.floor(Math.random()*100), ticket: Math.floor(Math.random()*100), renewal: Math.floor(Math.random()*100) } });
                  } finally { setIsLoading(false); }
                }}>
                  {isLoading ? "..." : "[ AI SUGGEST ]"}
                </button>
                <button type="button" onClick={() => setActiveTab("roster")} className={c.buttonGhost}>[ CANCEL ]</button>
                <button type="submit" className={c.button}>[ FILE ]</button>
              </div>
            </form>
          </section>
        )}

        {selectedCustomerId && (
          <div className="flex flex-col gap-6">
            <section id="detail" className={c.card}>
              <div className={c.exhibitHeader}>
                <span>Exhibit 03: Entity Detail</span>
                <button onClick={() => setSelectedCustomerId(null)} className="text-xs uppercase">[ BACK ]</button>
              </div>
              
              {activeCustomer.name ? (
                <>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h2 className={`text-2xl font-['Archivo_Black'] uppercase tracking-tight`}>{activeCustomer.name}</h2>
                      <div className="text-sm text-[#a0a5b5]">{activeCustomer.industry}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-4xl font-['Archivo_Black'] ${getBadgeColor(recalculateScore(activeCustomer.signals, config.weights)).split(' ')[0]}`}>
                        {recalculateScore(activeCustomer.signals, config.weights)}
                      </div>
                      <div className="text-xs uppercase text-[#a0a5b5] font-bold">Health Signal</div>
                    </div>
                  </div>

                  <table className={c.table}>
                    <thead>
                      <tr>
                        <th className={c.th}>Signal Vector</th>
                        <th className={c.th}>Raw Value (0-100)</th>
                        <th className={c.th}>Net Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(activeCustomer.signals || {}).map((key) => {
                        const raw = activeCustomer.signals[key];
                        const w = config.weights[key];
                        const impact = ((raw * w) / 100).toFixed(1);
                        return (
                          <tr key={key}>
                            <td className={c.td}>{key.toUpperCase()}</td>
                            <td className={c.td}>{raw}</td>
                            <td className={c.td}>+{impact}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                 <div className="text-[#a0a5b5] text-sm">LOADING ASSET...</div>
              )}
            </section>

            <section id="touches" className={c.card}>
              <div className={c.exhibitHeader}>
                <span>Exhibit 04: Intervention Log</span>
              </div>
              
              <form onSubmit={handleLogTouch} className="flex flex-col gap-4 mb-6 border-b border-[#3c3e4a] pb-6">
                <label className={c.label}>Log New Interaction</label>
                <textarea value={touchNotes} onChange={e => setTouchNotes(e.target.value)} className={`${c.input} resize-none h-24`} placeholder="Executive summary of contact..." />
                <div className="flex justify-between items-center text-xs text-[#a0a5b5]">
                  <span>AI Sentiment Parsing Active</span>
                  <button type="submit" className={c.button} disabled={isLoading || !touchNotes.trim()}>
                    {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full" /> : "[ TRANSCRIBE ]"}
                  </button>
                </div>
              </form>

              <div className="flex flex-col gap-4">
                {touches.length === 0 ? (
                  <div className="text-xs text-[#a0a5b5]">NO RECORDS FOUND.</div>
                ) : (
                  touches.map(touch => (
                    <div key={touch._id} className="border border-[#3c3e4a] p-3 bg-[#0a0a0a]">
                      <div className="flex justify-between text-xs mb-2 text-[#a0a5b5] font-['Archivo_Black']">
                        <span>{new Date(touch.date).toLocaleString()}</span>
                        <span>[ {touch.sentiment > 70 ? 'POS' : touch.sentiment < 40 ? 'NEG' : 'NEU'} ]</span>
                      </div>
                      <p className="text-sm mb-2 text-[#ffffff]">{touch.summary}</p>
                      <p className="text-xs text-[#555866] italic bg-[#000000] p-2 border border-[#3c3e4a]">Raw: {touch.notes}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}