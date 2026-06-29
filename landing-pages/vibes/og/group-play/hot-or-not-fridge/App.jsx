import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("fridge-hot-or-not");
  
  const [formData, setFormData] = useState({ name: '', file: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const { docs: items } = useLiveQuery('type', { key: 'item', descending: true });
  const { docs: votes } = useLiveQuery('type', { key: 'vote' });

  const c = {
    page: "min-h-screen p-4 md:p-8 font-inter bg-[oklch(0.93_0.03_130)] text-[oklch(0.12_0.01_0)]",
    container: "max-w-4xl mx-auto space-y-12 pb-16",
    
    header: "text-center space-y-2 relative pb-8",
    title: "text-5xl md:text-7xl font-caveat font-bold tracking-tight transform -rotate-2 text-[oklch(0.12_0.01_0)]",
    subtitle: "text-lg md:text-xl font-bold uppercase tracking-wider text-[oklch(0.45_0.01_0)]",
    
    addSection: "max-w-md mx-auto relative p-6 border-2 border-dashed rotate-1 bg-[oklch(0.93_0.12_95)] border-[oklch(0.12_0.01_0)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
    addForm: "flex flex-col space-y-4",
    inputFrame: "flex flex-col space-y-2",
    label: "text-2xl font-caveat font-bold text-[oklch(0.12_0.01_0)]",
    input: "w-full p-3 border-2 text-lg border-solid rounded-none outline-none transition-transform bg-white border-[oklch(0.12_0.01_0)] focus:-translate-y-1 focus:shadow-[0_4px_0_oklch(0.12_0.01_0)]",
    fileInput: "w-full p-3 border-2 border-dashed text-sm border-solid outline-none cursor-pointer bg-white border-[oklch(0.12_0.01_0)] file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-[oklch(0.12_0.01_0)] file:text-white hover:file:bg-[oklch(0.45_0.01_0)]",
    
    btnPrimary: "w-full p-4 mt-2 font-bold uppercase tracking-widest text-lg border-2 border-solid text-center transition-all hover:-translate-y-1 hover:rotate-1 flex justify-center items-center gap-2 bg-[oklch(0.12_0.01_0)] text-white border-[oklch(0.12_0.01_0)] shadow-[4px_4px_0_oklch(0.45_0.01_0)] disabled:opacity-50",
    aiBtn: "mt-1 p-2 text-xs uppercase font-bold border-2 border-dashed flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform w-max bg-transparent border-[oklch(0.45_0.01_0)] text-[oklch(0.45_0.01_0)] hover:text-[oklch(0.12_0.01_0)] hover:border-[oklch(0.12_0.01_0)] disabled:opacity-50",
    
    wallSection: "space-y-6 pt-8",
    wallTitle: "text-4xl font-caveat font-bold border-b-2 border-dashed pb-2 inline-block border-[oklch(0.45_0.01_0)]",
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8",
    
    card: "relative p-4 flex flex-col border-2 border-solid min-h-[350px] border-[oklch(0.12_0.01_0)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
    cardTape: "absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 border rotate-[-3deg] bg-[oklch(0.85_0.05_90)] border-[oklch(0.45_0.01_0)] opacity-90",
    cardImgFrame: "w-full aspect-square border-2 border-solid mb-4 overflow-hidden relative border-[oklch(0.12_0.01_0)] bg-[oklch(0.93_0.03_130)]",
    cardImg: "w-full h-full object-cover",
    cardEmptyImg: "w-full h-full flex items-center justify-center border-2 border-dashed p-4 text-center border-[oklch(0.45_0.01_0)] text-[oklch(0.45_0.01_0)] font-caveat text-xl",
    cardName: "text-3xl font-caveat font-bold text-center mb-4 leading-tight text-[oklch(0.12_0.01_0)] cursor-crosshair",
    
    votePanel: "grid grid-cols-2 gap-2 mt-auto",
    btnHot: "p-3 font-bold uppercase tracking-wider text-sm border-2 border-solid transition-transform active:translate-y-1 hover:-rotate-2 bg-transparent border-[oklch(0.12_0.01_0)] hover:bg-[oklch(0.93_0.12_95)]",
    btnNot: "p-3 font-bold uppercase tracking-wider text-sm border-2 border-solid transition-transform active:translate-y-1 hover:rotate-2 bg-transparent border-[oklch(0.12_0.01_0)] hover:bg-[oklch(0.90_0.06_10)]",
    
    tallyBar: "mt-4 h-3 w-full border-2 border-solid flex border-[oklch(0.12_0.01_0)] bg-[oklch(0.97_0.01_80)] overflow-hidden",
    tallyHot: "h-full transition-all bg-[oklch(0.93_0.12_95)]",
    tallyNot: "h-full transition-all bg-[oklch(0.90_0.06_10)]",
    
    compostTag: "absolute -right-3 top-8 px-3 py-1 font-bold uppercase text-xs border-2 border-solid rotate-6 shadow-[2px_2px_0_oklch(0.45_0.01_0)] z-10 bg-[oklch(0.70_0.20_25)] text-white border-white",
    
    boardsSection: "grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t-4 border-dashed border-[oklch(0.45_0.01_0)]",
    board: "p-6 border-2 border-solid relative shadow-[0_4px_12px_rgba(0,0,0,0.12)] border-[oklch(0.12_0.01_0)] bg-[oklch(0.97_0.01_80)]",
    boardTitle: "text-3xl font-caveat font-bold mb-4 flex items-center gap-2 border-b-2 border-dashed pb-2 border-[oklch(0.45_0.01_0)] text-[oklch(0.12_0.01_0)]",
    boardList: "space-y-4 pt-2",
    boardItem: "flex justify-between items-center text-xl pb-2 font-caveat text-[oklch(0.12_0.01_0)] border-b border-dashed border-[oklch(0.45_0.01_0)] last:border-0",
    boardRank: "font-bold mr-2 w-6 inline-block opacity-70",
    boardScore: "text-sm border py-1 px-2 uppercase font-inter font-bold tracking-widest bg-[oklch(0.12_0.01_0)] text-white border-[oklch(0.12_0.01_0)]"
  }

  async function handleAiSuggest() {
    setIsSuggesting(true);
    try {
      const response = await callAI("Suggest 1 funny, snarky, short name (max 5 words) for a questionable unidentified object left in a shared roommate fridge. Just the name itself, nothing else. Like 'Fuzzy Tupperware Surprise'", {
        schema: {
          properties: {
             suggestion: { type: "string" }
          }
        }
      });
      const data = JSON.parse(response);
      setFormData(prev => ({ ...prev, name: data.suggestion }));
    } catch(err) {
      console.error(err);
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      const newDoc = {
        type: 'item',
        name: formData.name,
        createdAt: Date.now()
      };
      if (formData.file) {
        newDoc._files = { photo: formData.file };
      }
      await database.put(newDoc);
      setFormData({ name: '', file: null });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVote(id, rating) {
    await database.put({ type: 'vote', itemId: id, rating, timestamp: Date.now() });
  }

  function handleAiSuggest() {
    console.log("AI Suggestion");
  }

  // Derived state: calculate votes per item
  const itemStats = {};
  votes.forEach(v => {
    if (!itemStats[v.itemId]) itemStats[v.itemId] = { hot: 0, not: 0 };
    if (v.rating === 'hot' || v.rating === 'not') {
      itemStats[v.itemId][v.rating]++;
    }
  });

  const cards = items.map((item, i) => {
    const stats = itemStats[item._id] || { hot: 0, not: 0 };
    
    // Assign a rotating paper color based on index
    const flavors = ['bg-[oklch(0.97_0.01_80)]', 'bg-[oklch(0.90_0.06_10)]', 'bg-[oklch(0.90_0.05_240)]'];
    const angles = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2', '-rotate-3', 'rotate-3'];
    
    return {
      ...item,
      hot: stats.hot,
      not: stats.not,
      color: flavors[i % flavors.length],
      rotate: angles[i % angles.length],
    };
  });

  // Calculate top charts (filter out 0 vote items)
  const rankedItems = [...cards].filter(c => c.hot > 0 || c.not > 0);
  const fameList = [...rankedItems].sort((a, b) => b.hot - a.hot).slice(0, 5);
  const shameList = [...rankedItems].sort((a, b) => b.not - a.not).slice(0, 5);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@400;600;700&display=swap');
      `}</style>

      <div className={c.page}>
        <div className={c.container}>
          
          <header className={c.header}>
            <h1 className={c.title}>Hot-or-Not the Fridge</h1>
            <p className={c.subtitle}>Rate your roommate's groceries</p>
          </header>

          <section id="add-item" className={c.addSection}>
            <div className={c.cardTape}></div>
            <form onSubmit={handleAddSubmit} className={c.addForm}>
              <div className={c.inputFrame}>
                <label className={c.label}>What is this thing?</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className={c.input} 
                  placeholder="e.g. Moldy Cheese Block" 
                  disabled={isSubmitting}
                />
                <button type="button" onClick={handleAiSuggest} disabled={isSuggesting} className={c.aiBtn}>
                  {isSuggesting && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[oklch(0.45_0.01_0)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Suggest Snarky Name
                </button>
              </div>
              <div className={c.inputFrame}>
                <label className={c.label}>Snap a pic for evidence</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setFormData(p => ({ ...p, file: e.target.files?.[0] }))}
                  className={c.fileInput} 
                  disabled={isSubmitting}
                />
              </div>
              <button type="submit" disabled={isSubmitting || !formData.name.trim()} className={c.btnPrimary}>
                {isSubmitting ? 'Pinning...' : 'Pin to Fridge'}
              </button>
            </form>
          </section>

          <section id="fridge-wall" className={c.wallSection}>
            <h2 className={c.wallTitle}>The Fridge Door</h2>
            <div className={c.grid}>
              {cards.length === 0 && (
                <div className="col-span-full py-16 text-center">
                   <p className="font-caveat text-4xl text-[oklch(0.45_0.01_0)] -rotate-2 inline-block">Nothing pinned yet! Be the first to complain.</p>
                </div>
              )}
              {cards.map((item, idx) => {
                const totalVotes = item.hot + item.not;
                const hotPct = totalVotes ? (item.hot / totalVotes) * 100 : 50;
                const notPct = totalVotes ? (item.not / totalVotes) * 100 : 50;
                const isCompostable = item.not >= item.hot + 3 && item.not > 2;
                
                return (
                  <div key={item._id} className={`${c.card} ${item.color} ${item.rotate}`}>
                    <div className={c.cardTape}></div>
                    {isCompostable && <div className={c.compostTag}>Consider Composting</div>}

                    <div className={c.cardImgFrame}>
                      {item._files?.photo?.url ? (
                        <img src={item._files.photo.url} alt={item.name} className={c.cardImg} />
                      ) : (
                        <div className={c.cardEmptyImg}>No photo<br/>provided</div>
                      )}
                    </div>
                    
                    <h3 className={c.cardName}>{item.name}</h3>
                    
                    <div className={c.votePanel}>
                      <button onClick={() => handleVote(item._id, 'hot')} className={c.btnHot}>Hot</button>
                      <button onClick={() => handleVote(item._id, 'not')} className={c.btnNot}>Not</button>
                    </div>
                    
                    <div className={c.tallyBar}>
                      <div className={c.tallyHot} style={{ width: `${hotPct}%`}}></div>
                      <div className={c.tallyNot} style={{ width: `${notPct}%`}}></div>
                    </div>
                  </div>
                )
              })}
              
            </div>
          </section>

          <section id="leaderboards" className={c.boardsSection}>
            <div className={`${c.board} rotate-1`}>
              <div className={c.cardTape}></div>
              <h2 className={c.boardTitle}>Hall of Fame (HOT)</h2>
              <ul className={c.boardList}>
                {fameList.length === 0 && <li className="text-[oklch(0.45_0.01_0)] font-caveat text-xl py-2">No hot takes yet...</li>}
                {fameList.map((item, i) => (
                  <li key={item._id} className={c.boardItem}>
                    <span><span className={c.boardRank}>{i + 1}.</span> {item.name}</span>
                    <span className={c.boardScore} style={{ backgroundColor: 'oklch(0.93 0.12 95)', color: 'oklch(0.12 0.01 0)' }}>{item.hot} Hot</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className={`${c.board} -rotate-1`}>
              <div className={c.cardTape}></div>
              <h2 className={c.boardTitle}>Wall of Shame (NOT)</h2>
              <ul className={c.boardList}>
                {shameList.length === 0 && <li className="text-[oklch(0.45_0.01_0)] font-caveat text-xl py-2">Fridge is looking clean...</li>}
                {shameList.map((item, i) => (
                  <li key={item._id} className={c.boardItem}>
                    <span><span className={c.boardRank}>{i + 1}.</span> {item.name}</span>
                    <span className={c.boardScore} style={{ backgroundColor: 'oklch(0.90 0.06 10)' }}>{item.not} Not</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}