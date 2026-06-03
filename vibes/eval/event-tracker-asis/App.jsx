import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header
      id="app-header"
      className={`sticky top-0 z-10 ${c.headerBg} ${c.headerBorder} border-b-4 px-4 py-3 flex items-center justify-between`}
    >
      <div>
        <h1 className={`${c.brand} text-2xl font-black tracking-wider uppercase`} style={{ fontFamily: "Orbitron, sans-serif" }}>
          Lineup
        </h1>
        <p className={`${c.tagline} text-xs tracking-widest uppercase`}>Live festival board</p>
      </div>
      <ViewerTag />
    </header>
  );
}

function AddActSection({ c, viewer, actDraft, mergeAct, handleAddAct, handleSuggestAct, isParsing }) {
  if (!viewer) return null;
  return (
    <section id="add-act" className={`${c.panel} ${c.panelBorder} border-2 rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h2
          className={`${c.sectionTitle} text-lg font-bold uppercase tracking-wider`}
          style={{ fontFamily: "Orbitron, sans-serif" }}
        >
          Add Act
        </h2>
        <button
          type="button"
          onClick={handleSuggestAct}
          disabled={isParsing}
          className="text-xs bg-[#00f0ff] text-[#2a0a2e] font-bold uppercase px-2 py-1 rounded border border-[#2a0a2e] disabled:opacity-50"
        >
          {isParsing ? "…" : "✨ Suggest"}
        </button>
      </div>
      <form onSubmit={handleAddAct} className="space-y-2">
        <input
          className={c.input}
          placeholder="Act name"
          value={actDraft.name}
          onChange={(e) => mergeAct({ name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={c.input}
            placeholder="Stage"
            value={actDraft.stage}
            onChange={(e) => mergeAct({ stage: e.target.value })}
          />
          <input
            className={c.input}
            placeholder="Time (8:30 PM)"
            value={actDraft.time}
            onChange={(e) => mergeAct({ time: e.target.value })}
          />
        </div>
        <button type="submit" className={`${c.primaryBtn} w-full`} disabled={!actDraft.name.trim()}>
          Add to Lineup
        </button>
      </form>
    </section>
  );
}

function PasteParseSection({ c, viewer, pasteText, setPasteText, handleParsePaste, isParsing }) {
  if (!viewer) return null;
  return (
    <section id="paste-parse" className={`${c.panel} ${c.panelBorder} border-2 rounded-lg p-4`}>
      <h2
        className={`${c.sectionTitle} text-lg font-bold uppercase tracking-wider mb-3`}
        style={{ fontFamily: "Orbitron, sans-serif" }}
      >
        Paste Schedule
      </h2>
      <textarea
        className={`${c.input} min-h-[120px]`}
        placeholder={"Paste any schedule text — e.g.\n8:00 PM — DJ Nova @ Main Stage\n9:30 PM — Static Bloom @ Neon Tent"}
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
      />
      <button
        type="button"
        onClick={handleParsePaste}
        disabled={isParsing || !pasteText.trim()}
        className={`${c.secondaryBtn} w-full mt-2 flex items-center justify-center gap-2`}
      >
        {isParsing && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
          </svg>
        )}
        {isParsing ? "Parsing…" : "Parse with AI"}
      </button>
    </section>
  );
}

function LineupSection({ c, acts, myStars, showFavoritesOnly, setShowFavoritesOnly, toggleStar, deleteAct, viewer, ViewerTag }) {
  return (
    <section id="lineup" className={`${c.panelAlt} ${c.panelBorder} border-2 rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2
          className={`${c.sectionTitle} text-lg font-bold uppercase tracking-wider`}
          style={{ fontFamily: "Orbitron, sans-serif" }}
        >
          The Lineup ({acts.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowFavoritesOnly((v) => !v)}
          className={`text-xs font-bold uppercase tracking-wider px-3 py-2 rounded border-2 min-h-[44px] ${showFavoritesOnly ? "bg-[#fcee0a] text-[#2a0a2e] border-[#2a0a2e]" : "bg-transparent text-[#fcee0a] border-[#fcee0a]"}`}
        >
          {showFavoritesOnly ? "★ Favorites" : "All Acts"}
        </button>
      </div>
      {acts.length === 0 ? (
        <p className={`${c.muted} text-sm text-center py-6`}>No acts yet. Add one or paste a schedule above.</p>
      ) : (
        <ul className="space-y-2">
          {acts.map((act) => {
            const starred = myStars.has(act._id);
            return (
              <li key={act._id} className={`${c.card} flex items-center gap-3`}>
                <button
                  type="button"
                  onClick={() => toggleStar(act._id)}
                  disabled={!viewer}
                  className={`text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center ${starred ? c.star : c.starOff}`}
                  aria-label={starred ? "Unstar" : "Star"}
                >
                  {starred ? "★" : "☆"}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate" style={{ fontFamily: "Orbitron, sans-serif" }}>
                    {act.name}
                  </p>
                  <p className="text-[#00f0ff] text-sm truncate">
                    {act.stage || "—"} · {act.time || "TBA"}
                  </p>
                  {act.createdBy && <ViewerTag userHandle={act.createdBy} />}
                </div>
                {viewer && act.createdBy === viewer.userHandle && (
                  <button
                    type="button"
                    onClick={() => deleteAct(act)}
                    className="text-[#f93c94] text-xs uppercase font-bold px-2 py-2 min-h-[44px]"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                )}
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
  const { useDocument, useLiveQuery, database } = useFireproof("lineup");

  const {
    doc: actDraft,
    merge: mergeAct,
    submit: submitAct,
  } = useDocument({
    type: "act",
    name: "",
    stage: "",
    time: "",
    createdBy: viewer?.userHandle || "",
    createdAt: Date.now(),
  });

  const { docs: acts } = useLiveQuery("type", { key: "act" });
  const { docs: stars } = useLiveQuery("type", { key: "star" });
  const myStars = new Set(stars.filter((s) => s.userHandle === viewer?.userHandle).map((s) => s.actId));

  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [isParsing, setIsParsing] = React.useState(false);

  function handleAddAct(e) {
    e.preventDefault();
    if (!viewer || !actDraft.name.trim()) return;
    mergeAct({ createdBy: viewer.userHandle, createdAt: Date.now() });
    submitAct();
  }

  async function handleSuggestAct() {
    if (!viewer) return;
    setIsParsing(true);
    try {
      const res = await callAI(
        "Suggest one fun fictional festival act with a band name, stage name, and a time slot like '8:30 PM'.",
        {
          schema: { properties: { name: { type: "string" }, stage: { type: "string" }, time: { type: "string" } } },
        }
      );
      const parsed = JSON.parse(res);
      mergeAct({ name: parsed.name || "", stage: parsed.stage || "", time: parsed.time || "" });
    } finally {
      setIsParsing(false);
    }
  }

  async function handleParsePaste() {
    if (!viewer || !pasteText.trim()) return;
    setIsParsing(true);
    try {
      const res = await callAI(`Parse this festival schedule into structured acts. Schedule:\n\n${pasteText}`, {
        schema: {
          properties: {
            acts: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, stage: { type: "string" }, time: { type: "string" } },
              },
            },
          },
        },
      });
      const parsed = JSON.parse(res);
      for (const a of parsed.acts || []) {
        await database.put({
          type: "act",
          name: a.name || "Unknown",
          stage: a.stage || "",
          time: a.time || "",
          createdBy: viewer.userHandle,
          createdAt: Date.now(),
        });
      }
      setPasteText("");
    } finally {
      setIsParsing(false);
    }
  }

  async function toggleStar(actId) {
    if (!viewer) return;
    const existing = stars.find((s) => s.userHandle === viewer.userHandle && s.actId === actId);
    if (existing) await database.del(existing._id);
    else await database.put({ type: "star", actId, userHandle: viewer.userHandle, createdAt: Date.now() });
  }

  async function deleteAct(act) {
    if (!viewer || act.createdBy !== viewer.userHandle) return;
    await database.del(act._id);
  }

  const visibleActs = showFavoritesOnly ? acts.filter((a) => myStars.has(a._id)) : acts;
  const sortedActs = [...visibleActs].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a]",
    headerBg: "bg-[#2a0a2e]",
    headerBorder: "border-[#fcee0a]",
    brand: "text-[#fcee0a]",
    tagline: "text-[#00f0ff]",
    panel: "bg-[#2a0a2e]/90 backdrop-blur",
    panelAlt: "bg-[#4d1558]/90 backdrop-blur",
    panelBorder: "border-[#f93c94]",
    sectionTitle: "text-[#fcee0a]",
    muted: "text-[#00f0ff]/70",
    input:
      "w-full bg-[#1a0520] border-2 border-[#f93c94] text-white rounded px-3 py-3 min-h-[44px] placeholder:text-[#f93c94]/60 focus:outline-none focus:border-[#fcee0a]",
    primaryBtn:
      "bg-[#fcee0a] text-[#2a0a2e] font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] rounded border-2 border-[#2a0a2e] hover:bg-[#00f0ff] disabled:opacity-50 disabled:cursor-not-allowed",
    secondaryBtn:
      "bg-[#f93c94] text-white font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] rounded border-2 border-[#2a0a2e] hover:bg-[#00f0ff] hover:text-[#2a0a2e] disabled:opacity-50",
    card: "bg-[#1a0520] border-2 border-[#f93c94] rounded-lg p-3",
    star: "text-[#fcee0a]",
    starOff: "text-[#4d1558]",
  };

  return (
    <div className={c.page} style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app" className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
        {!isViewerPending && !viewer && (
          <div className={`${c.panel} ${c.panelBorder} border-2 rounded-lg p-4 text-center`}>
            <p className="text-[#fcee0a] font-bold uppercase tracking-wider">Read-only mode — sign in to add acts</p>
          </div>
        )}
        <AddActSection
          c={c}
          viewer={viewer}
          actDraft={actDraft}
          mergeAct={mergeAct}
          handleAddAct={handleAddAct}
          handleSuggestAct={handleSuggestAct}
          isParsing={isParsing}
        />
        <PasteParseSection
          c={c}
          viewer={viewer}
          pasteText={pasteText}
          setPasteText={setPasteText}
          handleParsePaste={handleParsePaste}
          isParsing={isParsing}
        />
        <LineupSection
          c={c}
          acts={sortedActs}
          myStars={myStars}
          showFavoritesOnly={showFavoritesOnly}
          setShowFavoritesOnly={setShowFavoritesOnly}
          toggleStar={toggleStar}
          deleteAct={deleteAct}
          viewer={viewer}
          ViewerTag={ViewerTag}
        />
      </main>
    </div>
  );
}
