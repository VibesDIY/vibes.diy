import { type } from "arktype";

// The per-document access level a viewer resolves to. Kept in its own leaf
// module (no barrel imports) so dependency-light modules like db-acl-eval.ts
// can import it without pulling the whole @vibes.diy/vibe-types barrel.
export const docAccessLevel = type("'override' | 'editor' | 'viewer' | 'submitter' | 'none'");
export type DocAccessLevel = typeof docAccessLevel.infer;
