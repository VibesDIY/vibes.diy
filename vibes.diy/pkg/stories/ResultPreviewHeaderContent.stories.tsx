import type { Meta, StoryObj } from "@storybook/react";
import { MockedResultPreviewHeaderContent } from "./ResultPreviewHeaderContent.js";

const meta = {
  title: "Components/ResultPreviewHeaderContent",
  component: MockedResultPreviewHeaderContent,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `The ResultPreviewHeaderContent component from the production codebase. This is the header navigation bar that appears when viewing an AI-generated app, containing back navigation, view controls, and publishing functionality.

**Key features:**
- **Back Button**: Returns to chat view, with special handling during streaming
- **View Controls**: Three-tab navigation (Preview/Code/Data) with loading states
- **Save Button**: Appears in code view when there are unsaved changes
- **Share Button**: Handles app publishing with loading states and URL copying
- **Share Modal**: Full publishing workflow with firehose sharing option

**Mock State Management:**
This Storybook version uses a mock state provider to simulate the complex state management from the production app, including publish workflows, URL copying, and modal interactions.

**Testing responsive behavior:** Use the viewport selector to test different screen sizes. The component adapts its layout and shows/hides elements based on breakpoints.`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    displayView: {
      description: "Currently active view tab",
      control: "select",
      options: ["preview", "code", "data"],
    },
    showViewControls: {
      description: "Whether to show the view control tabs",
      control: "boolean",
    },
    previewReady: {
      description: "Whether the app preview is ready to display",
      control: "boolean",
    },
    hasCodeChanges: {
      description: "Whether there are unsaved code changes (shows Save button)",
      control: "boolean",
    },
    syntaxErrorCount: {
      description: "Number of syntax errors in code",
      control: { type: "number", min: 0, max: 10 },
    },
    promptProcessing: {
      description: "Whether AI is currently streaming a response",
      control: "boolean",
    },
    initialPublishedUrl: {
      description: "Initial published URL for the app",
      control: "text",
    },
    initialIsPublishing: {
      description: "Initial publishing state",
      control: "boolean",
    },
    initialUrlCopied: {
      description: "Initial URL copied state",
      control: "boolean",
    },
    initialIsShareModalOpen: {
      description: "Initial share modal open state",
      control: "boolean",
    },
    initialFirehoseShared: {
      description: "Initial firehose shared state",
      control: "boolean",
    },
    onNavigateToView: {
      description: "Callback when view tab is clicked",
      action: "navigate-to-view",
    },
    onCodeSave: {
      description: "Callback when save button is clicked",
      action: "code-save",
    },
    onBackClick: {
      description: "Callback when back button is clicked",
      action: "back-click",
    },
  },
} satisfies Meta<typeof MockedResultPreviewHeaderContent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default state - preview view with controls
export const Default: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Default state showing the preview view with standard navigation controls.",
      },
    },
  },
};

// Code view with unsaved changes
export const CodeViewWithChanges: Story = {
  args: {
    displayView: "code",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: true,
    syntaxErrorCount: 0,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Code view showing the Save button when there are unsaved changes.",
      },
    },
  },
};

// Code view with syntax errors
export const CodeViewWithErrors: Story = {
  args: {
    displayView: "code",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: true,
    syntaxErrorCount: 3,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Code view with syntax errors. The Save button shows error count and is disabled.",
      },
    },
  },
};

// Data view
export const DataView: Story = {
  args: {
    displayView: "data",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Data view showing session messages and database contents.",
      },
    },
  },
};

// Streaming state
export const StreamingState: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: false,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Streaming state where AI is generating content. Preview tab shows loading state.",
      },
    },
  },
};

// No controls (chat-only mode)
export const NoControls: Story = {
  args: {
    displayView: "preview",
    showViewControls: false,
    previewReady: false,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Minimal header with only back button, no view controls (used in chat-only contexts).",
      },
    },
  },
};

// Published app state
export const PublishedApp: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
    initialPublishedUrl: "https://vibes.diy/published-app-123456",
    initialUrlCopied: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'App that has already been published. Share button shows "URL Copied" state.',
      },
    },
  },
};

// Publishing in progress
export const PublishingInProgress: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
    initialIsPublishing: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Publishing workflow in progress. Share button shows loading spinner.",
      },
    },
  },
};

// Share modal open
export const ShareModalOpen: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
    initialIsShareModalOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Share modal is open, showing publishing options including firehose sharing.",
      },
    },
  },
};

// Complete workflow demo
export const InteractivePublishingDemo: Story = {
  args: {
    displayView: "preview",
    showViewControls: true,
    previewReady: true,
    hasCodeChanges: false,
    syntaxErrorCount: 0,
    promptProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo of the full publishing workflow. Click the Share button to open the modal, then click "Publish App" to see the complete flow.',
      },
    },
  },
};
