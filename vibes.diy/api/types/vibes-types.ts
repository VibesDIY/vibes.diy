import { type } from "arktype";
import { FPApiParameters } from "@fireproof/core-types-protocols-dashboard";
import { VibesSvcEnv } from "./vibes-diy-serv-ctx.js";

export interface PkgRepos {
  readonly workspace: string;
  readonly public: string;
}

export const LLMDefault = type({
  model: "string = 'anthropic/claude-3-opus'",
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
  wrapperBaseUrl: string; // relative should be access to Clerk-Auth to provide the entrypoint via postmessage the tokens to access FPCloud
  vibes: {
    svc: {
      hostnameBase: string; // localhost.vibes.app
      protocol: "https" | "http";
    };
    env: VibesSvcEnv;
  };
  assetCacheUrl: string; // https://asset-cache.vibes.app/{assetId}
  // importMapProps: ImportMapProps;
  llm: {
    default: LLMDefault;
    enforced: LLMEnforced;
    headers: LLMHeaders;
  };
};
