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
import type { Req, MethodReqType, Conn, VibesDiyApiIface } from "./vibes-diy-api.js";
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

// ── Task 3.2: Conn<K> derives method availability from SHARD_POLICY ──────────
declare const vibe: Conn<"vibe">;
declare const shared: Conn<"shared">;
declare const codegen: Conn<"codegen">;

// put-doc is VIBE_ONLY → present on vibe, absent on shared/codegen.
vibe.putDoc({ ownerHandle: "a", appSlug: "t", dbName: "d", doc: {} }); // ok
// @ts-expect-error put-doc not allowed on shared
shared.putDoc({ ownerHandle: "a", appSlug: "t", dbName: "d", doc: {} });
// @ts-expect-error put-doc not allowed on codegen
codegen.putDoc({ ownerHandle: "a", appSlug: "t", dbName: "d", doc: {} });

// list-models is ALL_SHARDS → present on every kind.
shared.listModels({}); // ok
vibe.listModels({}); // ok
codegen.listModels({}); // ok

// fork-app is CODEGEN_ONLY → the method exists on codegen, absent on vibe.
expectTypeOf<"forkApp" extends keyof Conn<"codegen"> ? true : false>().toEqualTypeOf<true>();
expectTypeOf<"forkApp" extends keyof Conn<"vibe"> ? true : false>().toEqualTypeOf<false>();

// open-chat is a mode-predicate op: vibe accepts only mode:"img".
vibe.openChat({ mode: "img" }); // ok
// @ts-expect-error open-chat codegen-mode not allowed on vibe
vibe.openChat({ mode: "codegen" });
codegen.openChat({ mode: "codegen" }); // ok
codegen.openChat({ mode: "img" }); // ok
