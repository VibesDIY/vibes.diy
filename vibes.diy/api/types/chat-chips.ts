import { isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import type { ResChatResponseTurn } from "./chat.js";

/**
 * Shared suggestion-chip projection — the ONE place that turns a vibe's persisted
 * chat into the `▸` edit-card chips. Lives in the browser-safe leaf package so
 * BOTH the server projection endpoint (`getVibeChips`, the anonymous read path)
 * and the in-place generation hook apply byte-identical chip semantics, with no
 * second copy to drift (#2755). The private chat stays the single source of
 * truth; this is the explicit allowlist projection over it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Option-line parsing (moved here from pkg/app/utils/option-lines.ts; the
// frontend module now re-exports these so existing importers are unchanged).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits an assistant message into prose and a trailing "▸ option" group.
 *
 * The chat UI renders option lines as clickable buttons. To avoid flickering
 * during streaming, a marker line is only counted as a button if it is fully
 * terminated (followed by a newline OR not the very last character of the
 * message).
 *
 * Mid-message marker groups are left in the prose — only a trailing group at
 * the end of the message is peeled off. This matches the prompt's
 * "question-then-options-then-end" cadence.
 */
export interface ParsedMessage {
  readonly prose: string;
  readonly options: readonly string[];
}

const MARKER = "▸"; // ▸ (BLACK RIGHT-POINTING SMALL TRIANGLE)

export interface ParseOptionLinesOptions {
  /**
   * When true (the default), the parser applies a "streaming flicker guard":
   * a trailing marker line that ends mid-word without a trailing newline is
   * deferred so the button text doesn't flicker as more characters arrive.
   * Pass false when the caller knows the message is fully streamed (e.g., the
   * chat is not in promptProcessing state) — the guard would otherwise drop
   * legitimate final markers like `▸ I'm done for now`.
   */
  readonly streaming?: boolean;
}

export function parseOptionLines(text: string, opts?: ParseOptionLinesOptions): ParsedMessage {
  if (!text) return { prose: "", options: [] };

  const streaming = opts?.streaming ?? true;

  // A marker line "counts" only if it is terminated by a newline. The last
  // line of a streaming message may be a partial marker — keep it in prose.
  const endsWithNewline = text.endsWith("\n");
  const lines = text.split("\n");

  // Determine which lines should be considered for the options group.
  // If the last line is a marker WITHOUT a newline AND ends mid-word
  // (letter or digit at the end), it's incomplete — exclude it.
  // Only applies when streaming is true; settled messages always include
  // the final marker even if it ends in a letter.
  let optionEndIndex = lines.length;
  if (streaming && !endsWithNewline && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    const lastStripped = lastLine.trimStart();
    if (lastStripped.startsWith(MARKER)) {
      const lastChar = lastLine[lastLine.length - 1];
      if (lastChar && /[a-zA-Z0-9]/.test(lastChar)) {
        optionEndIndex = lines.length - 1;
      }
    }
  }

  // Trim trailing blank lines so the backward scan can find the marker
  // group even when the source text ends with one or more newlines (which
  // split("\\n") materializes as trailing empty entries). Without this,
  // an early `break` on the first blank line would discard all options.
  while (optionEndIndex > 0 && lines[optionEndIndex - 1].trim() === "") {
    optionEndIndex--;
  }

  // Walk backward, collecting marker lines.
  let cutIndex = lines.length;
  for (let i = optionEndIndex - 1; i >= 0; i--) {
    const stripped = lines[i].trimStart();

    if (stripped.startsWith(MARKER)) {
      cutIndex = i;
    } else if (stripped === "") {
      // Allow blank lines between options if we've seen markers.
      if (cutIndex < lines.length) {
        continue;
      } else {
        break;
      }
    } else {
      // Non-marker, non-blank line — stop.
      break;
    }
  }

  if (cutIndex === lines.length) {
    // No full-line markers found. Let post-pass handle inline markers.
    return extractInlineMarkers(text, text, [], streaming);
  }

  const proseLines = lines.slice(0, cutIndex);
  const excludedLines = lines.slice(optionEndIndex);
  const optionLines = lines.slice(cutIndex, optionEndIndex).filter((line) => line.trimStart().startsWith(MARKER));
  const options = optionLines.map((line) => line.trimStart().slice(MARKER.length).trim()).filter(Boolean);

  // Include any excluded (incomplete) lines in the prose.
  const allProseLines = [...proseLines, ...excludedLines];

  const prose = allProseLines.join("\n");

  // Post-pass: handle the case where the model emitted an inline ▸ marker on
  // the same line as the question (or any earlier prose line). Find the last
  // non-blank line of prose; if it contains ▸, split that line — text before
  // the marker stays in prose, ▸ X segments after become additional options
  // prepended to the existing list (preserving source order).
  return extractInlineMarkers(text, prose, options, streaming);
}

function extractInlineMarkers(originalText: string, prose: string, options: readonly string[], streaming: boolean): ParsedMessage {
  const proseLines = prose.split("\n");
  let lastNonBlankIdx = -1;
  for (let i = proseLines.length - 1; i >= 0; i--) {
    if (proseLines[i].trim().length > 0) {
      lastNonBlankIdx = i;
      break;
    }
  }
  if (lastNonBlankIdx < 0) return { prose, options };

  const lastLine = proseLines[lastNonBlankIdx];
  const markerIdx = lastLine.indexOf(MARKER);
  if (markerIdx <= 0) return { prose, options };

  // Streaming guard: if we have no anchor options (existing full-line markers)
  // AND the inline-marker line is the very last line of the source message
  // without a trailing newline AND the trailing content ends mid-word, defer.
  // (Same heuristic the existing full-line streaming guard uses.)
  // Only applies when streaming is true; settled messages always extract inline markers.
  const isVeryLastSourceLine = lastNonBlankIdx === proseLines.length - 1 && !originalText.endsWith("\n");
  if (streaming && isVeryLastSourceLine && options.length === 0) {
    const lastChar = lastLine[lastLine.length - 1];
    if (lastChar && /[a-zA-Z0-9]/.test(lastChar)) {
      return { prose, options };
    }
  }

  const beforeMarker = lastLine.slice(0, markerIdx).trimEnd();
  const afterMarker = lastLine.slice(markerIdx);
  const inlineOptions = afterMarker
    .split(MARKER)
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);

  if (inlineOptions.length === 0) return { prose, options };

  if (beforeMarker === "") {
    proseLines.splice(lastNonBlankIdx, 1);
  } else {
    proseLines[lastNonBlankIdx] = beforeMarker;
  }

  return {
    prose: proseLines.join("\n"),
    options: [...inlineOptions, ...options],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip projection
// ─────────────────────────────────────────────────────────────────────────────

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
 * Pure + exported for testing. `turns` is the `getChatResponse`/`getVibeChips`
 * payload, ordered newest-first; we read the latest turn's assistant narration
 * (its `toplevel.line` blocks), parse the trailing `▸` option group, drop the
 * terminal "I'm done for now" chip, and cap at three. Anything missing (no
 * turns, a failed turn with no narration, a turn that ended without a question)
 * → no chips, and the card falls back to its text-input-only form.
 */
export function latestTurnChips(turns: readonly ResChatResponseTurn[], fsId?: string): readonly string[] {
  // Prefer the newest turn for THIS code version (fsId snapshot semantics) — the
  // chips should reflect the version being viewed, not whatever chat turn is
  // globally newest. Turns come newest-first, so find()/[0] both pick the newest
  // qualifying turn. Fall back to the newest turn overall when no fsId is pinned
  // (e.g. `/vibe/$owner/$app` with no version) or none matches.
  const pinned = (fsId ? turns.find((t) => t.fsId === fsId) : undefined) ?? turns[0];
  if (!pinned) return [];
  const pinnedChips = chipsForTurn(pinned);
  if (pinnedChips.length > 0) return pinnedChips;

  // The pinned turn carried no `▸` options — e.g. a CLI-seeded generation turn
  // whose narration was just `File: /App.jsx`, or a code turn that ended without
  // the interview tail. Rather than show an empty card, fall back to the newest
  // OTHER turn that actually has chips. Callers pass an already access-filtered
  // list (`getVibeChips` restricts non-members to the deployed version and its
  // talk-only turns), so this can never surface an unpublished draft's chips —
  // it's how a "talk-only" suggestions turn (fsId null, inheriting the deployed
  // version) lights up the card.
  for (const turn of turns) {
    if (turn === pinned) continue;
    const chips = chipsForTurn(turn);
    if (chips.length > 0) return chips;
  }
  return pinnedChips;
}

/** Project ONE turn's assistant narration into its trailing `▸` chips. */
function chipsForTurn(turn: ResChatResponseTurn): readonly string[] {
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
