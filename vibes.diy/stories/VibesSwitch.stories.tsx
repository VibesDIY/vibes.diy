import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VibesSwitch } from "@vibes.diy/base";

const meta: Meta<typeof VibesSwitch> = {
  title: "Base/VibesSwitch",
  component: VibesSwitch,
  argTypes: {
    size: { control: { type: "number", min: 16, max: 120 } },
    isActive: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof VibesSwitch>;

export const Default: Story = {
  args: {
    size: 48,
  },
};

export const Active: Story = {
  args: {
    size: 48,
    isActive: true,
  },
};

export const Inactive: Story = {
  args: {
    size: 48,
    isActive: false,
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
      {[24, 48, 72].map((size) => (
        <div key={size} style={{ textAlign: "center" }}>
          <VibesSwitch size={size} />
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>{size}px</div>
        </div>
      ))}
    </div>
  ),
};
