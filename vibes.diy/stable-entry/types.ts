import type { Fetcher } from "@cloudflare/workers-types";
import { Result, exception2Result, Lazy } from "@adviser/cement";

export const ROUTING_COOKIE = "se-group";
export const SPA_PREFIX = "/@stable-entry";
export const API_PATH = `${SPA_PREFIX}/api`;

// ─── Input (raw from JSON) ────────────────────────────────────────────────────

interface RouteTargetInput {
  desc?: string;
  target: string;
}

/** { path: { group: RouteTargetInput } } */
type BackendConfigInput = Record<string, Record<string, RouteTargetInput>>;

// ─── Normalized ───────────────────────────────────────────────────────────────

export interface RouteTarget {
  desc: string; // defaults to group key
  target: string;
}

/** path → group → RouteTarget. Paths are matched in insertion order (first wins). */
export type BackendConfig = Record<string, Record<string, RouteTarget>>;

export interface GroupStatus {
  key: string;
  desc: string;
  active: boolean;
}

export interface ApiResponse {
  /** path → groups (sorted longest-path-first) */
  routes: Record<string, GroupStatus[]>;
  /** current routing cookie: path → selected group key */
  cookie: Record<string, string>;
}

export interface Env {
  /** Stable fallback backend URL */
  BACKEND: string;
  /** JSON-encoded BackendConfig */
  BACKEND_CFG?: string;
  ASSETS: Fetcher;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export const getBackendConfig = Lazy(
  (raw?: string): Result<BackendConfig> => {
    if (!raw) return Result.Ok({});
    return exception2Result(() => {
      const input = JSON.parse(raw) as BackendConfigInput;
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => b.length - a.length)
          .map(([path, groups]) => [
            path,
            Object.fromEntries(Object.entries(groups).map(([group, t]) => [group, { desc: t.desc ?? group, target: t.target }])),
          ])
      );
    });
  },
  { resetAfter: 10000 }
);
