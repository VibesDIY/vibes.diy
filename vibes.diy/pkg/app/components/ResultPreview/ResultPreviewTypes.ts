// import { LLMChat } from "@vibes.diy/api-impl";
// import { TitleSrc, ViewType } from "@vibes.diy/prompts";
// import { RuntimeError } from "@vibes.diy/use-vibes-types";
import { ViewType } from "@vibes.diy/prompts";
import { PromptState } from "../../routes/chat.$userSlug.$appSlug.js";

export interface ResultPreviewProps {
  promptState: PromptState;
  currentView: ViewType;
  // code: string;
  // dependencies?: Record<string, string>;
  // onScreenshotCaptured?: (screenshotData: string | null) => void;
  // // sessionId: string;
  // title: TitleSrc;
  // chat?: LLMChat | null;
  // setTitle: (title: TitleSrc) => void;
  // promptProcessing?: boolean;
  // codeReady?: boolean;
  // displayView: ViewType; // Changed from activeView
  // // setActiveView: (view: 'code' | 'preview' | 'data') => void; // Removed
  // onPreviewLoaded: () => void;
  // setMobilePreviewShown: (shown: boolean) => void;
  // setIsIframeFetching?: (fetching: boolean) => void;
  // addError?: (error: RuntimeError) => void; // Single error handler for all types of errors
  // onCodeSave?: (code: string) => void;
  // onCodeChange?: (hasChanges: boolean, saveHandler: () => void) => void;
  // onSyntaxErrorChange?: (errorCount: number) => void;
}

export type IframeFiles = Record<
  string,
  {
    code: string;
    hidden?: boolean;
    active?: boolean;
  }
>;
