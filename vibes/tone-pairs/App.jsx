import React from "react"

function Shape({ name }) {
  const props = { width: "60%", height: "60%", viewBox: "0 0 24 24", fill: "none", stroke: "#4adede", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const shapes = {
    circle: <circle cx="12" cy="12" r="8" />,
    square: <rect x="4" y="4" width="16" height="16" />,
    triangle: <polygon points="12,4 20,20 4,20" />,
    diamond: <polygon points="12,3 21,12 12,21 3,12" />,
    hex: <polygon points="12,3 20,8 20,16 12,21 4,16 4,8" />,
    star: <polygon points="12,3 14,10 21,10 15,14 17,21 12,17 7,21 9,14 3,10 10,10" />,
    cross: <g><line x1="12" y1="4" x2="12" y2="20" /><line x1="4" y1="12" x2="20" y2="12" /></g>,
    ring: <g><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></g>,
    bar: <rect x="3" y="10" width="18" height="4" />,
    dot: <circle cx="12" cy="12" r="3" fill="#4adede" />,
    arc: <path d="M4 18 A 8 8 0 0 1 20 18" />,
    wave: <path d="M3 12 Q 7 6 12 12 T 21 12" />,
    split: <g><line x1="12" y1="3" x2="12" y2="21" /><circle cx="12" cy="12" r="8" /></g>,
    grid: <g><rect x="4" y="4" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></g>,
    spiral: <path d="M12 12 m-1 0 a 1 1 0 1 1 2 0 a 2 2 0 1 1 -4 0 a 3 3 0 1 1 6 0 a 4 4 0 1 1 -8 0" />,
    chevron: <polyline points="6,8 12,14 18,8" />,
  };
  return <svg {...props}>{shapes[name] || shapes.circle}</svg>;
}

// ── Tone Pairs ───────────────────────────────────────────────────────────────
// The sonic evolution of Match Pairs: every shape owns a note on a C-major
// pentatonic ladder, and flipping a tile PLAYS it — so your ears help your
// memory. A match replays the pair's note with its octave; a miss gives a low
// thud; finishing walks the board's notes low → high. Pure local state
// (Bloom-style) so an anonymous /start visitor can play; bests persist per
// device in localStorage.

const SHAPES = ["circle", "square", "triangle", "diamond", "hex", "star", "cross", "ring", "bar", "dot", "arc", "wave", "split", "grid", "spiral", "chevron"];
const SIZES = { "4x4": [4, 4], "6x6": [6, 6], "8x4": [8, 4] };
const BEST_KEY = "tone-pairs-bests";

// One pentatonic step per shape, low → high across three octaves (C4 → C7),
// in SHAPES order: the same shape always sings the same note.
const FREQS = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
const NOTE_OF = Object.fromEntries(SHAPES.map((s, i) => [s, FREQS[i]]));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeGame(sizeKey) {
  const [cols, rows] = SIZES[sizeKey];
  const pairCount = (cols * rows) / 2;
  const picks = shuffle(SHAPES).slice(0, pairCount);
  const tiles = shuffle([...picks, ...picks]).map((shape, i) => ({ i, shape, flipped: false, matched: false }));
  return { sizeKey, cols, rows, tiles, moves: 0, startedAt: Date.now(), completed: false, finishedAt: null, flippedIndices: [] };
}

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    return {};
  }
}

export default function App() {
  const [game, setGame] = React.useState(() => makeGame("4x4"));
  const [bests, setBests] = React.useState(loadBests);
  const [now, setNow] = React.useState(Date.now());
  const unflipRef = React.useRef(null);
  const ctxRef = React.useRef(null);

  // Lazy AudioContext behind a compressor; iOS Safari unlocks only inside a
  // gesture, so ensureCtx runs synchronously in the tap handler and re-resumes
  // every gesture (the context suspends when the phone locks).
  function ensureCtx() {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -6;
      master.ratio.value = 12;
      master.connect(ctx.destination);
      ctxRef.current = { ctx, master };
    }
    if (ctxRef.current.ctx.state !== "running") ctxRef.current.ctx.resume();
    return ctxRef.current;
  }

  // One short plucked note: triangle body + sine octave for presence.
  function playNote(freq, { when = 0, dur = 0.35, gain = 0.5 } = {}) {
    const { ctx, master } = ensureCtx();
    const t = ctx.currentTime + when;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    env.connect(master);
    [[freq, "triangle", 1], [freq * 2, "sine", 0.4]].forEach(([f, type, amt]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = amt;
      o.type = type;
      o.frequency.value = f;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  function playMatch(freq) {
    playNote(freq, { dur: 0.3 });
    playNote(freq * 2, { when: 0.14, dur: 0.45, gain: 0.4 });
  }

  function playMiss() {
    playNote(98.0, { dur: 0.25, gain: 0.35 }); // low G2 thud
  }

  React.useEffect(() => {
    if (game.completed) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [game.startedAt, game.completed]);

  function newGame(sizeKey) {
    clearTimeout(unflipRef.current);
    setGame(makeGame(sizeKey));
  }

  function saveBest(sizeKey, moves, elapsed) {
    setBests((prev) => {
      const cur = prev[sizeKey];
      if (cur && cur.moves <= moves) return prev;
      const next = { ...prev, [sizeKey]: { moves, elapsed } };
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(next));
      } catch {
        // private mode etc. — best-effort only
      }
      return next;
    });
  }

  function flipTile(idx) {
    setGame((g) => {
      if (g.completed) return g;
      const tile = g.tiles[idx];
      if (tile.flipped || tile.matched || g.flippedIndices.length >= 2) return g;
      playNote(NOTE_OF[tile.shape]); // synchronous, inside the tap — hear what you flip
      const flipped = [...g.flippedIndices, idx];
      let tiles = g.tiles.map((t, i) => (i === idx ? { ...t, flipped: true } : t));
      if (flipped.length < 2) return { ...g, tiles, flippedIndices: flipped };

      const [a, b] = flipped;
      const moves = g.moves + 1;
      if (tiles[a].shape === tiles[b].shape) {
        playMatch(NOTE_OF[tiles[a].shape]);
        tiles = tiles.map((t, i) => (i === a || i === b ? { ...t, matched: true, flipped: false } : t));
        const completed = tiles.every((t) => t.matched);
        const finishedAt = completed ? Date.now() : null;
        if (completed) {
          // Victory: walk the board's pair notes low → high like a run up the scale.
          const played = [...new Set(tiles.map((t) => t.shape))].map((s) => NOTE_OF[s]).sort((x, y) => x - y);
          played.forEach((f, i) => playNote(f, { when: 0.35 + i * 0.09, dur: 0.3, gain: 0.35 }));
          saveBest(g.sizeKey, moves, finishedAt - g.startedAt);
        }
        return { ...g, tiles, moves, flippedIndices: [], completed, finishedAt };
      }
      playMiss();
      clearTimeout(unflipRef.current);
      unflipRef.current = setTimeout(() => {
        setGame((cur) => ({
          ...cur,
          tiles: cur.tiles.map((t, i) => ((i === a || i === b) && !t.matched ? { ...t, flipped: false } : t)),
          flippedIndices: [],
        }));
      }, 900);
      return { ...g, tiles, moves, flippedIndices: flipped };
    });
  }

  const elapsed = !game.completed ? Math.floor((now - game.startedAt) / 1000) : Math.floor((game.finishedAt - game.startedAt) / 1000);

  const c = {
    page: "min-h-screen bg-[#0c1220] text-white font-['Inter',sans-serif]",
    header: "sticky top-0 bg-[#111a2c] border-b border-white/15 px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-white/50 font-mono",
    main: "px-4 py-4 max-w-2xl mx-auto space-y-4 pb-24",
    section: "bg-[#111a2c] border border-white/15 rounded-lg p-4",
    sectionTitle: "text-sm font-mono uppercase tracking-wider text-white/50 mb-3",
    btn: "min-h-[44px] px-4 py-3 bg-[#4adede] text-black font-semibold rounded-md active:scale-95 transition disabled:opacity-40",
    btnGhost: "min-h-[44px] px-4 py-3 bg-white/5 border border-white/15 text-white rounded-md active:bg-white/10",
    chip: "px-3 py-1 text-xs font-mono bg-white/5 border border-white/15 rounded-full",
    tile: "aspect-square rounded-md bg-[#1a2b4a] border-2 border-[#3a5a9a] active:scale-95 transition flex items-center justify-center cursor-pointer",
    tileBack: "bg-[#1a2b4a] border-[#3a5a9a] hover:border-[#4adede] hover:bg-[#22355c]",
    statBox: "flex-1 bg-[#080d18] border border-white/10 rounded-md p-3 text-center",
    statLabel: "text-[10px] font-mono uppercase text-white/40",
    statValue: "text-2xl font-bold text-[#4adede] font-mono",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Tone Pairs</h1>
          <p className={c.tagline}>flip · listen · match</p>
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="controls" className={c.section}>
          <h2 className={c.sectionTitle}>Game Setup</h2>
          <p className="text-sm text-white/60 mb-3">Every shape sings its own note — match by sight, sound, or both.</p>
          <div className="flex gap-2 mb-3">
            {Object.keys(SIZES).map(k => (
              <button
                key={k}
                onClick={() => newGame(k)}
                className={(game.sizeKey === k ? c.btn : c.btnGhost) + " flex-1"}
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={() => newGame(game.sizeKey)} className={c.btn + " w-full"}>
            Restart
          </button>
        </section>

        <section id="stats" className={c.section}>
          <h2 className={c.sectionTitle}>Live Stats</h2>
          <div className="flex gap-2">
            <div className={c.statBox}>
              <div className={c.statLabel}>Moves</div>
              <div className={c.statValue}>{game.moves}</div>
            </div>
            <div className={c.statBox}>
              <div className={c.statLabel}>Time</div>
              <div className={c.statValue}>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</div>
            </div>
            <div className={c.statBox}>
              <div className={c.statLabel}>Pairs</div>
              <div className={c.statValue}>{game.tiles.filter(t => t.matched).length / 2}</div>
            </div>
          </div>
          {game.completed && <p className="text-center mt-3 text-[#4adede] font-mono text-sm">♪ Complete! ♪</p>}
        </section>

        <section id="board" className={c.section}>
          <h2 className={c.sectionTitle}>Board</h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}
          >
            {game.tiles.map((t, i) => {
              const show = t.flipped || t.matched;
              return (
                <button
                  key={i}
                  onClick={() => flipTile(i)}
                  disabled={show}
                  className={c.tile + " " + (t.matched ? "opacity-40 bg-[#4adede]/10 border-[#4adede]/50" : show ? "bg-[#4adede]/10 border-[#4adede]/50" : c.tileBack)}
                >
                  {show ? <Shape name={t.shape} /> : <span className="text-[#3a5a9a] text-lg select-none">♪</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section id="scores" className={c.section}>
          <h2 className={c.sectionTitle}>Personal Bests</h2>
          <ul className="space-y-2">
            {Object.keys(SIZES).map(k => {
              const b = bests[k];
              return (
                <li key={k} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <span className={c.chip}>{k}</span>
                  {b ? (
                    <span className="text-sm font-mono">
                      <span className="text-[#4adede]">{b.moves}</span> moves · {Math.floor(b.elapsed / 1000)}s
                    </span>
                  ) : (
                    <span className="text-xs text-white/30 font-mono">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
