import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function SurveyForm() {
  return (
    <section id="survey-form" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="text-lg font-medium mb-1 text-[#eaeaea]">Share your feedback</h2>
      <p className="text-sm text-[#666] mb-4">5 quick questions. One submission per visitor.</p>
      {/* survey questions land here */}
    </section>
  );
}

function ResponseReview({ database, useLiveQuery, latestSummary }) {
  const { docs: responses } = useLiveQuery("type", { key: "response", descending: true });
  const [busy, setBusy] = React.useState(false);

  async function generateSummary() {
    if (busy || responses.length === 0) return;
    setBusy(true);
    try {
      const prompt = `You are a feedback analyst. Summarize these ${responses.length} survey responses. Identify key themes, sentiment highlights, and an overall takeaway.\n\nResponses:\n${responses.map((r, i) => `#${i + 1}: ${JSON.stringify(r.answers)}`).join("\n")}`;
      const raw = await callAI(prompt, {
        schema: {
          properties: {
            themes: { type: "array", items: { type: "string" }, description: "Key themes across responses" },
            sentiment: { type: "string", description: "Overall sentiment highlights" },
            takeaway: { type: "string", description: "Overall takeaway in 2-3 sentences" },
          },
        },
      });
      const parsed = JSON.parse(raw);
      await database.put({ type: "summary", ...parsed, responseCount: responses.length, createdAt: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="response-review" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-medium text-[#eaeaea]">Team review</h2>
        <span className="text-xs text-[#666]">{responses.length} responses</span>
      </div>
      <p className="text-sm text-[#666] mb-4">Live response stream.</p>
      <button
        onClick={generateSummary}
        disabled={busy || responses.length === 0}
        className="w-full min-h-[44px] mb-4 bg-[#ffffff] text-[#030303] rounded font-medium text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Generating...
          </>
        ) : latestSummary ? (
          "Regenerate summary"
        ) : (
          "Generate summary"
        )}
      </button>
      <ul className="space-y-3">
        {responses.length === 0 && <li className="text-sm text-[#666] italic">No responses yet.</li>}
        {responses.map((r) => (
          <li key={r._id} className="border border-[#1a1a1a] rounded p-3 text-sm">
            <div className="text-xs text-[#666] mb-2">{new Date(r.createdAt).toLocaleString()}</div>
            {QUESTIONS.map((q) => (
              <div key={q.id} className="mb-1.5">
                <div className="text-xs text-[#666]">{q.label}</div>
                <div className="text-[#eaeaea]">{r.answers?.[q.id] || <span className="text-[#666] italic">—</span>}</div>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryPanel({ summary }) {
  if (!summary) {
    return (
      <section id="summary-panel" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
        <h2 className="text-lg font-medium mb-1 text-[#eaeaea]">Published summary</h2>
        <p className="text-sm text-[#666]">No summary published yet.</p>
      </section>
    );
  }
  return (
    <section id="summary-panel" className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5">
      <h2 className="text-lg font-medium mb-1 text-[#eaeaea]">Published summary</h2>
      <p className="text-xs text-[#666] mb-4">
        Based on {summary.responseCount} responses · {new Date(summary.createdAt).toLocaleDateString()}
      </p>
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[#666] mb-2">Key themes</h3>
          <ul className="space-y-1">
            {summary.themes?.map((t, i) => (
              <li key={i} className="text-[#eaeaea]">
                • {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[#666] mb-2">Sentiment</h3>
          <p className="text-[#eaeaea]">{summary.sentiment}</p>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[#666] mb-2">Takeaway</h3>
          <p className="text-[#eaeaea]">{summary.takeaway}</p>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("feedback");
  const { docs: summaries } = useLiveQuery("type", { key: "summary", descending: true, limit: 1 });
  const latestSummary = summaries[0];

  const c = {
    page: "min-h-screen bg-[#030303] text-[#eaeaea]",
    header: "sticky top-0 z-10 border-b border-[#1a1a1a] bg-[#030303]/95 backdrop-blur px-5 py-4 flex items-center justify-between",
    title: "text-base font-medium tracking-tight",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-5",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page} style={{ fontFamily: "Inter, sans-serif" }}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Feedback</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <SurveyForm database={database} hasSummary={!!latestSummary} />
        {isOwner && (
          <ResponseReview database={database} useLiveQuery={useLiveQuery} isOwner={isOwner} latestSummary={latestSummary} />
        )}
        <SummaryPanel summary={latestSummary} />
      </main>
    </div>
  );
}
