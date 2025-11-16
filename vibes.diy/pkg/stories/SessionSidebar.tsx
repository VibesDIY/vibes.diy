import React from "react";
import SessionSidebar from "../app/components/SessionSidebar.js";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";

// Simple wrapper that provides the real SessionSidebar component
export const MockSessionSidebar: React.FC<{
  isVisible: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  isPolling?: boolean;
  pollError?: string;
}> = ({ isVisible, onClose }) => {
  return (
    <BrowserRouter>
      <ClerkProvider publishableKey="pk_test_storybook">
        <div style={{ position: "relative", height: "100vh", width: "100%" }}>
          {/* Backdrop overlay when sidebar is visible */}
          {isVisible && (
            <div
              className="bg-opacity-50 fixed inset-0 z-[5] bg-black"
              onClick={onClose}
              style={{ backdropFilter: "blur(2px)" }}
            />
          )}

          {/* The real SessionSidebar component */}
          <SessionSidebar
            isVisible={isVisible}
            onClose={onClose}
            sessionId="storybook-session"
          />

          {/* Mock main content area */}
          <div className="pl-0 transition-all duration-300">
            <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
              <h1 className="mb-4 text-2xl font-bold">Main Content Area</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Click the hamburger menu or use the controls to open the
                sidebar.
              </p>
              <div className="mt-4 space-y-2">
                <p>
                  <strong>isVisible:</strong> {isVisible.toString()}
                </p>
              </div>

              {!isVisible && (
                <button
                  onClick={() =>
                    console.log("This would normally open the sidebar")
                  }
                  className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  Open Sidebar (use controls above)
                </button>
              )}
            </div>
          </div>
        </div>
      </ClerkProvider>
    </BrowserRouter>
  );
};

export default MockSessionSidebar;
