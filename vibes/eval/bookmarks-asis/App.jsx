import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function AddBookmark({ isOwner, database }) {
  const [url, setUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      const res = await callAI(
        `Analyze this bookmark and return a short description (max 140 chars) and 2-5 lowercase topic tags. URL: ${url} TITLE: ${title || "(none)"}`,
        { schema: { properties: { description: { type: "string" }, tags: { type: "array", items: { type: "string" } } } } }
      );
      const { description, tags } = JSON.parse(res);
      await database.put({
        type: "bookmark",
        url: url.trim(),
        title: title.trim() || url.trim(),
        description: description || "",
        tags: Array.isArray(tags) ? tags.map((t) => t.toLowerCase()) : [],
        createdAt: Date.now(),
      });
      setUrl("");
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  if (!isOwner) {
    return (
      <section
        id="add-bookmark"
        className="rounded-2xl border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] p-4 backdrop-blur"
      >
        <p className="text-xs font-mono text-[oklch(0.50_0.04_290)]">// read-only archive — only the vault keeper can add</p>
      </section>
    );
  }

  return (
    <section
      id="add-bookmark"
      className="rounded-2xl border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[oklch(0.72_0.15_75)]">// stash a link</h2>
        <AISuggestButton
          onPick={({ url: u, title: t }) => {
            setUrl(u);
            setTitle(t);
          }}
          disabled={saving}
        />
      </div>
      <form onSubmit={save} className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          type="url"
          className="w-full min-h-[44px] px-3 rounded-lg bg-[oklch(0.08_0.03_280)] border border-[oklch(0.65_0.15_80/0.12)] text-[oklch(0.93_0.02_80)] placeholder:text-[oklch(0.50_0.04_290)] focus:border-[oklch(0.72_0.15_75)] outline-none"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="title (optional — AI will infer)"
          className="w-full min-h-[44px] px-3 rounded-lg bg-[oklch(0.08_0.03_280)] border border-[oklch(0.65_0.15_80/0.12)] text-[oklch(0.93_0.02_80)] placeholder:text-[oklch(0.50_0.04_290)] focus:border-[oklch(0.72_0.15_75)] outline-none"
        />
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="w-full min-h-[44px] rounded-lg bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)] font-mono text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving && (
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
          {saving ? "tagging…" : "stash + auto-tag"}
        </button>
      </form>
    </section>
  );
}

function TagCloud({ tags, activeTag, onPick }) {
  if (!tags.length) return null;
  return (
    <section
      id="tag-cloud"
      className="rounded-2xl border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] p-4 backdrop-blur"
    >
      <h2 className="font-mono text-xs uppercase tracking-widest text-[oklch(0.55_0.18_300)] mb-3">// topics</h2>
      <div className="flex flex-wrap gap-2">
        {activeTag && (
          <button
            onClick={() => onPick(null)}
            className="px-3 py-1.5 rounded-full text-xs font-mono bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)]"
          >
            ✕ {activeTag}
          </button>
        )}
        {tags
          .filter(([t]) => t !== activeTag)
          .map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => onPick(tag)}
              className="px-3 py-1.5 rounded-full text-xs font-mono border border-[oklch(0.65_0.15_80/0.12)] text-[oklch(0.93_0.02_80)] hover:border-[oklch(0.72_0.15_75)] hover:text-[oklch(0.72_0.15_75)]"
            >
              #{tag} <span className="text-[oklch(0.50_0.04_290)]">{count}</span>
            </button>
          ))}
      </div>
    </section>
  );
}

function BookmarkFeed({ docs, isOwner, database, query, setQuery, activeTag }) {
  const q = query.trim().toLowerCase();
  const filtered = docs.filter((d) => {
    if (activeTag && !(d.tags || []).includes(activeTag)) return false;
    if (!q) return true;
    return (
      (d.title || "").toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q) ||
      (d.url || "").toLowerCase().includes(q) ||
      (d.tags || []).some((t) => t.includes(q))
    );
  });
  return (
    <section
      id="bookmark-feed"
      className="rounded-2xl border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] p-4 backdrop-blur space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[oklch(0.72_0.15_75)]">// archive ({filtered.length})</h2>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search titles, tags, urls…"
        className="w-full min-h-[44px] px-3 rounded-lg bg-[oklch(0.08_0.03_280)] border border-[oklch(0.65_0.15_80/0.12)] text-[oklch(0.93_0.02_80)] placeholder:text-[oklch(0.50_0.04_290)] focus:border-[oklch(0.72_0.15_75)] outline-none"
      />
      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="text-sm text-[oklch(0.50_0.04_290)] font-mono py-6 text-center">// no links match</li>
        )}
        {filtered.map((d) => (
          <li
            key={d._id}
            className="rounded-xl border border-[oklch(0.65_0.15_80/0.12)] p-3 bg-[oklch(0.08_0.03_280)] hover:border-[oklch(0.72_0.15_75/0.4)]"
          >
            <div className="flex items-start justify-between gap-2">
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-[oklch(0.72_0.15_75)] font-medium leading-snug break-words flex-1"
              >
                {d.title}
              </a>
              {isOwner && (
                <button
                  onClick={() => database.del(d._id)}
                  aria-label="delete"
                  className="shrink-0 p-2 -m-1 text-[oklch(0.50_0.04_290)] hover:text-[oklch(0.72_0.15_75)]"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              )}
            </div>
            {d.description && <p className="text-sm text-[oklch(0.93_0.02_80)] mt-1 leading-relaxed">{d.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-mono text-[oklch(0.50_0.04_290)] truncate max-w-[180px]">
                {new URL(d.url).hostname}
              </span>
              {(d.tags || []).map((t) => (
                <span key={t} className="text-[10px] font-mono text-[oklch(0.55_0.18_300)]">
                  #{t}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AISuggestButton({ onPick, disabled }) {
  const [busy, setBusy] = React.useState(false);
  async function suggest() {
    setBusy(true);
    try {
      const res = await callAI("Suggest one interesting real public URL someone might bookmark, with a short title.", {
        schema: { properties: { url: { type: "string" }, title: { type: "string" } } },
      });
      const { url, title } = JSON.parse(res);
      onPick({ url, title });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={suggest}
      disabled={disabled || busy}
      className="text-[10px] font-mono uppercase tracking-widest text-[oklch(0.55_0.18_300)] hover:text-[oklch(0.72_0.15_75)] disabled:opacity-40"
    >
      {busy ? "thinking…" : "✦ suggest"}
    </button>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, useDocument, database } = useFireproof("bookmarks");

  const c = {
    page: "min-h-screen bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)]",
    wrap: "max-w-2xl mx-auto px-4 py-6 space-y-4",
    header: "flex items-center justify-between gap-3 pb-2 border-b border-[oklch(0.65_0.15_80/0.12)]",
    brand: "font-mono text-lg tracking-tight text-[oklch(0.72_0.15_75)]",
    sub: "text-xs font-mono text-[oklch(0.50_0.04_290)]",
  };

  const { docs } = useLiveQuery("createdAt", { descending: true });
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState(null);

  const tagCounts = React.useMemo(() => {
    const m = {};
    docs.forEach((d) =>
      (d.tags || []).forEach((t) => {
        m[t] = (m[t] || 0) + 1;
      })
    );
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [docs]);

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <main id="app" className={c.wrap}>
        <header id="app-header" className={c.header}>
          <div>
            <h1 className={c.brand}>vault://bookmarks</h1>
            <p className={c.sub}>
              {docs.length} saved · {isOwner ? "owner mode" : "read-only"}
            </p>
          </div>
          <ViewerTag />
        </header>
        <AddBookmark isOwner={isOwner} database={database} />
        <TagCloud tags={tagCounts} activeTag={activeTag} onPick={setActiveTag} />
        <BookmarkFeed docs={docs} isOwner={isOwner} database={database} query={query} setQuery={setQuery} activeTag={activeTag} />
      </main>
    </div>
  );
}
