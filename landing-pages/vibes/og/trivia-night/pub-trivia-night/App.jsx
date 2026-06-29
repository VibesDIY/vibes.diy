import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";

function Leaderboard({ c, useLiveQuery, activeCode, teamId }) {
  const { docs: teams } = useLiveQuery("gameCode", { key: activeCode });
  const ranked = teams
    .filter((t) => t.type === "team")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <section id="leaderboard" className={c.section}>
      <h2 className={c.h2}>Leaderboard</h2>
      {ranked.length === 0 && (
        <p className="text-xs text-[#c9a96a]/60 italic">No teams joined yet.</p>
      )}
      <ol className="space-y-2">
        {ranked.map((t, i) => (
          <li
            key={t._id}
            className={`flex justify-between items-center border-[2px] border-[#0f1614] rounded px-3 py-2 ${t._id === teamId ? "bg-[#e8b948]/20" : "bg-[#1a221f]"}`}
          >
            <span className="font-bold">
              {i + 1}. {t.name}
            </span>
            <span className="font-black text-[#e8b948] text-lg">
              {t.score || 0}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function JoinPanel({
  c,
  database,
  useLiveQuery,
  activeCode,
  setActiveCode,
  teamId,
  setTeamId,
}) {
  const [codeInput, setCodeInput] = React.useState(
    () => new URLSearchParams(window.location.search).get("code") || "",
  );
  const [teamName, setTeamName] = React.useState("");
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  const { docs: games } = useLiveQuery("code", {
    key: activeCode || "__none__",
  });
  const game = games.find((g) => g.type === "game");
  const { docs: questions } = useLiveQuery("_id", {
    key: game?.currentQuestionId || "__none__",
  });
  const currentQ = questions.find((q) => q.type === "question");
  const { docs: myAnswers } = useLiveQuery("teamId", {
    key: teamId || "__none__",
  });
  const myAnswer = myAnswers.find((a) => a.questionId === currentQ?._id);
  const remaining = game?.revealAt
    ? Math.max(0, Math.ceil((game.revealAt + 20000 - now) / 1000))
    : 0;
  const locked = remaining === 0 || !!myAnswer || game?.showAnswer;

  async function joinGame() {
    if (codeInput.length !== 4 || !teamName.trim()) return;
    const { docs } = await database.query("code", {
      key: codeInput.toUpperCase(),
    });
    if (!docs.find((d) => d.type === "game")) {
      alert("Game not found");
      return;
    }
    const res = await database.put({
      type: "team",
      gameCode: codeInput.toUpperCase(),
      name: teamName,
      score: 0,
      createdAt: Date.now(),
    });
    setActiveCode(codeInput.toUpperCase());
    setTeamId(res.id);
  }

  async function pickOption(idx) {
    if (locked || !currentQ || !teamId) return;
    await database.put({
      type: "answer",
      gameCode: activeCode,
      teamId,
      questionId: currentQ._id,
      optionIndex: idx,
      at: Date.now(),
    });
  }

  return (
    <section id="join-panel" className={c.section}>
      <h2 className={c.h2}>{teamId ? "Playing" : "Join Game"}</h2>
      {!teamId && (
        <div className="space-y-3">
          <input
            className={c.input}
            placeholder="4-LETTER CODE"
            maxLength={4}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <input
            className={c.input}
            placeholder="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <button className={c.btn} onClick={joinGame}>
            Join
          </button>
        </div>
      )}
      {teamId && !currentQ && (
        <p className="text-center text-[#c9a96a] italic py-6">
          Waiting for host to start…
        </p>
      )}
      {teamId && currentQ && (
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs uppercase tracking-wider text-[#c9a96a]">
              Question
            </span>
            <span
              className={`text-2xl font-black ${remaining <= 5 ? "text-[#a83232]" : "text-[#e8b948]"}`}
            >
              {remaining}s
            </span>
          </div>
          <p className="text-lg font-bold text-[#f4e8d0]">{currentQ.prompt}</p>
          <div className="space-y-2">
            {currentQ.options.map((opt, i) => {
              const isMine = myAnswer?.optionIndex === i;
              const isCorrect = game.showAnswer && i === currentQ.correctIndex;
              const isWrongPick =
                game.showAnswer && isMine && i !== currentQ.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => pickOption(i)}
                  disabled={locked}
                  className={`w-full min-h-[52px] text-left px-4 py-3 border-[3px] border-[#0f1614] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-70
                    ${isCorrect ? "bg-[#5a8a3a] text-[#f4e8d0]" : isWrongPick ? "bg-[#a83232] text-[#f4e8d0]" : isMine ? "bg-[#e8b948] text-[#1a221f]" : "bg-[#1a221f] text-[#f4e8d0]"}`}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function HostPanel({ c, database, useLiveQuery, activeCode, setActiveCode }) {
  const [gameName, setGameName] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [genLoading, setGenLoading] = React.useState(false);
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const game = games.find((g) => g.code === activeCode);
  const { docs: questions } = useLiveQuery("gameCode", {
    key: activeCode || "__none__",
  });
  const sortedQs = [...questions]
    .filter((q) => q.type === "question")
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const currentIdx = game
    ? sortedQs.findIndex((q) => q._id === game.currentQuestionId)
    : -1;
  const currentQ = sortedQs[currentIdx];

  async function createGame() {
    if (!gameName.trim()) return;
    const code = Array.from(
      { length: 4 },
      () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)],
    ).join("");
    await database.put({
      type: "game",
      code,
      name: gameName,
      status: "lobby",
      currentQuestionId: null,
      revealAt: null,
      showAnswer: false,
      createdAt: Date.now(),
    });
    setActiveCode(code);
    setGameName("");
  }

  async function generateQuestions() {
    if (!topic.trim() || !activeCode) return;
    setGenLoading(true);
    try {
      const res = await callAI(
        `Generate 10 trivia questions about: ${topic}. Each has a prompt, 4 options, and one correctIndex (0-3).`,
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
      const baseOrder = sortedQs.length;
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        await database.put({
          type: "question",
          gameCode: activeCode,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          order: baseOrder + i,
        });
      }
      setTopic("");
    } finally {
      setGenLoading(false);
    }
  }

  async function nextQuestion() {
    if (!game) return;
    const next = sortedQs[currentIdx + 1] || sortedQs[0];
    if (!next) return;
    await database.put({
      ...game,
      currentQuestionId: next._id,
      revealAt: Date.now(),
      showAnswer: false,
      status: "playing",
    });
  }

  async function showAnswer() {
    if (!game || !currentQ) return;
    await database.put({ ...game, showAnswer: true });
    const { docs: answers } = await database.query("questionId", {
      key: currentQ._id,
    });
    const { docs: teams } = await database.query("type", { key: "team" });
    for (const ans of answers.filter(
      (a) => a.type === "answer" && a.gameCode === activeCode,
    )) {
      if (ans.optionIndex === currentQ.correctIndex) {
        const team = teams.find((t) => t._id === ans.teamId);
        if (team && !ans.scored) {
          await database.put({ ...team, score: (team.score || 0) + 10 });
          await database.put({ ...ans, scored: true });
        }
      }
    }
  }

  return (
    <section id="host-panel" className={c.section}>
      <h2 className={c.h2}>Host Control</h2>
      {!activeCode && (
        <div className="space-y-3">
          <input
            className={c.input}
            placeholder="Game name"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />
          <button className={c.btn} onClick={createGame}>
            Create Game
          </button>
        </div>
      )}
      {activeCode && game && (
        <div className="space-y-3">
          <div className="bg-[#1a221f] border-[3px] border-dashed border-[#c9a96a]/40 rounded p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#c9a96a]">
              {game.name} · Join code
            </p>
            <p className="text-5xl font-black tracking-[0.3em] text-[#e8b948] my-2 [text-shadow:_2px_2px_0_#0a100e]">
              {activeCode}
            </p>
            <img
              alt="QR"
              className="w-32 h-32 mx-auto bg-[#f4e8d0] p-1 rounded"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + "?code=" + activeCode)}`}
            />
          </div>
          <div className="border-t-2 border-dashed border-[#c9a96a]/40 pt-3 space-y-2">
            <h3 className="text-sm uppercase tracking-wider text-[#c9a96a]">
              Deck ({sortedQs.length})
            </h3>
            <input
              className={c.input}
              placeholder="Topic (e.g. 90s movies)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button
              className={c.btnAmber}
              onClick={generateQuestions}
              disabled={genLoading}
            >
              {genLoading ? (
                <svg
                  className="animate-spin inline w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              ) : (
                "✨ Generate 10 Questions"
              )}
            </button>
            {sortedQs.length === 0 && (
              <p className="text-xs text-[#c9a96a]/60 italic">
                No questions yet.
              </p>
            )}
            {currentQ && (
              <p className="text-xs text-[#c9a96a]">
                On Q{currentIdx + 1}: {currentQ.prompt}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              className={c.btn}
              onClick={nextQuestion}
              disabled={!sortedQs.length}
            >
              Next Question
            </button>
            <button
              className={c.btnAmber}
              onClick={showAnswer}
              disabled={!currentQ || game.showAnswer}
            >
              Show Answer
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("pub-quiz-live");
  const [mode, setMode] = React.useState(null);
  const [activeCode, setActiveCode] = React.useState(null);
  const [teamId, setTeamId] = React.useState(null);
  const c = {
    page: "min-h-screen bg-[#1e2a26] bg-[radial-gradient(ellipse_at_top,_#2d3d37_0%,_#1a221f_70%)] text-[#f4e8d0] font-sans pb-24",
    header:
      "px-5 pt-6 pb-4 border-b-[3px] border-[#0f1614] bg-[#161f1c] shadow-[0_4px_0_#0a100e]",
    title:
      "text-3xl font-black uppercase tracking-tight text-[#f4e8d0] [text-shadow:_2px_2px_0_#a83232]",
    tagline: "text-xs uppercase tracking-[0.2em] text-[#c9a96a] mt-1",
    main: "px-4 py-5 max-w-2xl mx-auto space-y-5",
    section:
      "bg-[#243430] border-[3px] border-[#0f1614] rounded p-4 shadow-[4px_4px_0_#0a100e]",
    h2: "text-xl font-black uppercase tracking-wide text-[#e8b948] mb-3 border-b-2 border-dashed border-[#c9a96a]/40 pb-2",
    btn: "min-h-[52px] px-5 py-3 bg-[#a83232] text-[#f4e8d0] font-black uppercase tracking-wider border-[3px] border-[#0f1614] rounded shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnAmber:
      "min-h-[52px] px-5 py-3 bg-[#e8b948] text-[#1a221f] font-black uppercase tracking-wider border-[3px] border-[#0f1614] rounded shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnGhost:
      "min-h-[44px] px-4 py-2 bg-transparent text-[#c9a96a] font-bold uppercase tracking-wide border-[2px] border-[#c9a96a]/50 rounded active:bg-[#c9a96a]/10",
    input:
      "w-full min-h-[48px] px-3 py-2 bg-[#1a221f] text-[#f4e8d0] placeholder-[#c9a96a]/40 border-[3px] border-[#0f1614] rounded font-mono uppercase tracking-wider focus:border-[#e8b948] outline-none",
  };
  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Pub Quiz Live</h1>
        <p className={c.tagline}>// chalkboard trivia, live across phones</p>
      </header>
      <main id="app" className={c.main}>
        {!mode && (
          <section id="landing" className={c.section}>
            <h2 className={c.h2}>Trivia Night</h2>
            <p className="text-sm text-[#c9a96a] mb-4">
              Pick a side of the chalkboard.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button className={c.btn} onClick={() => setMode("host")}>
                Host
              </button>
              <button className={c.btnAmber} onClick={() => setMode("join")}>
                Join
              </button>
            </div>
          </section>
        )}
        {mode && (
          <button
            className={c.btnGhost}
            onClick={() => {
              setMode(null);
              setActiveCode(null);
              setTeamId(null);
            }}
          >
            ← Back
          </button>
        )}
        {mode === "host" && (
          <HostPanel
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            activeCode={activeCode}
            setActiveCode={setActiveCode}
          />
        )}
        {mode === "join" && (
          <JoinPanel
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            activeCode={activeCode}
            setActiveCode={setActiveCode}
            teamId={teamId}
            setTeamId={setTeamId}
          />
        )}
        {mode && activeCode && (
          <Leaderboard
            c={c}
            useLiveQuery={useLiveQuery}
            activeCode={activeCode}
            teamId={teamId}
          />
        )}
      </main>
    </div>
  );
}
