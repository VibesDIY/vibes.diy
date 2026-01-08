import { BackArrowIcon } from "../HeaderContent/SvgIcons.js";
import React from "react";

interface BackButtonProps {
  onBackClick: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onBackClick }) => {
  return (
    <button
      type="button"
      onClick={onBackClick}
      className="bg-light-decorative-00 dark:bg-dark-decorative-00 text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center justify-center rounded-md p-2 transition-colors md:hidden"
      aria-label="Back to chat"
    >
      <BackArrowIcon />
    </button>
  );
};
