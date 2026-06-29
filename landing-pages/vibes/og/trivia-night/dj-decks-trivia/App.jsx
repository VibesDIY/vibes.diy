import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";

function makeCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from(
    { length: 4 },
    () => a[Math.floor(Math.random() * a.length)],
  ).join("");
}

export default function App() {
  const [mode, setMode] = React.useState(null);
  const { database, useLiveQuery, useDocument } = useFireproof("pulse-trivia");
  const [hostGameId, setHostGameId] = React.useState(null);
  const [gameName, setGameName] = React.useState("");
  const [aiTopic, setAiTopic] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const {
    doc: qDraft,
    merge: mergeQ,
    reset: resetQ,
  } = useDocument({
    type: "question",
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    gameId: "",
  });
  const { docs: hostGameDocs } = useLiveQuery("_id", { key: hostGameId });
  const hostGame = hostGameDocs[0];
  const { docs: hostQuestions } = useLiveQuery("gameId", {
    key: hostGameId || "__none__",
  });
  const { docs: hostTeams } = useLiveQuery(
    (d) =>
      d.type === "team" && d.gameId === hostGameId ? d.gameId : undefined,
    { key: hostGameId || "__none__" },
  );
  const { docs: hostAnswers } = useLiveQuery(
    (d) =>
      d.type === "answer" && d.gameId === hostGameId ? d.gameId : undefined,
    { key: hostGameId || "__none__" },
  );

  async function createGame() {
    const code = makeCode();
    const r = await database.put({
      type: "game",
      code,
      name: gameName || "Untitled",
      currentQuestionId: null,
      revealAt: null,
      status: "lobby",
      createdAt: Date.now(),
    });
    setHostGameId(r.id);
    setGameName("");
  }
  async function addQuestion(e) {
    e.preventDefault();
    if (!hostGameId || !qDraft.prompt.trim()) return;
    await database.put({
      ...qDraft,
      gameId: hostGameId,
      createdAt: Date.now(),
    });
    resetQ();
  }
  async function aiGenerate() {
    if (!hostGameId || !aiTopic.trim()) return;
    setAiLoading(true);
    try {
      const raw = await callAI(
        `Generate 10 trivia questions about ${aiTopic}. Each has prompt, 4 options, one correctIndex (0-3).`,
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
      const parsed = JSON.parse(raw);
      for (const q of (parsed.questions || []).slice(0, 10)) {
        await database.put({
          type: "question",
          prompt: q.prompt,
          options: q.options.slice(0, 4),
          correctIndex: q.correctIndex | 0,
          gameId: hostGameId,
          createdAt: Date.now(),
        });
      }
      setAiTopic("");
    } finally {
      setAiLoading(false);
    }
  }
  async function nextQuestion() {
    if (!hostGame) return;
    const answered = new Set(hostAnswers.map((a) => a.questionId));
    const next = hostQuestions.find(
      (q) => !answered.has(q._id) && q._id !== hostGame.currentQuestionId,
    );
    if (!next) return;
    await database.put({
      ...hostGame,
      currentQuestionId: next._id,
      revealAt: Date.now() + 20000,
      status: "active",
      showAnswer: false,
    });
  }
  async function showAnswer() {
    if (!hostGame || !hostGame.currentQuestionId) return;
    await database.put({ ...hostGame, showAnswer: true });
    const q = hostQuestions.find((x) => x._id === hostGame.currentQuestionId);
    if (!q) return;
    const ansForQ = hostAnswers.filter((a) => a.questionId === q._id);
    for (const t of hostTeams) {
      const a = ansForQ.find((x) => x.teamId === t._id);
      if (a && a.optionIndex === q.correctIndex) {
        await database.put({ ...t, score: (t.score || 0) + 1 });
      }
    }
  }

  const [joinCode, setJoinCode] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const [teamId, setTeamId] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (mode !== "join") return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [mode]);
  React.useEffect(() => {
    if (mode !== "join") return;
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const c = params.get("code");
    if (c) setJoinCode(c.toUpperCase());
  }, [mode]);
  const { docs: codeMatches } = useLiveQuery("code", {
    key: joinCode.toUpperCase(),
  });
  const joinedGame = codeMatches.find((d) => d.type === "game");
  const { docs: joinedQs } = useLiveQuery("gameId", {
    key: joinedGame?._id || "__none__",
  });
  const currentQ = joinedGame?.currentQuestionId
    ? joinedQs.find((q) => q._id === joinedGame.currentQuestionId)
    : null;
  const { docs: myAnswers } = useLiveQuery(
    (d) => (d.type === "answer" && d.teamId === teamId ? d.teamId : undefined),
    { key: teamId || "__none__" },
  );
  const myAnsForQ = currentQ
    ? myAnswers.find((a) => a.questionId === currentQ._id)
    : null;
  const remaining = joinedGame?.revealAt
    ? Math.max(0, joinedGame.revealAt - now)
    : 0;
  const locked = remaining <= 0 || !!myAnsForQ || joinedGame?.showAnswer;

  async function joinGame() {
    if (!joinedGame || !teamName.trim()) return;
    const r = await database.put({
      type: "team",
      name: teamName.trim(),
      score: 0,
      gameId: joinedGame._id,
      createdAt: Date.now(),
    });
    setTeamId(r.id);
  }
  async function pickOption(i) {
    if (!currentQ || !teamId || locked) return;
    await database.put({
      type: "answer",
      teamId,
      questionId: currentQ._id,
      optionIndex: i,
      gameId: joinedGame._id,
      createdAt: Date.now(),
    });
  }

  const c = {
    page: "min-h-screen bg-[#0a0a0f] text-[#f5f5f7] font-['Space_Grotesk',sans-serif]",
    scan: "relative before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_3px)]",
    header:
      "sticky top-0 z-20 bg-[#0a0a0f]/90 backdrop-blur border-b-[3px] border-[#ff2bd6] px-5 py-4 flex items-center justify-between",
    title:
      "text-2xl font-bold uppercase tracking-tight text-[#ff2bd6] [text-shadow:3px_3px_0_#00f0ff]",
    tag: "font-['JetBrains_Mono',monospace] text-[0.65rem] uppercase tracking-[0.2em] text-[#00f0ff]",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    section:
      "bg-[#13131a] border-[3px] border-[#f5f5f7] shadow-[6px_6px_0_#ff2bd6] rounded p-5",
    h2: "text-xs uppercase tracking-[0.18em] font-bold text-[#00f0ff] mb-3 font-['JetBrains_Mono',monospace]",
    btnPrimary:
      "min-h-[52px] px-5 py-3 bg-[#ff2bd6] text-[#0a0a0f] font-bold uppercase tracking-wider border-[3px] border-[#f5f5f7] shadow-[4px_4px_0_#00f0ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none rounded",
    btnSecondary:
      "min-h-[52px] px-5 py-3 bg-[#00f0ff] text-[#0a0a0f] font-bold uppercase tracking-wider border-[3px] border-[#f5f5f7] shadow-[4px_4px_0_#ff2bd6] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none rounded",
    btnGhost:
      "min-h-[44px] px-4 py-2 bg-transparent text-[#f5f5f7] font-bold uppercase tracking-wider border-[3px] border-[#f5f5f7] rounded",
    input:
      "w-full bg-[#0a0a0f] border-[3px] border-[#f5f5f7] text-[#f5f5f7] px-3 py-3 font-['JetBrains_Mono',monospace] uppercase tracking-widest focus:border-[#ff2bd6] focus:outline-none rounded",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>Pulse Trivia</div>
          <div className={c.tag}>// live.deck.synced</div>
        </div>
        <div className="w-3 h-3 rounded-full bg-[#ff2bd6] animate-pulse" />
      </header>
      <main id="app" className={c.main}>
        <section id="landing" className={c.section}>
          <h2 className={c.h2}>{mode ? `Mode: ${mode}` : "Pick your role"}</h2>
          {!mode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode("host")}
                className={c.btnPrimary + " min-h-[120px] text-2xl"}
              >
                Host
              </button>
              <button
                onClick={() => setMode("join")}
                className={c.btnSecondary + " min-h-[120px] text-2xl"}
              >
                Join
              </button>
            </div>
          )}
          {mode && (
            <button onClick={() => setMode(null)} className={c.btnGhost}>
              ← Switch role
            </button>
          )}
          {!mode && (
            <p className="mt-4 text-xs font-['JetBrains_Mono',monospace] text-[#9999aa] uppercase tracking-widest">
              Host runs the deck. Join plays along.
            </p>
          )}
        </section>
        {mode === "host" && (
          <section id="host" className={c.section}>
            <h2 className={c.h2}>Host Console</h2>
            <div className="space-y-4">
              {!hostGame && (
                <div>
                  <label className="text-xs font-['JetBrains_Mono',monospace] uppercase tracking-widest text-[#00f0ff]">
                    Game name
                  </label>
                  <input
                    className={c.input + " mt-1"}
                    placeholder="Friday Night Brain Melt"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                  />
                  <button
                    onClick={createGame}
                    className={c.btnPrimary + " mt-3 w-full"}
                  >
                    Create Game
                  </button>
                </div>
              )}
              {hostGame && (
                <>
                  <div className="border-b-[3px] border-[#ff2bd6] pb-4">
                    <div className="text-xs font-['JetBrains_Mono',monospace] uppercase tracking-widest text-[#9999aa]">
                      {hostGame.name} — join code
                    </div>
                    <div className="text-5xl font-bold font-['JetBrains_Mono',monospace] tracking-[0.3em] text-[#ff2bd6] [text-shadow:3px_3px_0_#00f0ff]">
                      {hostGame.code}
                    </div>
                    <img
                      alt="qr"
                      className="mt-3 w-40 h-40 border-[3px] border-[#ff2bd6] bg-[#f5f5f7]"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.href + "?code=" + hostGame.code : hostGame.code)}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-['JetBrains_Mono',monospace] uppercase tracking-widest text-[#00f0ff]">
                        Deck ({hostQuestions.length})
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={c.input}
                        placeholder="AI topic (e.g. 90s movies)"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                      />
                      <button
                        onClick={aiGenerate}
                        disabled={aiLoading}
                        className={
                          c.btnSecondary + " text-xs whitespace-nowrap"
                        }
                      >
                        {aiLoading ? (
                          <svg
                            className="animate-spin w-4 h-4 inline"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#0a0a0f"
                            strokeWidth="3"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              strokeDasharray="40 20"
                            />
                          </svg>
                        ) : (
                          "AI: 10 Qs"
                        )}
                      </button>
                    </div>
                    <form onSubmit={addQuestion} className="space-y-2">
                      <input
                        className={c.input}
                        placeholder="Question prompt"
                        value={qDraft.prompt}
                        onChange={(e) => mergeQ({ prompt: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => mergeQ({ correctIndex: i })}
                              className={`px-2 ${qDraft.correctIndex === i ? "bg-[#00f0ff] text-[#0a0a0f]" : "bg-[#0a0a0f] text-[#f5f5f7]"} border-[3px] border-[#f5f5f7] font-bold rounded`}
                            >
                              {["A", "B", "C", "D"][i]}
                            </button>
                            <input
                              className={c.input}
                              placeholder={`Option ${["A", "B", "C", "D"][i]}`}
                              value={qDraft.options[i]}
                              onChange={(e) =>
                                mergeQ({
                                  options: qDraft.options.map((o, j) =>
                                    j === i ? e.target.value : o,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <button type="submit" className={c.btnGhost + " w-full"}>
                        + Add to deck
                      </button>
                    </form>
                    <ul className="space-y-1 max-h-40 overflow-auto">
                      {hostQuestions.map((q) => (
                        <li
                          key={q._id}
                          className="text-xs font-['JetBrains_Mono',monospace] text-[#9999aa] truncate"
                        >
                          → {q.prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {hostGame.currentQuestionId && (
                    <div className="border-t-[3px] border-[#00f0ff] pt-3 text-xs font-['JetBrains_Mono',monospace] text-[#00f0ff]">
                      Live:{" "}
                      {
                        hostQuestions.find(
                          (q) => q._id === hostGame.currentQuestionId,
                        )?.prompt
                      }
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={nextQuestion} className={c.btnPrimary}>
                      Next Question
                    </button>
                    <button onClick={showAnswer} className={c.btnSecondary}>
                      Show Answer
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        {mode === "join" && (
          <section id="join" className={c.section}>
            <h2 className={c.h2}>Join</h2>
            <div className="space-y-3">
              {!teamId && (
                <>
                  <input
                    className={
                      c.input + " text-center text-3xl tracking-[0.4em]"
                    }
                    placeholder="CODE"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  />
                  <input
                    className={c.input}
                    placeholder="Team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <div className="text-xs font-['JetBrains_Mono',monospace] text-[#9999aa]">
                    {joinedGame
                      ? `Found: ${joinedGame.name}`
                      : joinCode.length === 4
                        ? "No game with that code"
                        : "Enter 4-letter code"}
                  </div>
                  <button
                    onClick={joinGame}
                    disabled={!joinedGame || !teamName.trim()}
                    className={c.btnPrimary + " w-full disabled:opacity-50"}
                  >
                    Enter Game
                  </button>
                </>
              )}
              {teamId && (
                <div className="border-t-[3px] border-[#ff2bd6] pt-4">
                  <div
                    className={
                      c.scan +
                      " bg-[#0a0a0f] border-[3px] border-[#00f0ff] p-4 rounded " +
                      (joinedGame?.showAnswer
                        ? "translate-x-[2px] -translate-y-[1px]"
                        : "")
                    }
                  >
                    <div className="text-xs font-['JetBrains_Mono',monospace] uppercase tracking-widest text-[#9999aa]">
                      {currentQ
                        ? `Q · ${Math.ceil(remaining / 1000)}s`
                        : "Waiting for host…"}
                    </div>
                    <div className="mt-2 text-xl font-bold">
                      {currentQ?.prompt || "Stand by."}
                    </div>
                    {currentQ && (
                      <div className="mt-3 h-3 bg-[#13131a] border-[2px] border-[#ff2bd6] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00f0ff] to-[#ff2bd6] transition-all"
                          style={{
                            width: `${Math.min(100, (remaining / 20000) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {currentQ && (
                    <div className="grid grid-cols-1 gap-2 mt-3">
                      {currentQ.options.map((opt, i) => {
                        const correct =
                          joinedGame?.showAnswer && i === currentQ.correctIndex;
                        const wrongPick =
                          joinedGame?.showAnswer &&
                          myAnsForQ?.optionIndex === i &&
                          i !== currentQ.correctIndex;
                        const picked = myAnsForQ?.optionIndex === i;
                        return (
                          <button
                            key={i}
                            onClick={() => pickOption(i)}
                            disabled={locked}
                            className={`min-h-[48px] px-4 py-3 text-left font-bold border-[3px] rounded ${correct ? "bg-[#00f0ff] text-[#0a0a0f] border-[#f5f5f7]" : wrongPick ? "bg-[#ff2bd6] text-[#0a0a0f] border-[#f5f5f7]" : picked ? "bg-[#13131a] text-[#00f0ff] border-[#00f0ff]" : "bg-transparent text-[#f5f5f7] border-[#f5f5f7]"} disabled:opacity-60`}
                          >
                            {["A", "B", "C", "D"][i]}. {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Leaderboard</h2>
          {(() => {
            const gid = mode === "host" ? hostGameId : joinedGame?._id;
            if (!gid)
              return (
                <div className="text-xs font-['JetBrains_Mono',monospace] text-[#9999aa]">
                  No game yet.
                </div>
              );
            const teams = (
              mode === "host"
                ? hostTeams
                : codeMatches.filter(
                    (d) => d.type === "team" && d.gameId === gid,
                  )
            )
              .slice()
              .sort((a, b) => (b.score || 0) - (a.score || 0));
            if (!teams.length)
              return (
                <div className="text-xs font-['JetBrains_Mono',monospace] text-[#9999aa]">
                  Waiting for teams to join…
                </div>
              );
            return (
              <ol className="space-y-2">
                {teams.map((t, i) => (
                  <li
                    key={t._id}
                    className="flex items-center justify-between border-[3px] border-[#f5f5f7] bg-[#0a0a0f] px-3 py-2 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-['JetBrains_Mono',monospace] text-[#ff2bd6] font-bold">
                        #{i + 1}
                      </span>
                      <span className="font-bold">{t.name}</span>
                    </div>
                    <span className="font-['JetBrains_Mono',monospace] text-2xl text-[#00f0ff]">
                      {t.score || 0}
                    </span>
                  </li>
                ))}
              </ol>
            );
          })()}
        </section>
      </main>
    </div>
  );
}
