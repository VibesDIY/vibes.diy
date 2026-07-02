// Handles allowed to mint "super" grants. A `grant` doc gives its grantee read access
// to the "super" channel, which carries EVERY user's favorites — so only real admins
// may write one. Set this to your own Vibes handle(s). See RUNBOOK.md § Granting super
// access. (This is the handle you're signed in as when you write the doc via the CLI.)
const ADMIN_HANDLES = ["jchris", "jchrisa"];

export default function (doc, oldDoc, user, ctx) {
  // Deletes arrive as tombstones that may not carry the original fields, so fall back to
  // oldDoc for type/owner/etc.
  const type = doc.type || (oldDoc && oldDoc.type);

  // Owner is authoritative from the existing doc on updates/deletes — we must NOT trust
  // an incoming doc.userId that could target someone else's _id and pass the checks
  // below. doc.userId is trusted only on true creates (no oldDoc).
  const ownerId = oldDoc ? oldDoc.userId : doc.userId;

  // Every write needs a real account. Logged-out favorites never reach the cloud — they
  // live in localStorage and migrate in on first sign-in.
  if (!user) throw { forbidden: "authentication required" };

  // Favorites live in the owner's *shared* channel (owner + their friends can read it,
  // so "friend picks" resolve without fetching the world) AND are mirrored into the
  // global "super" firehose. Nobody is granted "super" here — only a `grant` doc unlocks
  // it. This is what stops every client from syncing every user's favorites at scale.
  if (type === "favorite") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const share = `share-${ownerId}`;
    return { channels: ["super", share], grant: { users: { [ownerId]: [share] } } };
  }

  // Notes are private to their owner — their own user channel, never shared with friends.
  if (type === "note") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${ownerId}`;
    return { channels: [ch], grant: { users: { [ownerId]: [ch] } } };
  }

  // A shift marked shareWithFriends goes to the owner's shared channel (friends can read
  // it — that's the friend-shift-sharing feature); otherwise it stays private in the
  // owner's user channel.
  if (type === "shift") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const shared = doc.shareWithFriends != null ? doc.shareWithFriends : oldDoc && oldDoc.shareWithFriends;
    const ch = shared ? `share-${ownerId}` : `user-${ownerId}`;
    return { channels: [ch], grant: { users: { [ownerId]: [ch] } } };
  }

  // A friend edge makes the two people's *shared* channels mutually readable, so each
  // sees the other's favorites and shared shifts. Private user channels (notes, private
  // shifts) are NOT shared. The edge doc itself lives in both user channels so it appears
  // in each person's following/followers list.
  if (type === "friend") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const friendSlug = doc.friendSlug != null ? doc.friendSlug : oldDoc && oldDoc.friendSlug;
    return {
      channels: [`user-${ownerId}`, `user-${friendSlug}`],
      grant: {
        users: {
          [ownerId]: [`user-${ownerId}`, `share-${friendSlug}`],
          [friendSlug]: [`user-${friendSlug}`, `share-${ownerId}`],
        },
      },
    };
  }

  // A `grant` doc unlocks the "super" favorites firehose for one user (doc.grantTo).
  // Admin-only — a non-admin must not be able to grant themselves the whole festival's
  // favorites. Written manually via the CLI; see RUNBOOK.md § Granting super access.
  if (type === "grant") {
    if (!ADMIN_HANDLES.includes(user.userHandle)) throw { forbidden: "not admin" };
    const grantee = doc.grantTo != null ? doc.grantTo : oldDoc && oldDoc.grantTo;
    return {
      channels: ["grants"],
      grant: { users: { [user.userHandle]: ["grants", "super"], [grantee]: ["super"] } },
    };
  }

  // Unknown / legacy doc types: accept the write but route it to an unreadable channel
  // (no grant) rather than throwing — a single stray local doc must not fail the whole
  // anonymousLocal sign-in migration.
  return { channels: ["discard"], grant: {} };
}
