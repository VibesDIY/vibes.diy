import { renderCurrentFiles } from "./recovery.js";

export interface SlotEntry {
  readonly label: string;
  readonly caption: string;
  readonly vfs: ReadonlyMap<string, string>;
  readonly canonical: boolean;
}

export interface RenderedBlock {
  readonly label: string;
  readonly text: string;
}

// Renders slots into headed text blocks. Within a non-canonical slot, any file
// whose content matches the canonical slot's same path is replaced with a
// pointer rather than full bytes. If every file in a non-canonical slot
// pointers out, the slot is omitted entirely (auto-collapse).
export function renderSlotsWithDedup(slots: readonly SlotEntry[], focusPath: string): RenderedBlock[] {
  const canonical = slots.find((s) => s.canonical);
  const out: RenderedBlock[] = [];
  for (const s of slots) {
    if (s === canonical) {
      const body = renderCurrentFiles(s.vfs, focusPath);
      out.push({
        label: s.label,
        text: `--- ${s.label} (${s.caption}) ---\n${body}`,
      });
      continue;
    }
    const dedupedVfs = new Map<string, string>();
    const pointerLines: string[] = [];
    for (const [path, content] of s.vfs.entries()) {
      const canonicalContent = canonical?.vfs.get(path);
      if (canonical && canonicalContent === content) {
        pointerLines.push(`--- ${path} (identical to ${canonical.label}) ---`);
      } else {
        dedupedVfs.set(path, content);
      }
    }
    // Auto-collapse: skip if all files are identical to canonical (no content to render)
    if (dedupedVfs.size === 0) continue;

    const body = renderCurrentFiles(dedupedVfs, focusPath);
    const parts: string[] = [`--- ${s.label} (${s.caption}) ---`, body];
    parts.push(...pointerLines);
    const text = parts.join("\n");
    out.push({ label: s.label, text });
  }
  return out;
}

export type CanonicalKind = "recovery" | "selected-draft" | "previous" | "none";

export interface CanonicalInputs {
  readonly recoveryPartial?: ReadonlyMap<string, string>;
  readonly selectedDraft?: ReadonlyMap<string, string>;
  readonly previous?: ReadonlyMap<string, string>;
}

export function pickCanonicalHome(inputs: CanonicalInputs): CanonicalKind {
  if (inputs.recoveryPartial) return "recovery";
  if (inputs.selectedDraft) return "selected-draft";
  if (inputs.previous) return "previous";
  return "none";
}
