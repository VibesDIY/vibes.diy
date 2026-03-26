import React from "react";
import { FlagToggle } from "./shared.js";
import { AppSettings } from "@vibes.diy/api-types";

interface PublicSharingSectionProps {
  publicAccess: AppSettings["entry"]["publicAccess"];
  toggling: string | null;
  onToggle: () => void;
}

export function PublicSharingSection({ publicAccess, toggling, onToggle }: PublicSharingSectionProps) {
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Public Sharing</div>
      <FlagToggle label="public sharing" enabled={!!publicAccess?.enable} toggling={toggling === "public"} onToggle={onToggle} />
    </li>
  );
}
