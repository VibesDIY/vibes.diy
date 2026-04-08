import React from "react";
import { CodeIcon, DataIcon, PreviewIcon, SettingsIcon } from "../HeaderContent/SvgIcons.js";
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
  onDoubleClick?: (view: ViewType) => void;
  onContextMenu?: (view: ViewType, e: React.MouseEvent) => void;
}

export const ViewControls: React.FC<ViewControlsProps> = ({ viewControls, currentView, onClick, onDoubleClick, onContextMenu }) => {
  return (
    <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center gap-1 rounded-lg p-1.5 shadow-sm md:rounded-md md:p-1">
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
              onClick={() => onClick?.(viewTypeKey)}
              onDoubleClick={() => onDoubleClick?.(viewTypeKey)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu?.(viewTypeKey, e);
              }}
              className={`flex items-center justify-center space-x-1 rounded-md px-3 py-2 text-base font-medium transition-colors md:space-x-1.5 md:rounded md:px-4 md:py-1.5 md:text-sm ${
                isActive
                  ? "bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm"
                  : "text-light-primary/90 dark:text-dark-primary/90 hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 hover:text-light-primary dark:hover:text-dark-primary"
              } ${!control.enabled ? "!pointer-events-none cursor-not-allowed opacity-50" : ""}`}
              aria-label={`Switch to ${control.label}`}
            >
              {viewTypeKey === "preview" && (
                <PreviewIcon
                  className="h-5 w-5 md:h-4 md:w-4"
                  isLoading={!!control.loading}
                  title={control.loading ? "App is fetching data" : "Preview icon"}
                />
              )}
              {viewTypeKey === "code" && (
                <CodeIcon className="h-5 w-5 md:h-4 md:w-4" isLoading={currentView === "preview" && !!control.loading} />
              )}
              {viewTypeKey === "data" && <DataIcon className="h-5 w-5 md:h-4 md:w-4" />}
              {viewTypeKey === "settings" && <SettingsIcon className="h-5 w-5 md:h-4 md:w-4" />}
              <span className="hidden min-[480px]:inline">{control.label}</span>
            </button>
          );
        })}
    </div>
  );
};
