// pixel docs: each pixel placement on the shared canvas, authored by one user.
//   - createdBy must match the writer; can be updated (recolor) or deleted (erase) by author only
// palette docs: AI-suggested palettes saved per-user.
// Anyone signed in can paint; no channels needed — single shared canvas.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to paint" };
  if (doc.type === "pixel") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not your pixel" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "can't overwrite another painter's pixel" };
  }
  return {};
}
