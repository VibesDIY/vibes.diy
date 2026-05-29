import React from "react";

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
  readonly onSelect?: (option: string) => void;
}

/**
 * Stacked clickable answer options for a brainstorm question.
 *
 * Rendered inside an assistant message bubble below the prose. Disabled state
 * is used for non-most-recent messages — the buttons stay visually present
 * (history) but cannot be clicked.
 */
export function OptionButtons({ options, disabled, isFirst, onSelect }: OptionButtonsProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

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
    onSelect?.(option);
  };

  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {isFirst && (
        <p className="text-xs text-light-secondary dark:text-dark-secondary" data-testid="option-buttons-explainer">
          These are optional. Pick one to suggest the next improvement, or type your own change.
        </p>
      )}
      {options.map((option) => {
        const isPressed = selected === option;
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            aria-pressed={isPressed}
            onClick={() => handleClick(option)}
            className={
              "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
              "border border-light-decorative-01 dark:border-dark-decorative-01 " +
              "bg-light-background-01 dark:bg-dark-background-01 " +
              "text-light-primary dark:text-dark-primary " +
              (locked
                ? "cursor-default opacity-70"
                : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
            }
          >
            <span>{option}</span>
            {isPressed && (
              <span
                data-testid="option-spinner"
                aria-hidden="true"
                className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default OptionButtons;
