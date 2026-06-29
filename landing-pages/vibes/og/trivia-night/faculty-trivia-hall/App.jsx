import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++)
    s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function Leaderboard({ c, useLiveQuery, activeGameId }) {
  const { docs } = useLiveQuery("gameId", { key: activeGameId });
  const teams = docs
    .filter((d) => d.type === "team")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <section id="leaderboard" className={c.section}>
      <h2 className={c.h2}>Leaderboard</h2>
      {teams.length === 0 ? (
        <p className="italic">No teams have joined yet.</p>
      ) : (
        <ol className="space-y-2">
          {teams.map((t, i) => (
            <li
              key={t._id}
              className="flex justify-between items-center border-b border-[#b8893a]/40 pb-2"
            >
              <span className="flex items-center gap-3">
                <span className="text-[#b8893a] font-bold">#{i + 1}</span>
                <span className={c.badge}>{t.name}</span>
              </span>
              <span className="text-xl font-bold tabular-nums">
                {t.score || 0}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function JoinView({
  c,
  database,
  useLiveQuery,
  activeGameId,
  setActiveGameId,
  activeTeamId,
  setActiveTeamId,
}) {
  const [code, setCode] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const game = games.find((g) => g._id === activeGameId);
  const { docs: gameDocs } = useLiveQuery("gameId", {
    key: activeGameId || "__none__",
  });
  const question = game?.currentQuestionId
    ? gameDocs.find(
        (d) => d._id === game.currentQuestionId && d.type === "question",
      )
    : null;
  const myAnswer = gameDocs.find(
    (d) =>
      d.type === "answer" &&
      d.teamId === activeTeamId &&
      d.questionId === game?.currentQuestionId,
  );
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const remaining = game?.revealAt
    ? Math.max(0, Math.ceil((game.revealAt - now) / 1000))
    : 0;
  const locked = remaining === 0 || game?.status === "revealed";

  async function join(e) {
    e.preventDefault();
    const target = games.find((g) => g.code === code.toUpperCase());
    if (!target || !teamName.trim()) return;
    const res = await database.put({
      type: "team",
      gameId: target._id,
      name: teamName,
      score: 0,
      createdAt: Date.now(),
    });
    setActiveGameId(target._id);
    setActiveTeamId(res.id);
  }

  async function pick(i) {
    if (locked || myAnswer) return;
    await database.put({
      type: "answer",
      teamId: activeTeamId,
      questionId: question._id,
      gameId: activeGameId,
      optionIndex: i,
      createdAt: Date.now(),
    });
  }

  if (!activeTeamId) {
    return (
      <section id="join" className={c.section}>
        <h2 className={c.h2}>Join the Game</h2>
        <form className="space-y-3" onSubmit={join}>
          <input
            className={c.input}
            placeholder="4-letter code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <input
            className={c.input}
            placeholder="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <button type="submit" className={c.btn}>
            Take a Seat
          </button>
        </form>
      </section>
    );
  }

  return (
    <section id="join" className={c.section}>
      <h2 className={c.h2}>{game?.name}</h2>
      {!question ? (
        <div className="bg-[#fdf6e3] border border-[#b8893a] p-4 text-center italic">
          Waiting for the host…
        </div>
      ) : (
        <div>
          <div className="flex justify-between mb-3">
            <span className={c.badge}>Time: {remaining}s</span>
            <span className={c.badge}>{locked ? "Locked" : "Open"}</span>
          </div>
          <p className="text-xl font-bold mb-4">{question.prompt}</p>
          <div className="grid grid-cols-1 gap-2">
            {question.options.map((o, i) => {
              const isMine = myAnswer?.optionIndex === i;
              const isCorrect =
                game.status === "revealed" && i === question.correctIndex;
              const isWrong =
                game.status === "revealed" &&
                isMine &&
                i !== question.correctIndex;
              return (
                <button
                  key={i}
                  disabled={locked || !!myAnswer}
                  onClick={() => pick(i)}
                  className={`${c.btn} ${isCorrect ? "!bg-green-700" : ""} ${isWrong ? "!bg-red-900" : ""} ${isMine ? "ring-4 ring-[#e8c87a]" : ""}`}
                >
                  {"ABCD"[i]}. {o}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function HostView({
  c,
  database,
  useLiveQuery,
  activeGameId,
  setActiveGameId,
}) {
  const [gameName, setGameName] = React.useState("");
  const [qPrompt, setQPrompt] = React.useState("");
  const [opts, setOpts] = React.useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = React.useState(0);
  const [topic, setTopic] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const game = games.find((g) => g._id === activeGameId);
  const { docs: questions } = useLiveQuery("gameId", {
    key: activeGameId || "__none__",
  });
  const qList = questions.filter((d) => d.type === "question");

  async function createGame(e) {
    e.preventDefault();
    if (!gameName.trim()) return;
    const code = makeCode();
    const res = await database.put({
      type: "game",
      code,
      name: gameName,
      currentQuestionId: null,
      revealAt: null,
      status: "lobby",
      createdAt: Date.now(),
    });
    setActiveGameId(res.id);
    setGameName("");
  }

  async function addQuestion(e) {
    e.preventDefault();
    if (!qPrompt.trim() || !activeGameId) return;
    await database.put({
      type: "question",
      gameId: activeGameId,
      prompt: qPrompt,
      options: opts,
      correctIndex: correctIdx,
      createdAt: Date.now(),
    });
    setQPrompt("");
    setOpts(["", "", "", ""]);
    setCorrectIdx(0);
  }

  async function generateAI() {
    if (!topic.trim() || !activeGameId) return;
    setAiLoading(true);
    try {
      const res = await callAI(
        `Generate 10 trivia questions about ${topic}. Each has a prompt, 4 options, and the index (0-3) of the correct one.`,
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
        await database.put({
          type: "question",
          gameId: activeGameId,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          createdAt: Date.now(),
        });
      }
      setTopic("");
    } finally {
      setAiLoading(false);
    }
  }

  async function nextQuestion() {
    if (!game) return;
    const answered = new Set([game.currentQuestionId].filter(Boolean));
    const next = qList.find(
      (q) => !answered.has(q._id) && q._id !== game.currentQuestionId,
    );
    if (!next) return;
    await database.put({
      ...game,
      currentQuestionId: next._id,
      revealAt: Date.now() + 20000,
      status: "playing",
    });
  }

  async function showAnswer() {
    if (!game || !game.currentQuestionId) return;
    const q = qList.find((x) => x._id === game.currentQuestionId);
    if (!q) return;
    const allAnswers = await database.query("questionId", {
      key: game.currentQuestionId,
    });
    const answers = allAnswers.rows
      .map((r) => r.doc)
      .filter((d) => d?.type === "answer");
    const teamsRes = await database.query("gameId", { key: game._id });
    const teams = teamsRes.rows
      .map((r) => r.doc)
      .filter((d) => d?.type === "team");
    for (const a of answers) {
      if (a.optionIndex === q.correctIndex) {
        const t = teams.find((x) => x._id === a.teamId);
        if (t) await database.put({ ...t, score: (t.score || 0) + 1 });
      }
    }
    await database.put({ ...game, status: "revealed" });
  }

  return (
    <section id="host" className={c.section}>
      <h2 className={c.h2}>Host Control Room</h2>
      {!game ? (
        <form className="space-y-3" onSubmit={createGame}>
          <input
            className={c.input}
            placeholder="Name your trivia night"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />
          <button type="submit" className={c.btn}>
            Create Game
          </button>
        </form>
      ) : (
        <>
          <div className="bg-[#fdf6e3] border border-[#b8893a] p-4 mb-4 text-center">
            <p className="text-xs uppercase tracking-wider">Join Code</p>
            <p className="text-4xl font-bold tracking-[0.3em] my-2">
              {game.code}
            </p>
            <img
              alt="QR"
              className="mx-auto"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.href + "?code=" + game.code)}`}
            />
          </div>
          <div className="mb-4">
            <h3 className="font-bold uppercase text-sm mb-2">
              Question Deck ({qList.length})
            </h3>
            <form className="space-y-2 mb-3" onSubmit={addQuestion}>
              <input
                className={c.input}
                placeholder="Question prompt"
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                {opts.map((o, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctIdx === i}
                      onChange={() => setCorrectIdx(i)}
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
                  </label>
                ))}
              </div>
              <button type="submit" className={c.btnGhost}>
                Add Question
              </button>
            </form>
            <div className="flex gap-2 mb-3">
              <input
                className={c.input}
                placeholder="Topic for AI generation"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <button
                className={c.btn}
                disabled={aiLoading}
                onClick={generateAI}
              >
                {aiLoading ? (
                  <svg
                    className="animate-spin inline"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <circle cx="12" cy="12" r="9" strokeDasharray="42" />
                  </svg>
                ) : (
                  "Generate 10"
                )}
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {qList.length === 0 && (
                <li className="italic">No questions yet.</li>
              )}
              {qList.map((q) => (
                <li
                  key={q._id}
                  className={
                    game.currentQuestionId === q._id ? "font-bold" : ""
                  }
                >
                  • {q.prompt}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button className={c.btn} onClick={nextQuestion}>
              Next Question
            </button>
            <button className={c.btn} onClick={showAnswer}>
              Show Answer
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("quizzo-tavern");
  const [view, setView] = React.useState("landing");
  const [activeGameId, setActiveGameId] = React.useState(null);
  const [activeTeamId, setActiveTeamId] = React.useState(null);
  const c = {
    page: "min-h-screen bg-[#5a1a1f] text-[#f4e9d2] font-serif",
    header:
      "bg-[#3d0f12] border-b-4 border-[#b8893a] px-4 py-4 flex items-center justify-between",
    title: "text-2xl md:text-3xl font-bold tracking-tight text-[#e8c87a]",
    tagline: "text-xs uppercase tracking-[0.2em] text-[#b8893a]",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    section:
      "bg-[#f4e9d2] text-[#3d0f12] border-2 border-[#b8893a] rounded-sm shadow-lg p-5",
    h2: "text-xl font-bold border-b border-[#b8893a] pb-2 mb-4 uppercase tracking-wider",
    btn: "min-h-[48px] px-5 py-3 bg-[#3d0f12] text-[#e8c87a] border-2 border-[#b8893a] rounded-sm font-bold uppercase tracking-wider hover:bg-[#5a1a1f] active:translate-y-px",
    btnGhost:
      "min-h-[44px] px-4 py-2 bg-transparent text-[#3d0f12] border border-[#b8893a] rounded-sm hover:bg-[#e8c87a]/30",
    input:
      "w-full min-h-[48px] px-3 py-2 bg-[#fdf6e3] border-2 border-[#b8893a] rounded-sm text-[#3d0f12] focus:outline-none focus:border-[#3d0f12]",
    badge:
      "inline-block px-3 py-1 bg-[#b8893a] text-[#3d0f12] font-bold rounded-sm border border-[#3d0f12]",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Quizzo Tavern</h1>
          <p className={c.tagline}>A scholarly trivia evening</p>
        </div>
      </header>
      <main id="app" className={c.main}>
        {view === "landing" && (
          <section id="landing" className={c.section}>
            <h2 className={c.h2}>Welcome, scholars</h2>
            <p className="mb-4 italic">
              Choose your role for tonight's gathering.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button className={c.btn} onClick={() => setView("host")}>
                Host a Game
              </button>
              <button className={c.btn} onClick={() => setView("join")}>
                Join a Game
              </button>
            </div>
          </section>
        )}
        {view === "host" && (
          <HostView
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            activeGameId={activeGameId}
            setActiveGameId={setActiveGameId}
          />
        )}
        {view === "join" && (
          <JoinView
            c={c}
            database={database}
            useLiveQuery={useLiveQuery}
            activeGameId={activeGameId}
            setActiveGameId={setActiveGameId}
            activeTeamId={activeTeamId}
            setActiveTeamId={setActiveTeamId}
          />
        )}
        {activeGameId && (
          <Leaderboard
            c={c}
            useLiveQuery={useLiveQuery}
            activeGameId={activeGameId}
          />
        )}
      </main>
    </div>
  );
}
