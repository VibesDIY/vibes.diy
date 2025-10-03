import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { VibeControl } from "../components/VibeControl.js";
import type { VibeControlProps } from "../components/VibeControl.js";

const meta: Meta<VibeControlProps> = {
  title: "Components/VibeControl",
  component: VibeControl,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
A floating action button that opens a full-screen overlay. Perfect for adding controls, settings, or additional content that doesn't interfere with the main UI.

### Features
- **Configurable positioning** - Choose from 4 corner positions
- **Portal rendering** - Avoids z-index conflicts  
- **Keyboard navigation** - Escape key to close
- **Custom content** - Any React children supported
- **Event callbacks** - onOpen/onClose integration hooks
- **Responsive design** - Works on mobile and desktop
        `,
      },
    },
  },
  argTypes: {
    position: {
      control: { type: "select" },
      options: ["bottom-right", "bottom-left", "top-right", "top-left"],
      description: "Position of the floating button",
    },
    label: {
      control: { type: "text" },
      description: "Text displayed on the button",
    },
    visible: {
      control: { type: "boolean" },
      description: "Whether to show the component",
    },
    onOpen: {
      action: "opened",
      description: "Callback when overlay opens",
    },
    onClose: {
      action: "closed", 
      description: "Callback when overlay closes",
    },
    children: {
      control: { type: "text" },
      description: "Custom content for the overlay",
    },
  },
};

export default meta;
type Story = StoryObj<VibeControlProps>;

// Default story
export const Default: Story = {
  args: {
    label: "Open Vibes",
    position: "bottom-right",
    visible: true,
  },
};

// Position variations
export const BottomLeft: Story = {
  args: {
    label: "Bottom Left",
    position: "bottom-left",
    visible: true,
  },
};

export const TopRight: Story = {
  args: {
    label: "Top Right", 
    position: "top-right",
    visible: true,
  },
};

export const TopLeft: Story = {
  args: {
    label: "Top Left",
    position: "top-left", 
    visible: true,
  },
};

// Custom content example
export const WithCustomContent: Story = {
  args: {
    label: "Settings",
    position: "bottom-right",
    visible: true,
    children: (
      <div>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "700" }}>
          Settings Panel
        </h3>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
            Theme Preference
          </label>
          <select style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
            <option>Light</option>
            <option>Dark</option>
            <option>Auto</option>
          </select>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" defaultChecked />
            <span>Enable notifications</span>
          </label>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" />
            <span>Auto-save changes</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
          <button
            style={{
              padding: "8px 16px",
              backgroundColor: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Save Changes
          </button>
          <button
            style={{
              padding: "8px 16px",
              backgroundColor: "#f5f5f5",
              color: "#333",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ),
  },
};

// Rich content example
export const WithRichContent: Story = {
  args: {
    label: "Help & Info",
    position: "bottom-right",
    visible: true,
    children: (
      <div>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "700" }}>
          Welcome to VibeControl
        </h3>
        <div style={{ marginBottom: "20px", lineHeight: "1.6" }}>
          <p>
            VibeControl provides a floating action button that opens rich overlay content.
            Perfect for settings, help content, or any additional functionality.
          </p>
        </div>

        <div
          style={{
            marginBottom: "20px",
            padding: "16px",
            backgroundColor: "#f0f8ff",
            borderRadius: "8px",
            border: "1px solid #bbdefb",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Key Features</h4>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "#1976d2" }}>
            <li>Portal rendering avoids z-index issues</li>
            <li>Escape key and backdrop click to close</li>
            <li>Four corner position options</li>
            <li>Fully customizable overlay content</li>
            <li>Event callbacks for integration</li>
          </ul>
        </div>

        <div
          style={{
            marginBottom: "20px", 
            padding: "16px",
            backgroundColor: "#f3e5f5",
            borderRadius: "8px",
            border: "1px solid #e1bee7",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", color: "#7b1fa2" }}>Usage Examples</h4>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "#7b1fa2" }}>
            <li>Application settings and preferences</li>
            <li>User help and documentation</li>
            <li>Additional navigation or tools</li>
            <li>Context-sensitive controls</li>
          </ul>
        </div>

        <button
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: "pointer",
          }}
          onClick={() => alert("Action triggered!")}
        >
          Try It Out!
        </button>
      </div>
    ),
  },
};

// Hidden state
export const Hidden: Story = {
  args: {
    label: "This Won't Show",
    position: "bottom-right", 
    visible: false,
  },
};

// Custom styling example
export const WithCustomStyling: Story = {
  args: {
    label: "🎨 Styled",
    position: "bottom-right",
    visible: true,
    classes: {
      button: "custom-button",
      backdrop: "custom-backdrop",
      overlay: "custom-overlay",
      overlayTitle: "custom-title",
      closeButton: "custom-close",
      content: "custom-content",
    },
    children: (
      <div>
        <h3>Custom Styled Overlay</h3>
        <p>This example shows how you can customize the styling using CSS classes.</p>
        <p>
          You can override the default styles by providing custom classes for each element
          of the component.
        </p>
      </div>
    ),
  },
};