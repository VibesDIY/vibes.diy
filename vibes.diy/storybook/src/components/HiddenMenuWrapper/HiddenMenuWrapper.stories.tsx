/**
 * HiddenMenuWrapper Component Story
 */

import type { Meta, StoryObj } from '@storybook/react';
import { HiddenMenuWrapper } from './HiddenMenuWrapper';

const meta = {
  title: 'Components/HiddenMenuWrapper',
  component: HiddenMenuWrapper,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
A wrapper component with a hidden menu at the bottom.

**HOW TO USE:**
- Look for the Vibes pill button in the bottom-right corner
- Click the pill to toggle the hidden menu
- The menu slides up from the bottom with smooth animation and blur effect

**Note:** The preview below shows the full component. Click the pill in the bottom-right!
        `,
      },
      story: {
        inline: false,
        iframeHeight: 500,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      description: 'Main content to display',
      control: false,
    },
    menuContent: {
      description: 'Content to display in the hidden menu',
      control: false,
    },
    triggerBounce: {
      control: 'boolean',
      description: 'Trigger bounce animation',
    },
    showVibesSwitch: {
      control: 'boolean',
      description: 'Show the VibesSwitch toggle button',
    },
  },
} satisfies Meta<typeof HiddenMenuWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * ## Default Story
 *
 * This story shows the HiddenMenuWrapper with:
 * - Main content area with gradient background
 * - Hidden menu at the bottom with actions
 * - Vibes pill toggle button in the bottom-right corner
 *
 * **To test:**
 * Click the Vibes pill (bottom-right corner) to toggle the menu!
 */
export const Default: Story = {
  args: {} as any,
  parameters: {
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
      },
    },
  },
  render: (_args, context) => {
    const env = context.globals?.environment || 'development';
    return (
      <HiddenMenuWrapper
        key={env}
        showVibesSwitch={true}
        triggerBounce={false}
        menuContent={
          <div style={{
            width: '100%',
            height: '200px',
            backgroundColor: 'transparent',
          }} />
        }
      >
        <div style={{
          width: '100%',
          height: '100vh',
          backgroundColor: 'var(--color-background)',
        }} />
      </HiddenMenuWrapper>
    );
  },
};

/**
 * ## With Bounce Animation
 *
 * This story demonstrates the bounce animation that plays when:
 * - The component first mounts
 * - `triggerBounce` prop changes to true
 *
 * Reload the story to see the bounce animation again!
 */
export const WithBounce: Story = {
  args: {} as any,
  parameters: {
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
      },
    },
  },
  render: (_args, context) => {
    const env = context.globals?.environment || 'development';
    return (
      <HiddenMenuWrapper
        key={env}
        showVibesSwitch={true}
        triggerBounce={true}
        menuContent={
          <div style={{
            width: '100%',
            height: '200px',
            backgroundColor: 'transparent',
          }} />
        }
      >
        <div style={{
          width: '100%',
          height: '100vh',
          backgroundColor: 'var(--color-background)',
        }} />
      </HiddenMenuWrapper>
    );
  },
};

/**
 * ## Without Toggle Button
 *
 * This story shows the wrapper without the Vibes pill button.
 * The menu can only be opened programmatically in this mode.
 *
 * Useful when you want to control the menu state externally.
 */
export const WithoutToggleButton: Story = {
  args: {} as any,
  parameters: {
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
      },
    },
  },
  render: (_args, context) => {
    const env = context.globals?.environment || 'development';
    return (
      <HiddenMenuWrapper
        key={env}
        showVibesSwitch={false}
        triggerBounce={false}
        menuContent={
          <div style={{
            width: '100%',
            height: '200px',
            backgroundColor: 'transparent',
          }} />
        }
      >
        <div style={{
          width: '100%',
          height: '100vh',
          backgroundColor: 'var(--color-background)',
        }} />
      </HiddenMenuWrapper>
    );
  },
};
