import React, { useCallback, useState } from "react";
import { useNewSessionChat } from "../hooks/useNewSessionChat.js";
import NewSessionContent from "./NewSessionContent/index.js";
import SessionSidebar from "./SessionSidebar.js";
import { MenuIcon } from "./ChatHeaderIcons.js";
import { Toaster } from "react-hot-toast";

interface NewSessionViewProps {
  onSessionCreate: (sessionId: string) => void;
}

export default function NewSessionView({
  onSessionCreate,
}: NewSessionViewProps) {
  const chatState = useNewSessionChat(onSessionCreate);

  // Sidebar state
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Sidebar handlers
  const openSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      chatState.setInput(suggestion);

      // Focus the input and position cursor at the end
      setTimeout(() => {
        if (chatState.inputRef.current) {
          chatState.inputRef.current.focus();
          // Move cursor to end of text
          chatState.inputRef.current.selectionStart =
            chatState.inputRef.current.selectionEnd = suggestion.length;
        }
      }, 0);
    },
    [chatState.setInput, chatState.inputRef],
  );

  return (
    <>
      <div>
        <Toaster />
      </div>
      <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
        {/* Header with menu button */}
        <div className="flex items-center justify-between p-4">
          <button
            type="button"
            onClick={openSidebar}
            className="mr-3 px-2 py-4 text-light-primary hover:text-accent-02-light dark:text-dark-primary dark:hover:text-accent-02-dark"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="flex-1" />
        </div>

        {/* Main content section */}
        <div className="flex-1 px-8 pb-8">
          <NewSessionContent
            chatState={chatState}
            handleSelectSuggestion={handleSelectSuggestion}
          />
        </div>
      </div>
      <SessionSidebar
        isVisible={isSidebarVisible}
        onClose={closeSidebar}
        sessionId=""
      />
    </>
  );
}
