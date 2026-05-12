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

import { generateLastEditBlock } from "./last-edit-diff.js";
import type { SlotConfig } from "../../types/chat.js";

export interface AssembleInputs {
  readonly original?: { readonly vfs: ReadonlyMap<string, string>; readonly turnsAgo: number };
  readonly prev2?: ReadonlyMap<string, string>;
  readonly previous?: ReadonlyMap<string, string>;
  readonly selectedVersion?: { readonly vfs: ReadonlyMap<string, string>; readonly turnsAgo: number };
  readonly selectedDraft?: ReadonlyMap<string, string>;
  readonly recoveryPartial?: ReadonlyMap<string, string>;
  readonly focusPath: string;
  readonly config: SlotConfig;
}

export interface AssembledMessage {
  readonly role: "user";
  readonly label: string;
  readonly text: string;
}

export function assembleSlotMessages(inputs: AssembleInputs): AssembledMessage[] {
  const cfg = inputs.config;
  const muted = (k: keyof SlotConfig) => cfg[k] === "off";
  const canonical = pickCanonicalHome({
    recoveryPartial: inputs.recoveryPartial,
    selectedDraft: inputs.selectedDraft,
    previous: inputs.previous,
  });

  // Snapshot entries flow through renderSlotsWithDedup. Order: ORIGINAL, SELECTED_VERSION,
  // PREVIOUS-as-reference (when demoted), canonical home (rendered last).
  const snapshotEntries: SlotEntry[] = [];

  if (inputs.original && !muted("original")) {
    snapshotEntries.push({
      label: "ORIGINAL",
      caption: `scaffold — first response, ${inputs.original.turnsAgo} turns ago`,
      vfs: inputs.original.vfs,
      canonical: false,
    });
  }

  if (inputs.selectedVersion && !muted("selected")) {
    snapshotEntries.push({
      label: "SELECTED_VERSION",
      caption: `user is currently viewing this, from ${inputs.selectedVersion.turnsAgo} turns ago`,
      vfs: inputs.selectedVersion.vfs,
      canonical: false,
    });
  }

  if (inputs.previous && !muted("previous") && canonical !== "previous") {
    snapshotEntries.push({
      label: "PREVIOUS",
      caption: "last server-side state — for reference; the disk/recovery state has since changed",
      vfs: inputs.previous,
      canonical: false,
    });
  }

  if (canonical === "recovery" && inputs.recoveryPartial) {
    snapshotEntries.push({
      label: "RECOVERY_PARTIAL",
      caption: "partial state captured during recovery; anchor SEARCH against this exact content",
      vfs: inputs.recoveryPartial,
      canonical: true,
    });
  } else if (canonical === "selected-draft" && inputs.selectedDraft && !muted("selected")) {
    snapshotEntries.push({
      label: "SELECTED_DRAFT",
      caption: "current disk contents — anchor SEARCH against these bytes",
      vfs: inputs.selectedDraft,
      canonical: true,
    });
  } else if (canonical === "previous" && inputs.previous && !muted("previous")) {
    const breadcrumb = inputs.original ? `; ORIGINAL scaffold is ${inputs.original.turnsAgo} turns earlier` : "";
    snapshotEntries.push({
      label: "PREVIOUS",
      caption: `current state — anchor SEARCH here${breadcrumb}`,
      vfs: inputs.previous,
      canonical: true,
    });
  }

  // LAST_EDIT body computed separately from snapshot rendering (it's a diff, not a vfs slot).
  let lastEditText: string | undefined;
  if (inputs.prev2 && inputs.previous && !muted("last_edit")) {
    const block = generateLastEditBlock(inputs.prev2, inputs.previous);
    if (block) {
      lastEditText = `--- LAST_EDIT (the diff that produced the current PREVIOUS state) ---\n${block}`;
    }
  }

  // Determine where LAST_EDIT inserts: immediately before the canonical label, or at the end if no canonical.
  const canonicalLabel = snapshotEntries.find((e) => e.canonical)?.label;
  const rendered = renderSlotsWithDedup(snapshotEntries, inputs.focusPath);
  const out: AssembledMessage[] = [];
  for (const r of rendered) {
    if (lastEditText && canonicalLabel && r.label === canonicalLabel) {
      out.push({ role: "user", label: "LAST_EDIT", text: lastEditText });
      lastEditText = undefined;
    }
    out.push({ role: "user", label: r.label, text: r.text });
  }
  if (lastEditText) {
    out.push({ role: "user", label: "LAST_EDIT", text: lastEditText });
  }
  return out;
}
