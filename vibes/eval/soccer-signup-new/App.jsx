import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg-start: oklch(0.18 0.10 300);
        --bg-end: oklch(0.12 0.09 300);
        --primary: oklch(0.38 0.17 295);
        --primary-light: oklch(0.47 0.18 295);
        --accent-green: oklch(0.70 0.15 155);
        --accent-gold: oklch(0.88 0.18 95);
        --danger: oklch(0.55 0.20 25);
        --text: oklch(1 0 0);
        --card-bg: oklch(0.38 0.17 295 / 0.4);
        --border: oklch(1 0 0 / 0.15);
        --muted: oklch(1 0 0 / 0.65);
      }
      body { font-family: 'Nunito', sans-serif; }
      h1, h2, h3 { font-family: 'Fredoka', sans-serif; }
    `}</style>
  );
}

function ScheduleSection({ viewer, isOwner, ViewerTag, c }) {
  const { useLiveQuery, useDocument, database, access } = useFireproof("snackSheet");
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const { docs: claims } = useLiveQuery("type", { key: "claim" });

  const {
    doc: newGame,
    merge: mergeGame,
    submit: submitGame,
  } = useDocument({
    type: "game",
    opponent: "",
    date: "",
    time: "",
    createdAt: Date.now(),
  });

  const sorted = [...games].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const claimFor = (gameId) => claims.find((cl) => cl.gameId === gameId);

  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);

  async function suggestBalance() {
    setSuggesting(true);
    try {
      const parents = Array.from(new Set(claims.map((cl) => cl.parentName).filter(Boolean)));
      const unclaimed = sorted.filter((g) => !claimFor(g._id));
      const counts = Object.fromEntries(parents.map((p) => [p, claims.filter((cl) => cl.parentName === p).length]));
      const prompt = `Soccer team snack-duty balancer. Parents and current snack counts: ${JSON.stringify(counts)}. Unclaimed games: ${JSON.stringify(unclaimed.map((g) => ({ id: g._id, opponent: g.opponent, date: g.date })))}. Suggest assignments that balance load — parents with fewer counts get more.`;
      const res = await callAI(prompt, {
        schema: {
          properties: {
            assignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  gameId: { type: "string" },
                  parentName: { type: "string" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      });
      setSuggestion(JSON.parse(res));
    } finally {
      setSuggesting(false);
    }
  }

  async function applySuggestion(a) {
    const existing = claimFor(a.gameId);
    if (existing) {
      await database.put({ ...existing, parentName: a.parentName });
    } else {
      await database.put({
        type: "claim",
        gameId: a.gameId,
        parentName: a.parentName,
        claimedBy: viewer?.userHandle,
        createdAt: Date.now(),
      });
    }
    setSuggestion((s) => (s ? { ...s, assignments: s.assignments.filter((x) => x.gameId !== a.gameId) } : null));
  }

  async function claimGame(gameId, name) {
    if (!viewer || !name.trim()) return;
    const existing = claimFor(gameId);
    if (existing && existing.claimedBy !== viewer.userHandle && !isOwner) return;
    if (existing) {
      await database.put({ ...existing, parentName: name.trim() });
    } else {
      await database.put({ type: "claim", gameId, parentName: name.trim(), claimedBy: viewer.userHandle, createdAt: Date.now() });
    }
  }

  async function releaseClaim(claimId) {
    await database.del(claimId);
  }

  return (
    <section id="schedule" className={c.section}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={c.sectionTitle}>Game Schedule</h2>
        {isOwner && sorted.length > 0 && (
          <button onClick={suggestBalance} disabled={suggesting} className={c.aiBtn}>
            {suggesting ? (
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            ) : (
              "Suggest balance"
            )}
          </button>
        )}
      </div>

      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newGame.opponent.trim()) submitGame();
          }}
          className={c.addGame}
        >
          <input
            type="text"
            placeholder="Opponent"
            value={newGame.opponent}
            onChange={(e) => mergeGame({ opponent: e.target.value })}
            className={c.input}
          />
          <div className="flex gap-2">
            <input type="date" value={newGame.date} onChange={(e) => mergeGame({ date: e.target.value })} className={c.input} />
            <input type="time" value={newGame.time} onChange={(e) => mergeGame({ time: e.target.value })} className={c.input} />
          </div>
          <button type="submit" className={c.primaryBtn}>
            Add Game
          </button>
        </form>
      )}

      {suggestion && suggestion.assignments && suggestion.assignments.length > 0 && (
        <div className={c.suggestBox}>
          <h3 className="font-bold mb-2">Suggested assignments</h3>
          <ul className="space-y-2">
            {suggestion.assignments.map((a, i) => {
              const g = sorted.find((x) => x._id === a.gameId);
              return (
                <li key={i} className={c.suggestRow}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {g?.opponent || "?"} → {a.parentName}
                    </div>
                    {a.rationale && <div className={c.muted}>{a.rationale}</div>}
                  </div>
                  <button onClick={() => applySuggestion(a)} className={c.smallBtn}>
                    Apply
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => setSuggestion(null)} className={c.linkBtn}>
            Dismiss
          </button>
        </div>
      )}

      {sorted.length === 0 && <p className={c.empty}>No games scheduled yet.</p>}

      <ul className="space-y-3">
        {sorted.map((game) => {
          const claim = claimFor(game._id);
          const mine = claim && claim.claimedBy === viewer?.userHandle;
          const canEdit = viewer && (isOwner || !claim || mine);
          return (
            <li key={game._id} className={c.gameCard}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate">vs {game.opponent}</div>
                  <div className={c.muted}>
                    {game.date} {game.time && `· ${game.time}`}
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => database.del(game._id)} className={c.dangerBtn} aria-label="Delete game">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="mt-3">
                {claim ? (
                  <div className="flex items-center gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[oklch(0.70_0.15_155)]"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="font-semibold">{claim.parentName}</span>
                    {claim.claimedBy && <ViewerTag userHandle={claim.claimedBy} />}
                    {canEdit && (
                      <button onClick={() => releaseClaim(claim._id)} className={c.linkBtn}>
                        release
                      </button>
                    )}
                  </div>
                ) : viewer ? (
                  <ClaimInput onClaim={(n) => claimGame(game._id, n)} defaultName={viewer.displayName || ""} c={c} />
                ) : (
                  <p className={c.muted}>Sign in to claim a snack slot.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClaimInput({ onClaim, defaultName, c }) {
  const [name, setName] = React.useState(defaultName);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onClaim(name);
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={c.input + " flex-1"}
      />
      <button type="submit" className={c.claimBtn}>
        Bring snacks
      </button>
    </form>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] text-white pb-20",
    header:
      "sticky top-0 z-10 bg-[oklch(0.18_0.10_300_/_0.85)] backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3",
    title: "text-xl font-bold",
    section: "px-4 py-5 max-w-2xl mx-auto",
    sectionTitle: "text-2xl font-bold",
    addGame: "bg-[oklch(0.38_0.17_295_/_0.4)] border border-white/15 rounded-xl p-3 mb-4 space-y-2",
    gameCard: "bg-[oklch(0.38_0.17_295_/_0.4)] border border-white/15 rounded-xl p-4",
    input: "min-h-[44px] px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 w-full",
    primaryBtn: "min-h-[44px] w-full px-4 py-2 rounded-lg bg-[oklch(0.70_0.15_155)] text-[oklch(0.15_0.08_295)] font-bold",
    claimBtn: "min-h-[44px] px-4 py-2 rounded-lg bg-[oklch(0.88_0.18_95)] text-[oklch(0.18_0.10_300)] font-bold whitespace-nowrap",
    aiBtn:
      "min-h-[40px] px-3 py-2 rounded-lg bg-[oklch(0.47_0.18_295)] text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60",
    smallBtn: "min-h-[36px] px-3 py-1 rounded-lg bg-[oklch(0.70_0.15_155)] text-[oklch(0.15_0.08_295)] font-semibold text-sm",
    dangerBtn: "p-2 rounded-lg text-[oklch(0.55_0.20_25)] hover:bg-white/5",
    linkBtn: "text-sm text-white/70 underline ml-2",
    muted: "text-sm text-white/65",
    empty: "text-center py-8 text-white/60",
    suggestBox: "bg-[oklch(0.47_0.18_295_/_0.6)] border border-[oklch(0.88_0.18_95_/_0.4)] rounded-xl p-3 mb-4",
    suggestRow: "flex items-center gap-2 bg-white/5 rounded-lg p-2",
  };

  if (isViewerPending) return null;

  return (
    <>
      <ThemeStyles />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700&display=optional"
        rel="stylesheet"
      />
      <main id="app" className={c.page}>
        <header id="app-header" className={c.header}>
          <div className="flex items-center gap-2 min-w-0">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[oklch(0.88_0.18_95)] shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2l2 4-2 4-2-4zM12 14l2 4-2 4-2-4zM2 12l4-2 4 2-4 2zM14 12l4-2 4 2-4 2z" />
            </svg>
            <h1 className={c.title}>Snack Sign-Up</h1>
            {isOwner && (
              <span className="text-xs bg-[oklch(0.88_0.18_95)] text-[oklch(0.18_0.10_300)] font-bold px-2 py-0.5 rounded-full">
                COACH
              </span>
            )}
          </div>
          <ViewerTag />
        </header>

        <ScheduleSection viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} c={c} />
      </main>
    </>
  );
}
