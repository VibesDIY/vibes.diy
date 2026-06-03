import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const QUESTIONS = [
  { id: "q1", label: "How would you rate your overall experience?", type: "scale" },
  { id: "q2", label: "What did you like most?", type: "text" },
  { id: "q3", label: "What could we improve?", type: "text" },
  { id: "q4", label: "How likely are you to recommend us?", type: "scale" },
  { id: "q5", label: "Any other thoughts to share?", type: "text" },
];

function SurveyForm({ database }) {
  const [answers, setAnswers] = React.useState({});
  const [submitted, setSubmitted] = React.useState(() => !!localStorage.getItem("pulse-submitted"));
  const [submitting, setSubmitting] = React.useState(false);

  const update = (id, val) => setAnswers((a) => ({ ...a, [id]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await database.put({ type: "response", answers, createdAt: Date.now() });
      localStorage.setItem("pulse-submitted", "1");
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const c = {
    input: "w-full bg-[#030303] border border-[#1a1a1a] rounded px-3 py-2 text-[#eaeaea] focus:border-[#666] focus:outline-none",
  };

  if (submitted) {
    return (
      <section id="survey-form" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
        <h2 className="text-lg font-medium text-[#eaeaea] mb-1">Thank you</h2>
        <p className="text-sm text-[#666]">Your feedback has been recorded.</p>
      </section>
    );
  }

  return (
    <section id="survey-form" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="text-lg font-medium text-[#eaeaea] mb-1">Share your feedback</h2>
      <p className="text-sm text-[#666] mb-4">Five quick questions. One submission.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.id}>
            <label className="block text-sm text-[#eaeaea] mb-2">{q.label}</label>
            {q.type === "scale" ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update(q.id, n)}
                    className={`min-h-[44px] flex-1 rounded border ${answers[q.id] === n ? "border-[#ffffff] bg-[#1a1a1a] text-[#ffffff]" : "border-[#1a1a1a] bg-[#030303] text-[#666]"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <textarea value={answers[q.id] || ""} onChange={(e) => update(q.id, e.target.value)} rows={2} className={c.input} />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] rounded bg-[#ffffff] text-[#030303] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
            </svg>
          ) : (
            "Submit feedback"
          )}
        </button>
      </form>
    </section>
  );
}

function PublishedSummary({ useLiveQuery }) {
  const { docs } = useLiveQuery("type", { key: "summary" });
  const published = docs.find((d) => d.published);
  if (!published) return null;
  return (
    <section id="published-summary" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="text-lg font-medium text-[#eaeaea] mb-3">Team summary</h2>
      <p className="text-sm text-[#eaeaea] leading-relaxed whitespace-pre-wrap">{published.summary}</p>
      {published.themes?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {published.themes.map((t) => (
            <span key={t} className="text-xs px-2 py-1 rounded border border-[#1a1a1a] bg-[#030303] text-[#666]">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-[#666] mt-4">Published {new Date(published.publishedAt).toLocaleDateString()}</p>
    </section>
  );
}

function ReviewDashboard({ database, useLiveQuery }) {
  const { docs: responses } = useLiveQuery("type", { key: "response" });
  const { docs: summaries } = useLiveQuery("type", { key: "summary" });
  const latest = summaries[summaries.length - 1];
  const [generating, setGenerating] = React.useState(false);

  const generate = async () => {
    if (responses.length === 0) return;
    setGenerating(true);
    try {
      const prompt = `Summarize this customer feedback. Responses:\n\n${responses.map((r, i) => `Response ${i + 1}: ${JSON.stringify(r.answers)}`).join("\n\n")}`;
      const result = await callAI(prompt, {
        schema: {
          properties: {
            summary: { type: "string", description: "Narrative summary paragraph" },
            themes: { type: "array", items: { type: "string" }, description: "Theme tags" },
          },
        },
      });
      const parsed = JSON.parse(result);
      await database.put({
        type: "summary",
        summary: parsed.summary,
        themes: parsed.themes || [],
        published: false,
        createdAt: Date.now(),
      });
    } finally {
      setGenerating(false);
    }
  };

  const togglePublish = async () => {
    if (!latest) return;
    await database.put({
      ...latest,
      published: !latest.published,
      publishedAt: !latest.published ? Date.now() : latest.publishedAt,
    });
  };

  return (
    <section id="review-dashboard" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-[#eaeaea]">Review responses</h2>
        <span className="text-xs text-[#666]">{responses.length} total</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
        {responses.length === 0 ? (
          <p className="text-sm text-[#666] italic">No responses yet.</p>
        ) : (
          responses.map((r) => (
            <details key={r._id} className="rounded border border-[#1a1a1a] bg-[#030303] p-3">
              <summary className="text-xs text-[#666] cursor-pointer">{new Date(r.createdAt).toLocaleString()}</summary>
              <div className="mt-2 space-y-1 text-sm text-[#eaeaea]">
                {QUESTIONS.map((q) => (
                  <div key={q.id}>
                    <span className="text-[#666] text-xs">{q.label}</span>
                    <div>{r.answers?.[q.id] ?? "—"}</div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </div>

      <div className="border-t border-[#1a1a1a] pt-4 space-y-3">
        <button
          onClick={generate}
          disabled={generating || responses.length === 0}
          className="w-full min-h-[44px] rounded border border-[#1a1a1a] bg-[#1a1a1a] text-[#eaeaea] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <svg
                className="animate-spin"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>{" "}
              Generating…
            </>
          ) : latest ? (
            "Regenerate summary"
          ) : (
            "Generate summary"
          )}
        </button>

        {latest && (
          <div className="rounded border border-[#1a1a1a] bg-[#030303] p-3">
            <p className="text-sm text-[#eaeaea] leading-relaxed whitespace-pre-wrap">{latest.summary}</p>
            {latest.themes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {latest.themes.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded border border-[#1a1a1a] text-[#666]">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={togglePublish}
              className={`mt-3 w-full min-h-[44px] rounded font-medium ${latest.published ? "bg-[#1a1a1a] text-[#eaeaea] border border-[#1a1a1a]" : "bg-[#ffffff] text-[#030303]"}`}
            >
              {latest.published ? "Unpublish" : "Publish to visitors"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("pulse-survey");

  if (isViewerPending) return null;

  return (
    <main id="app" className="min-h-screen bg-[#030303] text-[#eaeaea]" style={{ fontFamily: "Inter, sans-serif" }}>
      <header
        id="app-header"
        className="sticky top-0 z-10 border-b border-[#1a1a1a] bg-[#030303]/90 backdrop-blur px-5 py-4 flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-medium tracking-tight" style={{ fontFamily: "'Space Mono', monospace" }}>
            Pulse Survey
          </h1>
          <p className="text-xs text-[#666] mt-0.5">Customer feedback, made simple</p>
        </div>
        <ViewerTag />
      </header>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <SurveyForm database={database} />
        <PublishedSummary useLiveQuery={useLiveQuery} />
        {isOwner && <ReviewDashboard database={database} useLiveQuery={useLiveQuery} />}
      </div>
    </main>
  );
}
