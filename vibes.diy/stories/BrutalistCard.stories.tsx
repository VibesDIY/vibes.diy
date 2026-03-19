import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrutalistCard } from "@vibes.diy/base";

const meta: Meta<typeof BrutalistCard> = {
  title: "Base/BrutalistCard",
  component: BrutalistCard,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "error", "warning"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    messageType: {
      control: "select",
      options: [undefined, "user", "ai"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BrutalistCard>;

export const Default: Story = {
  args: {
    children: "Hello from BrutalistCard",
    variant: "default",
    size: "md",
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["default", "success", "error", "warning"] as const).map((variant) => (
        <BrutalistCard key={variant} variant={variant} size="md">
          {variant}
        </BrutalistCard>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <BrutalistCard key={size} size={size}>
          Size: {size}
        </BrutalistCard>
      ))}
    </div>
  ),
};

export const UserChatBubble: Story = {
  args: {
    children: "This is a user message with bottom-right corner not rounded.",
    variant: "default",
    size: "md",
    messageType: "user",
  },
};

export const AIChatBubble: Story = {
  args: {
    children: "This is an AI response with bottom-left corner not rounded.",
    variant: "default",
    size: "md",
    messageType: "ai",
  },
};
