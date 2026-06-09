import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const GRID = 20;
const CELL = 16;

function GameBoard({ viewer, isOwner, database, c }) {
  const canvasRef = React.useRef(null);
  const [score, setScore] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const stateRef = React.useRef(null);

  function initState() {
    return {
      snake: [{ x: 10, y: 10 }],
      dir: { x: 1, y: 0 },
      food: { x: 5, y: 5 },
      score: 0,
    };
  }

  function placeFood(snake) {
    while (true) {
      const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    ctx.fillStyle = "#2a0a2e";
    ctx.fillRect(0, 0, GRID * CELL, GRID * CELL);
    ctx.fillStyle = "#fcee0a";
    ctx.fillRect(s.food.x * CELL, s.food.y * CELL, CELL - 1, CELL - 1);
    s.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#00f0ff" : "#f93c94";
      ctx.fillRect(seg.x * CELL, seg.y * CELL, CELL - 1, CELL - 1);
    });
  }

  function tick() {
    const s = stateRef.current;
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    if (
      head.x < 0 ||
      head.x >= GRID ||
      head.y < 0 ||
      head.y >= GRID ||
      s.snake.some((seg) => seg.x === head.x && seg.y === head.y)
    ) {
      setRunning(false);
      setGameOver(true);
      if (viewer && s.score > 0) {
        database.put({
          type: "score",
          score: s.score,
          authorHandle: viewer.userHandle,
          createdAt: Date.now(),
        });
      }
      return;
    }
    s.snake.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10;
      setScore(s.score);
      s.food = placeFood(s.snake);
    } else {
      s.snake.pop();
    }
    draw();
  }

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [running]);

  React.useEffect(() => {
    function onKey(e) {
      const s = stateRef.current;
      if (!s) return;
      const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      const d = map[e.key];
      if (!d) return;
      if (s.dir.x === -d.x && s.dir.y === -d.y) return;
      s.dir = d;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function start() {
    stateRef.current = initState();
    setScore(0);
    setGameOver(false);
    setRunning(true);
    draw();
  }

  function turn(dx, dy) {
    const s = stateRef.current;
    if (!s) return;
    if (s.dir.x === -dx && s.dir.y === -dy) return;
    s.dir = { x: dx, y: dy };
  }

  if (!isOwner) {
    return (
      <div className={`${c.panel} rounded-lg p-6 text-center`}>
        <p className={c.textLight}>Spectator mode — watch the leaderboard update live.</p>
      </div>
    );
  }

  return (
    <div className={`${c.panel} rounded-lg p-4 flex flex-col items-center gap-3`}>
      <div className="flex items-center justify-between w-full">
        <span className={`${c.headline} ${c.neonCyan} text-xl`}>SCORE: {score}</span>
        {!running && (
          <button onClick={start} className={`${c.btn} min-h-[44px] px-5`}>
            {gameOver ? "PLAY AGAIN" : "START"}
          </button>
        )}
      </div>
      <canvas ref={canvasRef} width={GRID * CELL} height={GRID * CELL} className="border-2 border-[#f93c94] rounded max-w-full" />
      <div className="grid grid-cols-3 gap-2 w-48 md:hidden">
        <div />
        <button onClick={() => turn(0, -1)} className={`${c.btn} min-h-[44px]`}>
          ↑
        </button>
        <div />
        <button onClick={() => turn(-1, 0)} className={`${c.btn} min-h-[44px]`}>
          ←
        </button>
        <button onClick={() => turn(0, 1)} className={`${c.btn} min-h-[44px]`}>
          ↓
        </button>
        <button onClick={() => turn(1, 0)} className={`${c.btn} min-h-[44px]`}>
          →
        </button>
      </div>
      {gameOver && <p className={`${c.neonYellow} font-bold`}>GAME OVER — score submitted!</p>}
    </div>
  );
}

function Leaderboard({ scores, ViewerTag, c }) {
  const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);
  return (
    <div className={`${c.panel} rounded-lg p-4`}>
      <h2 className={`${c.headline} ${c.neonPink} text-2xl mb-3`}>LEADERBOARD</h2>
      {top.length === 0 && <p className={c.textLight}>No scores yet — be the first!</p>}
      <ul className="space-y-2">
        {top.map((s, i) => (
          <li key={s._id} className={`flex items-center justify-between gap-3 p-2 rounded ${i === 0 ? "bg-[#4d1558]" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`${c.neonYellow} font-bold w-6`}>#{i + 1}</span>
              <ViewerTag userHandle={s.authorHandle} />
            </div>
            <span className={`${c.neonCyan} font-bold text-lg tabular-nums`}>{s.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("snakeArcade");
  const { docs: scores } = useLiveQuery("type", { key: "score" });

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a]",
    panel: "bg-[#2a0a2e] border-2 border-[#f93c94]",
    headline: "font-['Orbitron',sans-serif] tracking-wider",
    body: "font-['Rajdhani',sans-serif]",
    neonPink: "text-[#f93c94]",
    neonYellow: "text-[#fcee0a]",
    neonCyan: "text-[#00f0ff]",
    textLight: "text-white",
    btn: "bg-[#f93c94] hover:bg-[#fcee0a] hover:text-[#2a0a2e] text-white font-bold rounded font-['Orbitron',sans-serif] tracking-wide transition-colors",
  };

  if (isViewerPending) return null;

  return (
    <main id="app" className={`${c.page} ${c.body} p-4 md:p-8`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;600&display=optional');`}</style>
      <header id="app-header" className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4">
        <h1 className={`${c.headline} text-3xl md:text-5xl text-[#2a0a2e] drop-shadow-[2px_2px_0_#fcee0a]`}>NEON SNAKE</h1>
        <ViewerTag />
      </header>
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
        <section id="game">
          <GameBoard viewer={viewer} isOwner={isOwner} database={database} c={c} />
        </section>
        <section id="leaderboard">
          <Leaderboard scores={scores} ViewerTag={ViewerTag} c={c} />
        </section>
      </div>
    </main>
  );
}
