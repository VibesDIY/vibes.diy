import { type } from "arktype";
import { viewerPayload, docAccessLevel } from "@vibes.diy/vibe-types";

// the vibe'd react website
export const vibeEnv = type({});

// `dbAcl` runtime validator for the viewer-env wire shape. The structural
// DbAcl type is now defined once in @vibes.diy/vibe-types (db-acl-eval); this
// inline arktype value is kept local only as a browser-safe validator, since
// api-types' `dbAcl` schema is not re-exported from vibe-types. Kept in lockstep
// with that shape. TODO(#2014 follow-up): export the arktype from vibe-types and
// import it here to retire this last copy.
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
