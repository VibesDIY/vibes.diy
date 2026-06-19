import { createContext } from "react-router";
import type { VibesFPApiParameters } from "@vibes.diy/api-types";

// Load-context payload seeded by the Cloudflare worker (workers/app.ts) and
// consumed by route loaders (root.tsx and the vibe viewer route).
//
// React Router v8 delivers a loader's `context` as a RouterContextProvider
// rather than the plain object used by the v7 AppLoadContext pattern, so we
// thread the payload through a typed context key and read it with
// `context.get(vibeLoadContext)`.
export interface VibeLoadContext {
  readonly vibeDiyAppParams: VibesFPApiParameters;
  readonly vibeOgTitle?: string;
  readonly isWorldReadable?: boolean;
}

export const vibeLoadContext = createContext<VibeLoadContext>();
