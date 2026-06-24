/**
 * Deterministic structural signals computed from a cell's generated source.
 *
 * These are NOT quality judgements — they're cheap, near-noise-free booleans
 * recording *what the model actually emitted* against the codegen protocol the
 * system prompt asks for (a separate `access.js`, gating writes on
 * `useVibe().can`, using the `requireAccess`/`requireRole` access DSL, calling
 * `callAI` with a schema, …). Aggregated per model they answer "does this model
 * follow our protocol?" as a leading indicator — far less noisy than the 1–5
 * judge, and they point at *what* to fix (format vs protocol-salience vs API
 * exposure). See the #2549 analysis: parse failures clustered on small models
 * (format), and access.js-emit-rate predicted the feature score on the ACL
 * prompt (protocol salience).
 *
 * They are regex heuristics over the source text, so treat them as directional
 * indicators, not a parser.
 */
export interface StructureSignals {
  /** A separate `access.js` file was emitted (the prompt mandates it for permission apps). */
  readonly hasAccessJs: boolean;
  /** Anti-pattern: access-function logic leaked into App.jsx (prompt explicitly forbids this). */
  readonly accessInAppJsx: boolean;
  /** App.jsx calls `useVibe(...)` — the runtime access hook. */
  readonly usesUseVibe: boolean;
  /** App.jsx gates a write surface on `can.create/edit/delete/update(...)`. */
  readonly gatesOnCan: boolean;
  /** App.jsx uses `useViewer(...)` for identity/display. */
  readonly usesUseViewer: boolean;
  /** access.js uses `requireAccess(...)` — channel/membership gating (per-object collab). */
  readonly usesRequireAccess: boolean;
  /** access.js uses `requireRole(...)` — role gating (owner-publish, moderation). */
  readonly usesRequireRole: boolean;
  /** access.js routes to a per-object channel (an interpolated/`:`-scoped channel like `list:<id>`). */
  readonly perObjectChannel: boolean;
  /** App.jsx persists with Fireproof (`useFireproof`/`useDocument`/`useLiveQuery`). */
  readonly usesFireproof: boolean;
  /** App.jsx calls `callAI(...)`. */
  readonly usesCallAi: boolean;
  /** App.jsx calls `callAI` with a `schema:` (structured extraction). */
  readonly usesCallAiSchema: boolean;
}

/** Read a file by basename, tolerating a leading slash (the collector keys vary). */
function pick(files: Readonly<Record<string, string>>, name: string): string {
  return files[name] ?? files[`/${name}`] ?? "";
}

export function computeStructure(files: Readonly<Record<string, string>>): StructureSignals {
  const appJsx = pick(files, "App.jsx");
  const accessJs = pick(files, "access.js");
  const hasAccessJs = accessJs.trim().length > 0;

  // Access logic in App.jsx: the access fn signature `(doc, oldDoc, user, ctx)`,
  // a named `access`/`function access(`, or the DSL/throw tokens appearing in the
  // component file — all mean access code leaked out of access.js.
  const accessInAppJsx =
    /\b(?:function\s+access\s*\(|const\s+access\s*=)/.test(appJsx) ||
    /\b(?:requireAccess|requireRole)\s*\(/.test(appJsx) ||
    /\bforbidden\s*:/.test(appJsx);

  return {
    hasAccessJs,
    accessInAppJsx,
    usesUseVibe: /\buseVibe\s*\(/.test(appJsx),
    gatesOnCan: /\bcan\.(?:create|edit|delete|update)\s*\(/.test(appJsx),
    usesUseViewer: /\buseViewer\s*\(/.test(appJsx),
    usesRequireAccess: /\brequireAccess\s*\(/.test(accessJs),
    usesRequireRole: /\brequireRole\s*\(/.test(accessJs),
    // A channel argument that is interpolated (`${`) or namespaced (`prefix:`) —
    // the per-object recipe (`list:<id>`), not a single global channel.
    perObjectChannel: /\brequireAccess\s*\(\s*[`"'][^`"')]*(?:\$\{|[A-Za-z0-9_]+:)/.test(accessJs),
    usesFireproof: /\b(?:useFireproof|useDocument|useLiveQuery)\s*\(/.test(appJsx),
    usesCallAi: /\bcallAI\s*\(/.test(appJsx),
    usesCallAiSchema: /\bcallAI\s*\(/.test(appJsx) && /\bschema\s*:/.test(appJsx),
  };
}
