import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VibesButton } from "@vibes.diy/base";

const meta: Meta<typeof VibesButton> = {
  title: "Base/VibesButton",
  component: VibesButton,
  argTypes: {
    variant: {
      control: "select",
      options: ["blue", "red", "yellow", "gray"],
    },
    icon: {
      control: "select",
      options: [undefined, "login", "remix", "invite", "settings", "back"],
    },
    ignoreDarkMode: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof VibesButton>;

export const Default: Story = {
  args: {
    children: "Click me",
    variant: "blue",
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["blue", "red", "yellow", "gray"] as const).map((variant) => (
        <VibesButton key={variant} variant={variant}>
          {variant}
        </VibesButton>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["login", "remix", "invite", "settings", "back"] as const).map((icon) => (
        <VibesButton key={icon} icon={icon} variant="blue">
          {icon}
        </VibesButton>
      ))}
    </div>
  ),
};

export const TextOnly: Story = {
  args: {
    children: "No icon, just text",
    variant: "blue",
  },
};
