import { type } from "arktype";
import { viewerPayload, docAccessLevel } from "@vibes.diy/vibe-types";

// the vibe'd react website
export const vibeEnv = type({});

// `dbAcl` shape — matches @vibes.diy/api-types' DbAcl, defined locally
// for the same reason db-acl-allows.ts redefines it: api-types pulls
// cloudflare/fireproof server-side deps that don't belong in a browser
// runtime bundle. Schema kept in lockstep with api-types/db-acls.ts.
const dbAcl = type({
  "read?": "('members' | 'editors' | 'submitters' | 'readers')[]",
  "write?": "('members' | 'editors' | 'submitters' | 'readers')[]",
  "delete?": "('members' | 'editors' | 'submitters' | 'readers')[]",
});

// Server-computed viewer info, embedded into the iframe's HTML by
// render-vibe so the very first React render already has identity.
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
  // Absolute origin used by avatarUrlFor() to construct
  // `${apiBaseUrl}/u/${slug}/avatar`. Server fills this in at render time.
  apiBaseUrl: "string",
});
export type ViewerEnv = typeof viewerEnv.infer;

export const vibeMountParams = type({
  usrEnv: vibeEnv,
  "viewerEnv?": viewerEnv,
});

export type VibeMountParams = typeof vibeMountParams.infer;
