import React from "react";

/**
 * Per-option adornments (#2917). A host can hang a non-interactive `badge` inside
 * the option button's trailing slot (e.g. a server-authoritative "stays here"
 * shield) and/or an interactive `aside` rendered as a SIBLING to the right of the
 * button — never nested, because a `<button>` inside a `<button>` is invalid HTML
 * (e.g. an owner-only bless/unbless toggle).
 */
export interface OptionDecoration {
  readonly badge?: React.ReactNode;
  readonly aside?: React.ReactNode;
}

interface OptionButtonsProps {
  readonly options: readonly string[];
  /** Disabled buttons (older, non-most-recent messages) render as visual history. */
  readonly disabled?: boolean;
  /**
   * When true, render a one-line explainer above the buttons telling the user
   * the options are optional and they can type their own change instead. Set
   * only on the first assistant message in a chat that has options — the user
   * only needs to see the explainer once.
   */
  readonly isFirst?: boolean;
  /**
   * Overrides the default one-line explainer shown when `isFirst` is true. Lets a
   * host (e.g. the in-vibe edit card) frame the affordance differently from chat
   * without forking the component.
   */
  readonly firstMessage?: string;
  readonly onSelect?: (option: string) => boolean | undefined | Promise<boolean | undefined>;
  /**
   * Optional per-option adornments (#2917). Return `undefined` for an option to
   * leave it a plain button (the default for every caller that omits this prop —
   * the rendered DOM is then byte-identical to the un-decorated component).
   */
  readonly decorate?: (option: string) => OptionDecoration | undefined;
}

/**
 * Stacked clickable answer options for a brainstorm question.
 *
 * Rendered inside an assistant message bubble below the prose. Disabled state
 * is used for non-most-recent messages — the buttons stay visually present
 * (history) but cannot be clicked.
 */
export function OptionButtons({ options, disabled, isFirst, firstMessage, onSelect, decorate }: OptionButtonsProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  const clearIfStillSelected = React.useCallback((option: string) => {
    setSelected((current) => (current === option ? null : current));
  }, []);

  // When this message scrolls into history (disabled flips true) drop the
  // pressed state so it doesn't linger as a stuck highlight.
  React.useEffect(() => {
    if (disabled) setSelected(null);
  }, [disabled]);

  if (options.length === 0) return null;

  // Locked once a selection is made (instant feedback) or when this is history.
  const locked = disabled || selected !== null;

  const handleClick = (option: string) => {
    if (locked) return;
    setSelected(option);
    try {
      const selectResult = onSelect?.(option);
      if (selectResult === false) {
        clearIfStillSelected(option);
        return;
      }
      if (selectResult && typeof selectResult === "object" && "then" in selectResult) {
        void Promise.resolve(selectResult)
          .then((ok) => {
            if (ok === false) clearIfStillSelected(option);
          })
          .catch(() => {
            clearIfStillSelected(option);
          });
      }
    } catch {
      clearIfStillSelected(option);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {/* Working-state sweep for the pressed option: a faint highlight drifting
          across the button so a click that kicks off async work (cache lookup,
          cross-slug navigation) visibly reads as "accepted, working" instead of
          dead. Self-contained (no global.css dependency) so every host of this
          component gets it; mid-gray at low alpha reads in light and dark. */}
      <style>{`
        @keyframes option-working-sweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .option-working {
            background-image: linear-gradient(100deg, transparent 35%, rgba(128, 128, 128, 0.18) 50%, transparent 65%);
            background-size: 250% 100%;
            background-repeat: no-repeat;
            animation: option-working-sweep 1.4s linear infinite;
          }
        }
      `}</style>
      {isFirst && (
        <p className="text-xs text-light-secondary dark:text-dark-secondary" data-testid="option-buttons-explainer">
          {firstMessage ?? "These are optional. Pick one to suggest the next improvement, or type your own change."}
        </p>
      )}
      {options.map((option) => {
        const isPressed = selected === option;
        const deco = decorate?.(option);
        const button = (
          <button
            type="button"
            disabled={locked}
            aria-pressed={isPressed}
            onClick={() => handleClick(option)}
            className={
              "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
              // An `aside` sibling owns the row's right edge, so the button grows
              // to fill; without one it spans the row exactly as before.
              (deco?.aside ? "min-w-0 flex-1 " : "w-full ") +
              "border border-light-decorative-01 dark:border-dark-decorative-01 " +
              "bg-light-background-01 dark:bg-dark-background-01 " +
              "text-light-primary dark:text-dark-primary " +
              (isPressed ? "option-working " : "") +
              (locked
                ? "cursor-default opacity-70"
                : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
            }
          >
            <span>{option}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {deco?.badge}
              {isPressed && (
                <span
                  data-testid="option-spinner"
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              )}
            </span>
          </button>
        );
        // No `aside` → the button is the flex child directly (identical layout to
        // the un-decorated component). An `aside` pairs it with a sibling control.
        return deco?.aside ? (
          <div key={option} className="flex items-center gap-1.5">
            {button}
            {deco.aside}
          </div>
        ) : (
          <React.Fragment key={option}>{button}</React.Fragment>
        );
      })}
    </div>
  );
}

export default OptionButtons;
