import React from "react";
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
        --text: oklch(1.00 0 0);
        --card-bg: oklch(0.38 0.17 295 / 0.4);
        --border: oklch(1.00 0 0 / 0.15);
        --muted: oklch(1.00 0 0 / 0.6);
      }
      body { font-family: 'Nunito', sans-serif; }
      h1, h2, h3 { font-family: 'Fredoka', sans-serif; }
    `}</style>
  );
}

function ScheduleManager({ isOwner, database }) {
  const { useDocument } = useFireproof("snackRoster");
  const { doc, merge, submit } = useDocument({
    type: "game",
    opponent: "",
    date: "",
    location: "",
  });

  if (!isOwner) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc.opponent.trim() || !doc.date) return;
    submit();
  };

  return (
    <section id="schedule" className="px-4 py-3 border-b border-[var(--border)]">
      <h2 className="font-bold text-lg mb-2">Add Game</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2">
        <input
          type="date"
          value={doc.date}
          onChange={(e) => merge({ date: e.target.value })}
          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-3 min-h-[44px] text-[var(--text)]"
          required
        />
        <input
          type="text"
          placeholder="vs. Opponent"
          value={doc.opponent}
          onChange={(e) => merge({ opponent: e.target.value })}
          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-3 min-h-[44px] text-[var(--text)] placeholder:text-[var(--muted)]"
          required
        />
        <input
          type="text"
          placeholder="Field / location"
          value={doc.location}
          onChange={(e) => merge({ location: e.target.value })}
          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-3 min-h-[44px] text-[var(--text)] placeholder:text-[var(--muted)]"
        />
        <button type="submit" className="min-h-[44px] rounded-lg bg-[var(--accent-green)] text-[oklch(0.18_0.10_300)] font-bold">
          Add Game
        </button>
      </form>
    </section>
  );
}

function GameRow({ game, signups, viewer, isOwner, database, ViewerTag }) {
  const gameSignups = signups.filter((s) => s.gameId === game._id);
  const mine = viewer && gameSignups.find((s) => s.authorHandle === viewer.userHandle);
  const [name, setName] = React.useState("");

  const claim = async () => {
    if (!viewer || !name.trim()) return;
    await database.put({
      type: "signup",
      gameId: game._id,
      authorHandle: viewer.userHandle,
      name: name.trim(),
      createdAt: Date.now(),
    });
    setName("");
  };

  const release = async (signupId) => {
    await database.del(signupId);
  };

  const removeGame = async () => {
    if (!confirm("Delete this game?")) return;
    await database.del(game._id);
  };

  return (
    <li className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-lg">vs. {game.opponent}</div>
          <div className="text-sm text-[var(--muted)]">
            {new Date(game.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {game.location ? ` · ${game.location}` : ""}
          </div>
        </div>
        {isOwner && (
          <button onClick={removeGame} className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)]">
            Remove
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Snacks</div>
        {gameSignups.length === 0 ? (
          <div className="text-sm text-[var(--muted)] italic mb-2">No one signed up yet</div>
        ) : (
          <ul className="space-y-1 mb-2">
            {gameSignups.map((s) => {
              const canEdit = isOwner || (viewer && s.authorHandle === viewer.userHandle);
              return (
                <li
                  key={s._id}
                  className="flex items-center justify-between gap-2 bg-[oklch(0.18_0.10_300/0.4)] rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ViewerTag userHandle={s.authorHandle} />
                    <span className="text-sm truncate">{s.name}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => release(s._id)}
                      className="text-xs px-2 py-1 rounded bg-[var(--danger)] text-white shrink-0"
                    >
                      {isOwner && viewer?.userHandle !== s.authorHandle ? "Remove" : "Drop"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {viewer && !mine && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Snack you'll bring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-[oklch(0.18_0.10_300/0.4)] border border-[var(--border)] rounded-lg px-3 py-3 min-h-[44px] text-sm placeholder:text-[var(--muted)]"
            />
            <button
              onClick={claim}
              disabled={!name.trim()}
              className="min-h-[44px] px-4 rounded-lg bg-[var(--accent-gold)] text-[oklch(0.18_0.10_300)] font-bold disabled:opacity-40"
            >
              Sign up
            </button>
          </div>
        )}
        {!viewer && <div className="text-sm text-[var(--muted)] italic">Sign in to claim a slot</div>}
      </div>
    </li>
  );
}

function GameList({ viewer, isOwner, ViewerTag }) {
  const { useLiveQuery, database } = useFireproof("snackRoster");
  const { docs: games } = useLiveQuery("type", { key: "game" });
  const { docs: signups } = useLiveQuery("type", { key: "signup" });

  const sorted = [...games].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <section id="games" className="px-4 pb-24 pt-3">
      <h2 className="font-bold text-xl mb-3">Upcoming Games</h2>
      {sorted.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 text-center text-[var(--muted)]">
          {isOwner ? "Add your first game above." : "No games on the schedule yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((g) => (
            <GameRow
              key={g._id}
              game={g}
              signups={signups}
              viewer={viewer}
              isOwner={isOwner}
              database={database}
              ViewerTag={ViewerTag}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] text-[var(--text)]",
    header:
      "sticky top-0 z-10 backdrop-blur bg-[oklch(0.18_0.10_300/0.85)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "font-bold text-2xl tracking-tight",
    subtitle: "text-sm text-[var(--muted)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Snack Roster</h1>
          <p className={c.subtitle}>{isOwner ? "Coach view" : "Parent view"}</p>
        </div>
        <ViewerTag />
      </header>
      <main id="app">
        <ScheduleManager isOwner={isOwner} />
        <GameList viewer={viewer} isOwner={isOwner} ViewerTag={ViewerTag} />
      </main>
    </div>
  );
}
