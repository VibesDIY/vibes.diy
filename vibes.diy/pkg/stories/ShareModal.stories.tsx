import type { Meta, StoryObj } from "@storybook/react";
import { MockShareModal } from "./ShareModal.js";

const meta = {
  title: "Components/ShareModal",
  component: MockShareModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `The ShareModal component from the production codebase. This is a portal-based modal that handles the complete app publishing workflow, including firehose sharing and update functionality.

**Key features:**
- **Portal Rendering**: Uses React Portal to render outside component tree
- **Positioning**: Dynamically positions relative to trigger button
- **Publishing Workflow**: Complete flow from initial publish to updates
- **Firehose Integration**: Optional sharing to social feeds
- **Loading States**: Visual feedback during async operations
- **Success Animations**: Checkmark and success messages
- **Keyboard Navigation**: ESC key support and proper ARIA labels

**Modal States:**
- **Initial Publish**: First-time publishing with gradient CTA button
- **Published State**: Shows published URL with update options
- **Loading**: Publishing/updating with animated progress indicators
- **Success**: Brief success confirmation with checkmark

**Firehose Feature:**
The firehose checkbox allows apps to be featured on Vibes DIY social feeds and community platforms.`,
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
    publishedAppUrl: {
      description: "Published app URL (when set, shows published state)",
      control: "text",
    },
    isFirehoseShared: {
      description: "Whether the app is shared to firehose feeds",
      control: "boolean",
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
    publishedAppUrl: "",
    isFirehoseShared: false,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Initial publish state with the vibrant gradient CTA button. User can check firehose sharing option before publishing.",
      },
    },
  },
};

// Publishing in progress
export const PublishingInProgress: Story = {
  args: {
    isOpen: true,
    isPublishing: true,
    publishedAppUrl: "",
    isFirehoseShared: false,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Publishing state showing animated loading effects on the publish button.",
      },
    },
  },
};

// Initial publish with firehose enabled
export const InitialPublishWithFirehose: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedAppUrl: "",
    isFirehoseShared: true,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Initial publish state with firehose sharing pre-enabled.",
      },
    },
  },
};

// Published state - app has been published
export const PublishedState: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedAppUrl: "https://vibes.diy/published-app-12345/iframe",
    isFirehoseShared: false,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Published state showing the subdomain link and update functionality. User can toggle firehose sharing and update the published app.",
      },
    },
  },
};

// Published with firehose shared
export const PublishedWithFirehose: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedAppUrl: "https://vibes.diy/published-app-awesome/iframe",
    isFirehoseShared: true,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Published state with firehose sharing enabled. Shows how the checkbox state is preserved.",
      },
    },
  },
};

// Updating published app
export const UpdatingPublishedApp: Story = {
  args: {
    isOpen: true,
    isPublishing: true,
    publishedAppUrl: "https://vibes.diy/published-app-67890/iframe",
    isFirehoseShared: false,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Updating an already-published app. Shows loading state on the "Update Code" button.',
      },
    },
  },
};

// Closed state (for comparison)
export const ClosedModal: Story = {
  args: {
    isOpen: false,
    isPublishing: false,
    publishedAppUrl: "",
    isFirehoseShared: false,
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
    publishedAppUrl: "",
    isFirehoseShared: false,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo of the complete publishing workflow. Click "Publish App" to see the flow, toggle firehose sharing, and try updating.',
      },
    },
  },
};

// Long subdomain example
export const LongSubdomainExample: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedAppUrl: "https://vibes.diy/published-app-super-long-subdomain-name-example/iframe",
    isFirehoseShared: true,
    showCloseButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Published state with a longer subdomain to test text wrapping and link display.",
      },
    },
  },
};

// All states off for clean screenshot
export const CleanScreenshot: Story = {
  args: {
    isOpen: true,
    isPublishing: false,
    publishedAppUrl: "",
    isFirehoseShared: false,
    showCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Clean initial state without demo controls, perfect for screenshots and documentation.",
      },
    },
  },
};
