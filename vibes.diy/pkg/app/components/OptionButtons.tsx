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
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {isFirst && (
        <p className="text-xs text-light-secondary dark:text-dark-secondary" data-testid="option-buttons-explainer">
          These are optional. Pick one to suggest the next improvement, or type your own change.
        </p>
      )}
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect?.(option)}
          className={
            "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
            "border border-light-decorative-01 dark:border-dark-decorative-01 " +
            "bg-light-background-01 dark:bg-dark-background-01 " +
            "text-light-primary dark:text-dark-primary " +
            (disabled
              ? "cursor-default opacity-70"
              : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default OptionButtons;
