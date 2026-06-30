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

  // Vibe SSR mode (#2802 slice 4): "off" (default) | "node" | "loader". Anything
  // unrecognized parses to "off", so SSR stays dark unless explicitly enabled.
  "VIBES_SSR?": "string",

  // Cached-suggestion read lane (#2801): "on" enables the client producer +
  // read-lane lookup; anything else (incl. undefined) keeps it dark. Set in
  // [env.preview] so we validate in the PR preview without touching prod.
  "VIBES_CACHED_SUGGESTIONS?": "string",

  // Per-app backend.js mode (#2856): "loader" | "off" (default). Anything but
  // "loader" keeps backend.js dark. Read on the putDoc/deleteDoc path to gate the
  // onChange emit (B5) so writes enqueue nothing while the feature is off.
  "BACKEND_JS?": "string",

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
