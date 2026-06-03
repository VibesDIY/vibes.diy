import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const QUESTIONS = [
  { id: "q1", label: "How would you rate your overall experience?", type: "rating" },
  { id: "q2", label: "What did you like most?", type: "text" },
  { id: "q3", label: "What could we improve?", type: "text" },
  { id: "q4", label: "How likely are you to recommend us?", type: "rating" },
  { id: "q5", label: "Any other comments?", type: "text" },
];

function SurveyForm({ database, onSubmitted, viewer }) {
  const [answers, setAnswers] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await database.put({
        type: "response",
        answers,
        authorHandle: viewer?.userHandle || null,
        createdAt: Date.now(),
      });
      try {
        localStorage.setItem("pulse:submitted", ok.id);
      } catch {}
      onSubmitted(ok.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="survey" className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="font-mono text-sm uppercase tracking-widest text-[#666] mb-4">Share your feedback</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {QUESTIONS.map((q, i) => (
          <div key={q.id}>
            <label className="block text-sm mb-2">
              <span className="text-[#666] font-mono mr-2">0{i + 1}</span>
              {q.label}
            </label>
            {q.type === "rating" ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setAnswers({ ...answers, [q.id]: n })}
                    className={`min-h-[44px] flex-1 rounded-lg border ${answers[q.id] === n ? "bg-white text-black border-white" : "border-[#1a1a1a] text-[#eaeaea]"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                rows={2}
                className="w-full bg-[#030303] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] rounded-lg bg-white text-black font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && (
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
          )}
          {submitting ? "Submitting..." : "Submit feedback"}
        </button>
      </form>
    </section>
  );
}

function ThankYou() {
  return (
    <section id="thanks" className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
      <svg
        className="mx-auto mb-3"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <h2 className="text-2xl font-semibold mb-2">Thank you</h2>
      <p className="text-[#666]">Your response was recorded. Check back later for the published summary.</p>
    </section>
  );
}

function PublishedSummary({ summary }) {
  return (
    <section id="summary" className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="font-mono text-sm uppercase tracking-widest text-[#666] mb-4">Published summary</h2>
      <h3 className="text-lg font-semibold mb-3">{summary.title || "Feedback summary"}</h3>
      {summary.themes?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-[#666] mb-2">Key themes</div>
          <ul className="space-y-1 text-sm">
            {summary.themes.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.sentiment && <p className="text-sm text-[#eaeaea] mb-4">{summary.sentiment}</p>}
      {summary.quotes?.length > 0 && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[#666] mb-2">Notable quotes</div>
          <ul className="space-y-2">
            {summary.quotes.map((q, i) => (
              <li key={i} className="border-l-2 border-[#1a1a1a] pl-3 text-sm italic text-[#eaeaea]">
                "{q}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TeamDashboard({ database, useLiveQuery, summaries }) {
  const { docs: responses } = useLiveQuery("type", { key: "response", descending: true });
  const [generating, setGenerating] = React.useState(false);
  const draft = summaries.find((s) => !s.published) || null;
  const published = summaries.find((s) => s.published) || null;

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const prompt =
        `Analyze these ${responses.length} customer feedback responses and produce a summary.\n\n` +
        responses.map((r, i) => `Response ${i + 1}: ${JSON.stringify(r.answers)}`).join("\n");
      const raw = await callAI(prompt, {
        schema: {
          properties: {
            title: { type: "string" },
            themes: { type: "array", items: { type: "string" } },
            sentiment: { type: "string", description: "Overall sentiment summary" },
            quotes: { type: "array", items: { type: "string" } },
          },
        },
      });
      const parsed = JSON.parse(raw);
      await database.put({
        ...(draft || {}),
        type: "summary",
        ...parsed,
        published: false,
        updatedAt: Date.now(),
      });
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    await database.put({ ...draft, published: true, publishedAt: Date.now() });
  };

  const unpublish = async () => {
    if (!published) return;
    await database.put({ ...published, published: false });
  };

  const editField = (field, value) => {
    if (!draft) return;
    database.put({ ...draft, [field]: value });
  };

  return (
    <section id="dashboard" className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="font-mono text-sm uppercase tracking-widest text-[#666] mb-4">Team review — {responses.length} responses</h2>

      <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
        {responses.length === 0 && <p className="text-[#666] text-sm">No responses yet.</p>}
        {responses.map((r) => (
          <details key={r._id} className="border border-[#1a1a1a] rounded-lg">
            <summary className="px-3 py-2 text-sm cursor-pointer text-[#eaeaea]">
              {new Date(r.createdAt).toLocaleString()} — {r.authorHandle || "anonymous"}
            </summary>
            <div className="px-3 pb-3 text-xs space-y-2">
              {QUESTIONS.map((q) => (
                <div key={q.id}>
                  <div className="text-[#666]">{q.label}</div>
                  <div>{r.answers?.[q.id] ?? "—"}</div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={generateSummary}
          disabled={generating || responses.length === 0}
          className="min-h-[44px] px-4 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {generating && (
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
          )}
          {generating ? "Generating..." : draft ? "Regenerate draft" : "Generate AI summary"}
        </button>
        {draft && (
          <button onClick={publish} className="min-h-[44px] px-4 rounded-lg border border-white text-sm">
            Publish
          </button>
        )}
        {published && (
          <button onClick={unpublish} className="min-h-[44px] px-4 rounded-lg border border-[#1a1a1a] text-sm text-[#666]">
            Unpublish
          </button>
        )}
      </div>

      {draft && (
        <div className="space-y-3 border-t border-[#1a1a1a] pt-4">
          <div className="text-xs font-mono uppercase tracking-widest text-[#666]">Draft (edit before publishing)</div>
          <input
            value={draft.title || ""}
            onChange={(e) => editField("title", e.target.value)}
            placeholder="Title"
            className="w-full bg-[#030303] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={draft.sentiment || ""}
            onChange={(e) => editField("sentiment", e.target.value)}
            rows={3}
            placeholder="Sentiment summary"
            className="w-full bg-[#030303] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={(draft.themes || []).join("\n")}
            onChange={(e) => editField("themes", e.target.value.split("\n").filter(Boolean))}
            rows={3}
            placeholder="Themes (one per line)"
            className="w-full bg-[#030303] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={(draft.quotes || []).join("\n")}
            onChange={(e) => editField("quotes", e.target.value.split("\n").filter(Boolean))}
            rows={3}
            placeholder="Quotes (one per line)"
            className="w-full bg-[#030303] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  if (isViewerPending) return null;

  const c = {
    page: "min-h-screen bg-[#030303] text-[#eaeaea]",
    wrap: "max-w-2xl mx-auto px-4 pb-24",
    header: "sticky top-0 z-10 bg-[#030303]/90 backdrop-blur border-b border-[#1a1a1a]",
    headerInner: "max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3",
    brand: "font-mono text-sm uppercase tracking-[0.3em]",
    dot: "inline-block w-2 h-2 rounded-full bg-white mr-2 align-middle",
    stack: "space-y-4 mt-4",
  };

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Mono&display=optional');body{font-family:'Inter',sans-serif}.font-mono{font-family:'Space Mono',monospace}`}</style>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div className={c.brand}>
            <span className={c.dot}></span>Pulse
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className={c.wrap}>
        <div className={c.stack}>
          {published && <PublishedSummary summary={published} />}
          {!canReview && !submittedId && <SurveyForm database={database} viewer={viewer} onSubmitted={setSubmittedId} />}
          {!canReview && submittedId && !published && <ThankYou />}
          {canReview && <TeamDashboard database={database} useLiveQuery={useLiveQuery} summaries={summaries} />}
        </div>
      </main>
    </div>
  );
}
