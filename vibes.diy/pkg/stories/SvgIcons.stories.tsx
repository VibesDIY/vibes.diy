import type { Meta, StoryObj } from "@storybook/react";
import React, { ComponentProps, ReactNode } from "react";
import {
  HomeIcon,
  GearIcon,
  StarIcon,
  PreviewIcon,
  CodeIcon,
  DataIcon,
  ShareIcon,
  BackArrowIcon,
  UserIcon,
  PublishIcon,
  MinidiscIcon,
} from "../app/components/HeaderContent/SvgIcons.js";

// Wrapper component for better story display
const IconWrapper = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4">
    <div className="text-gray-600">{children}</div>
    <span className="font-mono text-xs text-gray-500">{label}</span>
  </div>
);

const meta = {
  title: "Design System/Icons",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `The SvgIcons collection from the production codebase. These are the core iconography components used throughout the application, featuring consistent styling, interactive states, and animation capabilities.

**Key features:**
- **Consistent Design**: All icons follow the same stroke-width and styling patterns
- **Interactive States**: Loading animations, filled states, authentication indicators
- **Accessibility**: Proper titles and ARIA labels for screen readers
- **Responsive**: Icons adapt their size based on screen breakpoints
- **Theme Support**: Work seamlessly with light/dark theme system

**Icon Categories:**
- **Navigation**: Home, Gear (settings), Back Arrow
- **Content Views**: Preview, Code, Data icons with loading states
- **User Actions**: Share, Publish, Star (favoriting), Save (retro minidisc)
- **User Status**: User icon with authentication states

**Testing animations:** Icons with loading states will show spin animations when enabled.`,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;

// Icon Gallery - Shows all icons at once
export const IconGallery = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      <IconWrapper label="HomeIcon">
        <HomeIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="GearIcon">
        <GearIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="StarIcon">
        <StarIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="PreviewIcon">
        <PreviewIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="CodeIcon">
        <CodeIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="DataIcon">
        <DataIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="ShareIcon">
        <ShareIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="BackArrowIcon">
        <BackArrowIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="UserIcon">
        <UserIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="PublishIcon">
        <PublishIcon className="h-6 w-6" />
      </IconWrapper>
      <IconWrapper label="MinidiscIcon">
        <MinidiscIcon className="h-6 w-6" />
      </IconWrapper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Overview of all available icons in the design system.",
      },
    },
  },
};

// Navigation Icons
const NavigationMeta = {
  parameters: {
    docs: {
      description: {
        component: "Navigation-related icons used in headers, sidebars, and routing.",
      },
    },
  },
};

export const HomeIcon_Story: StoryObj<ComponentProps<typeof HomeIcon>> = {
  ...NavigationMeta,
  render: (args) => <HomeIcon {...args} />,
  args: {
    className: "h-6 w-6",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Home icon used for navigation to main app view.",
      },
    },
  },
};

export const GearIcon_Story: StoryObj<ComponentProps<typeof GearIcon>> = {
  ...NavigationMeta,
  render: (args) => <GearIcon {...args} />,
  args: {
    className: "h-6 w-6",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Settings/gear icon for configuration and preferences.",
      },
    },
  },
};

export const BackArrowIcon_Story: StoryObj<ComponentProps<typeof BackArrowIcon>> = {
  ...NavigationMeta,
  render: (args) => <BackArrowIcon {...args} />,
  args: {
    className: "h-6 w-6",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Back arrow for navigation, typically used in mobile views.",
      },
    },
  },
};

// Content View Icons with Loading States
const ContentViewMeta = {
  parameters: {
    docs: {
      description: {
        component: "Icons for different content views with optional loading animations.",
      },
    },
  },
};

export const PreviewIcon_Story: StoryObj<ComponentProps<typeof PreviewIcon>> = {
  ...ContentViewMeta,
  render: (args) => <PreviewIcon {...args} />,
  args: {
    className: "h-6 w-6",
    isLoading: false,
    title: "Preview icon",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    isLoading: {
      description: "Whether the icon should show loading animation",
      control: "boolean",
    },
    title: {
      description: "Accessibility title for the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Preview/eye icon for app preview view. Shows spinning animation when loading.",
      },
    },
  },
};

export const CodeIcon_Story: StoryObj<ComponentProps<typeof CodeIcon>> = {
  ...ContentViewMeta,
  render: (args) => <CodeIcon {...args} />,
  args: {
    className: "h-6 w-6",
    isLoading: false,
    title: "Code icon",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    isLoading: {
      description: "Whether the icon should show loading animation",
      control: "boolean",
    },
    title: {
      description: "Accessibility title for the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Code icon for code editor view. Shows spinning animation when loading.",
      },
    },
  },
};

export const DataIcon_Story: StoryObj<ComponentProps<typeof DataIcon>> = {
  ...ContentViewMeta,
  render: (args) => <DataIcon {...args} />,
  args: {
    className: "h-6 w-6",
    title: "Data icon",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    title: {
      description: "Accessibility title for the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Data icon for database/session data view.",
      },
    },
  },
};

// Action Icons
const ActionMeta = {
  parameters: {
    docs: {
      description: {
        component: "Icons for user actions like sharing, publishing, and favoriting.",
      },
    },
  },
};

export const StarIcon_Story: StoryObj<ComponentProps<typeof StarIcon>> = {
  ...ActionMeta,
  render: (args) => <StarIcon {...args} />,
  args: {
    className: "h-6 w-6",
    filled: false,
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    filled: {
      description: "Whether the star should be filled (favorited state)",
      control: "boolean",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Star icon for favoriting/bookmarking. Toggle filled state to see both variants.",
      },
    },
  },
};

export const ShareIcon_Story: StoryObj<ComponentProps<typeof ShareIcon>> = {
  ...ActionMeta,
  render: (args) => <ShareIcon {...args} />,
  args: {
    className: "h-6 w-6",
    title: "Share icon",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    title: {
      description: "Accessibility title for the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Share icon for sharing apps and content.",
      },
    },
  },
};

export const PublishIcon_Story: StoryObj<ComponentProps<typeof PublishIcon>> = {
  ...ActionMeta,
  render: (args) => <PublishIcon {...args} />,
  args: {
    className: "h-6 w-6",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Publish icon for publishing apps to public URLs.",
      },
    },
  },
};

export const MinidiscIcon_Story: StoryObj<ComponentProps<typeof MinidiscIcon>> = {
  ...ActionMeta,
  render: (args) => <MinidiscIcon {...args} />,
  args: {
    className: "h-6 w-6",
    title: "Save icon (minidisc)",
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    title: {
      description: "Accessibility title for the icon",
      control: "text",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Retro minidisc icon used for the save button. Features detailed disc design with label area and inner ring.",
      },
    },
  },
};

// User Status Icons
export const UserIcon_Story: StoryObj<ComponentProps<typeof UserIcon>> = {
  render: (args) => <UserIcon {...args} />,
  args: {
    className: "h-6 w-6",
    isVerifying: false,
    isUserAuthenticated: false,
  },
  argTypes: {
    className: {
      description: "CSS classes for styling the icon",
      control: "text",
    },
    isVerifying: {
      description: "Whether user authentication is being verified (shows pulse animation)",
      control: "boolean",
    },
    isUserAuthenticated: {
      description: "Whether the user is authenticated (affects fill state)",
      control: "boolean",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "User icon with authentication states. Shows pulse animation during verification and filled state when authenticated.",
      },
    },
  },
};

// Size Variations
export const SizeVariations = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <HomeIcon className="h-4 w-4" />
        <span className="text-xs">Small (h-4 w-4)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <HomeIcon className="h-5 w-5" />
        <span className="text-xs">Default (h-5 w-5)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <HomeIcon className="h-6 w-6" />
        <span className="text-xs">Medium (h-6 w-6)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <HomeIcon className="h-8 w-8" />
        <span className="text-xs">Large (h-8 w-8)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Common size variations for icons. Most components use responsive sizing (sm:h-4 sm:w-4).",
      },
    },
  },
};

// Loading Animations Demo
export const LoadingAnimations = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <PreviewIcon className="h-8 w-8" isLoading={true} />
        <span className="text-xs">Preview Loading</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <CodeIcon className="h-8 w-8" isLoading={true} />
        <span className="text-xs">Code Loading</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <UserIcon className="h-8 w-8" isVerifying={true} />
        <span className="text-xs">User Verifying</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Icons with animated loading states. Preview and Code icons use slow spin, User icon uses pulse.",
      },
    },
  },
};
