import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThreadWall() {
  // feature: live wall of all conversations
  return (
    <section id="thread-wall" className="px-4 py-5 border-b border-[oklch(0.40_0_0)]">
      <h2 className="font-[Cinzel_Decorative] text-[oklch(0.73_0.10_78)] text-lg tracking-wider mb-3">The Council Wall</h2>
      <p className="text-[oklch(0.55_0_0)] italic text-sm">No echoes yet. Summon a figure below.</p>
    </section>
  );
}

function SummonForm({ viewer, database, setActiveId }) {
  const [figure, setFigure] = React.useState("");
  const [suggesting, setSuggesting] = React.useState(false);

  async function suggest() {
    setSuggesting(true);
    try {
      const res = await callAI("Suggest one intriguing historical figure to converse with. Just the name.", {
        schema: { properties: { name: { type: "string" } } },
      });
      const { name } = JSON.parse(res);
      if (name) setFigure(name);
    } finally {
      setSuggesting(false);
    }
  }

  async function summon(e) {
    e.preventDefault();
    if (!viewer || !figure.trim()) return;
    const ok = await database.put({
      type: "thread",
      figure: figure.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    setFigure("");
    setActiveId(ok.id);
  }

  if (!viewer) {
    return (
      <section id="summon" className="px-4 py-5 border-b border-[oklch(0.40_0_0)]">
        <h2 className="font-[Cinzel_Decorative] text-[oklch(0.73_0.10_78)] text-lg tracking-wider mb-3">Summon a Figure</h2>
        <p className="text-[oklch(0.55_0_0)] italic text-sm">Sign in to summon a voice from the past.</p>
      </section>
    );
  }

  return (
    <section id="summon" className="px-4 py-5 border-b border-[oklch(0.40_0_0)]">
      <h2 className="font-[Cinzel_Decorative] text-[oklch(0.73_0.10_78)] text-lg tracking-wider mb-3">Summon a Figure</h2>
      <form onSubmit={summon} className="space-y-3">
        <input
          value={figure}
          onChange={(e) => setFigure(e.target.value)}
          placeholder="e.g. Cleopatra, Tesla, Joan of Arc"
          className="w-full min-h-[44px] px-3 py-3 bg-[oklch(0.17_0_0)] border border-[oklch(0.40_0_0)] rounded text-[oklch(0.90_0_0)] placeholder:text-[oklch(0.55_0_0)] focus:border-[oklch(0.73_0.10_78)] outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!figure.trim()}
            className="flex-1 min-h-[44px] px-4 py-3 bg-[oklch(0.32_0.10_25)] hover:bg-[oklch(0.20_0.07_22)] border border-[oklch(0.73_0.10_78)] rounded font-[Cinzel_Decorative] text-[oklch(0.97_0.07_100)] tracking-wider text-sm uppercase disabled:opacity-40"
          >
            Summon
          </button>
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="min-h-[44px] px-3 py-3 bg-[oklch(0.17_0_0)] border border-[oklch(0.40_0_0)] rounded text-[oklch(0.73_0.10_78)] text-xs tracking-wider uppercase disabled:opacity-40"
            title="Suggest a figure"
          >
            {suggesting ? (
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            ) : (
              "Suggest"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function ActiveThread({ threads, messages, activeId, viewer, database, ViewerTag }) {
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const thread = threads.find((t) => t._id === activeId);
  const threadMessages = messages.filter((m) => m.threadId === activeId).sort((a, b) => a.createdAt - b.createdAt);
  const isOwn = thread && viewer && thread.authorHandle === viewer.userHandle;

  async function send(e) {
    e.preventDefault();
    if (!viewer || !thread || !draft.trim() || sending) return;
    setSending(true);
    const userText = draft.trim();
    try {
      await database.put({
        type: "message",
        threadId: thread._id,
        role: "user",
        body: userText,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      setDraft("");

      const history = threadMessages.map((m) => `${m.role === "user" ? "Seeker" : thread.figure}: ${m.body}`).join("\n");
      const prompt = `You are ${thread.figure}, the historical figure. Respond in their voice, era, and worldview. Be vivid and concise (2-4 sentences). Include one surprising fun fact about your life or times.\n\nConversation so far:\n${history}\nSeeker: ${userText}\n${thread.figure}:`;
      const res = await callAI(prompt, {
        schema: {
          properties: {
            reply: { type: "string", description: "In-character response, 2-4 sentences" },
            funFact: { type: "string", description: "One surprising fun fact" },
          },
        },
      });
      const { reply, funFact } = JSON.parse(res);
      await database.put({
        type: "message",
        threadId: thread._id,
        role: "figure",
        body: reply,
        funFact,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }

  if (!thread) {
    return (
      <section id="active-thread" className="px-4 py-5">
        <h2 className="font-[Cinzel_Decorative] text-[oklch(0.73_0.10_78)] text-lg tracking-wider mb-3">The Audience</h2>
        <p className="text-[oklch(0.55_0_0)] italic text-sm">Choose a thread from the Council Wall to read or continue.</p>
      </section>
    );
  }

  return (
    <section id="active-thread" className="px-4 py-5">
      <div className="mb-4">
        <h2 className="font-[Cinzel_Decorative] text-[oklch(0.97_0.07_100)] text-xl tracking-wider">{thread.figure}</h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-[oklch(0.55_0_0)] italic">
          <span>summoned by</span>
          <ViewerTag userHandle={thread.authorHandle} />
        </div>
      </div>

      <ul className="space-y-3 mb-4">
        {threadMessages.length === 0 && <li className="text-[oklch(0.55_0_0)] italic text-sm">The figure waits in silence...</li>}
        {threadMessages.map((m) => (
          <li
            key={m._id}
            className={`p-3 rounded border ${m.role === "figure" ? "bg-[oklch(0.20_0.07_22)] border-[oklch(0.73_0.10_78)]" : "bg-[oklch(0.17_0_0)] border-[oklch(0.40_0_0)]"}`}
          >
            <div className="text-[10px] uppercase tracking-widest text-[oklch(0.73_0.10_78)] mb-1 font-[Cinzel_Decorative]">
              {m.role === "figure" ? thread.figure : "Seeker"}
            </div>
            <p className="text-[oklch(0.90_0_0)] text-sm leading-relaxed">{m.body}</p>
            {m.funFact && (
              <p className="mt-2 pt-2 border-t border-[oklch(0.40_0_0)] text-[oklch(0.78_0.05_70)] text-xs italic">
                <span className="font-[Cinzel_Decorative] tracking-wider not-italic text-[oklch(0.73_0.10_78)]">Fun Fact — </span>
                {m.funFact}
              </p>
            )}
          </li>
        ))}
      </ul>

      {isOwn ? (
        <form onSubmit={send} className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Speak to ${thread.figure}...`}
            rows={3}
            className="w-full px-3 py-3 bg-[oklch(0.17_0_0)] border border-[oklch(0.40_0_0)] rounded text-[oklch(0.90_0_0)] placeholder:text-[oklch(0.55_0_0)] focus:border-[oklch(0.73_0.10_78)] outline-none resize-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="w-full min-h-[44px] px-4 py-3 bg-[oklch(0.32_0.10_25)] hover:bg-[oklch(0.20_0.07_22)] border border-[oklch(0.73_0.10_78)] rounded font-[Cinzel_Decorative] text-[oklch(0.97_0.07_100)] tracking-wider text-sm uppercase disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
                <span>Awaiting reply...</span>
              </>
            ) : (
              "Send"
            )}
          </button>
        </form>
      ) : (
        <p className="text-[oklch(0.55_0_0)] italic text-sm border-t border-[oklch(0.40_0_0)] pt-3">
          Only the seeker who summoned {thread.figure} may continue this dialogue. You bear witness.
        </p>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("council");
  const { docs: threads } = useLiveQuery("type", { key: "thread", descending: true });
  const { docs: messages } = useLiveQuery("type", { key: "message" });
  const [activeId, setActiveId] = React.useState(null);

  const c = {
    page: "min-h-screen bg-[oklch(0.06_0_0)] text-[oklch(0.90_0_0)] font-[Cinzel]",
    header: "px-4 py-5 border-b-2 border-[oklch(0.40_0_0)] bg-[oklch(0.17_0_0)] sticky top-0 z-10",
    title: "font-[Cinzel_Decorative] text-[oklch(0.97_0.07_100)] text-2xl tracking-[0.2em] uppercase",
    sub: "text-[oklch(0.55_0_0)] text-xs italic mt-1",
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cinzel+Decorative:wght@400;700&display=optional');`}</style>
      <div className={c.page}>
        <header id="app-header" className={c.header}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className={c.title}>Council of Echoes</h1>
              <p className={c.sub}>Converse with the departed. The council listens.</p>
            </div>
            {!isViewerPending && <ViewerTag />}
          </div>
        </header>
        <main id="app">
          <ThreadWall
            threads={threads}
            messages={messages}
            onSelect={setActiveId}
            activeId={activeId}
            ViewerTag={ViewerTag}
            currentHandle={viewer?.userHandle}
          />
          <SummonForm viewer={viewer} database={database} setActiveId={setActiveId} />
          <ActiveThread
            threads={threads}
            messages={messages}
            activeId={activeId}
            viewer={viewer}
            database={database}
            ViewerTag={ViewerTag}
          />
        </main>
      </div>
    </>
  );
}
