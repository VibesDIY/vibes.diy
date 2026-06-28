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
import type { Req, MethodReqType } from "./vibes-diy-api.js";
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
