import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function MilestoneBoard({ database, milestones, updates, viewer, isOwner, ViewerTag }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [subtasks, setSubtasks] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);

  async function suggest() {
    if (!title.trim()) return;
    setSuggesting(true);
    try {
      const res = await callAI(
        `Break this team milestone into 3-5 concrete sub-tasks and success criteria. Milestone: "${title}". ${description ? "Context: " + description : ""}`,
        {
          schema: { properties: { subtasks: { type: "array", items: { type: "string" } }, criteria: { type: "string" } } },
        }
      );
      const parsed = JSON.parse(res);
      setSubtasks(parsed.subtasks || []);
      if (parsed.criteria && !description) setDescription(parsed.criteria);
    } finally {
      setSuggesting(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    if (!title.trim() || !isOwner) return;
    setBusy(true);
    try {
      await database.put({
        type: "milestone",
        title: title.trim(),
        description,
        deadline,
        subtasks,
        complete: false,
        createdAt: Date.now(),
      });
      setTitle("");
      setDescription("");
      setDeadline("");
      setSubtasks([]);
    } finally {
      setBusy(false);
    }
  }

  const updateCounts = updates.reduce((acc, u) => {
    if (u.type === "update") acc[u.milestoneId] = (acc[u.milestoneId] || 0) + 1;
    return acc;
  }, {});

  const ip = "w-full border-2 border-[oklch(0.05_0.01_0)] bg-white px-3 py-3 rounded-sm font-mono text-sm min-h-[44px]";
  const btn = "px-4 py-3 min-h-[44px] border-2 border-[oklch(0.05_0.01_0)] font-mono uppercase tracking-widest text-xs";

  return (
    <section id="milestones" className="border-2 border-[oklch(0.05_0.01_0)] bg-white/40 p-4 rounded-sm">
      <h2 className="font-mono uppercase text-sm tracking-widest mb-3">Milestones</h2>

      {isOwner && (
        <form onSubmit={create} className="space-y-2 mb-5 pb-5 border-b-2 border-dashed border-[oklch(0.05_0.01_0)]">
          <input className={ip} placeholder="Milestone title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className={ip}
            placeholder="Description / success criteria"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input className={ip} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {subtasks.length > 0 && (
            <ul className="text-xs font-mono space-y-1 bg-[oklch(0.90_0.20_110)]/40 p-2 border-2 border-[oklch(0.05_0.01_0)]">
              {subtasks.map((s, i) => (
                <li key={i}>▸ {s}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={suggest}
              disabled={suggesting || !title.trim()}
              className={`${btn} bg-white disabled:opacity-50`}
            >
              {suggesting ? (
                <svg className="animate-spin w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                </svg>
              ) : (
                "AI sub-tasks"
              )}
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className={`${btn} bg-[oklch(0.90_0.20_110)] disabled:opacity-50 flex-1`}
            >
              {busy ? "Saving…" : "Add milestone"}
            </button>
          </div>
        </form>
      )}

      {milestones.length === 0 && <p className="text-[oklch(0.40_0.01_0)] text-sm font-mono">No milestones yet.</p>}

      <ul className="space-y-3">
        {milestones.map((m) => (
          <li
            key={m._id}
            className={`border-2 border-[oklch(0.05_0.01_0)] p-3 ${m.complete ? "bg-[oklch(0.90_0.20_110)]/30" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className={`font-semibold ${m.complete ? "line-through" : ""}`}>{m.title}</div>
                {m.deadline && <div className="text-xs font-mono text-[oklch(0.40_0.01_0)] mt-1">Due {m.deadline}</div>}
                {m.description && <div className="text-sm mt-2">{m.description}</div>}
                {m.subtasks?.length > 0 && (
                  <ul className="text-xs font-mono mt-2 space-y-1 text-[oklch(0.40_0.01_0)]">
                    {m.subtasks.map((s, i) => (
                      <li key={i}>▸ {s}</li>
                    ))}
                  </ul>
                )}
                <div className="text-xs font-mono mt-2 text-[oklch(0.40_0.01_0)]">
                  {updateCounts[m._id] || 0} update{updateCounts[m._id] === 1 ? "" : "s"}
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => database.put({ ...m, complete: !m.complete })}
                  className={`${btn} ${m.complete ? "bg-white" : "bg-[oklch(0.90_0.20_110)]"}`}
                >
                  {m.complete ? "Reopen" : "Done"}
                </button>
              )}
            </div>
            <UpdateForm milestoneId={m._id} database={database} viewer={viewer} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function UpdateForm({ milestoneId, database, viewer }) {
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!viewer) return <p className="text-xs font-mono text-[oklch(0.40_0.01_0)] mt-3">Sign in to post updates.</p>;
  async function post(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await database.put({
        type: "update",
        milestoneId,
        body: body.trim(),
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      setBody("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={post} className="flex gap-2 mt-3">
      <input
        className="flex-1 border-2 border-[oklch(0.05_0.01_0)] bg-white px-2 py-2 text-sm font-mono min-h-[40px]"
        placeholder="Post an update…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="px-3 py-2 border-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.90_0.20_110)] font-mono text-xs uppercase tracking-widest disabled:opacity-50"
      >
        Post
      </button>
    </form>
  );
}

function UpdateFeed({ updates, milestones, ViewerTag }) {
  const updateDocs = updates.filter((u) => u.type === "update");
  const titleFor = (id) => milestones.find((m) => m._id === id)?.title || "—";
  return (
    <section id="updates" className="border-2 border-[oklch(0.05_0.01_0)] bg-white/40 p-4 rounded-sm">
      <h2 className="font-mono uppercase text-sm tracking-widest mb-3">Recent Updates</h2>
      {updateDocs.length === 0 ? (
        <p className="text-[oklch(0.40_0.01_0)] text-sm font-mono">No updates posted yet.</p>
      ) : (
        <ul className="space-y-3">
          {updateDocs.slice(0, 10).map((u) => (
            <li key={u._id} className="border-l-4 border-[oklch(0.05_0.01_0)] pl-3 py-1">
              <div className="flex items-center gap-2 mb-1">
                <ViewerTag userHandle={u.authorHandle} />
                <span className="text-xs font-mono text-[oklch(0.40_0.01_0)]">on {titleFor(u.milestoneId)}</span>
              </div>
              <p className="text-sm">{u.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("goalline");
  const { docs: milestones } = useLiveQuery("type", { key: "milestone", descending: true });
  const { docs: updates } = useLiveQuery("createdAt", { descending: true, limit: 20 });

  const c = {
    page: "min-h-screen bg-[oklch(0.88_0.01_90)] text-[oklch(0.05_0.01_0)]",
    header: "border-b-2 border-[oklch(0.05_0.01_0)] bg-[oklch(0.90_0.20_110)] px-4 py-4 sticky top-0 z-10",
    title: "font-mono uppercase tracking-widest text-lg",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24",
    muted: "text-[oklch(0.40_0.01_0)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Mono:wght@400;700&display=optional');body{font-family:Inter,sans-serif}`}</style>
      <header id="app-header" className={c.header}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className={c.title}>GoalLine</div>
            <div className="text-xs font-mono uppercase tracking-wider opacity-70">Team Milestones</div>
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className={c.main}>
        <MilestoneBoard
          database={database}
          milestones={milestones}
          updates={updates}
          viewer={viewer}
          isOwner={isOwner}
          ViewerTag={ViewerTag}
        />
        <UpdateFeed updates={updates} milestones={milestones} ViewerTag={ViewerTag} />
      </main>
    </div>
  );
}
