import { type } from "arktype";
import { vibeEnv, vibesDiyMountParams } from "@vibes.diy/use-vibes-base";

const metaProps = type({
  title: "string",
  description: "string",
});

export type MetaProps = typeof metaProps.infer;

export const vibesImportMap = type({
  imports: vibeEnv,
});

export type VibesImportMap = typeof vibesImportMap.infer;

export const vibesDiyServCtx = type({
  wrapper: {
    state: "'active'|'waiting'",
  },
  importMap: vibesImportMap,
  metaProps,
  mountJS: "string",
}).and(vibesDiyMountParams);

export type VibesDiyServCtx = typeof vibesDiyServCtx.infer;
