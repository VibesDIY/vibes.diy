// Slack-style team chat in a single Fireproof database, gated by this access
// function (the SAME function the server enforces and that useVibe() previews).
//
// Doc types:
//   channel — owner-only; defines a channel. Routed to a public channel so the
//             whole team sees the channel list and its messages (open board).
//   message — any signed-in member posts; the author must stamp themselves, and
//             the message is routed to its channel. Authors edit/delete their own.
//
// The export name matches the database name passed to useFireproof/useVibe
// ("teamChannels"), which is how the runtime selects this function.
export function teamChannels(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "only the owner can create channels" };
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "not creator" };
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: [doc.channelId] };
  }

  throw { forbidden: "unknown document type" };
}
