import { type } from "arktype";

export const vibesEnvSchema = type({
  FPCLOUD_URL: "string",
  DASHBOARD_URL: "string",
  // CLERK_PUBLISHABLE_KEY: "string",
  // CALLAI_API_KEY: "string",
  // CALLAI_CHAT_URL: "string",
  // CALLAI_IMG_URL: "string",
  VIBES_DIY_STYLES_URL: "string",
  VIBES_DIY_API_URL: "string",
});

export const vibesSvcEnv = type({
  DEV_SERVER_HOST: "string",
  DEV_SERVER_PORT: "string",
  GTM_CONTAINER_ID: "string",
  POSTHOG_KEY: "string",
  POSTHOG_HOST: "string",
}).and(vibesEnvSchema);

export type VibesSvcEnv = typeof vibesSvcEnv.infer;

export type VibesEnv = typeof vibesEnvSchema.infer;

export const vibeEnv = type("Record<string, string>");
export type VibeEnv = typeof vibeEnv.infer;

// const slugPattern = /^(?!.*\/|.*--|.*\.\.)[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;

// export const vibeBindings = type({
//   appSlug: "string < 30",
//   userSlug: "string < 30",
//   "fsId?": "string",
// //   "groupId?": slugPattern,
// });
// export type VibeBindings = typeof vibeBindings.infer;

export const vibesDiyMountParams = type({
  //   bindings: vibeBindings,
  env: vibeEnv.and(vibesEnvSchema),
});
export type VibesDiyMountParams = typeof vibesDiyMountParams.infer;
