import { type } from "arktype";
import { FPApiParameters } from "@fireproof/core-types-protocols-dashboard";
import { VibesSvcEnv } from "./vibes-diy-serv-ctx.js";

export interface PkgRepos {
  readonly workspace: string;
  readonly public: string;
}

export const LLMDefault = type({
  model: "string = 'anthropic/claude-sonnet-4.6'",
});
export type LLMDefault = typeof LLMDefault.infer;

export const LLMEnforced = type({
  debug: "boolean = false",
  transforms: type("string[]").default(() => ["middle-out"]),
});
export type LLMEnforced = typeof LLMEnforced.infer;

export const LLMHeaders = type({
  "HTTP-Referer": type("string").default("https://vibes.diy"),
  "X-Title": type("string").default("Vibes DIY"),
  "[string]": "string",
});
export type LLMHeaders = typeof LLMHeaders.infer;

export type VibesFPApiParameters = Pick<FPApiParameters, "cloudPublicKeys" | "clerkPublishableKey"> & {
  maxAppSlugPerUserId: number;
  maxUserSlugPerUserId: number;
  maxAppsPerUserId: number;
  pkgRepos: PkgRepos;
  vibes: {
    svc: {
      hostnameBase: string; // localhost.vibes.app
      protocol: "https" | "http";
      port?: string; // optional, default to 443 for https and 80 for http
    };
    env: VibesSvcEnv;
  };
  assetCacheUrl: string; // https://asset-cache.vibes.app/{assetId}
  // importMapProps: ImportMapProps;
  llm: {
    default: LLMDefault;
    runtimeModel?: string;
    enforced: LLMEnforced;
    headers: LLMHeaders;
  };
};
