import type { Meta, StoryObj } from "@storybook/react";
import { MockShareModal } from "./ShareModal.js";

const meta = {
  title: "Components/ShareModal",
  component: MockShareModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `The ShareModal component from the production codebase. This is a portal-based modal that handles publishing and copying a clean share URL.

**Key features:**
- **Portal Rendering**: Uses React Portal to render outside component tree
- **Positioning**: Dynamically positions relative to trigger button
- **Publish**: One-button publish, then shows a clean share URL
- **Copy link**: Copies the clean URL to clipboard
- **Auto-join toggle**: Controls whether visitors can join immediately (UI only)
- **Keyboard Navigation**: ESC key support and proper ARIA labels

**Modal States:**
- **Initial Publish**: First-time publish
- **Published State**: Shows URL and copy button
- **Loading**: Publishing state
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      description: "Whether the modal is open",
      control: "boolean",
    },
    isPublishing: {
      description: "Whether publishing is in progress (shows loading states)",
      control: "boolean",
    },
    publishedUrl: {
      description: "Published URL (when set, shows published state)",
      control: "text",
    },
    showCloseButton: {
      description: "Show demo close button (for Storybook interaction)",
      control: "boolean",
    },
    onClose: {
      description: "Callback when modal is closed",
      action: "close",
    },
    onPublish: {
      description: "Callback when publish button is clicked",
      action: "publish",
    },
  },
} satisfies Meta<typeof MockShareModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Initial publish state - first time publishing
export const InitialPublish: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedUrl: "",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Initial publish state with the primary publish CTA.",
      },
    },
  },
};

// Publishing in progress
export const PublishingInProgress: Story = {
  args: {
    isOpen: true,
    isPublishing: true,
    publishedUrl: "",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Publishing state showing animated loading effects on the publish button.",
      },
    },
  },
};

// Published state - app has been published
export const PublishedState: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedUrl: "https://vibes.diy/vibe/published-app-12345/",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Published state showing the URL and copy button.",
      },
    },
  },
};

// Closed state (for comparison)
export const ClosedModal: Story = {
  args: {
    isOpen: false,
    isPublishing: false,
    publishedUrl: "",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Modal in closed state. Only the demo close button is visible.",
      },
    },
  },
};

// Interactive demo - full workflow
export const InteractiveWorkflowDemo: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedUrl: "",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo of the publish flow. Click "Publish" to see the flow, then copy the URL.',
      },
    },
  },
};

// Long subdomain example
export const LongSubdomainExample: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedUrl:
      "https://vibes.diy/vibe/published-app-super-long-name-example/",
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Published state with a longer subdomain to test text wrapping and link display.",
      },
    },
  },
};

// All states off for clean screenshot
export const CleanScreenshot: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedUrl: "",
    showCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Clean initial state without demo controls, perfect for screenshots and documentation.",
      },
    },
  },
};
