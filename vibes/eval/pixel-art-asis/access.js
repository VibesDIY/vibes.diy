// Owner manages palette and can clear the canvas.
// Any signed-in user can paint pixels (set/update one of the 256 pixel docs).
// Pixel docs use deterministic _id "px:R:C" so concurrent edits collapse to one doc per cell.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to paint" };
  if (doc.type === "palette-color") {
    if (!user.isOwner) throw { forbidden: "owner manages palette" };
    return {};
  }
  if (doc.type === "pixel") return {};
  if (doc.type === "clear") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
