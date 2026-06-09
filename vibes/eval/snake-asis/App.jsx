import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const GRID = 20;

function randFood(snake) {
  while (true) {
    const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
  }
}

function Arena({ viewer }) {
  const { database } = useFireproof("neonSnake");
  const [snake, setSnake] = React.useState([{ x: 10, y: 10 }]);
  const [dir, setDir] = React.useState({ x: 1, y: 0 });
  const [food, setFood] = React.useState({ x: 5, y: 5 });
  const [running, setRunning] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [gameOver, setGameOver] = React.useState(false);
  const dirRef = React.useRef(dir);
  dirRef.current = dir;

  React.useEffect(() => {
    function onKey(e) {
      const k = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) return;
      e.preventDefault();
      const d = dirRef.current;
      if (k === "ArrowUp" && d.y !== 1) setDir({ x: 0, y: -1 });
      if (k === "ArrowDown" && d.y !== -1) setDir({ x: 0, y: 1 });
      if (k === "ArrowLeft" && d.x !== 1) setDir({ x: -1, y: 0 });
      if (k === "ArrowRight" && d.x !== -1) setDir({ x: 1, y: 0 });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
        if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || prev.some((s) => s.x === head.x && s.y === head.y)) {
          setRunning(false);
          setGameOver(true);
          return prev;
        }
        const ate = head.x === food.x && head.y === food.y;
        const next = ate ? [head, ...prev] : [head, ...prev.slice(0, -1)];
        if (ate) {
          setScore((s) => s + 10);
          setFood(randFood(next));
        }
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, [running, food]);

  React.useEffect(() => {
    if (gameOver && score > 0 && viewer) {
      database.put({ type: "score", score, authorHandle: viewer.userHandle, createdAt: Date.now() });
    }
  }, [gameOver]);

  function start() {
    setSnake([{ x: 10, y: 10 }]);
    setDir({ x: 1, y: 0 });
    setFood(randFood([{ x: 10, y: 10 }]));
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }

  function press(nd) {
    const d = dirRef.current;
    if (nd.x === -d.x && nd.y === -d.y) return;
    setDir(nd);
  }

  return (
    <section
      id="arena"
      className="rounded-2xl border-2 border-[#f93c94] bg-[#2a0a2e]/80 p-4 shadow-[0_0_30px_rgba(249,60,148,0.4)]"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-[Orbitron] text-xl text-[#fcee0a] tracking-widest">ARENA</h2>
        <span className="font-[Share_Tech_Mono] text-[#00f0ff] text-lg">
          SCORE: <span className="text-[#fcee0a] font-bold">{score}</span>
        </span>
      </div>
      <div
        className="aspect-square w-full max-w-md mx-auto bg-[#1a0520] border-2 border-[#f93c94]/50 rounded-lg relative overflow-hidden"
        style={{ boxShadow: "inset 0 0 40px rgba(249,60,148,0.3)" }}
      >
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
        >
          {snake.map((s, i) => (
            <div
              key={i}
              style={{
                gridColumn: s.x + 1,
                gridRow: s.y + 1,
                background: i === 0 ? "#fcee0a" : "#f93c94",
                boxShadow: i === 0 ? "0 0 10px #fcee0a" : "0 0 8px #f93c94",
                borderRadius: "20%",
              }}
            />
          ))}
          <div
            style={{
              gridColumn: food.x + 1,
              gridRow: food.y + 1,
              background: "#00f0ff",
              boxShadow: "0 0 12px #00f0ff",
              borderRadius: "50%",
            }}
          />
        </div>
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#2a0a2e]/80">
            <div className="text-center">
              {gameOver && (
                <p className="font-[Orbitron] text-2xl text-[#f93c94] mb-2 drop-shadow-[0_0_8px_rgba(249,60,148,0.8)]">GAME OVER</p>
              )}
              {gameOver && <p className="font-[Share_Tech_Mono] text-[#fcee0a] mb-3">final: {score}</p>}
              {viewer ? (
                <button
                  onClick={start}
                  className="font-[Orbitron] tracking-widest bg-[#fcee0a] text-[#2a0a2e] px-6 py-3 rounded-lg min-h-[44px] shadow-[0_0_20px_rgba(252,238,10,0.6)] hover:scale-105 transition"
                >
                  {gameOver ? "PLAY AGAIN" : "START"}
                </button>
              ) : (
                <p className="font-[Rajdhani] text-white">sign in to play</p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 max-w-[200px] mx-auto md:hidden">
        <div />
        <button
          onClick={() => press({ x: 0, y: -1 })}
          className="min-h-[44px] bg-[#4d1558] border-2 border-[#f93c94] text-[#fcee0a] rounded-lg font-bold"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => press({ x: -1, y: 0 })}
          className="min-h-[44px] bg-[#4d1558] border-2 border-[#f93c94] text-[#fcee0a] rounded-lg font-bold"
        >
          ←
        </button>
        <button
          onClick={() => press({ x: 0, y: 1 })}
          className="min-h-[44px] bg-[#4d1558] border-2 border-[#f93c94] text-[#fcee0a] rounded-lg font-bold"
        >
          ↓
        </button>
        <button
          onClick={() => press({ x: 1, y: 0 })}
          className="min-h-[44px] bg-[#4d1558] border-2 border-[#f93c94] text-[#fcee0a] rounded-lg font-bold"
        >
          →
        </button>
      </div>
    </section>
  );
}

function Leaderboard() {
  return (
    <section
      id="leaderboard"
      className="rounded-2xl border-2 border-[#00f0ff] bg-[#4d1558]/80 p-4 shadow-[0_0_30px_rgba(0,240,255,0.4)]"
    >
      <h2 className="font-[Orbitron] text-xl text-[#00f0ff] tracking-widest mb-3 text-center">HIGH SCORES</h2>
      {/* live score list lands here */}
    </section>
  );
}

export default function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] font-[Rajdhani] text-[#2a0a2e]",
    header:
      "sticky top-0 z-10 backdrop-blur-md bg-[#2a0a2e]/70 border-b-2 border-[#f93c94] px-4 py-3 flex items-center justify-between",
    title: "font-[Orbitron] text-2xl font-bold text-[#fcee0a] tracking-[0.2em] drop-shadow-[0_0_8px_rgba(252,238,10,0.6)]",
    main: "max-w-2xl mx-auto p-4 space-y-4",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>NEON SNAKE</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <Arena viewer={viewer} />
        <Leaderboard viewerHandle={viewer?.userHandle} />
      </main>
    </div>
  );
}
