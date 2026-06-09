import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function HostPanel({ database, currentRound, currentQuestion, questions }) {
  const [topic, setTopic] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function generateRound() {
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const response = await callAI(`Write 5 multiple-choice trivia questions about: ${topic}. Vary the difficulty.`, {
        schema: {
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "The question" },
                  choices: { type: "array", items: { type: "string" }, description: "4 answer choices" },
                  correctIndex: { type: "number", description: "Index 0-3 of correct choice" },
                  points: { type: "number", description: "Point value 1-3" },
                },
              },
            },
          },
        },
      });
      const data = JSON.parse(response);
      const roundResult = await database.put({
        type: "round",
        topic: topic.trim(),
        currentIndex: 0,
        revealed: false,
        createdAt: Date.now(),
      });
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        await database.put({
          type: "question",
          roundId: roundResult.id,
          order: i,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          points: q.points,
        });
      }
      setTopic("");
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestTopic() {
    setIsLoading(true);
    try {
      const response = await callAI("Suggest one fun, specific trivia topic (3-6 words).", {
        schema: { properties: { topic: { type: "string" } } },
      });
      setTopic(JSON.parse(response).topic);
    } finally {
      setIsLoading(false);
    }
  }

  async function advance() {
    if (!currentRound) return;
    const next = currentRound.currentIndex + 1;
    if (next >= questions.length) {
      await database.put({ ...currentRound, revealed: true });
    } else {
      await database.put({ ...currentRound, currentIndex: next });
    }
  }

  const spinner = (
    <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeDasharray="50 50" />
    </svg>
  );

  return (
    <section
      id="host-panel"
      className="rounded-xl border-2 border-[#f93c94] bg-[#2a0a2e]/80 p-4 shadow-[0_0_20px_rgba(249,60,148,0.4)] space-y-3"
    >
      <h2 className="font-['Orbitron'] text-lg font-bold text-[#fcee0a] tracking-wide">HOST CONTROL</h2>
      {(!currentRound || currentRound.revealed) && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (e.g. 80s movies)"
              className="flex-1 min-h-[44px] px-3 rounded-lg bg-[#4d1558] text-[#fcee0a] border-2 border-[#f93c94] font-['Rajdhani'] placeholder:text-[#00f0ff]/60"
            />
            <button
              onClick={suggestTopic}
              disabled={isLoading}
              className="min-h-[44px] px-3 bg-[#00f0ff] text-[#2a0a2e] font-['Orbitron'] font-bold rounded-lg disabled:opacity-50"
            >
              {isLoading ? spinner : "AI"}
            </button>
          </div>
          <button
            onClick={generateRound}
            disabled={isLoading || !topic.trim()}
            className="w-full min-h-[44px] bg-[#f93c94] text-[#ffffff] font-['Orbitron'] font-bold rounded-lg disabled:opacity-50 tracking-wide"
          >
            {isLoading ? <>{spinner} GENERATING…</> : "START NEW ROUND"}
          </button>
        </div>
      )}
      {currentRound && !currentRound.revealed && (
        <div className="space-y-2">
          <p className="font-['Share_Tech_Mono'] text-[#00f0ff] text-sm">
            Topic: {currentRound.topic} • Q{currentRound.currentIndex + 1}/{questions.length}
          </p>
          {currentQuestion && (
            <p className="font-['Rajdhani'] text-[#fcee0a]">Correct: {String.fromCharCode(65 + currentQuestion.correctIndex)}</p>
          )}
          <button
            onClick={advance}
            className="w-full min-h-[44px] bg-[#fcee0a] text-[#2a0a2e] font-['Orbitron'] font-bold rounded-lg tracking-wide"
          >
            {currentRound.currentIndex + 1 >= questions.length ? "REVEAL SCORES" : "NEXT QUESTION"}
          </button>
        </div>
      )}
    </section>
  );
}

function QuestionStage({ currentRound, currentQuestion }) {
  return (
    <section
      id="question-stage"
      className="rounded-xl border-2 border-[#00f0ff] bg-gradient-to-br from-[#4d1558] to-[#2a0a2e] p-6 shadow-[0_0_30px_rgba(0,240,255,0.3)] min-h-[200px]"
    >
      {!currentRound && <p className="font-['Orbitron'] text-center text-[#fcee0a] text-xl mt-12">Waiting for the host…</p>}
      {currentRound && currentRound.revealed && (
        <p className="font-['Orbitron'] text-center text-[#fcee0a] text-2xl mt-12">ROUND COMPLETE</p>
      )}
      {currentRound && !currentRound.revealed && currentQuestion && (
        <div className="space-y-4">
          <p className="font-['Share_Tech_Mono'] text-[#00f0ff] text-sm">
            Question {currentRound.currentIndex + 1} • {currentQuestion.points} pts
          </p>
          <p className="font-['Orbitron'] text-[#fcee0a] text-xl leading-relaxed">{currentQuestion.prompt}</p>
          {currentQuestion.choices && (
            <ul className="space-y-2 mt-3">
              {currentQuestion.choices.map((ch, i) => (
                <li
                  key={i}
                  className="font-['Rajdhani'] text-[#ffffff] text-lg border border-[#f93c94] rounded-lg px-3 py-2 bg-[#2a0a2e]/60"
                >
                  <span className="text-[#f93c94] font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                  {ch}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function PlayerAnswer({ viewer, database, currentRound, currentQuestion, answers }) {
  const myAnswer = answers.find((a) => a.questionId === currentQuestion?._id && a.playerHandle === viewer.userHandle);

  async function submit(choiceIndex) {
    if (!currentQuestion || myAnswer) return;
    await database.put({
      type: "answer",
      roundId: currentRound._id,
      questionId: currentQuestion._id,
      choiceIndex,
      playerHandle: viewer.userHandle,
      submittedAt: Date.now(),
    });
  }

  return (
    <section id="player-answer" className="rounded-xl border-2 border-[#fcee0a] bg-[#2a0a2e]/80 p-4">
      <h2 className="font-['Orbitron'] text-lg font-bold text-[#f93c94] mb-3 tracking-wide">YOUR ANSWER</h2>
      {!currentRound && <p className="font-['Share_Tech_Mono'] text-sm text-[#00f0ff]">Waiting for host…</p>}
      {currentRound?.revealed && <p className="font-['Share_Tech_Mono'] text-sm text-[#00f0ff]">Round over — see scoreboard</p>}
      {currentQuestion && !currentRound.revealed && (
        <div className="grid grid-cols-2 gap-2">
          {currentQuestion.choices.map((ch, i) => (
            <button
              key={i}
              onClick={() => submit(i)}
              disabled={!!myAnswer}
              className={`min-h-[56px] px-3 font-['Orbitron'] font-bold rounded-lg border-2 tracking-wide ${myAnswer?.choiceIndex === i ? "bg-[#f93c94] text-[#ffffff] border-[#fcee0a]" : "bg-[#4d1558] text-[#fcee0a] border-[#f93c94]"} disabled:opacity-60`}
            >
              {String.fromCharCode(65 + i)}
            </button>
          ))}
        </div>
      )}
      {myAnswer && !currentRound.revealed && (
        <p className="font-['Share_Tech_Mono'] text-sm text-[#00f0ff] mt-2">
          ✓ Locked in {String.fromCharCode(65 + myAnswer.choiceIndex)}
        </p>
      )}
    </section>
  );
}

function Scoreboard({ currentRound, questions, answers }) {
  if (!currentRound?.revealed) return null;
  const scores = {};
  for (const a of answers) {
    const q = questions.find((qq) => qq._id === a.questionId);
    if (!q) continue;
    if (!scores[a.playerHandle]) scores[a.playerHandle] = 0;
    if (a.choiceIndex === q.correctIndex) scores[a.playerHandle] += q.points;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <section
      id="scoreboard"
      className="rounded-xl border-2 border-[#f93c94] bg-[#2a0a2e]/80 p-4 shadow-[0_0_25px_rgba(252,238,10,0.4)]"
    >
      <h2 className="font-['Orbitron'] text-lg font-bold text-[#fcee0a] mb-3 tracking-wide">SCOREBOARD</h2>
      {ranked.length === 0 && <p className="font-['Share_Tech_Mono'] text-sm text-[#00f0ff]">No answers submitted</p>}
      <ol className="space-y-2">
        {ranked.map(([handle, pts], i) => (
          <li
            key={handle}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border ${i === 0 ? "bg-[#fcee0a] text-[#2a0a2e] border-[#f93c94]" : "bg-[#4d1558] text-[#fcee0a] border-[#00f0ff]"}`}
          >
            <span className="font-['Orbitron'] font-bold">#{i + 1}</span>
            <span className="font-['Rajdhani'] text-lg">@{handle}</span>
            <span className="font-['Share_Tech_Mono'] font-bold">{pts} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("triviaNight");
  const { docs: rounds } = useLiveQuery("_id", { descending: true, limit: 1 });
  const currentRound = rounds[0] || null;
  const { docs: questions } = useLiveQuery("roundId", { key: currentRound?._id });
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const currentQuestion = currentRound ? sortedQuestions[currentRound.currentIndex] : null;
  const { docs: answers } = useLiveQuery("roundId", { key: currentRound?._id });

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] pb-24",
    header: "sticky top-0 z-10 bg-[#2a0a2e] border-b-4 border-[#fcee0a] shadow-[0_4px_20px_rgba(249,60,148,0.5)]",
    headerInner: "flex items-center justify-between p-4 max-w-2xl mx-auto",
    title: "font-['Orbitron'] text-2xl font-bold text-[#fcee0a] tracking-widest",
    main: "max-w-2xl mx-auto p-4 space-y-4",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <h1 className={c.title}>TRIVIA NIGHT</h1>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className={c.main}>
        <QuestionStage currentRound={currentRound} currentQuestion={currentQuestion} />
        {isOwner && (
          <HostPanel
            database={database}
            currentRound={currentRound}
            currentQuestion={currentQuestion}
            questions={sortedQuestions}
          />
        )}
        {viewer && !isOwner && (
          <PlayerAnswer
            viewer={viewer}
            database={database}
            currentRound={currentRound}
            currentQuestion={currentQuestion}
            answers={answers}
          />
        )}
        <Scoreboard isOwner={isOwner} currentRound={currentRound} questions={sortedQuestions} answers={answers} />
      </main>
    </div>
  );
}
