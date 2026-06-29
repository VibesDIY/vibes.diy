import { type } from "arktype";
import { FPApiParameters } from "@vibes.diy/identity";
import { VibesSvcEnv } from "./vibes-diy-serv-ctx.js";

// Structural shape of the Cloudflare Worker Loader (`env.LOADER`) binding for
// vibe SSR's isolate executor (#2802 slice 4). Defined here — not imported from
// `vibe-runtime` — so `@vibes.diy/api-types` stays self-contained when
// packed/published (a relative import would dangle in the tarball; per Codex
// review). Structurally compatible with vibe-runtime's `WorkerLoaderBinding`, so
// `params.vibes.loader` flows to `attemptVibeSsr` without a cast.
export interface WorkerLoaderBinding {
  get(id: string, factory: () => unknown): { getEntrypoint(): { fetch(request: Request): Promise<Response> } };
}

export interface PkgRepos {
  readonly workspace: string;
  readonly public: string;
}

// export const LLMDefault = type({
//   model: "string = 'anthropic/claude-sonnet-4.6'",
// });
// export type LLMDefault = typeof LLMDefault.infer;

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
    // The Cloudflare Worker Loader (env.LOADER) binding for vibe SSR's isolate
    // executor (#2802 slice 4). Beta; undefined until plumbed (#2845).
    loader?: WorkerLoaderBinding;
  };
  assetCacheUrl: string; // https://asset-cache.vibes.app/{assetId}
  // importMapProps: ImportMapProps;
  llm: {
    // default: LLMDefault;
    enforced: LLMEnforced;
    headers: LLMHeaders;
    url: string;
    apiKey: string;
  };
};
