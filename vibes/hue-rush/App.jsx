import React from "react"

// ── Hue Rush ─────────────────────────────────────────────────────────────────
// The endless evolution of Hue Hunt: same color-word guessing, but no daily
// limit — finish a round and deal the next color immediately. Win streaks are
// the score. Pure local state so an anonymous /start visitor can play; stats
// persist per device in localStorage. Round words are drawn at random (never
// the same twice in a row).

const COLOR_WORDS = ["AMBER","AZURE","BEIGE","BLACK","BLUSH","BROWN","CORAL","CREAM","GREEN","HONEY","IVORY","KHAKI","LEMON","LILAC","MAUVE","MOCHA","OCHRE","OLIVE","PEACH","PLUM ".trim(),"ROUGE","SEPIA","TEAL ".trim(),"WHEAT","WHITE"].filter(w => w.length === 5);

function scoreGuess(guess, answer) {
  const res = Array(5).fill("absent");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) { res[i] = "correct"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === answer[j]) { res[i] = "present"; used[j] = true; break; }
    }
  }
  return res;
}

function pickWord(exclude) {
  const pool = COLOR_WORDS.filter(w => w !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

const SWATCH = {
  correct: "bg-[#00f0ff] text-[#0a2e1c] border-[#00f0ff]",
  present: "bg-[#fcee0a] text-[#0a2e1c] border-[#fcee0a]",
  absent: "bg-[#14503a] text-[#ffffff]/40 border-[#14503a]",
};

const STATS_KEY = "hue-rush-stats";

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { played: 0, won: 0, streak: 0, best: 0 };
  } catch {
    return { played: 0, won: 0, streak: 0, best: 0 };
  }
}

export default function App() {
  const [word, setWord] = React.useState(() => pickWord());
  const [round, setRound] = React.useState(1);
  const [guesses, setGuesses] = React.useState([]);
  const [current, setCurrent] = React.useState("");
  const [result, setResult] = React.useState(null); // null | "won" | "lost"
  const [stats, setStats] = React.useState(loadStats);

  const done = result !== null;

  function recordRound(won) {
    setStats((prev) => {
      const streak = won ? prev.streak + 1 : 0;
      const next = { played: prev.played + 1, won: prev.won + (won ? 1 : 0), streak, best: Math.max(prev.best, streak) };
      try {
        localStorage.setItem(STATS_KEY, JSON.stringify(next));
      } catch {
        // private mode etc. — best-effort only
      }
      return next;
    });
  }

  function nextRound() {
    setWord((w) => pickWord(w));
    setGuesses([]);
    setCurrent("");
    setResult(null);
    setRound((r) => r + 1);
  }

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#5b8dff] via-[#5cffc8] to-[#0afc6e] text-[#0a2e1c] font-['Rajdhani',sans-serif] pb-8",
    header: "sticky top-0 z-10 bg-[#0a2e1c] text-[#0afc6e] px-4 py-3 shadow-lg border-b-4 border-[#3c94f9]",
    title: "font-['Orbitron',sans-serif] text-2xl font-bold tracking-widest text-center",
    tagline: "text-center text-[#00f0ff] text-xs tracking-[0.3em] uppercase mt-1",
    main: "max-w-md mx-auto px-4 pt-6 space-y-6",
    section: "bg-[#0a2e1c]/90 backdrop-blur rounded-xl border-2 border-[#3c94f9] p-4 shadow-[0_0_20px_rgba(60,148,249,0.4)]",
    h2: "font-['Orbitron',sans-serif] text-[#0afc6e] text-sm tracking-widest uppercase mb-3",
    board: "grid grid-rows-6 gap-2",
    row: "grid grid-cols-5 gap-2",
    tile: "aspect-square flex items-center justify-center font-['Orbitron',sans-serif] font-bold text-2xl uppercase rounded-md border-2 border-[#14503a] bg-[#14503a]/40 text-[#ffffff]",
    keyboard: "space-y-2",
    kbRow: "flex justify-center gap-1",
    key: "min-w-[32px] min-h-[48px] px-2 rounded-md bg-[#14503a] text-[#ffffff] font-bold font-['Rajdhani',sans-serif] active:bg-[#3c94f9] border border-[#3c94f9]/40",
    keyWide: "min-w-[60px] min-h-[48px] px-2 rounded-md bg-[#3c94f9] text-[#0a2e1c] font-bold font-['Orbitron',sans-serif] text-xs tracking-wider active:bg-[#0afc6e] border border-[#0afc6e]/40",
    statRow: "flex justify-around text-center",
    statBox: "flex-1",
    statNum: "font-['Orbitron',sans-serif] text-2xl text-[#0afc6e]",
    statLabel: "text-[#00f0ff] text-xs uppercase tracking-widest",
    btn: "w-full min-h-[48px] rounded-md bg-[#0afc6e] text-[#0a2e1c] font-['Orbitron',sans-serif] font-bold tracking-widest uppercase border-2 border-[#3c94f9] active:bg-[#00f0ff]",
  };

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>HUE RUSH</h1>
        <p className={c.tagline}>Endless color words · streak up</p>
      </header>
      <main id="app" className={c.main}>
        <section id="board" className={c.section}>
          <h2 className={c.h2}>Round {round}</h2>
          <div className={c.board}>
            {[0,1,2,3,4,5].map(r => {
              const g = guesses[r];
              const isCurrent = r === guesses.length && !done;
              const letters = g ? g.split("") : isCurrent ? current.padEnd(5," ").split("") : ["","","","",""];
              const scores = g ? scoreGuess(g, word) : null;
              return (
                <div key={r} className={c.row}>
                  {letters.map((ch, i) => (
                    <div key={i} className={`${c.tile} ${scores ? SWATCH[scores[i]] : ""}`}>
                      {ch.trim()}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {done && (
            <div className="mt-4 text-center space-y-2">
              {result === "won" ? (
                <p className="font-['Orbitron',sans-serif] text-[#00f0ff] text-xl tracking-widest">🎨 GOT IT!</p>
              ) : (
                <>
                  <p className="font-['Orbitron',sans-serif] text-[#3c94f9] text-sm tracking-widest">THE COLOR WAS</p>
                  <p className="font-['Orbitron',sans-serif] text-[#0afc6e] text-3xl tracking-[0.3em] font-bold">{word}</p>
                </>
              )}
              <button className={c.btn} onClick={nextRound}>Next Color →</button>
            </div>
          )}
        </section>
        <section id="keyboard" className={c.section}>
          <h2 className={c.h2}>Input</h2>
          <div className={c.keyboard}>
            {["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"].map((row, ri) => {
              const letterStatus = {};
              guesses.forEach(g => {
                const s = scoreGuess(g, word);
                g.split("").forEach((ch, i) => {
                  const cur = letterStatus[ch];
                  const next = s[i];
                  if (cur === "correct") return;
                  if (cur === "present" && next === "absent") return;
                  letterStatus[ch] = next;
                });
              });
              return (
                <div key={ri} className={c.kbRow}>
                  {ri === 2 && (
                    <button type="button" className={c.keyWide} disabled={done} onClick={() => {
                      if (done || current.length !== 5) return;
                      const newGuesses = [...guesses, current];
                      const wonNow = current === word;
                      setGuesses(newGuesses);
                      setCurrent("");
                      if (wonNow || newGuesses.length >= 6) {
                        setResult(wonNow ? "won" : "lost");
                        recordRound(wonNow);
                      }
                    }}>ENTER</button>
                  )}
                  {row.split("").map(k => {
                    const st = letterStatus[k];
                    const tint = st === "correct" ? "bg-[#00f0ff] text-[#0a2e1c]" : st === "present" ? "bg-[#fcee0a] text-[#0a2e1c]" : st === "absent" ? "bg-[#14503a]/40 text-[#ffffff]/40" : "";
                    return (
                      <button type="button" key={k} className={`${c.key} ${tint} ${done ? "opacity-60 cursor-default" : ""}`} onClick={() => {
                        if (done || current.length >= 5) return;
                        setCurrent(current + k);
                      }}>{k}</button>
                    );
                  })}
                  {ri === 2 && (
                    <button type="button" className={c.keyWide} disabled={done} onClick={() => {
                      if (done || current.length === 0) return;
                      setCurrent(current.slice(0, -1));
                    }}>DEL</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section id="stats" className={c.section}>
          <h2 className={c.h2}>Stats</h2>
          <div className={c.statRow}>
            <div className={c.statBox}><div className={c.statNum}>{stats.played}</div><div className={c.statLabel}>Rounds</div></div>
            <div className={c.statBox}><div className={c.statNum}>{stats.won}</div><div className={c.statLabel}>Won</div></div>
            <div className={c.statBox}><div className={c.statNum}>{stats.streak}</div><div className={c.statLabel}>Streak</div></div>
            <div className={c.statBox}><div className={c.statNum}>{stats.best}</div><div className={c.statLabel}>Best</div></div>
          </div>
        </section>
      </main>
    </div>
  )
}
