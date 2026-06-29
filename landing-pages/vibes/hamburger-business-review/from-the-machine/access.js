// Visit entries: only the author can write their own entry; routed to a private per-user channel.
// Each user reads only their own ledger — the access function ensures isolation.
export function automatonLedger(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to log visits" }
  if (doc.type !== "visit") throw { forbidden: "unknown document type" }
  if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
  if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "cannot edit others' entries" }
  const mine = `user:${user.userHandle}`
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } }
}