// Spelling Hive backend: keep the public leaderboard tidy — prune the "scores"
// db to the TOP 50 once a day. Runs as the app owner; ctx.db.query/delete are
// read/write gated exactly like user traffic.
//
// Two hardening decisions (Charlie, #3040 review):
// - The daily gate derives from the CLOCK, not a stored doc: the platform's
//   scheduled interval caps at 1h, so we tick hourly and prune only on the tick
//   that lands in PRUNE_UTC_HOUR. A forged prune-meta doc (any auto-joined
//   editor can write to "scores") can therefore never suppress pruning —
//   prune-meta below is a non-load-bearing observability stamp.
// - ctx.db.query caps at 2000 docs per read, so one pass over a huge db only
//   sees a window. The prune loops: each pass keeps the window's top 50 and
//   deletes the rest, which pulls previously-unseen docs into the next query —
//   converging on the GLOBAL top 50 within one tick (bounded passes).
export const config = { scheduled: { interval: "1h" } };

const KEEP = 50;
const PRUNE_UTC_HOUR = 4; // once a day, on the ~04:00 UTC tick
const QUERY_CAP = 2000; // mirrors the host-side ctx.db.query cap
const MAX_PASSES = 20; // safety bound (~39k deletions/day capacity)

export async function scheduled(event, ctx) {
  const when = new Date(event.scheduledTime);
  if (when.getUTCHours() !== PRUNE_UTC_HOUR) return;

  let pruned = 0;
  let junked = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const docs = await ctx.db.query({ db: "scores" });
    // The db has a CLOSED schema — highscore docs plus the prune-meta stamp.
    // Anything else is junk an auto-joined writer parked here; delete it, both
    // for bloat and so junk can't pin the query window and shield unseen
    // highscores from the sweep (Charlie #3040 follow-up). Every full-window
    // pass therefore makes progress: 2000 docs are either mostly junk (junk
    // deleted) or mostly highscores (excess deleted).
    const junk = docs.filter((d) => d.kind !== "highscore" && d._id !== "prune-meta");
    const excess = docs
      .filter((d) => d.kind === "highscore")
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.at || 0) - (b.at || 0))
      .slice(KEEP);
    for (const doc of [...junk, ...excess]) {
      await ctx.db.delete(doc._id, { db: "scores" });
    }
    pruned += excess.length;
    junked += junk.length;
    // Saw the whole db this pass — the kept set is now the global top 50.
    if (docs.length < QUERY_CAP) break;
  }

  await ctx.db.put(
    { _id: "prune-meta", kind: "prune-meta", lastPruneAt: Date.parse(event.scheduledTime) || 0, pruned, junked },
    { db: "scores" }
  );
}
