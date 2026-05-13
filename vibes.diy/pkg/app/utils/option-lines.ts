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
