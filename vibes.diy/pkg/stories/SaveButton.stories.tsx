import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { SaveButton } from "../app/components/ResultPreview/SaveButton.js";

const meta = {
  title: "Components/Save Button",
  component: SaveButton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `The NeobrutalistSaveButton component with brutal design aesthetics from the production codebase. This button shows when there are unsaved changes and provides visual feedback for syntax errors. It features the signature neobrutalism style with thick borders, bold shadows, and strong visual impact.

**Key features:**
- Only renders when \`hasChanges\` is true
- Shows error count and disables when there are syntax errors
- Responsive design (text + icon on desktop, icon-only on mobile)
- Neobrutalism styling with thick borders and dramatic shadows
- Custom minidisc icon for retro aesthetic
- Active state with shadow animation (button "presses" into the page)
- Proper accessibility with titles and disabled states

**Neobrutalism Design Elements:**
- Bold, black borders (2px thick)
- Dramatic drop shadows (4px offset)
- High contrast colors
- Strong, blocky typography
- Active state animations that simulate physical button press

**Testing responsive behavior:** Use the viewport selector in the Storybook toolbar to test different screen sizes. Try "Below SM (639px)" or "Small Mobile (440px)" to see the mobile icon-only version.`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    onClick: {
      description: "Callback function called when the save button is clicked",
      action: "clicked",
    },
    hasChanges: {
      description:
        "Whether there are unsaved changes. Button only renders when true.",
      control: "boolean",
    },
    syntaxErrorCount: {
      description:
        "Number of syntax errors. When > 0, button shows error count and becomes disabled.",
      control: { type: "number", min: 0, max: 10 },
    },
    color: {
      description: "Color of the Button",
    },
    testId: {
      description: "Id for testing purpose",
      control: "text",
    },
  },
  args: {
    onClick: () => console.log("Save clicked"),
  },
} satisfies Meta<typeof SaveButton>;

export default meta;
type _Story = StoryObj<typeof meta>;

export const Default: _Story = {
  args: {
    hasChanges: true,
    syntaxErrorCount: 0,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The default neobrutalist save button state when there are changes to save and no syntax errors.",
      },
    },
  },
};

const colorNames: {
  name: string;
  value:
    | "blue"
    | "electric"
    | "hot"
    | "cyber"
    | "retro"
    | "cool"
    | "dream"
    | "danger";
}[] = [
  { name: "Default Blue", value: "blue" },
  { name: "Electric Yellow", value: "electric" },
  { name: "Hot Pink", value: "hot" },
  { name: "Cyber Lime", value: "cyber" },
  { name: "Retro Orange", value: "retro" },
  { name: "Cool Cyan", value: "cool" },
  { name: "Violet Dream", value: "dream" },
  { name: "Danger Red", value: "danger" },
];

export const WithErrors: _Story = {
  args: {
    hasChanges: true,
    syntaxErrorCount: 3,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The error state showing syntax error count. The button is disabled and uses destructive styling.",
      },
    },
  },
};

export const SingleError: _Story = {
  args: {
    hasChanges: true,
    syntaxErrorCount: 1,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story:
          'Error state with singular grammar (shows "1 Error" instead of "1 Errors").',
      },
    },
  },
};

export const NoChanges: _Story = {
  args: {
    hasChanges: false,
    syntaxErrorCount: 0,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story: "When there are no changes, the button does not render at all.",
      },
    },
  },
};

export const NeobrutalistShowcase: _Story = {
  args: {
    hasChanges: true,
    syntaxErrorCount: 0,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story: `This story showcases the neobrutalism design elements:
        
- **Bold Borders**: 2px black borders create strong definition
- **Dramatic Shadows**: 4px offset shadows add depth and impact  
- **Active Animation**: Click to see the button "press" into the page
- **High Contrast**: Strong color combinations for maximum visual impact
        
Try clicking the button to see the characteristic neobrutalism active state animation where the button appears to be pressed into the page surface.`,
      },
    },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div className="bg-background p-8 text-black">
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Neobrutalism Design Elements</h3>
          <div className="border-border bg-secondary-background rounded-[--radius-base] border-2 p-4">
            <p className="mb-4 text-sm">
              Click the button to see the signature neobrutalism "press"
              animation!
            </p>
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
};

export const ColorSystem: _Story = {
  args: {
    hasChanges: true,
    syntaxErrorCount: 0,
    testId: "save-button",
  },
  parameters: {
    docs: {
      description: {
        story: `Complete neobrutalism color system from neobrutalism.dev. Each color maintains the signature style with thick borders, bold shadows, and the button press animation. This supports the project goal of building a themeable component system.`,
      },
    },
  },
  decorators: [
    () => (
      <div className="bg-background p-8 text-black">
        <div className="space-y-6">
          <h3 className="text-lg font-bold">Neobrutalism Color System</h3>
          <p className="max-w-2xl text-sm text-gray-600">
            This demonstrates the foundation for the themeable component system:
            "neobrutalism → rainbow mode → other themes later". All colors are
            from the official neobrutalism.dev palette with proper React
            component integration.
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {colorNames.map((color) => (
              <div key={color.value} className="space-y-3">
                <h4 className="text-sm font-semibold">{color.name}</h4>
                <SaveButton
                  hasChanges={true}
                  onClick={() => console.log(`${color.name} clicked`)}
                  color={color.value}
                  testId="save-button"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  ],
};
