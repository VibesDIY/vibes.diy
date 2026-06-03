import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ApplicationForm({ database, viewer }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [letter, setLetter] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !letter.trim()) return;
    setIsLoading(true);
    try {
      let analysis = { summary: "", score: 0, tags: [] };
      try {
        const res = await callAI(
          `Analyze this cover letter for a job application. Return a brief summary (1-2 sentences), a relevance score from 0-100, and 3-5 short topical tags.\n\nName: ${name}\nCover letter: ${letter}`,
          {
            schema: {
              properties: {
                summary: { type: "string" },
                score: { type: "number" },
                tags: { type: "array", items: { type: "string" } },
              },
            },
          }
        );
        analysis = JSON.parse(res);
      } catch (err) {
        console.error("AI analysis failed", err);
      }
      await database.put({
        type: "application",
        name: name.trim(),
        email: email.trim(),
        letter: letter.trim(),
        analysis,
        submittedAt: Date.now(),
        submittedBy: viewer?.userHandle || "anonymous",
      });
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestLetter() {
    setIsLoading(true);
    try {
      const res = await callAI(
        "Write a short, sincere example cover letter (3-4 sentences) for a generic job application. Just the letter text.",
        { schema: { properties: { letter: { type: "string" } } } }
      );
      const parsed = JSON.parse(res);
      if (parsed.letter) setLetter(parsed.letter);
    } finally {
      setIsLoading(false);
    }
  }

  const c = {
    card: "border border-[#cccccc] bg-white p-5",
    label: "block text-sm font-medium text-[#111111] mb-1",
    input:
      "w-full border border-[#cccccc] bg-white px-3 py-3 text-[#111111] min-h-[44px] focus:outline-none focus:border-[#111111]",
    textarea:
      "w-full border border-[#cccccc] bg-white px-3 py-2 text-[#111111] min-h-[120px] focus:outline-none focus:border-[#111111]",
    button:
      "w-full min-h-[44px] bg-[#111111] text-white font-medium px-4 py-3 disabled:opacity-50 flex items-center justify-center gap-2",
    suggest: "text-xs text-[#666666] underline hover:text-[#111111]",
    confirm: "border border-[#cccccc] bg-white p-6 text-center",
  };

  if (submitted) {
    return (
      <section id="application-form" className={c.confirm}>
        <h2 className="text-xl font-semibold text-[#111111] mb-2">Application received</h2>
        <p className="text-[#666666]">Thank you. The hiring team will review your application.</p>
      </section>
    );
  }

  return (
    <section id="application-form" className={c.card}>
      <h2 className="text-xl font-semibold text-[#111111] mb-4">Apply for this role</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={c.label} htmlFor="name">
            Full name
          </label>
          <input id="name" className={c.input} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={c.label} htmlFor="email">
            Email
          </label>
          <input id="email" type="email" className={c.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={c.label} htmlFor="letter">
              Cover letter
            </label>
            <button type="button" onClick={suggestLetter} disabled={isLoading} className={c.suggest}>
              Suggest example
            </button>
          </div>
          <textarea id="letter" className={c.textarea} value={letter} onChange={(e) => setLetter(e.target.value)} required />
        </div>
        <button type="submit" disabled={isLoading} className={c.button}>
          {isLoading && (
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
          {isLoading ? "Submitting..." : "Submit application"}
        </button>
      </form>
    </section>
  );
}

function ReviewDashboard({ database, applications, isReviewer }) {
  const c = {
    card: "border border-[#cccccc] bg-white p-4",
    score: "inline-block px-2 py-0.5 text-xs font-semibold border border-[#cccccc]",
    tag: "inline-block px-2 py-0.5 text-xs bg-[#f5f5f5] text-[#111111] mr-1 mb-1",
    meta: "text-xs text-[#666666]",
  };

  if (!isReviewer) return null;

  return (
    <section id="review-dashboard" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#111111]">Applications ({applications.length})</h2>
      </div>
      {applications.length === 0 && (
        <div className="border border-dashed border-[#cccccc] p-6 text-center text-[#666666]">
          No applications yet. Submissions will appear here in real time.
        </div>
      )}
      <ul className="space-y-3">
        {applications.map((a) => (
          <li key={a._id} className={c.card}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-semibold text-[#111111]">{a.name}</div>
                <div className={c.meta}>{a.email}</div>
              </div>
              {typeof a.analysis?.score === "number" && <span className={c.score}>{Math.round(a.analysis.score)}/100</span>}
            </div>
            {a.analysis?.summary && <p className="text-sm text-[#111111] mb-2 italic">{a.analysis.summary}</p>}
            {a.analysis?.tags?.length > 0 && (
              <div className="mb-2">
                {a.analysis.tags.map((t, i) => (
                  <span key={i} className={c.tag}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-[#666666] hover:text-[#111111]">Read cover letter</summary>
              <p className="mt-2 text-[#111111] whitespace-pre-wrap">{a.letter}</p>
            </details>
            <div className={`${c.meta} mt-2`}>Submitted {new Date(a.submittedAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("careerpost", {
    acl: { read: ["editors"], write: ["members"], delete: ["editors"] },
  });
  const { docs: applications } = useLiveQuery("submittedAt", { descending: true });

  const isReviewer = isOwner || access.hasRole("reviewer");

  const c = {
    page: "min-h-screen bg-white text-[#111111]",
    header: "border-b border-[#cccccc] bg-white",
    headerInner: "max-w-2xl mx-auto px-4 py-4 flex items-center justify-between",
    title: "text-2xl font-bold tracking-tight text-[#111111]",
    sub: "text-sm text-[#666666]",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page} style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <h1 className={c.title}>CareerPost</h1>
            <p className={c.sub}>{isReviewer ? "Hiring review" : "Candidate application"}</p>
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app">
        <div className={c.main}>
          {!isReviewer && <ApplicationForm database={database} viewer={viewer} />}
          {isReviewer && <ReviewDashboard database={database} applications={applications} isReviewer={isReviewer} />}
        </div>
      </main>
    </div>
  );
}
