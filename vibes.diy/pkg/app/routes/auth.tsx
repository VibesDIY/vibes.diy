import React, { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { SignIn, useAuth } from "@clerk/react";
import { createPortal } from "react-dom";
import SessionSidebar from "../components/SessionSidebar.js";
import { Delayed } from "../components/Delayed.js";

/**
 * Auth layout route - wraps all protected routes.
 * Shows a Clerk SignIn overlay (and open sidebar) when not authenticated.
 */
export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();
  const [isSidebarVisible, setIsSidebarVisible] = useState(!isSignedIn);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

  useEffect(() => {
    if (isSignedIn) {
      setIsSidebarVisible(false);
    }
  }, [isSignedIn]);

  if (!isLoaded) {
    // SSR Path
    return <div></div>;
  }

  return (
    <>
      <Outlet />
      <Delayed ms={1000}>
        <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
      </Delayed>
      {!isSignedIn &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <SignIn routing="hash" fallbackRedirectUrl={location.pathname + location.search} />
          </div>,
          document.body
        )}
    </>
  );
}
