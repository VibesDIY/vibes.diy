// Content-equality for app documents (issue #2644).
//
// A `put` whose content is identical to the current head revision should be
// absorbed as a no-op — no new revision, no clock entry, no doc-changed /
// grants-changed fan-out. This makes the "re-assert my access setup on every
// page load" pattern (per-visitor self-grants, the owner-approves-authors
// roster grant from #2631, channel/role setup docs) free when nothing changed,
// so codegen can emit the simple idempotent form without a read-guard that
// races sync (the #2026 failure mode).
//
// App documents are plain JSON (stored as jsonb), so equality is a canonical
// comparison: object key order does not matter, and the `_id` field is ignored
// (it is carried out-of-band as the docId column and re-injected on read, so it
// must never count as content). `_files` attachments compare by their stored
// value — the `{ uploadId, ... }` / CID reference — so two puts naming the same
// asset are equal.

/** Recursively render a JSON value with object keys sorted, so equal content with
 * different key order produces an identical string. Mirrors `JSON.stringify`
 * semantics for `undefined` (omitted from objects, `null` inside arrays). */
function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

/** Drop the `_id` field from a doc-shaped object so it never counts as content. */
function stripId(doc: unknown): unknown {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const { _id: _omit, ...rest } = doc as Record<string, unknown>;
  return rest;
}

/**
 * True when two app documents carry identical content — ignoring `_id` and
 * object key order. Used by putDoc to absorb a content-identical re-put into a
 * no-op (#2644).
 */
export function docContentEqual(a: unknown, b: unknown): boolean {
  return canonical(stripId(a)) === canonical(stripId(b));
}
