import { expectTypeOf } from "vitest";
import {
  type ShardKind,
  openVibe,
  openShared,
  openCodegen,
  type VibeShard,
  type SharedShard,
  type CodegenShard,
} from "./shard-policy.js";
import type { Req, MethodReqType, VibesDiyApiIface } from "./vibes-diy-api.js";
import type { ReqPutDoc } from "./app-documents.js";

expectTypeOf<ShardKind>().toEqualTypeOf<"codegen" | "vibe" | "shared">();
expectTypeOf(openVibe("alice", "todo")).toEqualTypeOf<VibeShard>();
// A raw string is NOT assignable to a branded shard key.
// @ts-expect-error branded key cannot be a bare string
const _bad: VibeShard = "alice--todo";
expectTypeOf(openShared()).toEqualTypeOf<SharedShard>();
expectTypeOf(openCodegen("uuid")).toEqualTypeOf<CodegenShard>();

// ── Task 3.1: phantom reqType on Req<T> recovered via MethodReqType ──────────
expectTypeOf<MethodReqType<(req: Req<ReqPutDoc>) => unknown>>().toEqualTypeOf<"vibes.diy.req-put-doc">();

// ── Task 3.3: every REQUEST-TAKING method maps to a concrete reqType ─────────
// Restrict the check to methods whose first parameter is a `Req<...>` (carries
// the `__reqType` phantom). No-arg ops (getTokenClaims, close) and callback
// registrars (onDocChanged, …) take no Req and are legitimately excluded.
type RequestTakingMethods = {
  [M in keyof VibesDiyApiIface]: Parameters<VibesDiyApiIface[M]>[0] extends { __reqType?: unknown } ? M : never;
}[keyof VibesDiyApiIface];
type AnyNever = {
  [M in RequestTakingMethods]: MethodReqType<VibesDiyApiIface[M]> extends never ? M : never;
}[RequestTakingMethods];
expectTypeOf<AnyNever>().toEqualTypeOf<never>();
