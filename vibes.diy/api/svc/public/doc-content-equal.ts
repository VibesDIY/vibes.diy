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
// must never count as content).
//
// `_files` attachments compare by their stable identity fields. The server adds
// a derived `_files.<key>.url` ON READ (see files-url-mint.ts) that is a pure
// function of the entry's `uploadId` plus the doc's location — it is NOT content
// the client authored. A read-modify-write cycle bakes that minted url back into
// the stored doc, so the comparator must ignore `_files.<key>.url` or it would
// miss the no-op the moment a doc round-trips through a read. Every identity
// field (`uploadId`/CID, `type`, `size`, `lastModified`) is still compared, so a
// real attachment change is never absorbed.

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

/** Strip the read-only minted `url` from every `_files` entry so the derived
 * field never counts as content (see header note). Returns a normalized copy;
 * non-object entries and a missing/non-object `_files` pass through. */
function stripMintedFileUrls(files: unknown): unknown {
  if (!files || typeof files !== "object" || Array.isArray(files)) return files;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(files as Record<string, unknown>)) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const { url: _omitUrl, ...rest } = entry as Record<string, unknown>;
      out[key] = rest;
    } else {
      out[key] = entry;
    }
  }
  return out;
}

/** Normalize a doc for comparison: drop `_id` (carried out-of-band) and the
 * derived `_files.<key>.url` (minted on read) so neither counts as content. */
function normalizeForCompare(doc: unknown): unknown {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const { _id: _omitId, ...rest } = doc as Record<string, unknown>;
  if ("_files" in rest) {
    rest._files = stripMintedFileUrls(rest._files);
  }
  return rest;
}

/**
 * True when two app documents carry identical content — ignoring `_id`, the
 * derived `_files.<key>.url`, and object key order. Used by putDoc to absorb a
 * content-identical re-put into a no-op (#2644).
 */
export function docContentEqual(a: unknown, b: unknown): boolean {
  return canonical(normalizeForCompare(a)) === canonical(normalizeForCompare(b));
}
