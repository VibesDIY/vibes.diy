import { type } from "arktype";
import { vibeUserEnv } from "./common.js";

export const vibesSvcEnv = type({
  CLERK_PUBLISHABLE_KEY: "string",
  // CLERK_PUBLISHABLE_KEY: "string",
  // CALLAI_API_KEY: "string",
  // CALLAI_CHAT_URL: "string",
  // CALLAI_IMG_URL: "string",
  VIBES_DIY_API_URL: "string",

  "GTM_CONTAINER_ID?": "string",
  "POSTHOG_KEY?": "string",
  "POSTHOG_HOST?": "string",

  // "DEV_SERVER_HOST?": "string",
  // "DEV_SERVER_PORT?": "string",

  //VIBES_DIY_FROM_EMAIL: "string",
  //RESEND_API_KEY: "string",

  VIBES_DIY_PUBLIC_BASE_URL: "string",

  // GTM_CONTAINER_ID: "string",
  // POSTHOG_KEY: "string",
  // POSTHOG_HOST: "string",
});

export type VibesSvcEnv = typeof vibesSvcEnv.infer;

const metaProps = type({
  title: "string",
  description: "string",
  "imageUrl?": "string",
  "canonicalUrl?": "string",
});

export type MetaProps = typeof metaProps.infer;

export const vibeImportMap = type({
  imports: type("Record<string, string>"),
});

export type VibeImportMap = typeof vibeImportMap.infer;

export const vibesDiyServCtx = type({
  wrapper: {
    state: "'active'|'waiting'",
  },
  usrEnv: vibeUserEnv,
  svcEnv: vibesSvcEnv,
  importMap: vibeImportMap,
  metaProps,
  mountJS: "string",
  // Server-rendered vibe HTML to inject into the `vibe-app-container` (#2802
  // slice 4). Present only when the SSR executor ran successfully; when absent
  // the container ships empty (client-only render, today's path). Its presence
  // is what flips `VibePage` to emit the `data-vibe-ssr` hydration marker.
  "ssrHtml?": "string",
}); // .and(vibesDiyMountParams);

export type VibesDiyServCtx = typeof vibesDiyServCtx.infer;
