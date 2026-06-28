import { useEffect, useState } from "react";
import { isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import type { ResChatResponseTurn, VibesDiyApiIface } from "@vibes.diy/api-types";
import { parseOptionLines } from "../utils/option-lines.js";

// The auto-interview tail the model appends to every codegen turn ends with a
// terminal "▸ I'm done for now" dismiss chip. It belongs in the chat (where it
// closes the interview), never on the edit card — so we drop it here. (jchris)
const TERMINAL_CHIP = "i'm done for now";

// The edit card is a low-choice trained gesture. The auto-interview emits 2–4
// options; cap at three after dropping the terminal chip.
const MAX_CHIPS = 3;

/**
 * Shape an assistant turn's narration text into edit-card chips: parse the
 * trailing `▸` option group, drop the terminal "I'm done for now" dismiss chip,
 * and cap at three. Shared by the persisted-chat read (`latestTurnChips`) and the
 * in-place generation hook (which parses its own freshly-streamed block) so both
 * surfaces apply identical chip semantics.
 */
export function chipsFromNarration(text: string): readonly string[] {
  const { options } = parseOptionLines(text, { streaming: false });
  return options.filter((o) => o.trim().toLowerCase() !== TERMINAL_CHIP).slice(0, MAX_CHIPS);
}

/**
 * Derive the edit-card suggestion chips from a vibe's most recent chat turn.
 *
 * Pure + exported for testing. `turns` is the `getChatResponse` payload, ordered
 * newest-first; we read the latest turn's assistant narration (its
 * `toplevel.line` blocks), parse the trailing `▸` option group, drop the terminal
 * "I'm done for now" chip, and cap at three. Anything missing (no turns, a failed
 * turn with no narration, a turn that ended without a question) → no chips, and
 * the card falls back to its text-input-only form.
 */
export function latestTurnChips(turns: readonly ResChatResponseTurn[], fsId?: string): readonly string[] {
  // Prefer the newest turn for THIS code version (fsId snapshot semantics) — the
  // chips should reflect the version being viewed, not whatever chat turn is
  // globally newest. Turns come newest-first, so find()/[0] both pick the newest
  // qualifying turn. Fall back to the newest turn overall when no fsId is pinned
  // (e.g. `/vibe/$owner/$app` with no version) or none matches.
  const turn = (fsId ? turns.find((t) => t.fsId === fsId) : undefined) ?? turns[0];
  if (!turn) return [];
  const text = turn.sections
    .flatMap((s) => s.blocks)
    // NB: wrap the guard — `isToplevelLine(msg, streamId?)` takes an optional
    // second arg, and Array.filter would pass the element index into it, so a
    // bare `.filter(isToplevelLine)` drops every block after index 0. (#footgun)
    .filter((b): b is ToplevelLineMsg => isToplevelLine(b))
    .map((b) => b.line)
    .join("\n");
  return chipsFromNarration(text);
}

/**
 * Load the latest suggestion chips for a vibe's edit card.
 *
 * Sources the chips from the vibe's persisted chat via `getChatResponse` — a
 * normal read, no more expensive than any other DB query. The read is owner-gated
 * on the server, and the owner's chat is private, so we only `enabled` it for the
 * owner; non-owners/visitors get the text-input-only card. Returns `[]` until
 * loaded and on any error.
 */
export function useLatestVibeChips(args: {
  readonly sharedApi: Pick<VibesDiyApiIface, "getChatResponse">;
  readonly ownerHandle?: string;
  readonly appSlug?: string;
  /** The code version being viewed; chips prefer this turn's suggestions. */
  readonly fsId?: string;
  readonly enabled: boolean;
}): readonly string[] {
  const { sharedApi, ownerHandle, appSlug, fsId, enabled } = args;
  const [chips, setChips] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!enabled || !ownerHandle || !appSlug) {
      setChips([]);
      return;
    }
    let cancelled = false;
    void sharedApi
      .getChatResponse({ ownerHandle, appSlug })
      .then((r) => {
        if (cancelled) return;
        setChips(r.isErr() ? [] : latestTurnChips(r.Ok().turns, fsId));
      })
      .catch(() => {
        if (!cancelled) setChips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sharedApi, ownerHandle, appSlug, fsId, enabled]);

  return chips;
}
