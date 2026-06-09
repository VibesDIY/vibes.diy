import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Stage({ question }) {
  return (
    <section
      id="stage"
      className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(1_0_0)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Current Question</h2>
      {!question && <p className="text-[oklch(0.50_0.02_280)] italic">No question yet — host, pick a topic to begin.</p>}
      {question && (
        <div>
          <p className="text-xs uppercase tracking-widest text-[oklch(0.55_0.24_28)] font-bold mb-1">Topic: {question.topic}</p>
          <p className="text-lg font-medium">{question.prompt}</p>
        </div>
      )}
    </section>
  );
}

function TopicPicker({ isOwner, database }) {
  const [topic, setTopic] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);

  if (!isOwner) {
    return (
      <section
        id="topic"
        className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
      >
        <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Spectator Mode</h2>
        <p className="text-sm">Only the host can spin up new questions. Sit tight!</p>
      </section>
    );
  }

  async function suggest() {
    setSuggesting(true);
    try {
      const r = await callAI("Suggest one fun trivia topic in 2-4 words.", {
        schema: { properties: { topic: { type: "string" } } },
      });
      setTopic(JSON.parse(r).topic);
    } finally {
      setSuggesting(false);
    }
  }

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const r = await callAI(`Generate one trivia question on the topic "${topic}". Include the correct answer.`, {
        schema: { properties: { prompt: { type: "string" }, answer: { type: "string" } } },
      });
      const { prompt, answer } = JSON.parse(r);
      await database.put({ type: "question", topic, prompt, answer, createdAt: Date.now() });
      setTopic("");
    } finally {
      setLoading(false);
    }
  }

  const Spinner = () => (
    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
    </svg>
  );

  return (
    <section
      id="topic"
      className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Host Controls</h2>
      <div className="flex gap-2 mb-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. 80s movies"
          className="flex-1 border-2 border-[oklch(0.15_0.02_280)] rounded px-2 py-2 bg-white min-h-[44px]"
        />
        <button
          onClick={suggest}
          disabled={suggesting}
          className="border-2 border-[oklch(0.15_0.02_280)] bg-white px-3 rounded font-bold text-sm min-h-[44px]"
        >
          {suggesting ? <Spinner /> : "✦"}
        </button>
      </div>
      <button
        onClick={generate}
        disabled={loading || !topic.trim()}
        className="w-full border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white py-2 rounded font-bold uppercase tracking-wide min-h-[44px] disabled:opacity-50"
      >
        {loading ? (
          <>
            <Spinner /> Generating…
          </>
        ) : (
          "Generate Question"
        )}
      </button>
    </section>
  );
}

function AnswerBox({ viewer, question, database, answers }) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const alreadyAnswered =
    viewer && question && answers.some((a) => a.questionId === question._id && a.authorHandle === viewer.userHandle);

  if (!viewer) {
    return (
      <section
        id="answer"
        className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(1_0_0)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
      >
        <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Your Answer</h2>
        <p className="text-sm text-[oklch(0.50_0.02_280)]">Sign in to play.</p>
      </section>
    );
  }
  if (!question) return null;

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await callAI(
        `Question: "${question.prompt}"\nCorrect answer: "${question.answer}"\nPlayer answered: "${text}"\nJudge correctness. Award 0-10 points. One-sentence explanation.`,
        {
          schema: { properties: { correct: { type: "boolean" }, points: { type: "number" }, explanation: { type: "string" } } },
        }
      );
      const verdict = JSON.parse(r);
      await database.put({
        type: "answer",
        questionId: question._id,
        authorHandle: viewer.userHandle,
        text: text.trim(),
        correct: verdict.correct,
        points: verdict.points,
        explanation: verdict.explanation,
        createdAt: Date.now(),
      });
      setText("");
    } finally {
      setLoading(false);
    }
  }

  const Spinner = () => (
    <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
    </svg>
  );

  return (
    <section
      id="answer"
      className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(1_0_0)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Your Answer</h2>
      {alreadyAnswered ? (
        <p className="text-sm text-[oklch(0.62_0.19_145)] font-bold">✓ Answer locked in. Wait for the next question.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            className="w-full border-2 border-[oklch(0.15_0.02_280)] rounded px-2 py-2 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="w-full border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] text-white py-2 rounded font-bold uppercase tracking-wide min-h-[44px] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Spinner /> Judging…
              </>
            ) : (
              "Submit"
            )}
          </button>
        </form>
      )}
    </section>
  );
}

function Scoreboard({ answers }) {
  const { ViewerTag } = useViewer();
  const totals = {};
  answers.forEach((a) => {
    totals[a.authorHandle] = (totals[a.authorHandle] || 0) + (a.points || 0);
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return (
    <section
      id="scoreboard"
      className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-white rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Scoreboard</h2>
      {sorted.length === 0 ? (
        <p className="text-sm">No scores yet.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(([handle, pts], i) => (
            <li
              key={handle}
              className="flex items-center justify-between bg-white text-[oklch(0.15_0.02_280)] rounded px-3 py-2 border-2 border-[oklch(0.15_0.02_280)]"
            >
              <span className="flex items-center gap-2">
                <span className="font-black">#{i + 1}</span>
                <ViewerTag userHandle={handle} />
              </span>
              <span className="font-black text-lg">{pts}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function History({ questions, answers }) {
  const { ViewerTag } = useViewer();
  const sortedQ = [...questions].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <section
      id="history"
      className="border-2 border-[oklch(0.15_0.02_280)] bg-[oklch(1_0_0)] rounded p-4 shadow-[4px_4px_0_oklch(0.15_0.02_280)]"
    >
      <h2 className="font-bold text-lg mb-2 tracking-wide uppercase">Round History</h2>
      {sortedQ.length === 0 ? (
        <p className="text-sm text-[oklch(0.50_0.02_280)]">Past questions will appear here.</p>
      ) : (
        <ul className="space-y-3">
          {sortedQ.map((q) => {
            const qAnswers = answers.filter((a) => a.questionId === q._id);
            return (
              <li key={q._id} className="border-2 border-[oklch(0.15_0.02_280)] rounded p-2 bg-[oklch(0.96_0.01_90)]">
                <p className="text-xs uppercase tracking-widest text-[oklch(0.55_0.24_28)] font-bold">{q.topic}</p>
                <p className="text-sm font-medium mb-1">{q.prompt}</p>
                <p className="text-xs text-[oklch(0.50_0.02_280)] italic mb-2">Answer: {q.answer}</p>
                <ul className="space-y-1">
                  {qAnswers.map((a) => (
                    <li key={a._id} className="text-xs flex items-center gap-2 flex-wrap">
                      <ViewerTag userHandle={a.authorHandle} />
                      <span className={a.correct ? "text-[oklch(0.62_0.19_145)] font-bold" : "text-[oklch(0.55_0.24_28)]"}>
                        {a.correct ? "✓" : "✗"} "{a.text}" (+{a.points})
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("trivia");
  const { docs: questions } = useLiveQuery("type", { key: "question" });
  const { docs: answers } = useLiveQuery("type", { key: "answer" });
  const { docs: configs } = useLiveQuery("type", { key: "config" });
  const activeQuestion = questions.sort((a, b) => b.createdAt - a.createdAt)[0];

  React.useEffect(() => {
    if (isOwner && configs.length === 0) {
      database.put({ type: "config", createdAt: Date.now() });
    }
  }, [isOwner, configs.length]);

  if (isViewerPending) return null;

  return (
    <main id="app" className="min-h-screen bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)] font-[Space_Grotesk,sans-serif]">
      <header
        id="app-header"
        className="border-b-4 border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10"
      >
        <h1 className="font-black text-xl tracking-widest uppercase">★ Trivia Showdown ★</h1>
        <ViewerTag />
      </header>
      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        <Stage question={activeQuestion} />
        <TopicPicker isOwner={isOwner} database={database} />
        <AnswerBox viewer={viewer} question={activeQuestion} database={database} answers={answers} />
        <Scoreboard answers={answers} />
        <History questions={questions} answers={answers} />
      </div>
    </main>
  );
}
