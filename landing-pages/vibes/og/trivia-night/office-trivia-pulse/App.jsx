import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";

function Leaderboard({ c, useLiveQuery, gameId, mode }) {
  const { docs: teams } = useLiveQuery("teamGameId", {
    key: gameId || "__none__",
  });
  if (!gameId || mode === "landing") return null;
  const sorted = [...teams].sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <section id="leaderboard" className={c.section}>
      <h2 className={c.h2}>Leaderboard</h2>
      {sorted.length === 0 && <p className={c.muted}>No teams yet.</p>}
      {sorted.map((t, i) => (
        <div key={t._id} className={c.row}>
          <span>
            <span className="font-mono text-[#64748b] mr-3">{i + 1}</span>
            {t.name}
          </span>
          <span className="font-mono font-bold text-[#3b82f6]">
            {t.score || 0}
          </span>
        </div>
      ))}
    </section>
  );
}

function JoinPanel({ c, database, useLiveQuery, teamId, setTeamId, onBack }) {
  const [code, setCode] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const { docs: games } = useLiveQuery("code", { key: code.toUpperCase() });
  const game = games[0];
  const [teamDoc, setTeamDoc] = React.useState(null);
  const [question, setQuestion] = React.useState(null);
  const [remaining, setRemaining] = React.useState(0);
  const [picked, setPicked] = React.useState(null);

  React.useEffect(() => {
    if (!teamId) return;
    database
      .get(teamId)
      .then(setTeamDoc)
      .catch(() => {});
    const sub = database.subscribe(
      () =>
        database
          .get(teamId)
          .then(setTeamDoc)
          .catch(() => {}),
      true,
    );
    return () => sub && sub();
  }, [teamId, database]);

  React.useEffect(() => {
    if (!game?.currentQuestionId) {
      setQuestion(null);
      return;
    }
    database
      .get(game.currentQuestionId)
      .then(setQuestion)
      .catch(() => {});
    setPicked(null);
  }, [game?.currentQuestionId, database]);

  React.useEffect(() => {
    if (!game?.revealAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((game.revealAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game?.revealAt]);

  async function joinGame() {
    if (!game || !teamName.trim()) return;
    const ok = await database.put({
      type: "team",
      teamGameId: game._id,
      name: teamName,
      score: 0,
      createdAt: Date.now(),
    });
    setTeamId(ok.id);
  }

  async function pickOption(idx) {
    if (!question || !teamId || remaining === 0 || picked !== null) return;
    setPicked(idx);
    await database.put({
      type: "answer",
      answerQid: question._id,
      teamId,
      gameId: game._id,
      optionIndex: idx,
      createdAt: Date.now(),
    });
  }

  return (
    <section id="join" className={c.section}>
      <h2 className={c.h2}>Join Game</h2>
      <div className="space-y-3">
        {!teamId && (
          <>
            <input
              className={
                c.input +
                " font-mono uppercase tracking-[0.3em] text-center text-xl"
              }
              maxLength={4}
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            {code.length === 4 && !game && (
              <p className={c.muted}>No game found for that code.</p>
            )}
            {game && (
              <p className={c.muted}>
                Found: <strong>{game.name}</strong>
              </p>
            )}
            <input
              className={c.input}
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <button
              className={c.btnPrimary}
              disabled={!game || !teamName.trim()}
              onClick={joinGame}
            >
              Join
            </button>
          </>
        )}
        {teamId && teamDoc && (
          <>
            <p className={c.muted}>
              Playing as <strong>{teamDoc.name}</strong> · Score:{" "}
              <span className="font-mono text-[#3b82f6] font-bold">
                {teamDoc.score || 0}
              </span>
            </p>
            {!question && (
              <p className={c.muted}>
                Waiting for host to start the next question…
              </p>
            )}
            {question && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-semibold">{question.prompt}</p>
                  <span className="font-mono font-bold text-2xl text-[#3b82f6]">
                    {remaining}s
                  </span>
                </div>
                {question.options.map((opt, i) => {
                  const isCorrect =
                    game.answerShown && i === question.correctIndex;
                  const isPicked = picked === i;
                  const wrong =
                    game.answerShown && isPicked && i !== question.correctIndex;
                  return (
                    <button
                      key={i}
                      disabled={remaining === 0 || picked !== null}
                      onClick={() => pickOption(i)}
                      className={`w-full min-h-[48px] text-left px-4 border-[3px] border-[#0f172a] rounded-[4px] font-medium transition-all ${isCorrect ? "bg-[#22c55e] text-white" : wrong ? "bg-[#ef4444] text-white" : isPicked ? "bg-[#3b82f6] text-white" : "bg-white"} ${remaining === 0 || picked !== null ? "opacity-70" : "active:translate-x-[2px] active:translate-y-[2px]"}`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        <button className={c.btnGhost} onClick={onBack}>
          ← Back
        </button>
      </div>
    </section>
  );
}

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from(
    { length: 4 },
    () => letters[Math.floor(Math.random() * letters.length)],
  ).join("");
}

function HostPanel({ c, database, useLiveQuery, gameId, setGameId, onBack }) {
  const [name, setName] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [q, setQ] = React.useState({
    prompt: "",
    a: "",
    b: "",
    c: "",
    d: "",
    correctIndex: 0,
  });

  const { docs: questions } = useLiveQuery("gameId", {
    key: gameId || "__none__",
  });
  const { docs: teams } = useLiveQuery("teamGameId", {
    key: gameId || "__none__",
  });
  const [gameDoc, setGameDoc] = React.useState(null);
  React.useEffect(() => {
    if (!gameId) return;
    const sub = database.subscribe(async () => {
      try {
        setGameDoc(await database.get(gameId));
      } catch {}
    }, true);
    database
      .get(gameId)
      .then(setGameDoc)
      .catch(() => {});
    return () => sub && sub();
  }, [gameId, database]);

  async function createGame() {
    const code = makeCode();
    const ok = await database.put({
      type: "game",
      code,
      name: name || "Trivia Night",
      status: "lobby",
      currentQuestionId: null,
      revealAt: null,
      answerShown: false,
      createdAt: Date.now(),
    });
    setGameId(ok.id);
  }

  async function addQuestion() {
    if (!q.prompt.trim() || !gameId) return;
    await database.put({
      type: "question",
      gameId,
      prompt: q.prompt,
      options: [q.a, q.b, q.c, q.d],
      correctIndex: Number(q.correctIndex),
      createdAt: Date.now(),
    });
    setQ({ prompt: "", a: "", b: "", c: "", d: "", correctIndex: 0 });
  }

  async function genAI() {
    if (!topic.trim() || !gameId) return;
    setAiLoading(true);
    try {
      const res = await callAI(
        `Generate 10 trivia questions about ${topic}. Each has prompt, 4 options, and correctIndex (0-3).`,
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
      const { questions: qs } = JSON.parse(res);
      for (const item of qs) {
        await database.put({
          type: "question",
          gameId,
          prompt: item.prompt,
          options: item.options,
          correctIndex: item.correctIndex,
          createdAt: Date.now(),
        });
      }
      setTopic("");
    } finally {
      setAiLoading(false);
    }
  }

  async function nextQuestion() {
    if (!gameDoc) return;
    const asked = new Set(gameDoc.askedIds || []);
    const next = questions.find((x) => !asked.has(x._id));
    if (!next) return;
    await database.put({
      ...gameDoc,
      currentQuestionId: next._id,
      revealAt: Date.now() + 20000,
      answerShown: false,
      status: "playing",
      askedIds: [...asked, next._id],
    });
  }

  async function showAnswer() {
    if (!gameDoc?.currentQuestionId) return;
    const cur = await database.get(gameDoc.currentQuestionId);
    const { docs: answers } = await database.query("answerQid", {
      key: cur._id,
    });
    for (const ans of answers) {
      if (ans.optionIndex === cur.correctIndex) {
        const team = await database.get(ans.teamId);
        await database.put({ ...team, score: (team.score || 0) + 1 });
      }
    }
    await database.put({ ...gameDoc, answerShown: true });
  }

  return (
    <section id="host" className={c.section}>
      <h2 className={c.h2}>Host Control</h2>
      <div className="space-y-3">
        {!gameId && (
          <>
            <input
              className={c.input}
              placeholder="Game name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className={c.btnPrimary} onClick={createGame}>
              Create Game
            </button>
          </>
        )}
        {gameId && gameDoc && (
          <>
            <div className="border-[3px] border-[#0f172a] rounded-[4px] p-4 bg-[#f1f5f9]">
              <p className={c.muted}>Join code</p>
              <p className="font-mono font-bold text-4xl tracking-[0.3em] text-[#3b82f6]">
                {gameDoc.code}
              </p>
              <img
                alt="qr"
                className="mt-2 border-[2px] border-[#0f172a]"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.href + "?code=" + gameDoc.code : gameDoc.code)}`}
              />
              <p className={c.muted + " mt-2"}>Teams joined: {teams.length}</p>
            </div>
            <div className="border-t-[2px] border-[#0f172a] pt-3 mt-3 space-y-2">
              <p className={c.muted}>Deck ({questions.length} questions)</p>
              <input
                className={c.input}
                placeholder="Question prompt"
                value={q.prompt}
                onChange={(e) => setQ({ ...q, prompt: e.target.value })}
              />
              <input
                className={c.input}
                placeholder="Option A"
                value={q.a}
                onChange={(e) => setQ({ ...q, a: e.target.value })}
              />
              <input
                className={c.input}
                placeholder="Option B"
                value={q.b}
                onChange={(e) => setQ({ ...q, b: e.target.value })}
              />
              <input
                className={c.input}
                placeholder="Option C"
                value={q.c}
                onChange={(e) => setQ({ ...q, c: e.target.value })}
              />
              <input
                className={c.input}
                placeholder="Option D"
                value={q.d}
                onChange={(e) => setQ({ ...q, d: e.target.value })}
              />
              <select
                className={c.input}
                value={q.correctIndex}
                onChange={(e) => setQ({ ...q, correctIndex: e.target.value })}
              >
                <option value="0">Correct: A</option>
                <option value="1">Correct: B</option>
                <option value="2">Correct: C</option>
                <option value="3">Correct: D</option>
              </select>
              <button className={c.btnGhost} onClick={addQuestion}>
                Add Question
              </button>
              <input
                className={c.input}
                placeholder="Topic for AI"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <button
                className={c.btnGhost}
                disabled={aiLoading}
                onClick={genAI}
              >
                {aiLoading ? (
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
                      <circle cx="12" cy="12" r="9" strokeDasharray="40 60" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  "Generate 10 with AI"
                )}
              </button>
            </div>
            <div className="border-t-[2px] border-[#0f172a] pt-3 mt-3 space-y-2">
              <button className={c.btnPrimary} onClick={nextQuestion}>
                Next Question
              </button>
              <button className={c.btnGhost} onClick={showAnswer}>
                Show Answer
              </button>
            </div>
          </>
        )}
        <button className={c.btnGhost} onClick={onBack}>
          ← Back
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("triviaroom");
  const [mode, setMode] = React.useState("landing");
  const [gameId, setGameId] = React.useState(null);
  const [teamId, setTeamId] = React.useState(null);

  const c = {
    page: "min-h-screen bg-[#f1f5f9] text-[#0f172a] font-['Inter',sans-serif] pb-24",
    header:
      "bg-white border-b-[3px] border-[#0f172a] px-5 py-4 sticky top-0 z-10 shadow-[4px_4px_0px_#0f172a]",
    title: "text-2xl font-bold tracking-tight uppercase",
    tagline: "text-[0.7rem] uppercase tracking-[0.15em] text-[#64748b] mt-1",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section:
      "bg-white border-[3px] border-[#0f172a] rounded-[4px] p-5 shadow-[4px_4px_0px_#0f172a]",
    h2: "text-sm font-bold uppercase tracking-[0.1em] mb-4 text-[#0f172a]",
    btnPrimary:
      "w-full min-h-[48px] bg-[#3b82f6] text-white font-semibold uppercase tracking-wide border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnGhost:
      "w-full min-h-[48px] bg-white text-[#0f172a] font-semibold uppercase tracking-wide border-[3px] border-[#0f172a] rounded-[4px] active:translate-x-[2px] active:translate-y-[2px] transition-all",
    input:
      "w-full min-h-[48px] px-3 bg-white border-[3px] border-[#0f172a] rounded-[4px] text-[#0f172a] font-medium focus:outline-none focus:shadow-[4px_4px_0px_#3b82f6]",
    row: "flex items-center justify-between px-3 py-3 bg-white border-[2px] border-[#0f172a] rounded-[4px] mb-2",
    muted: "text-[#64748b] text-sm",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>TriviaRoom</h1>
        <p className={c.tagline}>Live team trivia · sync across phones</p>
      </header>
      <main id="app" className={c.main}>
        {mode === "landing" && (
          <section id="landing" className={c.section}>
            <h2 className={c.h2}>Welcome</h2>
            <p className={c.muted + " mb-5"}>
              Run a live trivia night or join one in progress.
            </p>
            <div className="space-y-3">
              <button className={c.btnPrimary} onClick={() => setMode("host")}>
                Host a Game
              </button>
              <button className={c.btnGhost} onClick={() => setMode("join")}>
                Join with Code
              </button>
            </div>
          </section>
        )}
        {mode === "host" && (
          <HostPanel
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            gameId={gameId}
            setGameId={setGameId}
            onBack={() => setMode("landing")}
          />
        )}
        {mode === "join" && (
          <JoinPanel
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            teamId={teamId}
            setTeamId={setTeamId}
            onBack={() => setMode("landing")}
          />
        )}
        <Leaderboard
          c={c}
          useLiveQuery={useLiveQuery}
          gameId={gameId}
          mode={mode}
        />
      </main>
    </div>
  );
}
