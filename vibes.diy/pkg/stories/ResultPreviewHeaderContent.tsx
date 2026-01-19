import React from "react";
import ResultPreviewHeaderContent from "../app/components/ResultPreview/ResultPreviewHeaderContent.js";
import type { ViewType, ViewControlsType } from "@vibes.diy/prompts";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import { PromptState } from "../app/routes/chat.$userSlug.$appSlug.js";

// Mock state provider for interactive demo
interface MockedHeaderProps {
  // View state props
  displayView?: ViewType;
  showViewControls?: boolean;
  previewReady?: boolean;

  // Code state props
  hasCodeChanges?: boolean;
  syntaxErrorCount?: number;
  promptProcessing?: boolean;

  initialPublishedUrl?: string;
  initialIsPublishing?: boolean;
  initialUrlCopied?: boolean;
  initialIsShareModalOpen?: boolean;
  initialFirehoseShared?: boolean;

  // Mock state controls (for interactive demos)
  initialCode?: string;
  initialSessionId?: string;
  initialTitle?: string;

  // Event handlers
  onNavigateToView?: (view: ViewType) => void;
  onCodeSave?: () => void;
  onBackClick?: () => void;
  onMobilePreviewShown?: (shown: boolean) => void;
}

export const MockedResultPreviewHeaderContent: React.FC<MockedHeaderProps> = ({
  displayView = "preview",
  // showViewControls = true,
  previewReady = true,
  // hasCodeChanges = false,
  // syntaxErrorCount = 0,
  // promptProcessing = false,
  // initialCode = "function App() { return <div>Hello World</div>; }",
  // initialSessionId = "storybook-session",
  // initialTitle = "Storybook Demo App",
  onNavigateToView,
  // onCodeSave,
  // onBackClick,
  // onMobilePreviewShown,
}) => {
  // Create view controls based on current state
  const viewControls: ViewControlsType = {
    preview: {
      enabled: previewReady,
      icon: "preview",
      label: "Preview",
      loading: !previewReady,
    },
    code: {
      enabled: true,
      icon: "code",
      label: "Code",
    },
    data: {
      enabled: true,
      icon: "data",
      label: "Data",
    },
    settings: {
      enabled: false,
      icon: "loading",
      label: "loading...",
      loading: undefined,
    },
  };

  const handleNavigateToView = (view: ViewType) => {
    onNavigateToView?.(view);
    console.log("Navigate to view:", view);
  };

  // const handleCodeSave = () => {
  //   onCodeSave?.();
  //   console.log("Code save triggered");
  // };

  // const handleBackClick = () => {
  //   onBackClick?.();
  //   console.log("Back clicked");
  // };

  // const handleMobilePreviewShown = (shown: boolean) => {
  //   onMobilePreviewShown?.(shown);
  //   console.log("Mobile preview shown:", shown);
  // };

  // const handleUserClickedBack = (clicked: boolean) => {
  //   console.log("User clicked back:", clicked);
  // };

  return (
    <BrowserRouter>
      <ClerkProvider publishableKey="pk_test_storybook">
        <div className="border-b bg-white dark:bg-gray-900">
          <ResultPreviewHeaderContent
            promptState={
              {
                running: false,
              } as PromptState
            }
            navigateToView={handleNavigateToView}
            viewControls={viewControls}
            currentView={displayView}
            hasCodeChanges={false} // displayView={displayView}
            // navigateToView={handleNavigateToView}
            // viewControls={viewControls}
            // showViewControls={showViewControls}
            // previewReady={previewReady}
            // setMobilePreviewShown={handleMobilePreviewShown}
            // setUserClickedBack={handleUserClickedBack}
            // code={initialCode}
            // promptProcessing={promptProcessing}
            // sessionId={initialSessionId}
            // title={{ title: initialTitle, src: "user" }}
            // hasCodeChanges={hasCodeChanges}
            // onCodeSave={handleCodeSave}
            // syntaxErrorCount={syntaxErrorCount}
          />
        </div>
      </ClerkProvider>
    </BrowserRouter>
  );
};

// Also export as default for easier importing
