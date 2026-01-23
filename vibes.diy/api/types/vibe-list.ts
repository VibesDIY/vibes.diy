import { type } from "arktype";
import { dashAuthType } from "./msg-types.js";

// Deployed vibes.diy app info for listings
export const vibeListItem = type({
  appSlug: "string",
  userSlug: "string",
  mode: "'production'|'dev'",
  fsId: "string",
  releaseSeq: "number",
  created: "string",
});

export type VibeListItem = typeof vibeListItem.infer;

// Request to list user's vibes
export const reqListMyVibes = type({
  type: "'vibes.diy.req-list-my-vibes'",
  auth: dashAuthType,
});

export type ReqListMyVibes = typeof reqListMyVibes.infer;

// Response with user's vibes
export const resListMyVibes = type({
  type: "'vibes.diy.res-list-my-vibes'",
  vibes: [vibeListItem, "[]"],
});

export type ResListMyVibes = typeof resListMyVibes.infer;
