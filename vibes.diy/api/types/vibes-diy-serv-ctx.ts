import { type } from "arktype";
import { vibeUserEnv } from "./msg-types.js";

export const vibesSvcEnv = type({
  CLERK_PUBLISHABLE_KEY: "string",
  FPCLOUD_URL: "string",
  DASHBOARD_URL: "string",
  // CLERK_PUBLISHABLE_KEY: "string",
  // CALLAI_API_KEY: "string",
  // CALLAI_CHAT_URL: "string",
  // CALLAI_IMG_URL: "string",
  VIBES_DIY_STYLES_URL: "string",
  VIBES_DIY_API_URL: "string",

  "GTM_CONTAINER_ID?": "string",
  "POSTHOG_KEY?": "string",
  "POSTHOG_HOST?": "string",

  "DEV_SERVER_HOST?": "string",
  "DEV_SERVER_PORT?": "string",
  // GTM_CONTAINER_ID: "string",
  // POSTHOG_KEY: "string",
  // POSTHOG_HOST: "string",
});

export type VibesSvcEnv = typeof vibesSvcEnv.infer;

const metaProps = type({
  title: "string",
  description: "string",
});

export type MetaProps = typeof metaProps.infer;

export const vibesImportMap = type({
  imports: type("Record<string, string>"),
});

export type VibesImportMap = typeof vibesImportMap.infer;

export const vibesDiyServCtx = type({
  wrapper: {
    state: "'active'|'waiting'",
  },
  usrEnv: vibeUserEnv,
  svcEnv: vibesSvcEnv,
  importMap: vibesImportMap,
  metaProps,
  mountJS: "string",
}); // .and(vibesDiyMountParams);

export type VibesDiyServCtx = typeof vibesDiyServCtx.infer;
