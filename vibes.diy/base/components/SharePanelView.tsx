import React from "react";

/**
 * Presentational link-first share panel — the §2 "Share panel" design from
 * notes/2026-06-26-agent-in-vibe-ux-epic.md, built as a real `@vibes.diy/base`
 * component so it can be iterated in Storybook (the same single-source-of-truth
 * loop the unified card used). All actions are INJECTED: the runtime/chrome wires
 * copy / publish-intent / manage-access / view-live to the real ShareModal model
 * (pkg/app/components/ResultPreview/ShareModal), the Storybook sketch wires no-ops.
 *
 * Groundwork for #2680 (link-first Share, the #2232 cluster). Not yet wired into
 * the card's nav on the route — this is the canvas to design the panel on.
 */

export type PublishIntent = "shared" | "template" | "readonly";

export interface SharePanelViewProps {
  /** The shareable app URL. */
  readonly url: string;
  /** When true, the Copy button reads "Copied". */
  readonly copied?: boolean;
  readonly onCopy?: () => void;
  /** Opens the live published app (link-first: copy URL + inline "View live", #2234). */
  readonly onViewLive?: () => void;
  /** Owner sees publish-intent + Manage access; non-owner sees just the link (+ Request access). */
  readonly isOwner?: boolean;
  /** The one new owner setting (#1854): what the vibe is *for*. */
  readonly publishIntent?: PublishIntent;
  readonly onChangePublishIntent?: (intent: PublishIntent) => void;
  /** Opens the collapsed detail (members, requests, roles) — everything past link-first. */
  readonly onManageAccess?: () => void;
  /** The lone explicit access CTA for a request-gated visitor. */
  readonly onRequestAccess?: () => void;
  readonly className?: string;
}

const INTENTS: readonly { value: PublishIntent; label: string; hint: string }[] = [
  { value: "shared", label: "Shared space", hint: "People join and share data" },
  { value: "template", label: "Remix seed", hint: '"Make it yours" is the headline' },
  { value: "readonly", label: "Read-only", hint: "View only; editing makes a copy" },
];

export function SharePanelView({
  url,
  copied,
  onCopy,
  onViewLive,
  isOwner = true,
  publishIntent = "shared",
  onChangePublishIntent,
  onManageAccess,
  onRequestAccess,
  className,
}: SharePanelViewProps) {
  return (
    <div
      className={`text-light-primary dark:text-dark-primary ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Link-first: the URL + Copy is the whole default surface. */}
      <div>
        <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
          Anyone with the link can open this vibe.
        </p>
        <div
          className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 py-1.5 pl-3 pr-1.5"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span className="flex-1 truncate text-sm">{url}</span>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy link"
            className="shrink-0 rounded-[5px] border-2 border-[#1a1a1a] bg-blue-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-blue-600 active:translate-x-[2px] active:translate-y-[2px]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={onViewLive}
          className="mt-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View live ↗
        </button>
      </div>

      {isOwner ? (
        <>
          {/* The one new setting (#1854): sets access + remixability defaults. */}
          <div>
            <p className="text-xs text-light-secondary dark:text-dark-secondary" style={{ marginBottom: 6 }}>
              This vibe is for…
            </p>
            <div role="radiogroup" aria-label="Publish intent" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {INTENTS.map((intent) => {
                const active = intent.value === publishIntent;
                return (
                  <button
                    key={intent.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChangePublishIntent?.(intent.value)}
                    className={
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "border-[#1a1a1a] bg-light-background-01 dark:bg-dark-background-01"
                        : "border-light-decorative-01 dark:border-dark-decorative-01 hover:bg-light-background-01 dark:hover:bg-dark-background-01")
                    }
                  >
                    <span>
                      <span className="block text-sm font-medium">{intent.label}</span>
                      <span className="block text-xs text-light-secondary dark:text-dark-secondary">{intent.hint}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        borderRadius: "50%",
                        border: active ? "5px solid var(--vibes-blue, #3b82f6)" : "2px solid currentColor",
                        opacity: active ? 1 : 0.4,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onManageAccess}
            className="self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Manage access →
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onRequestAccess}
          className="rounded-md border-2 border-[#1a1a1a] bg-blue-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-600 active:translate-x-[2px] active:translate-y-[2px]"
        >
          Request access
        </button>
      )}
    </div>
  );
}

export default SharePanelView;
