import React from "react"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

// ── Spelling Hive ─────────────────────────────────────────────────────────────
// Find every word in the comb: 7 letters, the center is required, 4+ letters,
// pangrams use all seven. Reworked from the original jchris/spelling-hive:
//
// - Puzzles are REAL word lists (ENABLE dictionary, curated letter sets) loaded
//   from the "puzzles" database — populated via the CLI, not callAI (whose
//   hallucinated lists were the old app's word list). One puzzle per day
//   (date-hash over the loaded set), and you can roam with Next/Prev.
// - Your running game — found words + score — is YOURS: local state persisted
//   per device+puzzle in localStorage. Anonymous visitors play fully.
// - Only the leaderboard is shared: your best single-puzzle score (score +
//   handle, never your word list) posts to the "scores" database when you're
//   signed in. A backend.js scheduled sweep prunes it to the top 50 daily.

const DEMO_PUZZLE = {
  _id: "demo",
  type: "puzzle",
  letters: ["c", "e", "h", "i", "k", "n", "t"],
  center: "k",
  // A tiny built-in fallback (a slice of the real "kitchen" puzzle) so the hive
  // renders before the CLI-loaded puzzles sync. Real puzzles replace it.
  words: [
    { word: "kine", points: 1, pangram: false }, { word: "kite", points: 1, pangram: false },
    { word: "kith", points: 1, pangram: false }, { word: "knit", points: 1, pangram: false },
    { word: "keen", points: 1, pangram: false }, { word: "kent", points: 1, pangram: false },
    { word: "khet", points: 1, pangram: false }, { word: "kithe", points: 5, pangram: false },
    { word: "knee", points: 1, pangram: false }, { word: "nick", points: 1, pangram: false },
    { word: "neck", points: 1, pangram: false }, { word: "nickel", points: 6, pangram: false },
    { word: "chick", points: 5, pangram: false }, { word: "check", points: 5, pangram: false },
    { word: "chicken", points: 7, pangram: false }, { word: "thick", points: 5, pangram: false },
    { word: "thicken", points: 14, pangram: true }, { word: "kitchen", points: 14, pangram: true },
    { word: "ethnic", points: 6, pangram: false }, { word: "tick", points: 1, pangram: false },
    { word: "ticket", points: 6, pangram: false }, { word: "kinetic", points: 7, pangram: false },
  ],
  ranks: [
    { name: "Beginner", minScore: 0 }, { name: "Good Start", minScore: 2 },
    { name: "Moving Up", minScore: 5 }, { name: "Good", minScore: 8 },
    { name: "Solid", minScore: 15 }, { name: "Nice", minScore: 25 },
    { name: "Great", minScore: 40 }, { name: "Amazing", minScore: 50 },
    { name: "Genius", minScore: 70 },
  ],
};

function dayIndex(count) {
  const d = new Date();
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return count > 0 ? h % count : 0;
}

function loadFound(puzzleId) {
  try {
    return JSON.parse(localStorage.getItem(`hive-found-${puzzleId}`)) || [];
  } catch {
    return [];
  }
}

function saveFound(puzzleId, found) {
  try {
    localStorage.setItem(`hive-found-${puzzleId}`, JSON.stringify(found));
  } catch {
    // private mode etc. — best-effort only
  }
}

export default function App() {
  const { viewer, can } = useViewer();
  const { database: scoresDb, useLiveQuery: useScoresQuery } = useFireproof("scores");
  const { useLiveQuery: usePuzzlesQuery } = useFireproof("puzzles");

  const { docs: puzzleDocs } = usePuzzlesQuery("type", { key: "puzzle" });
  const puzzles = puzzleDocs.length > 0 ? [...puzzleDocs].sort((a, b) => String(a._id).localeCompare(String(b._id))) : [DEMO_PUZZLE];
  const [offset, setOffset] = React.useState(0); // roam away from today's puzzle
  const idx = (dayIndex(puzzles.length) + offset + puzzles.length * 1000) % puzzles.length;
  const puzzle = puzzles[idx];

  const { docs: scoreDocs } = useScoresQuery("kind", { key: "highscore" });
  const leaderboard = [...scoreDocs].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);

  const [found, setFound] = React.useState(() => loadFound(puzzle._id));
  const [shuffleKey, setShuffleKey] = React.useState(0);
  const [guess, setGuess] = React.useState("");
  const [flash, setFlash] = React.useState(null);
  const [pangramCelebrate, setPangramCelebrate] = React.useState(false);
  const flashTimer = React.useRef(null);

  // Swap the local game when the puzzle changes (new day / roaming / docs sync).
  React.useEffect(() => {
    setFound(loadFound(puzzle._id));
    setGuess("");
  }, [puzzle._id]);

  const score = found.reduce((s, f) => s + (f.points || 0), 0);
  const totalPossible = puzzle.words.reduce((s, w) => s + w.points, 0) || 1;
  const pct = (score / totalPossible) * 100;
  const rank = [...(puzzle.ranks || [])].reverse().find((r) => pct >= r.minScore) || puzzle.ranks?.[0];

  const letters = React.useMemo(() => {
    const outer = puzzle.letters.filter((l) => l !== puzzle.center);
    const arr = [...outer];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(((Math.sin(shuffleKey * 7 + i) + 1) / 2) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [puzzle, shuffleKey]);

  function showFlash(kind, msg) {
    clearTimeout(flashTimer.current);
    setFlash({ kind, msg });
    flashTimer.current = setTimeout(() => setFlash(null), 2000);
  }

  // Post your best to the public board — score + handle only, never the words.
  // Signed-in players only ("who got it, if logged in"); anonymous play stays
  // entirely on-device.
  async function maybeSubmitHighScore(newScore) {
    if (!viewer?.userSlug || !can("write")) return;
    const mine = scoreDocs.find((d) => d._id === `hs-${viewer.userSlug}`);
    if (mine && (mine.score || 0) >= newScore) return;
    try {
      await scoresDb.put({
        _id: `hs-${viewer.userSlug}`,
        kind: "highscore",
        score: newScore,
        by: viewer.displayName || viewer.userSlug,
        handle: viewer.userSlug,
        puzzleId: puzzle._id,
        at: Date.now(),
      });
    } catch {
      // Board write is best-effort — the local game is the source of truth.
    }
  }

  function submitGuess() {
    const g = guess.toLowerCase();
    if (!g) return;
    if (g.length < 4) return showFlash("err", "Too short");
    if (!g.includes(puzzle.center)) return showFlash("err", "Missing center letter");
    if (![...g].every((ch) => puzzle.letters.includes(ch))) return showFlash("err", "Bad letters");
    if (found.some((f) => f.word === g)) return showFlash("err", "Already found");
    const match = puzzle.words.find((w) => w.word === g);
    if (!match) return showFlash("err", "Not in word list");
    const nextFound = [...found, { word: g, points: match.points, pangram: match.pangram }];
    setFound(nextFound);
    saveFound(puzzle._id, nextFound);
    setGuess("");
    showFlash("ok", match.pangram ? `PANGRAM! +${match.points}` : `+${match.points}`);
    if (match.pangram) {
      setPangramCelebrate(true);
      setTimeout(() => setPangramCelebrate(false), 2500);
    }
    void maybeSubmitHighScore(nextFound.reduce((s, f) => s + f.points, 0));
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#2a1a4a] to-[#1a0f33] text-white font-['Nunito',sans-serif]",
    header: "px-4 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1a0f33]/80 backdrop-blur z-10",
    title: "text-2xl font-bold font-['Fredoka',sans-serif] tracking-wide",
    tagline: "text-xs text-white/60",
    main: "max-w-md mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-white/5 border border-white/10 rounded-2xl p-4",
    sectionTitle: "text-sm font-semibold uppercase tracking-wider text-white/70 mb-3",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[#6b3fa0] hover:bg-[#7a4ab0] active:bg-[#5a3590] font-semibold transition disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 font-semibold transition",
    input: "w-full min-h-[44px] px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-lg tracking-widest text-center font-bold uppercase focus:outline-none focus:border-[#e0c060]",
    avatar: "w-8 h-8 rounded-full border border-white/20",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Spelling Hive</h1>
          <p className={c.tagline}>Find every word in the comb</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#e0c060]">{rank?.name || "Beginner"}</span>
          <span className="text-lg font-bold font-['Fredoka',sans-serif] bg-[#e0c060] text-[#2a1a4a] px-3 py-1 rounded-full">{score}</span>
          <span className="text-xs text-white/60">{found.length}w</span>
          {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />}
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="puzzle-controls" className={c.section}>
          <h2 className={c.sectionTitle}>Puzzle {puzzles.length > 1 ? `${idx + 1} of ${puzzles.length}` : ""}</h2>
          <div className="flex gap-2">
            <button className={c.btnGhost} onClick={() => setShuffleKey((k) => k + 1)}>
              Shuffle
            </button>
            <button className={c.btnGhost} onClick={() => setOffset((o) => o - 1)} disabled={puzzles.length < 2}>
              ← Prev
            </button>
            <button className={c.btnGhost + " flex-1"} onClick={() => setOffset((o) => o + 1)} disabled={puzzles.length < 2}>
              Next puzzle →
            </button>
          </div>
          <p className="text-xs text-white/40 mt-2">Today's puzzle picks itself — roam if you finish it.</p>
        </section>
        <section id="hive" className={c.section}>
          <h2 className={c.sectionTitle}>The Hive</h2>
          <div className="relative w-full max-w-[280px] mx-auto aspect-square">
            {[
              { x: 50, y: 50, letter: puzzle.center, center: true },
              ...letters.slice(0, 6).map((l, i) => {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                return {
                  x: 50 + 33 * Math.cos(angle),
                  y: 50 + 33 * Math.sin(angle),
                  letter: l,
                  center: false,
                };
              }),
            ].map((tile, i) => (
              <button
                key={i}
                onClick={() => setGuess((g) => (g + tile.letter).slice(0, 20))}
                className={`absolute w-[30%] aspect-square flex items-center justify-center text-2xl font-bold uppercase font-['Fredoka',sans-serif] transition active:scale-95 ${
                  tile.center ? "bg-[#e0c060] text-[#2a1a4a]" : "bg-white/15 hover:bg-white/25 text-white"
                }`}
                style={{
                  left: `${tile.x}%`,
                  top: `${tile.y}%`,
                  transform: "translate(-50%, -50%)",
                  clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
                }}
              >
                {tile.letter}
              </button>
            ))}
          </div>
        </section>
        <section id="guess-input" className={c.section}>
          <h2 className={c.sectionTitle}>Your Guess</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitGuess();
            }}
          >
            <input
              className={c.input}
              value={guess}
              onChange={(e) => setGuess(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
              placeholder="type or tap"
              maxLength={20}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <div className="flex gap-2 mt-3">
              <button type="button" className={c.btnGhost} onClick={() => setGuess("")}>Clear</button>
              <button type="button" className={c.btnGhost} onClick={() => setGuess((g) => g.slice(0, -1))}>⌫</button>
              <button type="submit" className={c.btn + " flex-1"}>Enter</button>
            </div>
            {flash && (
              <p className={`text-sm mt-2 text-center font-semibold ${flash.kind === "ok" ? "text-[#8fdda8]" : "text-[#e09090]"}`}>
                {flash.msg}
              </p>
            )}
          </form>
        </section>
        <section id="score-rank" className={c.section}>
          <h2 className={c.sectionTitle}>Score & Rank</h2>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-bold font-['Fredoka',sans-serif]">{score}</span>
              <span className="text-sm text-[#e0c060] font-semibold">{rank?.name || "—"}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#6b3fa0] to-[#e0c060] transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="text-xs text-white/50 mt-2">{found.length} of {puzzle.words.length} words found · your words stay on this device</p>
          </div>
        </section>
        {pangramCelebrate && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="text-6xl font-bold font-['Fredoka',sans-serif] text-[#e0c060] animate-pulse drop-shadow-[0_0_30px_rgba(224,192,96,0.8)]">
              PANGRAM!
            </div>
          </div>
        )}
        <section id="found-words" className={c.section}>
          <h2 className={c.sectionTitle}>Your Words ({found.length})</h2>
          {found.length === 0 ? (
            <p className="text-sm text-white/50">No words yet — start finding them.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {[...found].sort((a, b) => a.word.localeCompare(b.word)).map((f) => (
                <li key={f.word} className={`text-sm capitalize ${f.pangram ? "text-[#e0c060] font-bold" : "text-white/85"}`}>
                  {f.word}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="leaderboard" className={c.section}>
          <h2 className={c.sectionTitle}>High Scores</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-white/50">No scores on the board yet.</p>
          ) : (
            <ol className="space-y-1">
              {leaderboard.map((s, i) => (
                <li key={s._id} className="flex items-center justify-between text-sm">
                  <span className={s.handle === viewer?.userSlug ? "text-[#e0c060] font-bold" : "text-white/85"}>
                    {i + 1}. {s.by || s.handle}
                  </span>
                  <span className="font-bold font-['Fredoka',sans-serif]">{s.score}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-white/40 mt-2">
            {viewer ? "Beat your best on any puzzle to climb the board." : "Sign in to post your best score."}
          </p>
        </section>
      </main>
    </div>
  );
}
