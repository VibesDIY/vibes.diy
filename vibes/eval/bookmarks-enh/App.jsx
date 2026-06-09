import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg: oklch(0.95 0.01 70);
        --page-bg: oklch(0.92 0.01 65);
        --text: oklch(0.15 0.02 50);
        --border: oklch(0.20 0.02 50);
        --accent: oklch(0.35 0.04 50);
        --accent-text: oklch(0.95 0.01 70);
        --muted: oklch(0.55 0.02 50);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: oklch(0.18 0.02 50);
          --page-bg: oklch(0.14 0.02 50);
          --text: oklch(0.95 0.01 70);
          --border: oklch(0.40 0.02 50);
          --accent: oklch(0.75 0.05 70);
          --accent-text: oklch(0.15 0.02 50);
          --muted: oklch(0.65 0.02 50);
        }
      }
      body { background: var(--page-bg); color: var(--text); font-family: 'Inter', sans-serif; }
      .headline { font-family: 'Playfair Display', serif; }
    `}</style>
  );
}

function SubmitSection({ viewer, url, setUrl, title, setTitle, onSubmit, isSaving }) {
  return (
    <section id="submit" className="rounded-lg border p-4 mb-4" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
      <h2 className="headline text-xl mb-3">Add a bookmark</h2>
      {!viewer && (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Sign in to drop a link.
        </p>
      )}
      {viewer && (
        <form onSubmit={onSubmit} className="space-y-2">
          <input
            type="url"
            required
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-3 rounded border min-h-[44px]"
            style={{ background: "var(--page-bg)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-3 rounded border min-h-[44px]"
            style={{ background: "var(--page-bg)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-4 py-3 rounded min-h-[44px] font-medium flex items-center justify-center gap-2"
            style={{ background: "var(--accent)", color: "var(--accent-text)", opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving && (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="50 20" />
              </svg>
            )}
            {isSaving ? "Tagging..." : "Save bookmark"}
          </button>
        </form>
      )}
    </section>
  );
}

function FiltersSection({ bookmarks, collections, activeTag, setActiveTag, activeCollection, setActiveCollection }) {
  const allTags = Array.from(new Set(bookmarks.flatMap((b) => b.tags || []))).sort();
  return (
    <section id="filters" className="rounded-lg border p-4 mb-4" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
      <h2 className="headline text-xl mb-3">Filter</h2>
      <div className="mb-3">
        <select
          value={activeCollection || ""}
          onChange={(e) => setActiveCollection(e.target.value || null)}
          className="w-full px-3 py-3 rounded border min-h-[44px]"
          style={{ background: "var(--page-bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {allTags.length === 0 ? (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          No tags yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="px-3 py-2 rounded-full text-xs min-h-[36px]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              clear: {activeTag} ×
            </button>
          )}
          {!activeTag &&
            allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className="px-3 py-2 rounded-full text-xs min-h-[36px] border"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                {t}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

function CollectionsSection({ canCurate, collections, database, isOwner }) {
  const [name, setName] = React.useState("");
  const [grantHandle, setGrantHandle] = React.useState("");
  async function createCollection(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await database.put({ type: "collection", name: name.trim(), createdAt: Date.now() });
    setName("");
  }
  async function grantCurator(e) {
    e.preventDefault();
    if (!grantHandle.trim()) return;
    await database.put({ type: "roleGrant", role: "curator", userHandle: grantHandle.trim() });
    setGrantHandle("");
  }
  return (
    <section
      id="collections"
      className="rounded-lg border p-4 mb-4"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <h2 className="headline text-xl mb-3">Collections</h2>
      {!canCurate && (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Curators organize bookmarks into collections.
        </p>
      )}
      {canCurate && (
        <>
          <form onSubmit={createCollection} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="New collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-3 rounded border min-h-[44px]"
              style={{ background: "var(--page-bg)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <button
              type="submit"
              className="px-4 py-3 rounded min-h-[44px]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Add
            </button>
          </form>
          {collections.length > 0 && (
            <ul className="space-y-1 mb-3">
              {collections.map((c) => (
                <li key={c._id} className="text-sm" style={{ color: "var(--text)" }}>
                  · {c.name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {isOwner && (
        <form onSubmit={grantCurator} className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <input
            type="text"
            placeholder="Grant curator (userHandle)"
            value={grantHandle}
            onChange={(e) => setGrantHandle(e.target.value)}
            className="flex-1 px-3 py-3 rounded border min-h-[44px]"
            style={{ background: "var(--page-bg)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            type="submit"
            className="px-4 py-3 rounded min-h-[44px] border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            Grant
          </button>
        </form>
      )}
    </section>
  );
}

function FeedSection({ bookmarks, collections, activeTag, activeCollection, canCurate, database, ViewerTag }) {
  const list = bookmarks
    .filter((b) => b.type === "bookmark")
    .filter((b) => !activeTag || (b.tags || []).includes(activeTag))
    .filter((b) => !activeCollection || b.collectionId === activeCollection);
  return (
    <section id="feed" className="rounded-lg border p-4 mb-4" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
      <h2 className="headline text-xl mb-3">Library</h2>
      {list.length === 0 ? (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Nothing here yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => (
            <li key={b._id} className="p-3 rounded border" style={{ borderColor: "var(--border)", background: "var(--page-bg)" }}>
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer"
                className="block font-medium underline break-words"
                style={{ color: "var(--accent)" }}
              >
                {b.title}
              </a>
              {b.summary && (
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                  {b.summary}
                </p>
              )}
              {(b.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {b.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 rounded-full text-xs border"
                      style={{ borderColor: "var(--border)", color: "var(--text)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <ViewerTag userHandle={b.authorHandle} />
                {canCurate && (
                  <select
                    value={b.collectionId || ""}
                    onChange={(e) => database.put({ ...b, collectionId: e.target.value || null })}
                    className="px-2 py-1 rounded border text-xs"
                    style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <option value="">— unfiled —</option>
                    {collections.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database, access } = useFireproof("stash");
  const { docs: bookmarks } = useLiveQuery("createdAt", { descending: true });
  const { docs: collections } = useLiveQuery("type", { key: "collection" });
  const [url, setUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeTag, setActiveTag] = React.useState(null);
  const [activeCollection, setActiveCollection] = React.useState(null);

  async function saveBookmark(e) {
    e.preventDefault();
    if (!viewer || !url.trim()) return;
    setIsSaving(true);
    try {
      const raw = await callAI(
        `Categorize this bookmark. URL: ${url}. Title: ${title || "(none)"}. Return 2-5 lowercase topical tags and a one-sentence summary.`,
        {
          schema: { properties: { tags: { type: "array", items: { type: "string" } }, summary: { type: "string" } } },
        }
      );
      const { tags = [], summary = "" } = JSON.parse(raw);
      await database.put({
        type: "bookmark",
        url: url.trim(),
        title: title.trim() || url.trim(),
        tags,
        summary,
        collectionId: null,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      setUrl("");
      setTitle("");
    } finally {
      setIsSaving(false);
    }
  }

  const c = {
    page: "min-h-screen px-4 py-4 max-w-2xl mx-auto",
    headerRow: "flex items-center justify-between mb-4 pb-3 border-b",
    title: "headline text-3xl",
  };

  return (
    <>
      <ThemeStyles />
      <main id="app" className={c.page} style={{ color: "var(--text)" }}>
        <header id="app-header" className={c.headerRow} style={{ borderColor: "var(--border)" }}>
          <h1 className={c.title}>Stash</h1>
          <ViewerTag />
        </header>
        {!isViewerPending && (
          <>
            <SubmitSection
              viewer={viewer}
              url={url}
              setUrl={setUrl}
              title={title}
              setTitle={setTitle}
              onSubmit={saveBookmark}
              isSaving={isSaving}
            />
            <FiltersSection
              bookmarks={bookmarks.filter((b) => b.type === "bookmark")}
              collections={collections}
              activeTag={activeTag}
              setActiveTag={setActiveTag}
              activeCollection={activeCollection}
              setActiveCollection={setActiveCollection}
            />
            <CollectionsSection
              canCurate={isOwner || access.hasRole("curator")}
              collections={collections}
              database={database}
              isOwner={isOwner}
            />
            <FeedSection
              bookmarks={bookmarks}
              collections={collections}
              activeTag={activeTag}
              activeCollection={activeCollection}
              canCurate={isOwner || access.hasRole("curator")}
              database={database}
              ViewerTag={ViewerTag}
            />
          </>
        )}
      </main>
    </>
  );
}
