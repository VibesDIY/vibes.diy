import React from "react"

// ── Word Jumble ───────────────────────────────────────────────────────────────
// The Games starter for the Instant Starter Stack: six scrambled letter tiles,
// one hidden word — tap the tiles to spell it. The simplest possible
// letters-into-words loop, which is exactly the thread its evolution chip pulls
// on: "Grow it into a spelling hive" jumps to the full 7-letter comb with real
// dictionaries and a public leaderboard. Pure local state (Bloom rule): an
// anonymous /start visitor plays instantly; streaks persist per device.

const WORDS = [
  "planet", "garden", "singer", "bright", "stream", "pocket", "wonder", "silver",
  "orange", "temple", "castle", "spring", "danger", "forest", "market", "candle",
  "monkey", "rocket", "singer", "island", "butter", "window", "yellow", "violet",
  "summer", "winter", "bridge", "flower", "guitar", "jungle", "kitten", "lemon",
  "melon", "night", "ocean", "piano", "quiet", "river", "stone", "tiger",
  "under", "voice", "water", "young", "zebra", "apple", "bread", "cloud",
  "dream", "earth", "fruit", "grape", "heart", "juice", "knife", "light",
  "mouse", "north", "olive", "peach", "queen", "radio", "smile", "train",
].filter((w, i, a) => a.indexOf(w) === i);

const STATS_KEY = "word-jumble-stats";

function shuffle(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(((Math.sin(seed * 31 + i * 7) + 1) / 2) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRound(prevWord) {
  const pool = WORDS.filter((w) => w !== prevWord);
  const word = pool[Math.floor(Math.random() * pool.length)];
  let tiles = shuffle([...word], Math.floor(Math.random() * 1e6));
  // Don't deal the word already solved.
  if (tiles.join("") === word) tiles = [...tiles.reverse()];
  return { word, tiles };
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { solved: 0, streak: 0, best: 0 };
  } catch {
    return { solved: 0, streak: 0, best: 0 };
  }
}

export default function App() {
  const [round, setRound] = React.useState(() => makeRound());
  const [picked, setPicked] = React.useState([]); // indices into round.tiles
  const [state, setState] = React.useState("play"); // play | won | revealed
  const [stats, setStats] = React.useState(loadStats);
  const [wiggle, setWiggle] = React.useState(false);

  const guess = picked.map((i) => round.tiles[i]).join("");

  function saveStats(next) {
    setStats(next);
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(next));
    } catch {
      // best-effort
    }
  }

  function pickTile(i) {
    if (state !== "play" || wiggle || picked.includes(i)) return;
    const nextPicked = [...picked, i];
    setPicked(nextPicked);
    const g = nextPicked.map((x) => round.tiles[x]).join("");
    if (g.length !== round.word.length) return;
    if (g === round.word) {
      setState("won");
      const streak = stats.streak + 1;
      saveStats({ solved: stats.solved + 1, streak, best: Math.max(stats.best, streak) });
    } else {
      // Wrong order — wiggle and give the tiles back.
      setWiggle(true);
      setTimeout(() => {
        setWiggle(false);
        setPicked([]);
      }, 450);
    }
  }

  function undo() {
    if (state !== "play" || wiggle || picked.length === 0) return;
    setPicked(picked.slice(0, -1));
  }

  function reveal() {
    if (state !== "play") return;
    setState("revealed");
    saveStats({ ...stats, streak: 0 });
  }

  function next() {
    setRound(makeRound(round.word));
    setPicked([]);
    setState("play");
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#14342b] to-[#0a1f19] text-white font-['Nunito',sans-serif]",
    header: "px-4 py-5 border-b border-white/10 sticky top-0 bg-[#0a1f19]/80 backdrop-blur z-10",
    title: "text-2xl font-bold font-['Fredoka',sans-serif] tracking-wide",
    tagline: "text-xs text-white/60",
    main: "max-w-md mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-white/5 border border-white/10 rounded-2xl p-4",
    sectionTitle: "text-sm font-semibold uppercase tracking-wider text-white/70 mb-3",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#2f9e6e] hover:bg-[#37b57e] active:bg-[#278a5f] font-semibold transition disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-semibold transition disabled:opacity-40",
    tile: "w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold uppercase font-['Fredoka',sans-serif] transition active:scale-95",
    slot: "w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold uppercase font-['Fredoka',sans-serif] border-2 border-dashed border-white/20",
    statBox: "flex-1 text-center",
    statNum: "text-2xl font-bold font-['Fredoka',sans-serif] text-[#7fe0b0]",
    statLabel: "text-xs uppercase tracking-widest text-white/50",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Word Jumble</h1>
        <p className={c.tagline}>Untangle the letters · spell the word</p>
      </header>
      <main id="app" className={c.main}>
        <section id="answer" className={c.section}>
          <h2 className={c.sectionTitle}>Your Word</h2>
          <div className={`flex gap-2 justify-center ${wiggle ? "animate-pulse" : ""}`}>
            {round.word.split("").map((_, i) => (
              <div key={i} className={c.slot + (state !== "play" ? " border-[#7fe0b0]/60" : "")}>
                {state === "revealed" && !guess[i] ? (
                  <span className="text-white/40">{round.word[i]}</span>
                ) : (
                  <span className={state === "won" ? "text-[#7fe0b0]" : ""}>{guess[i] || ""}</span>
                )}
              </div>
            ))}
          </div>
          {state === "won" && <p className="text-center mt-3 text-[#7fe0b0] font-bold">Solved! 🎉</p>}
          {state === "revealed" && <p className="text-center mt-3 text-white/60">It was “{round.word}” — next one's yours.</p>}
        </section>
        <section id="tiles" className={c.section}>
          <h2 className={c.sectionTitle}>The Letters</h2>
          <div className="flex gap-2 justify-center flex-wrap">
            {round.tiles.map((ch, i) => {
              const used = picked.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => pickTile(i)}
                  disabled={used || state !== "play"}
                  className={c.tile + (used ? " bg-white/5 text-white/20" : " bg-[#2f9e6e]/30 border border-[#2f9e6e]/60 hover:bg-[#2f9e6e]/50")}
                >
                  {ch}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4">
            <button className={c.btnGhost} onClick={undo} disabled={state !== "play" || picked.length === 0}>
              ⌫ Undo
            </button>
            <button className={c.btnGhost} onClick={reveal} disabled={state !== "play"}>
              Reveal
            </button>
            <button className={c.btn + " flex-1"} onClick={next}>
              {state === "play" ? "Skip →" : "Next word →"}
            </button>
          </div>
        </section>
        <section id="stats" className={c.section}>
          <h2 className={c.sectionTitle}>Stats</h2>
          <div className="flex">
            <div className={c.statBox}><div className={c.statNum}>{stats.solved}</div><div className={c.statLabel}>Solved</div></div>
            <div className={c.statBox}><div className={c.statNum}>{stats.streak}</div><div className={c.statLabel}>Streak</div></div>
            <div className={c.statBox}><div className={c.statNum}>{stats.best}</div><div className={c.statLabel}>Best</div></div>
          </div>
        </section>
      </main>
    </div>
  );
}
