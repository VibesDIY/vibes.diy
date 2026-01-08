import React from "react";
import {
  CodeIcon,
  DataIcon,
  PreviewIcon,
  SettingsIcon,
} from "../HeaderContent/SvgIcons.js";
import { ViewType } from "@vibes.diy/prompts";

interface ViewControlsProps {
  viewControls: Record<
    string,
    {
      enabled: boolean;
      icon: string;
      label: string;
      loading?: boolean;
    }
  >;
  currentView: ViewType;
  onClick?: (view: ViewType) => void;
}

export const ViewControls: React.FC<ViewControlsProps> = ({
  viewControls,
  currentView,
  onClick,
}) => {
  return (
    <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center gap-1 rounded-md p-1 shadow-sm">
      {Object.entries(viewControls)
        .filter(([viewType]) => viewType !== "chat")
        .map(([viewType, control]) => {
          const viewTypeKey = viewType as ViewType;
          const isActive = currentView === viewTypeKey;

          return (
            <button
              key={viewType}
              type="button"
              disabled={!control.enabled}
              onClick={() => onClick && onClick(viewTypeKey)}
              className={`flex items-center justify-center space-x-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${
                isActive
                  ? "bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm"
                  : "text-light-primary/90 dark:text-dark-primary/90 hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 hover:text-light-primary dark:hover:text-dark-primary"
              } ${!control.enabled ? "!pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              aria-label={`Switch to ${control.label}`}
            >
              {viewTypeKey === "preview" && (
                <PreviewIcon
                  className="h-4 w-4"
                  isLoading={!!control.loading}
                  title={
                    control.loading ? "App is fetching data" : "Preview icon"
                  }
                />
              )}
              {viewTypeKey === "code" && (
                <CodeIcon
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  isLoading={currentView === "preview" && !!control.loading}
                />
              )}
              {viewTypeKey === "data" && (
                <DataIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              {viewTypeKey === "settings" && (
                <SettingsIcon className="h-4 w-4" />
              )}
              <span className="hidden min-[480px]:inline">{control.label}</span>
            </button>
          );
        })}
    </div>
  );
};
