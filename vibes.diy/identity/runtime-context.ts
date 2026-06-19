import { ensureSuperThis } from "@fireproof/core-runtime";
import type { SuperThis } from "@fireproof/core-types-base";

/**
 * The minimal runtime surface identity code needs: env access, text codecs
 * (base58/base64/utf8), and id generation. Intentionally a strict subset of
 * fireproof's `SuperThis` so the dependency can later be inverted — replaced
 * by an in-repo implementation or pushed down into `@adviser/cement` — without
 * touching any identity call site.
 *
 * v1 delegates to `ensureSuperThis()` so behavior is byte-identical to today;
 * a later phase narrows the surface and (optionally) drops the fireproof backing.
 */
export type RuntimeContext = Pick<SuperThis, "env" | "txt" | "nextId">;

let singleton: RuntimeContext | undefined;

export function ensureRuntimeContext(): RuntimeContext {
  return (singleton ??= ensureSuperThis());
}
