import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  // --- STATE PLACEHOLDERS ---
  const [myName, setMyName] = useState("");
  const [tempName, setTempName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { useDocument, useLiveQuery } = useFireproof("group-mad-libs");

  // Multi-device game state object
  const { doc: game, merge: mergeGame } = useDocument({
    _id: "current-game",
    state: "setup",
    players: [],
    templateTitle: "A Fresh Story",
    templateText: "The [ADJECTIVE] [NOUN] decided to [VERB]!",
    blanks: [],
    revealIndex: -1,
    revealedSentences: []
  });

  // Scrapbook listing query
  const { docs: scrapbookDocs } = useLiveQuery("type", { key: "scrapbook", descending: true });

  // --- HANDLER PLACEHOLDERS ---
  const handleJoin = (e) => { 
    e.preventDefault(); 
    if (!tempName.trim()) return;
    setMyName(tempName.trim());
    
    // Add player to the global doc
    if (!game.players.includes(tempName.trim())) {
      mergeGame({ players: [...game.players, tempName.trim()] });
    }
  };
  const handleGenerateAI = async () => {
    setIsLoading(true);
    try {
      const resp = await callAI("Write a fun, chaotic 3-sentence short story template with at least 5 blanks formatted exactly like [NOUN], [VERB], [ADJECTIVE], etc.", {
        schema: {
          properties: {
            title: { type: "string", description: "A catchy story title" },
            text: { type: "string", description: "The story text including bracketed blanks." }
          }
        }
      });
      const data = JSON.parse(resp);
      mergeGame({ templateTitle: data.title, templateText: data.text });
    } finally {
      setIsLoading(false);
    }
  };
  const handleStartGame = () => {
    const segments = parseTemplate(game.templateText);
    const requiredBlanks = segments.filter(s => s.isBlank);
    
    // Assign blindly round-robin across all named players
    const activePlayers = game.players.length > 0 ? game.players : [myName];
    
    const assignedBlanks = requiredBlanks.map((b, i) => ({
      id: b.id,
      type: b.type,
      assignedTo: activePlayers[i % activePlayers.length],
      value: ""
    }));

    mergeGame({ 
      state: "filling", 
      blanks: assignedBlanks,
      // reset reveal state
      revealIndex: -1,
      revealedSentences: []
    });
  };
  const handleSubmitWords = () => {
    // In a perfectly robust app this would be a CRDT inner merge
    // For this prototype, we just overwrite our assignments in the shared doc array
    const newBlanks = game.blanks.map(b => {
      if (b.assignedTo === myName) {
         // Local temporary states were saved directly into a mirror state,
         // but let's wire it to read from DOM or specialized local state
      }
      return b;
    });
    // Let's implement this better using immediate array extraction inside the render method.
  };

  // Safe handler that receives the local copies
  const submitLocalBlanks = (localVals) => {
    const updated = game.blanks.map(b => 
      localVals[b.id] !== undefined ? { ...b, value: localVals[b.id] } : b
    );
    
    const allDone = updated.every(b => (b.value || "").trim() !== "");
    mergeGame({ 
      blanks: updated,
      state: allDone ? "reveal" : "filling" 
    });
  };
  const handleRevealNext = () => {
    // Generate final concatenated story based on current blanks
    const segments = parseTemplate(game.templateText);
    const finalStoryStr = segments.map(s => {
      if (s.isBlank) {
        const found = game.blanks.find(b => b.id === s.id);
        return found ? (found.value || "???") : "???";
      }
      return s.text;
    }).join("");

    const sentences = finalStoryStr.match(/[^.!?]+[.!?]*/g) || [finalStoryStr];
    const nextIdx = game.revealIndex + 1;

    if (nextIdx < sentences.length) {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(sentences[nextIdx]);
        window.speechSynthesis.speak(utterance);
      }
      mergeGame({ 
        revealIndex: nextIdx,
        revealedSentences: [...(game.revealedSentences || []), sentences[nextIdx]]
      });
    }
  };
  const { database } = useFireproof("group-mad-libs");
  const handleSaveScrapbook = () => {
    const rawStory = (game.revealedSentences || []).join(" ");
    if (rawStory.trim()) {
      database.put({
        type: "scrapbook",
        createdAt: Date.now(),
        title: game.templateTitle || "A Mad Story",
        finalStory: rawStory
      });
    }
    // Reset room for new game
    mergeGame({ 
      state: "setup",
      templateTitle: "",
      templateText: "",
      blanks: [],
      revealIndex: -1,
      revealedSentences: []
    });
  };

  // --- HELPER ---
  function parseTemplate(text) {
    let count = 0;
    return (text || "").split(/(\[[a-zA-Z\s-]+\])/).map(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return { isBlank: true, type: part.slice(1, -1).toUpperCase(), id: count++ };
      }
      return { isBlank: false, text: part, id: `text-${count}` };
    }).filter(p => (p.text && p.text.trim() !== "") || p.isBlank);
  }

  // --- CLASSNAMES ---
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Inter:wght@400;700&display=swap');
    .font-caveat { font-family: 'Caveat', cursive; }
    .font-inter { font-family: 'Inter', sans-serif; }
    .texture-bg {
      background-color: oklch(0.93 0.03 130);
      background-image: radial-gradient(oklch(0.85 0.03 130) 1px, transparent 1px);
      background-size: 20px 20px;
    }
  `;

  const c = {
    app: "min-h-screen p-4 flex flex-col items-center",
    header: "w-full max-w-lg mb-8 mt-4 text-center flex flex-col items-center relative z-10",
    title: "text-5xl font-caveat font-bold mb-2 text-[oklch(0.12_0.01_0)]",
    subtitle: "text-sm uppercase tracking-wider font-bold text-[oklch(0.45_0.01_0)]",
    cardRoot: "w-full max-w-lg mb-8",
    card: "relative w-full p-8 p-10 bg-[oklch(0.97_0.01_80)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] -rotate-1",
    tapeLeft: "absolute w-12 h-5 -top-2 left-6 bg-[oklch(0.85_0.04_100)] rotate-[-4deg] opacity-90 shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
    tapeRight: "absolute w-12 h-5 -top-2 right-6 bg-[oklch(0.85_0.04_100)] rotate-[6deg] opacity-90 shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
    label: "block w-full text-xs font-bold uppercase mb-2 mt-4 text-[oklch(0.45_0.01_0)]",
    input: "w-full p-4 mb-4 border-2 border-[oklch(0.12_0.01_0)] border-dashed bg-white/50 rounded-sm text-lg outline-none focus:bg-white focus:border-solid",
    textarea: "w-full p-4 mb-4 border-2 border-[oklch(0.12_0.01_0)] border-dashed bg-white/50 rounded-sm text-lg font-caveat text-2xl outline-none min-h-[160px] focus:bg-white",
    badge: "inline-block px-3 py-1 mr-2 mb-2 text-sm border-2 rounded-sm italic",
    btnPrimary: "px-6 py-4 font-bold uppercase tracking-wider block w-full mb-3 shadow-[0_2px_0_oklch(0.12_0.01_0)] bg-[oklch(0.12_0.01_0)] text-white hover:-translate-y-1 hover:rotate-1 hover:shadow-[0_6px_0_oklch(0.12_0.01_0)] transition-all",
    btnSecondary: "px-6 py-4 font-bold uppercase tracking-wider block w-full mb-3 border-2 border-[oklch(0.12_0.01_0)] bg-transparent text-[oklch(0.12_0.01_0)] hover:-translate-y-1 hover:-rotate-1 shadow-[0_2px_0_oklch(0.12_0.01_0)] hover:shadow-[0_6px_0_oklch(0.12_0.01_0)] transition-all",
    scrapbookTitle: "text-3xl font-bold mb-6 mt-12 text-center relative z-10",
    scrapGrid: "w-full max-w-lg space-y-8 relative z-10",
    scrapCard: "p-8 relative shadow-lg bg-[oklch(0.93_0.12_95)] rotate-1",
    scrapText: "text-lg leading-relaxed mt-4 font-caveat text-3xl",
    blankInline: "inline-block border-b-2 border-dashed border-[oklch(0.12_0.01_0)] font-bold px-1 mx-1 uppercase",
  };

  return (
    <div className={`${c.app} texture-bg font-inter text-[oklch(0.12_0.01_0)] overflow-x-hidden`}>
      <style>{globalStyles}</style>
      <header className={c.header}>
        <h1 className={`${c.title} text-[oklch(0.97_0.01_80)] bg-[oklch(0.12_0.01_0)] px-6 py-2 rotate-[-2deg] shadow-lg`}>Mad Libs</h1>
        <p className={`${c.subtitle} mt-2 font-caveat text-[oklch(0.12_0.01_0)] text-xl font-bold`}>Grab friends. Wait your turn. Chaos ensues.</p>
      </header>

      <main className={c.cardRoot}>
        {!myName ? (
          <form className={c.card} onSubmit={handleJoin}>
            <div className={c.tapeLeft}></div>
            <div className={c.tapeRight}></div>
            <h2 className={c.title}>Grab a Pen</h2>
            <label className={c.label}>Your Name</label>
            <input 
              className={c.input} 
              placeholder="e.g. Grandma"
              value={tempName}
              onChange={e => setTempName(e.target.value)} 
            />
            <button className={c.btnPrimary} type="submit">Join the Fun</button>
          </form>
        ) : game.state === "setup" ? (
          <div className={c.card}>
            <div className={c.tapeLeft}></div>
            <div className={c.tapeRight}></div>
            <h2 className={c.title}>Game Setup</h2>
            <div className="mb-6">
              <label className={c.label}>Players in Room</label>
              <div>
                {game.players.length === 0 ? (
                  <span className={c.badge}>Just you right now...</span>
                ) : (
                  game.players.map(p => (
                    <span key={p} className={`${c.badge} ${p === myName ? 'bg-[oklch(0.93_0.12_95)]' : 'bg-[oklch(0.97_0.01_80)]'}`}>
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>
            
            <label className={c.label}>Story Template Title</label>
            <input 
              className={c.input} 
              placeholder="The Great Journey" 
              value={game.templateTitle} 
              onChange={e => mergeGame({ templateTitle: e.target.value })} 
            />
            
            <label className={c.label}>Story With [BLANKS]</label>
            <textarea 
              className={c.textarea} 
              placeholder="A [ADJECTIVE] [NOUN] decided to [VERB]..." 
              value={game.templateText} 
              onChange={e => mergeGame({ templateText: e.target.value })}
            ></textarea>
            
            <button className={c.btnSecondary} onClick={handleGenerateAI} disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  WRITING...
                </span>
              ) : "✨ Suggest AI Template ✨"}
            </button>
            <button className={c.btnPrimary} onClick={handleStartGame}>Start Game</button>
          </div>
        ) : game.state === "filling" ? (
          <div className={c.card}>
            <div className={c.tapeLeft}></div>
            <div className={c.tapeRight}></div>
            <h2 className={c.title}>Your Turn</h2>
            
            {game.blanks.filter(b => b.assignedTo === myName).every(b => (b.value || "").trim() !== "") ? (
              <div className="py-12 text-center text-xl font-caveat font-bold">
                You're all done! Waiting on others...
              </div>
            ) : (
              <>
                <p className="mb-6 italic text-sm">Fill in the blanks assigned to you.</p>
                {game.blanks.filter(b => b.assignedTo === myName).map(b => (
                  <div key={b.id}>
                    <label className={c.label}>{b.type}</label>
                    <input 
                      className={c.input} 
                      placeholder="Type a word..." 
                      defaultValue={b.value}
                      onBlur={(e) => {
                        const nextBlanks = [...game.blanks];
                        const idx = nextBlanks.findIndex(x => x.id === b.id);
                        if(idx > -1) nextBlanks[idx].value = e.target.value.toUpperCase();
                        mergeGame({ blanks: nextBlanks });
                      }}
                    />
                  </div>
                ))}
                
                <button className={c.btnPrimary} onClick={() => {
                  const allDone = game.blanks.every(bk => (bk.value || "").trim() !== "");
                  if (allDone) mergeGame({ state: "reveal" });
                }}>Looks Good to Me</button>
              </>
            )}
          </div>
        ) : (
          <div className={c.card}>
            <div className={c.tapeLeft}></div>
            <div className={c.tapeRight}></div>
            <h2 className={c.title}>{game.templateTitle || "The Story Reveal"}</h2>
            <div className={`${c.scrapText} font-caveat text-3xl leading-snug`}>
              {(game.revealedSentences || []).length === 0 && (
                <span className="text-[oklch(0.45_0.01_0)]">Ready to read...</span>
              )}
              {(game.revealedSentences || []).map((sent, i) => (
                <span key={i} className="mr-2 highlight-appear">{sent}</span>
              ))}
            </div>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button className={c.btnPrimary} onClick={handleRevealNext}>Read Next</button>
              <button className={c.btnSecondary} onClick={handleSaveScrapbook}>Save & Reset</button>
            </div>
          </div>
        )}
      </main>

      <section className="w-full max-w-lg mb-20">
        <h2 className={c.scrapbookTitle}>Memory Scrapbook</h2>
        <div className={c.scrapGrid}>
          {scrapbookDocs.length === 0 && (
            <p className="text-center font-caveat text-2xl text-[oklch(0.45_0.01_0)]">No stories saved yet. Play a round!</p>
          )}
          {scrapbookDocs.map((doc, idx) => {
            const rot = idx % 2 === 0 ? "rotate-2" : "-rotate-1";
            const bgClass = ["bg-[oklch(0.93_0.12_95)]", "bg-[oklch(0.90_0.06_10)]", "bg-[oklch(0.90_0.05_240)]"][idx % 3];
            return (
              <article key={doc._id} className={`${c.scrapCard} ${bgClass} ${rot} transition-transform hover:rotate-0`}>
                <div className={c.tapeLeft}></div>
                <h3 className={`${c.title} border-b-2 border-dashed border-[oklch(0.12_0.01_0)] pb-2 inline-block`}>{doc.title}</h3>
                <p className={c.scrapText}>{doc.finalStory}</p>
                <div className="absolute bottom-4 right-4 text-xs font-bold uppercase opacity-50"># {doc._id.slice(-6)}</div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}