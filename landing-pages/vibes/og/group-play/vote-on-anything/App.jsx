import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const { useState } = React;
const Spinner = () => (
  <svg className="animate-spin h-4 w-4 inline-block" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="square"/>
  </svg>
);

export default function App() {
  const [topic, setTopic] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const { useLiveQuery, database } = useFireproof("vote-on-anything");
  const { docs: questions } = useLiveQuery("type", { key: "question", descending: true });
  const { docs: votes } = useLiveQuery("type", { key: "vote" });

  const activeQuestion = questions[0] || null;
  const history = questions.slice(1);
  
  const activeVotes = votes.filter(v => v.questionId === activeQuestion?._id);
  const yesVotes = activeVotes.filter(v => v.choice === 'YES').length;
  const hmmmVotes = activeVotes.filter(v => v.choice === 'HMMM').length;
  const noVotes = activeVotes.filter(v => v.choice === 'NO').length;

  async function handleAsk(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setIsAsking(true);
    try {
      if (activeQuestion) await database.put({ ...activeQuestion, status: "closed" });
      await database.put({ type: "question", text: topic.trim().toUpperCase(), ts: Date.now(), status: "active" });
      setTopic("");
    } finally {
      setIsAsking(false);
    }
  }
  async function handleVote(choice) {
    if (!activeQuestion || isVoting) return;
    setIsVoting(true);
    try {
      await database.put({ type: "vote", questionId: activeQuestion._id, choice, ts: Date.now() });
    } finally {
      setIsVoting(false);
    }
  }
  async function handleSuggest() {
    setIsSuggesting(true);
    try {
      const prompt = "Suggest a highly controversial, fun, casual debate question (e.g. Is cereal a soup? Do aliens exist?). Return a short single uppercase string.";
      const response = await callAI(prompt, {
        schema: { properties: { suggestion: { type: "string" } } }
      });
      const data = JSON.parse(response);
      setTopic(data.suggestion.toUpperCase());
    } finally {
      setIsSuggesting(false);
    }
  }

  const c = {
    page: "min-h-screen p-6 md:p-12 relative flex flex-col items-center font-['Space_Grotesk',sans-serif] bg-[var(--bg)] text-[var(--border)]",
    ambient: "fixed inset-0 pointer-events-none -z-10 bg-[var(--bg)] neo-ambient",
    container: "w-full max-w-[920px] relative z-10 flex flex-col gap-8",
    nav: "flex justify-between items-center p-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)]",
    navLogo: "flex gap-2 items-center font-bold uppercase",
    hero: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] p-8 flex flex-col items-center text-center relative overflow-hidden gap-6",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroTitle: "text-3xl md:text-5xl font-bold uppercase tracking-tighter max-w-[800px] z-10 text-[var(--border)]",
    heroShadow: "absolute z-0 pointer-events-none text-3xl md:text-5xl font-bold uppercase tracking-tighter mt-[5px] ml-[5px] text-[var(--red)] opacity-50",
    actionRow: "flex flex-wrap justify-center gap-4 mt-8 z-10",
    statGrid: "grid grid-cols-1 md:grid-cols-3 gap-6",
    statCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] overflow-hidden flex flex-col",
    statHeaderRed: "p-2 uppercase text-[0.65rem] tracking-[0.15em] border-b-[3px] border-[var(--border)] bg-[var(--green)] text-[var(--border)] font-bold text-center",
    statHeaderYellow: "p-2 uppercase text-[0.65rem] tracking-[0.15em] border-b-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--border)] font-bold text-center",
    statHeaderGreen: "p-2 uppercase text-[0.65rem] tracking-[0.15em] border-b-[3px] border-[var(--border)] bg-[var(--red)] text-[white] font-bold text-center",
    statBody: "p-8 flex justify-center items-center text-6xl font-['JetBrains_Mono',monospace] font-bold",
    formCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] p-6 flex flex-col gap-6",
    inputDiv: "flex flex-col gap-2",
    inputLabel: "uppercase text-[0.65rem] tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "border-[3px] border-[var(--border)] rounded-[4px] p-3 uppercase font-medium focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_var(--border)] transition-transform",
    btnPrimary: "border-[3px] border-[var(--border)] bg-[var(--blue)] text-white rounded-[4px] py-4 px-6 uppercase font-bold text-center cursor-pointer min-h-[44px] neo-shadow flex items-center justify-center gap-2",
    btnSecondary: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] py-2 px-4 uppercase font-bold text-[0.8rem] min-h-[44px] neo-shadow flex items-center gap-2",
    btnVoteYes: "border-[3px] border-[var(--border)] bg-[var(--green)] text-[var(--border)] rounded-[4px] py-4 px-10 uppercase font-bold text-2xl cursor-pointer min-w-[140px] neo-shadow",
    btnVoteHmmm: "border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--border)] rounded-[4px] py-4 px-10 uppercase font-bold text-2xl cursor-pointer min-w-[140px] neo-shadow",
    btnVoteNo: "border-[3px] border-[var(--border)] bg-[var(--red)] text-white rounded-[4px] py-4 px-10 uppercase font-bold text-2xl cursor-pointer min-w-[140px] neo-shadow",
    historyCard: "border-[3px] border-[var(--border)] rounded-[4px] w-full bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] mt-6 overflow-x-auto",
    table: "w-full text-left border-collapse min-w-[500px]",
    th: "p-4 uppercase text-[0.7rem] border-b-[3px] border-[var(--border)] bg-[var(--bg)] font-bold",
    td: "p-4 text-[0.85rem] border-b-[2px] border-[var(--border)] group-hover:bg-[var(--yellow)] transition-colors",
    tdNum: "p-4 text-[1rem] border-b-[2px] border-[var(--border)] font-['JetBrains_Mono',monospace] font-bold group-hover:bg-[var(--yellow)] transition-colors"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
        :root {
          --bg: oklch(0.96 0.01 90); --card-bg: oklch(1.00 0 0); --border: oklch(0.15 0.02 280); 
          --muted: oklch(0.50 0.02 280); --red: oklch(0.55 0.24 28); --yellow: oklch(0.85 0.18 85); 
          --green: oklch(0.62 0.19 145); --blue: oklch(0.52 0.18 255);
        }
        .neo-ambient {
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 60px 60px; opacity: 0.04;
        }
        .neo-shadow { box-shadow: 4px 4px 0px var(--border); transition: all 0.15s ease; }
        .neo-shadow:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
        .neo-shadow:active { transform: translate(2px, 2px); box-shadow: none; }
        @keyframes drift1 { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } }
        @keyframes drift2 { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(20px) rotate(-15deg); } }
      `}</style>
      <main className={c.page}>
        <div className={c.ambient}>
          <div className="absolute w-[40px] h-[40px] bg-[var(--red)] border-[3px] border-[var(--border)] top-[15%] left-[5%] opacity-40 animate-[drift1_8s_ease-in-out_infinite]" />
          <div className="absolute w-[60px] h-[60px] rounded-full bg-[var(--yellow)] border-[3px] border-[var(--border)] top-[60%] right-[8%] opacity-30 animate-[drift2_12s_ease-in-out_infinite]" />
          <div className="absolute w-[30px] h-[30px] bg-[var(--blue)] border-[3px] border-[var(--border)] top-[80%] left-[10%] opacity-40 animate-[drift1_10s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
        </div>
        <div className={c.container}>
          
          <header className={c.nav}>
            <div className={c.navLogo}>
              <div className="flex gap-1">
                 <div className="w-4 h-4 rounded-sm bg-[var(--red)] border-[2px] border-[var(--border)]"></div>
                 <div className="w-4 h-4 rounded-sm bg-[var(--yellow)] border-[2px] border-[var(--border)]"></div>
                 <div className="w-4 h-4 rounded-sm bg-[var(--green)] border-[2px] border-[var(--border)]"></div>
              </div>
              <span className="text-xl">VOTE-ON-ANYTHING</span>
            </div>
            <div>
              <div className="py-2 px-4 border-[3px] border-[var(--border)] rounded-[4px] bg-[var(--green)] text-[var(--border)] text-[0.75rem] uppercase font-bold neo-shadow">
                Live Server
              </div>
            </div>
          </header>

          <section className={c.hero}>
            <div className={c.heroBar}>
               <div className="flex-1 bg-[var(--red)]"></div>
               <div className="flex-1 bg-[var(--yellow)]"></div>
               <div className="flex-1 bg-[var(--green)]"></div>
               <div className="flex-1 bg-[var(--blue)]"></div>
            </div>
            <div className="relative mt-4 mb-4 flex justify-center w-full">
               <h1 className={c.heroTitle}>{activeQuestion ? activeQuestion.text : "CREATE A POLL"}</h1>
               <h1 className={c.heroShadow} aria-hidden>{activeQuestion ? activeQuestion.text : "CREATE A POLL"}</h1>
            </div>
            
            <div className={c.actionRow}>
               <button className={c.btnVoteYes} disabled={!activeQuestion || isVoting} onClick={() => handleVote('YES')}>YES</button>
               <button className={c.btnVoteHmmm} disabled={!activeQuestion || isVoting} onClick={() => handleVote('HMMM')}>HMMM</button>
               <button className={c.btnVoteNo} disabled={!activeQuestion || isVoting} onClick={() => handleVote('NO')}>NO</button>
            </div>
          </section>

          <section className={c.statGrid}>
             <div className={c.statCard}>
               <div className={c.statHeaderRed}>YES VOTES</div>
               <div className={c.statBody}>{yesVotes}</div>
             </div>
             <div className={c.statCard}>
               <div className={c.statHeaderYellow}>HMMM VOTES</div>
               <div className={c.statBody}>{hmmmVotes}</div>
             </div>
             <div className={c.statCard}>
               <div className={c.statHeaderGreen}>NO VOTES</div>
               <div className={c.statBody}>{noVotes}</div>
             </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <form className={c.formCard} onSubmit={handleAsk}>
                <div className="flex justify-between items-end">
                  <label className={c.inputLabel}>New Topic</label>
                  <button type="button" className={c.btnSecondary} onClick={handleSuggest} disabled={isSuggesting}>
                    {isSuggesting && <Spinner />}
                    {isSuggesting ? "THINKING..." : "AI SUGGEST"}
                  </button>
                </div>
                <input className={c.input} value={topic} onChange={e => setTopic(e.target.value)} placeholder="WHAT ARE WE DEBATING?" />
                <button type="submit" className={c.btnPrimary} disabled={isAsking}>
                  {isAsking && <Spinner />}
                  DROP QUESTION
                </button>
             </form>
             
             <div className={c.formCard}>
                <h2 className={c.inputLabel}>ACTIVE PARTICIPANTS</h2>
                <div className="flex gap-2 flex-wrap mt-2">
                   <div className="px-3 py-1 border-[3px] border-[var(--border)] bg-[var(--yellow)] rounded-[4px] text-xs font-bold uppercase">HOST-29</div>
                   <div className="px-3 py-1 border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] text-xs font-bold uppercase">LURKER-5</div>
                </div>
             </div>
          </section>

          <section className={c.historyCard}>
             <table className={c.table}>
               <thead>
                 <tr>
                   <th className={c.th}>PAST QUESTIONS</th>
                   <th className={c.th}>Y</th>
                   <th className={c.th}>H</th>
                   <th className={c.th}>N</th>
                 </tr>
               </thead>
               <tbody>
                 {history.length === 0 && (
                   <tr><td colSpan={4} className={c.td}>No past questions...</td></tr>
                 )}
                 {history.map(q => {
                   const qVotes = votes.filter(v => v.questionId === q._id);
                   const y = qVotes.filter(v => v.choice === 'YES').length;
                   const h = qVotes.filter(v => v.choice === 'HMMM').length;
                   const n = qVotes.filter(v => v.choice === 'NO').length;
                   return (
                     <tr key={q._id} className="group cursor-default">
                       <td className={c.td}>{q.text}</td>
                       <td className={c.tdNum}>{y}</td>
                       <td className={c.tdNum}>{h}</td>
                       <td className={c.tdNum}>{n}</td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </section>
        </div>
      </main>
    </>
  );
}