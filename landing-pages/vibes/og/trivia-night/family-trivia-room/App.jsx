import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";

function Leaderboard({ useLiveQuery, gameId, c }) {
  const { docs: teams } = useLiveQuery("type", { key: "team" });
  const list = teams
    .filter((t) => t.gameId === gameId)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section id="leaderboard" className={c.section}>
      <h2 className={c.h2}>Leaderboard</h2>
      <div className="space-y-2">
        {list.length === 0 && (
          <div className="text-sm">No teams have joined yet.</div>
        )}
        {list.map((t, i) => (
          <div key={t._id} className={c.leaderRow}>
            <span className="font-bold">
              {medals[i] || `${i + 1}.`} {t.name}
            </span>
            <span className="font-mono font-bold text-xl">{t.score || 0}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Play({ database, useLiveQuery, gameId, teamId, now, c }) {
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const { docs: questions } = useLiveQuery("type", { key: "question" });
  const { docs: answers } = useLiveQuery("type", { key: "answer" });
  const game = games.find((g) => g._id === gameId);
  const q = questions.find((x) => x._id === game?.currentQuestionId);
  const myAnswer = answers.find(
    (a) => a.questionId === q?._id && a.teamId === teamId,
  );
  const remaining =
    q && game?.revealAt
      ? Math.max(0, 20 - Math.floor((now - game.revealAt) / 1000))
      : 20;
  const locked = remaining <= 0 || game?.showAnswer || !!myAnswer;

  async function pick(i) {
    if (locked) return;
    await database.put({
      type: "answer",
      gameId,
      questionId: q._id,
      teamId,
      optionIndex: i,
      at: Date.now(),
    });
  }

  const palette = [c.btnRed, c.btnYellow, c.btnBlue, c.btnGreen];

  return (
    <section id="play" className={c.section}>
      <h2 className={c.h2}>{game?.name || "Game"}</h2>
      {!q && (
        <div className="font-bold">
          Waiting for the host to reveal a question…
        </div>
      )}
      {q && (
        <>
          <div className="text-center p-4 border-[3px] border-[#15151f] rounded-[4px] bg-[#f4c430] mb-3">
            <div className={c.tag}>Time</div>
            <div className="text-5xl font-extrabold">{remaining}</div>
          </div>
          <div className="font-bold text-lg mb-3">{q.prompt}</div>
          <div className={c.grid2}>
            {q.options.map((opt, i) => {
              const isMine = myAnswer?.optionIndex === i;
              const isCorrect = game.showAnswer && i === q.correctIndex;
              const isWrong = game.showAnswer && isMine && i !== q.correctIndex;
              return (
                <button
                  key={i}
                  className={`${palette[i]} ${isCorrect ? "ring-4 ring-[#15151f]" : ""} ${isWrong ? "opacity-50" : ""}`}
                  disabled={locked}
                  onClick={() => pick(i)}
                >
                  {"ABCD"[i]}. {opt} {isMine && "✓"}
                </button>
              );
            })}
          </div>
          {game.showAnswer && (
            <div className="mt-3 font-bold">
              Answer: {q.options[q.correctIndex]}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function JoinForm({
  database,
  useLiveQuery,
  setGameId,
  setTeamId,
  setMode,
  c,
}) {
  const [code, setCode] = React.useState(
    new URLSearchParams(location.search).get("code") || "",
  );
  const [team, setTeam] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { docs: games } = useLiveQuery("type", { key: "game" });

  async function join() {
    setErr("");
    const up = code.trim().toUpperCase();
    const g = games.find((x) => x.code === up);
    if (!g) {
      setErr("No game with that code.");
      return;
    }
    if (!team.trim()) {
      setErr("Pick a team name.");
      return;
    }
    setBusy(true);
    try {
      const r = await database.put({
        type: "team",
        gameId: g._id,
        name: team.trim(),
        score: 0,
        createdAt: Date.now(),
      });
      setGameId(g._id);
      setTeamId(r.id);
      setMode("play");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="join" className={c.section}>
      <h2 className={c.h2}>Join a game</h2>
      <div className={c.row}>
        <input
          className={c.input}
          placeholder="4-letter code"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            textAlign: "center",
          }}
        />
        <input
          className={c.input}
          placeholder="Team name"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        />
        <button className={c.btnGreen} disabled={busy} onClick={join}>
          {busy ? "Joining…" : "Join"}
        </button>
        {err && <div className="text-[#e63946] font-bold">{err}</div>}
      </div>
    </section>
  );
}

function Deck({ database, useLiveQuery, gameId, now, c }) {
  const [topic, setTopic] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [opts, setOpts] = React.useState(["", "", "", ""]);
  const [correct, setCorrect] = React.useState(0);
  const { docs: allQuestions } = useLiveQuery("type", { key: "question" });
  const { docs: allAnswers } = useLiveQuery("type", { key: "answer" });
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const game = games.find((g) => g._id === gameId);
  const questions = allQuestions
    .filter((q) => q.gameId === gameId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const current = questions.find((q) => q._id === game?.currentQuestionId);

  async function addManual() {
    if (!prompt.trim() || opts.some((o) => !o.trim())) return;
    await database.put({
      type: "question",
      gameId,
      prompt: prompt.trim(),
      options: opts.map((o) => o.trim()),
      correctIndex: correct,
      createdAt: Date.now(),
    });
    setPrompt("");
    setOpts(["", "", "", ""]);
    setCorrect(0);
  }

  async function generate() {
    if (!topic.trim()) return;
    setAiBusy(true);
    try {
      const res = await callAI(
        `Generate 10 trivia questions about ${topic}. Each has 4 options and one correct answer.`,
        {
          schema: {
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    prompt: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correctIndex: { type: "number" },
                  },
                },
              },
            },
          },
        },
      );
      const data = JSON.parse(res);
      for (const q of data.questions || []) {
        if (q.prompt && q.options?.length === 4) {
          await database.put({
            type: "question",
            gameId,
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex ?? 0,
            createdAt: Date.now() + Math.random(),
          });
        }
      }
      setTopic("");
    } finally {
      setAiBusy(false);
    }
  }

  async function reveal(qid) {
    await database.put({
      ...game,
      currentQuestionId: qid,
      revealAt: Date.now(),
      status: "playing",
      showAnswer: false,
    });
  }
  async function showAnswer() {
    if (!current) return;
    // award points
    const answers = allAnswers.filter((a) => a.questionId === current._id);
    for (const a of answers) {
      if (a.optionIndex === current.correctIndex) {
        const team = await database.get(a.teamId).catch(() => null);
        if (team) await database.put({ ...team, score: (team.score || 0) + 1 });
      }
    }
    await database.put({ ...game, showAnswer: true, status: "reveal" });
  }

  const remaining =
    current && game?.revealAt && !game?.showAnswer
      ? Math.max(0, 20 - Math.floor((now - game.revealAt) / 1000))
      : null;

  return (
    <section id="deck" className={c.section}>
      <h2 className={c.h2}>Question deck ({questions.length})</h2>
      <div className="flex flex-col gap-2 mb-4">
        <input
          className={c.input}
          placeholder="Topic for AI (e.g. 90s movies)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button className={c.btnYellow} disabled={aiBusy} onClick={generate}>
          {aiBusy ? (
            <>
              <svg
                className="inline animate-spin mr-2"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="42 60" />
              </svg>
              Generating…
            </>
          ) : (
            "✨ Generate 10 questions"
          )}
        </button>
      </div>
      <div className="border-t-[3px] border-[#15151f] pt-4 space-y-2">
        <input
          className={c.input}
          placeholder="Question prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correct === i}
              onChange={() => setCorrect(i)}
              className="w-6 h-6"
            />
            <input
              className={c.input}
              placeholder={`Option ${"ABCD"[i]}`}
              value={o}
              onChange={(e) => {
                const n = [...opts];
                n[i] = e.target.value;
                setOpts(n);
              }}
            />
          </div>
        ))}
        <button className={c.btnBlue} onClick={addManual}>
          Add question
        </button>
      </div>
      {current && (
        <div className="mt-4 p-3 border-[3px] border-[#15151f] rounded-[4px] bg-[#f4c430]">
          <div className={c.tag}>
            Live now {remaining !== null && `• ${remaining}s`}
          </div>
          <div className="font-bold mb-2">{current.prompt}</div>
          {!game.showAnswer && (
            <button className={c.btnRed} onClick={showAnswer}>
              Show answer & score
            </button>
          )}
          {game.showAnswer && (
            <div className="font-bold">
              Answer: {current.options[current.correctIndex]}
            </div>
          )}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {questions.map((q, i) => (
          <div key={q._id} className={c.leaderRow}>
            <span className="font-bold flex-1 mr-2">
              {i + 1}. {q.prompt}
            </span>
            <button className={c.btnGreen} onClick={() => reveal(q._id)}>
              Reveal
            </button>
          </div>
        ))}
        {questions.length === 0 && (
          <div className="text-sm">
            No questions yet — add or generate some.
          </div>
        )}
      </div>
    </section>
  );
}

function HostSetup({ database, useLiveQuery, gameId, setGameId, c }) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const game = games.find((g) => g._id === gameId);

  async function createGame() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const code = makeCode();
      const r = await database.put({
        type: "game",
        name: name.trim(),
        code,
        status: "lobby",
        currentQuestionId: null,
        revealAt: null,
        createdAt: Date.now(),
      });
      setGameId(r.id);
    } finally {
      setBusy(false);
    }
  }

  const joinUrl = game
    ? `${location.origin}${location.pathname}?code=${game.code}`
    : "";
  const qrSrc = game
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}`
    : "";

  return (
    <section id="host" className={c.section}>
      <h2 className={c.h2}>Host control room</h2>
      {!game ? (
        <div className={c.row}>
          <input
            className={c.input}
            placeholder="Game name (e.g. Friday Pub Quiz)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className={c.btnGreen} disabled={busy} onClick={createGame}>
            {busy ? "Creating…" : "Create game"}
          </button>
        </div>
      ) : (
        <div className="p-4 border-[3px] border-[#15151f] rounded-[4px] bg-[#fdf6e3] text-center">
          <div className={c.tag}>{game.name} — Join code</div>
          <div className="text-5xl font-extrabold tracking-[0.2em] my-2">
            {game.code}
          </div>
          <img
            src={qrSrc}
            alt="Join QR"
            className="mx-auto border-[3px] border-[#15151f] rounded-[4px] bg-white"
          />
          <div className="text-xs mt-2 break-all">{joinUrl}</div>
        </div>
      )}
    </section>
  );
}

function makeCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export default function App() {
  const { database, useLiveQuery, useDocument } =
    useFireproof("trivia-night-live");
  const [mode, setMode] = React.useState("landing"); // landing | host | join | play
  const [gameId, setGameId] = React.useState(null);
  const [teamId, setTeamId] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  const c = {
    page: "min-h-screen bg-[#fdf6e3] text-[#15151f] font-sans",
    header:
      "bg-[#e63946] border-b-[3px] border-[#15151f] px-5 py-4 flex items-center justify-between",
    title: "text-2xl font-extrabold uppercase tracking-tight text-white",
    tag: "text-[0.65rem] uppercase tracking-[0.15em] text-[#fdf6e3]/90",
    main: "max-w-[920px] mx-auto px-4 py-5 space-y-5",
    section:
      "bg-white border-[3px] border-[#15151f] rounded-[4px] p-5 shadow-[4px_4px_0_#15151f]",
    h2: "text-lg font-extrabold uppercase tracking-tight mb-3",
    btnRed:
      "min-h-[52px] px-5 py-3 bg-[#e63946] text-white font-bold uppercase tracking-wide border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnYellow:
      "min-h-[52px] px-5 py-3 bg-[#f4c430] text-[#15151f] font-bold uppercase tracking-wide border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnBlue:
      "min-h-[52px] px-5 py-3 bg-[#2a6df4] text-white font-bold uppercase tracking-wide border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnGreen:
      "min-h-[52px] px-5 py-3 bg-[#3aa657] text-white font-bold uppercase tracking-wide border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    input:
      "w-full min-h-[48px] px-3 py-2 bg-white border-[3px] border-[#15151f] rounded-[4px] text-base font-semibold focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_#15151f]",
    row: "flex flex-col gap-3",
    grid2: "grid grid-cols-1 sm:grid-cols-2 gap-3",
    chip: "inline-block px-2 py-1 text-[0.7rem] uppercase tracking-wide font-bold border-[2px] border-[#15151f] rounded-[4px] bg-[#f4c430]",
    leaderRow:
      "flex items-center justify-between p-3 border-[3px] border-[#15151f] rounded-[4px] bg-[#fdf6e3]",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.tag}>Saturday Night</div>
          <div className={c.title}>Trivia Night Live</div>
        </div>
        <div className="text-3xl" aria-hidden>
          🎲
        </div>
      </header>
      <main id="app" className={c.main}>
        {mode === "join" && !teamId && (
          <JoinForm
            database={database}
            useLiveQuery={useLiveQuery}
            setGameId={setGameId}
            setTeamId={setTeamId}
            setMode={setMode}
            c={c}
          />
        )}
        {mode === "landing" && (
          <section id="landing" className={c.section}>
            <h2 className={c.h2}>Welcome to game night</h2>
            <p className="mb-4 text-sm">Pick your role to get rolling.</p>
            <div className={c.grid2}>
              <button className={c.btnRed} onClick={() => setMode("host")}>
                Host a game
              </button>
              <button className={c.btnBlue} onClick={() => setMode("join")}>
                Join a game
              </button>
            </div>
          </section>
        )}
        {mode === "host" && (
          <HostSetup
            database={database}
            useLiveQuery={useLiveQuery}
            gameId={gameId}
            setGameId={setGameId}
            c={c}
          />
        )}
        {mode === "host" && gameId && (
          <Deck
            database={database}
            useLiveQuery={useLiveQuery}
            gameId={gameId}
            now={now}
            c={c}
          />
        )}
        {null}
        {mode === "play" && teamId && (
          <Play
            database={database}
            useLiveQuery={useLiveQuery}
            gameId={gameId}
            teamId={teamId}
            now={now}
            c={c}
          />
        )}
        {gameId && (
          <Leaderboard useLiveQuery={useLiveQuery} gameId={gameId} c={c} />
        )}
      </main>
    </div>
  );
}
