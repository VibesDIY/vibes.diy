import { ViewType } from "@vibes.diy/prompts";
import { RuntimeError } from "@vibes.diy/use-vibes-types";

export interface ResultPreviewProps {
  code: string;
  dependencies?: Record<string, string>;
  onScreenshotCaptured?: (screenshotData: string | null) => void;
  sessionId: string;
  title?: string;
  updateTitle: (title: string, isManual?: boolean) => Promise<void>;
  isStreaming?: boolean;
  codeReady?: boolean;
  displayView: ViewType; // Changed from activeView
  // setActiveView: (view: 'code' | 'preview' | 'data') => void; // Removed
  onPreviewLoaded: () => void;
  setMobilePreviewShown: (shown: boolean) => void;
  setIsIframeFetching?: (fetching: boolean) => void;
  addError?: (error: RuntimeError) => void; // Single error handler for all types of errors
  onCodeSave?: (code: string) => void;
  onCodeChange?: (hasChanges: boolean, saveHandler: () => void) => void;
  onSyntaxErrorChange?: (
    errorCount: number,
    errors?: Array<{
      line: number;
      column: number;
      message: string;
      severity: number;
    }>,
  ) => void;
}

export type IframeFiles = Record<
  string,
  {
    code: string;
    hidden?: boolean;
    active?: boolean;
  }
>;
