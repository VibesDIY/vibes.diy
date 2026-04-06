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

const buttonColors: Record<string, string> = {
  preview: "var(--vibes-menu-bg, #CCCDC8)",
  code: "#5398c9",
  data: "var(--vibes-yellow, #fedd00)",
  settings: "var(--vibes-green, #22c55e)",
};

const labelColors: Record<string, string> = {
  preview: "var(--vibes-near-black)",
  code: "var(--vibes-cream)",
  data: "var(--vibes-near-black)",
  settings: "var(--vibes-cream)",
};

const activeColors: Record<string, string> = {
  preview: "#b0b1ac",
  code: "#3d7a9e",
  data: "#c4b000",
  settings: "#1a9e48",
};

export const ViewControls: React.FC<ViewControlsProps> = ({ viewControls, currentView, onClick, onDoubleClick, onContextMenu }) => {
  return (
    <div className="vibes-header-right stagger-in">
      {Object.entries(viewControls)
        .filter(([viewType]) => viewType !== "chat")
        .map(([viewType, control]) => {
          const viewTypeKey = viewType as ViewType;
          const isActive = currentView === viewTypeKey;

          return (
            <div key={viewType} className={`navbar-button-wrapper${isActive ? " active" : ""}`}>
              <button
                type="button"
                disabled={!control.enabled}
                onClick={() => onClick?.(viewTypeKey)}
                onDoubleClick={() => onDoubleClick?.(viewTypeKey)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu?.(viewTypeKey, e);
                }}
                style={{
                  background: buttonColors[viewType] || "var(--vibes-bg-secondary)",
                  "--navbar-active-color": activeColors[viewType] || "rgba(0,0,0,0.3)",
                } as React.CSSProperties}
                aria-label={`Switch to ${control.label}`}
              >
                <div className="navbar-button-icon">
                  {viewTypeKey === "preview" && (
                    <NavbarIconCircle>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>Chat icon</title>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </NavbarIconCircle>
                  )}
                  {viewTypeKey === "code" && (
                    <NavbarIconCircle>
                      <CodeIcon className="h-[18px] w-[18px]" isLoading={currentView === "preview" && !!control.loading} />
                    </NavbarIconCircle>
                  )}
                  {viewTypeKey === "data" && (
                    <NavbarIconCircle>
                      <DataIcon className="h-[18px] w-[18px]" />
                    </NavbarIconCircle>
                  )}
                  {viewTypeKey === "settings" && (
                    <NavbarIconCircle>
                      <SettingsIcon className="h-[18px] w-[18px]" />
                    </NavbarIconCircle>
                  )}
                </div>
                <div className="navbar-button-label" style={{ color: labelColors[viewType] || "var(--vibes-cream)" }}>
                  {control.label}
                </div>
              </button>
            </div>
          );
        })}
    </div>
  );
};

function NavbarIconCircle({ children }: { children: React.ReactNode }) {
  return (
    <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17.5" cy="17.5" r="17.5" fill="#231F20" />
      <foreignObject x="5" y="5" width="25" height="25">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "var(--vibes-cream, #fffff0)" }}>
          {children}
        </div>
      </foreignObject>
    </svg>
  );
}
