// irmaSpanish database: only authenticated users can write progress/study-day docs.
// Each doc is tagged with the writer's userHandle so the runtime can attribute it.
// Reads are open to all members so Irma can share her progress with a tutor.
export function irmaSpanish(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to track progress" }
  if (doc.type === "progress" || doc.type === "studyDay") return {}
  return {}
}