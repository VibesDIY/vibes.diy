import React, { useState, useCallback, useEffect } from "react";
import { gridBackground, cx } from "@vibes.diy/base";
import { isMobileViewport } from "../../utils/ViewState.js";
import { getPageStyle } from "./StartPage.styles.js";
import CategoryPicker from "./CategoryPicker.js";
import StarterAppView from "./StarterAppView.js";
import { getStarterNode } from "./starter-tree.js";

type View = { kind: "categories" } | { kind: "app"; nodeId: string };

export default function StartPage() {
  const [view, setView] = useState<View>({ kind: "categories" });
  const [history, setHistory] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(isMobileViewport());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navigateToApp = useCallback(
    (nodeId: string) => {
      if (view.kind === "app") {
        setHistory((prev) => [...prev, view.nodeId]);
      }
      setView({ kind: "app", nodeId });
    },
    [view]
  );

  const navigateBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setView({ kind: "app", nodeId: prev });
    } else {
      setView({ kind: "categories" });
    }
  }, [history]);

  if (isMobile === null) {
    return <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()} />;
  }

  const mobile = isMobile as boolean;

  if (view.kind === "categories") {
    return (
      <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: mobile ? "48px 16px 16px" : "64px 32px 32px",
          }}
        >
          <CategoryPicker isMobile={mobile} onSelect={navigateToApp} />
        </div>
      </div>
    );
  }

  const node = getStarterNode(view.nodeId);
  if (!node) {
    setView({ kind: "categories" });
    return null;
  }

  return (
    <div className={cx(gridBackground, "page-grid-background")} style={getPageStyle()}>
      <StarterAppView node={node} isMobile={mobile} onSelectChiclet={navigateToApp} onBack={navigateBack} />
    </div>
  );
}
