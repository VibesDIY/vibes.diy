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
// Avatars are not shipped here — render them with <ViewerTag userHandle={...} />,
// which derives the avatar URL from the handle.
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "isOwner?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
export type ViewerEnv = typeof viewerEnv.infer;

export const vibeMountParams = type({
  usrEnv: vibeEnv,
  "viewerEnv?": viewerEnv,
});

export type VibeMountParams = typeof vibeMountParams.infer;
