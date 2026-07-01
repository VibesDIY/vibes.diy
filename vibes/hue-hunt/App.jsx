import React from "react"

// ── Hue Hunt ─────────────────────────────────────────────────────────────────
// Wordle for color words: guess the 5-letter color in 6 tries, one puzzle per
// day. Curated Games-tree copy of the hand-tuned jchris/hue-hunt (a mind-games
// featured app) — reworked to pure local state + localStorage so an anonymous
// /start visitor can play, not spectate. Its evolution chip — "Let me play
// unlimited rounds" — jumps to hue-rush, the endless-round variant.

const COLOR_WORDS = ["AMBER","AZURE","BEIGE","BLACK","BLUSH","BROWN","CORAL","CREAM","GREEN","HONEY","IVORY","KHAKI","LEMON","LILAC","MAUVE","MOCHA","OCHRE","OLIVE","PEACH","PLUM ".trim(),"ROUGE","SEPIA","TEAL ".trim(),"WHEAT","WHITE"].filter(w => w.length === 5);

function dailyIndex() {
  const d = new Date();
  const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % COLOR_WORDS.length;
}

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

const SWATCH = {
  correct: "bg-[#00f0ff] text-[#2a0a2e] border-[#00f0ff]",
  present: "bg-[#fcee0a] text-[#2a0a2e] border-[#fcee0a]",
  absent: "bg-[#4d1558] text-[#ffffff]/40 border-[#4d1558]",
};

const STORE_KEY = "hue-hunt-games";

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // private mode etc. — best-effort only
  }
}

export default function App() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const answer = COLOR_WORDS[dailyIndex()];
  const [store, setStore] = React.useState(loadStore);
  const doc = store[todayKey] || { guesses: [], current: "", done: false, won: false };
  const guesses = doc.guesses || [];
  const current = doc.current || "";
  const done = doc.done || guesses.length >= 6;

  function update(next) {
    setStore((prev) => {
      const merged = { ...prev, [todayKey]: { ...(prev[todayKey] || {}), ...next } };
      saveStore(merged);
      return merged;
    });
  }

  const finished = Object.entries(store).filter(([, g]) => g.done);
  const played = finished.length;
  const won = finished.filter(([, g]) => g.won).length;
  let streak = 0;
  for (const [, g] of finished.sort(([a], [b]) => b.localeCompare(a))) {
    if (g.won) streak++;
    else break;
  }

  function share() {
    const emojiMap = { correct: "🟦", present: "🟨", absent: "🟪" };
    const grid = guesses.map(g => scoreGuess(g, answer).map(s => emojiMap[s]).join("")).join("\n");
    const text = `Hue Hunt ${todayKey}\n${doc.won ? guesses.length : "X"}/6\n\n${grid}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text);
  }

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] text-[#2a0a2e] font-['Rajdhani',sans-serif] pb-8",
    header: "sticky top-0 z-10 bg-[#2a0a2e] text-[#fcee0a] px-4 py-3 shadow-lg border-b-4 border-[#f93c94]",
    title: "font-['Orbitron',sans-serif] text-2xl font-bold tracking-widest text-center",
    tagline: "text-center text-[#00f0ff] text-xs tracking-[0.3em] uppercase mt-1",
    main: "max-w-md mx-auto px-4 pt-6 space-y-6",
    section: "bg-[#2a0a2e]/90 backdrop-blur rounded-xl border-2 border-[#f93c94] p-4 shadow-[0_0_20px_rgba(249,60,148,0.4)]",
    h2: "font-['Orbitron',sans-serif] text-[#fcee0a] text-sm tracking-widest uppercase mb-3",
    board: "grid grid-rows-6 gap-2",
    row: "grid grid-cols-5 gap-2",
    tile: "aspect-square flex items-center justify-center font-['Orbitron',sans-serif] font-bold text-2xl uppercase rounded-md border-2 border-[#4d1558] bg-[#4d1558]/40 text-[#ffffff]",
    keyboard: "space-y-2",
    kbRow: "flex justify-center gap-1",
    key: "min-w-[32px] min-h-[48px] px-2 rounded-md bg-[#4d1558] text-[#ffffff] font-bold font-['Rajdhani',sans-serif] active:bg-[#f93c94] border border-[#f93c94]/40",
    keyWide: "min-w-[60px] min-h-[48px] px-2 rounded-md bg-[#f93c94] text-[#2a0a2e] font-bold font-['Orbitron',sans-serif] text-xs tracking-wider active:bg-[#fcee0a] border border-[#fcee0a]/40",
    statRow: "flex justify-around text-center",
    statBox: "flex-1",
    statNum: "font-['Orbitron',sans-serif] text-2xl text-[#fcee0a]",
    statLabel: "text-[#00f0ff] text-xs uppercase tracking-widest",
    btn: "w-full min-h-[48px] rounded-md bg-[#fcee0a] text-[#2a0a2e] font-['Orbitron',sans-serif] font-bold tracking-widest uppercase border-2 border-[#f93c94] active:bg-[#00f0ff]",
  };

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;700&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>HUE HUNT</h1>
        <p className={c.tagline}>Guess the color · 6 tries</p>
      </header>
      <main id="app" className={c.main}>
        <section id="how-to-play" className={c.section}>
          <h2 className={c.h2}>How to Play</h2>
          <p className="text-[#ffffff]/80 text-sm font-['Rajdhani',sans-serif] mb-2">Guess the 5-letter <span className="text-[#fcee0a] font-bold">color word</span> in 6 tries.</p>
          <div className="flex gap-3 flex-wrap text-xs font-['Rajdhani',sans-serif]">
            <span className="flex items-center gap-1"><span className="inline-block w-7 h-7 rounded bg-[#00f0ff] text-[#2a0a2e] font-bold text-center leading-7 font-['Orbitron',sans-serif]">A</span> right spot</span>
            <span className="flex items-center gap-1"><span className="inline-block w-7 h-7 rounded bg-[#fcee0a] text-[#2a0a2e] font-bold text-center leading-7 font-['Orbitron',sans-serif]">A</span> wrong spot</span>
            <span className="flex items-center gap-1"><span className="inline-block w-7 h-7 rounded bg-[#4d1558] text-white/40 font-bold text-center leading-7 font-['Orbitron',sans-serif]">A</span> not in word</span>
          </div>
          <p className="text-[#00f0ff] text-xs mt-2 font-['Rajdhani',sans-serif]">Words are color names: AMBER, AZURE, CORAL, TEAL…</p>
        </section>
        <section id="board" className={c.section}>
          <h2 className={c.h2}>Puzzle · {todayKey}</h2>
          <div className={c.board}>
            {[0,1,2,3,4,5].map(r => {
              const g = guesses[r];
              const isCurrent = r === guesses.length && !done;
              const letters = g ? g.split("") : isCurrent ? current.padEnd(5," ").split("") : ["","","","",""];
              const scores = g ? scoreGuess(g, answer) : null;
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
            <div className="mt-4 text-center space-y-1">
              {doc.won ? (
                <p className="font-['Orbitron',sans-serif] text-[#00f0ff] text-xl tracking-widest">🎨 YOU GOT IT!</p>
              ) : (
                <>
                  <p className="font-['Orbitron',sans-serif] text-[#f93c94] text-sm tracking-widest">THE COLOR WAS</p>
                  <p className="font-['Orbitron',sans-serif] text-[#fcee0a] text-3xl tracking-[0.3em] font-bold">{answer}</p>
                </>
              )}
            </div>
          )}
        </section>
        <section id="keyboard" className={c.section}>
          <h2 className={c.h2}>Input</h2>
          <div className={c.keyboard}>
            {["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"].map((row, ri) => {
              const letterStatus = {};
              guesses.forEach(g => {
                const s = scoreGuess(g, answer);
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
                      const wonNow = current === answer;
                      const finishedNow = wonNow || newGuesses.length >= 6;
                      update({ guesses: newGuesses, current: "", done: finishedNow, won: wonNow });
                    }}>ENTER</button>
                  )}
                  {row.split("").map(k => {
                    const st = letterStatus[k];
                    const tint = st === "correct" ? "bg-[#00f0ff] text-[#2a0a2e]" : st === "present" ? "bg-[#fcee0a] text-[#2a0a2e]" : st === "absent" ? "bg-[#4d1558]/40 text-[#ffffff]/40" : "";
                    return (
                      <button type="button" key={k} className={`${c.key} ${tint} ${done ? "opacity-60 cursor-default" : ""}`} onClick={() => {
                        if (done || current.length >= 5) return;
                        update({ current: current + k });
                      }}>{k}</button>
                    );
                  })}
                  {ri === 2 && (
                    <button type="button" className={c.keyWide} disabled={done} onClick={() => {
                      if (done || current.length === 0) return;
                      update({ current: current.slice(0, -1) });
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
            <div className={c.statBox}><div className={c.statNum}>{played}</div><div className={c.statLabel}>Played</div></div>
            <div className={c.statBox}><div className={c.statNum}>{won}</div><div className={c.statLabel}>Won</div></div>
            <div className={c.statBox}><div className={c.statNum}>{streak}</div><div className={c.statLabel}>Streak</div></div>
          </div>
          {done && (
            <button className={`${c.btn} mt-4`} onClick={share}>Share Result</button>
          )}
        </section>
      </main>
    </div>
  )
}
