import React from "react";
import { MinidiscIcon } from "../HeaderContent/SvgIcons.js";
import { Button } from "../ui/button.js";
import { SaveButtonProps, ButtonColor } from "./SaveButton.types.js";

export const SaveButton: React.FC<SaveButtonProps> = ({
  onClick,
  hasChanges,
  syntaxErrorCount = 0,
  color = "blue",
  testId,
}) => {
  if (!hasChanges) return null;

  const hasErrors = syntaxErrorCount > 0;
  const variant: ButtonColor = hasErrors ? "danger" : color;

  const buttonText = hasErrors
    ? `${syntaxErrorCount} Error${syntaxErrorCount !== 1 ? "s" : ""}`
    : "Save";

  return (
    <Button
      data-testid={testId}
      onClick={onClick}
      disabled={hasErrors}
      variant={variant}
      size="default"
      title="Save changes"
    >
      <MinidiscIcon className="h-4 w-4" />
      <span className="hidden sm:inline">{buttonText}</span>
    </Button>
  );
};
