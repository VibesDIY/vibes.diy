function NewCardBar({ viewer, columns, database }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [loading, setLoading] = React.useState(false);

  if (!viewer) {
    return (
      <section
        id="new-card"
        className="sticky bottom-0 px-4 py-3 border-t border-[oklch(0.39_0.065_165)] bg-[oklch(0.27_0.055_163)] text-center text-sm text-[oklch(0.55_0.04_165)] italic"
      >
        Sign in to add cards
      </section>
    );
  }

  const suggest = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await callAI(`Task title: "${title}". Suggest a concise description (max 15 words) and priority.`, {
        schema: {
          properties: { description: { type: "string" }, priority: { type: "string", description: "low, medium, or high" } },
        },
      });
      const parsed = JSON.parse(res);
      setDescription(parsed.description || "");
      setPriority(parsed.priority || "medium");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || columns.length === 0) return;
    await database.put({
      type: "card",
      title: title.trim(),
      description: description.trim(),
      priority,
      columnId: columns[0]._id,
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setOpen(false);
  };

  const c = {
    section: "sticky bottom-0 px-4 py-3 border-t border-[oklch(0.39_0.065_165)] bg-[oklch(0.27_0.055_163)]",
    openBtn: "w-full min-h-[44px] rounded-lg bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold",
    form: "space-y-2",
    input:
      "w-full min-h-[44px] px-3 rounded-lg bg-[oklch(0.22_0.05_163)] border border-[oklch(0.39_0.065_165)] text-[oklch(0.95_0.01_100)]",
    row: "flex gap-2",
    suggest:
      "min-h-[44px] px-3 rounded-lg border border-[oklch(0.86_0.18_90)] text-[oklch(0.86_0.18_90)] font-semibold flex items-center gap-2 disabled:opacity-50",
    select:
      "min-h-[44px] px-3 rounded-lg bg-[oklch(0.22_0.05_163)] border border-[oklch(0.39_0.065_165)] text-[oklch(0.95_0.01_100)]",
    submit: "flex-1 min-h-[44px] rounded-lg bg-[oklch(0.86_0.18_90)] text-[oklch(0.20_0.04_163)] font-semibold",
    cancel: "min-h-[44px] px-4 rounded-lg border border-[oklch(0.39_0.065_165)] text-[oklch(0.55_0.04_165)]",
  };

  if (!open) {
    return (
      <section id="new-card" className={c.section}>
        <button className={c.openBtn} onClick={() => setOpen(true)}>
          + New Card
        </button>
      </section>
    );
  }

  return (
    <section id="new-card" className={c.section}>
      <div className={c.form}>
        <input className={c.input} placeholder="Card title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className={c.row}>
          <input
            className={c.input}
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button className={c.suggest} onClick={suggest} disabled={loading || !title.trim()}>
            {loading ? (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="50" />
              </svg>
            ) : (
              "AI"
            )}
          </button>
        </div>
        <div className={c.row}>
          <select className={c.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button className={c.submit} onClick={submit}>
            Add
          </button>
          <button className={c.cancel} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
