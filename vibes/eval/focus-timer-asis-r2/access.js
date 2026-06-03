// Permission model:
// - Only owner can create/edit/delete timers (type: "timer")
// - Only owner can write timer state transitions (start/pause/reset)
// - Session completion logs (type: "session") are owner-only writes
// - Coach suggestions (type: "coach") are owner-only writes
// - Everyone (including anonymous viewers) gets read-only via app-level public toggle
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (!user.isOwner) throw { forbidden: "owner only" };
  return {};
}
