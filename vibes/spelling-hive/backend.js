// Spelling Hive backend: keep the public leaderboard tidy. The "scores" db
// accumulates one highscore doc per signed-in player; this sweep prunes it to
// the TOP 50 once a day so the board never bloats. The platform's scheduled
// interval caps at 1h, so we tick hourly and gate the actual prune on a
// prune-meta doc (runs as the app owner — ctx.db.query/delete are read/write
// gated exactly like user traffic).
export const config = { scheduled: { interval: "1h" } };

const KEEP = 50;
const DAY_MS = 22 * 60 * 60 * 1000; // "once a day" with slack for tick drift

export async function scheduled(event, ctx) {
  const docs = await ctx.db.query({ db: "scores" });
  const now = Date.parse(event.scheduledTime) || Date.now();

  const meta = docs.find((d) => d._id === "prune-meta");
  if (meta && now - (meta.lastPruneAt || 0) < DAY_MS) return;

  const scores = docs
    .filter((d) => d.kind === "highscore")
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.at || 0) - (b.at || 0));
  for (const doc of scores.slice(KEEP)) {
    await ctx.db.delete(doc._id, { db: "scores" });
  }
  await ctx.db.put(
    {
      _id: "prune-meta",
      kind: "prune-meta",
      lastPruneAt: now,
      kept: Math.min(scores.length, KEEP),
      pruned: Math.max(0, scores.length - KEEP),
    },
    { db: "scores" }
  );
}
