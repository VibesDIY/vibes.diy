import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { useAppSelector } from '../../store/hooks';
import type { ButtonVariantConfig } from './Button.tokens';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    showEditButton: {
      control: 'boolean',
      description: 'Show edit button to customize styles',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story for docs - single button
export const Default: Story = {
  args: {
    children: 'Button',
    showEditButton: true,
  },
};

// Multi-button test story - shows multiple buttons, some with same variant, some different
const MultiButtonTestRenderer = () => {
  const buttonVariants = useAppSelector(state => state.designTokens.buttonVariants);

  // Find variants by name for stability (indices can change with persisted state)
  const findVariantByName = (name: string) => buttonVariants.find((v: ButtonVariantConfig) => v.name === name);

  const variant1 = findVariantByName('Primary') || buttonVariants[0];
  const variant2 = findVariantByName('Secondary') || buttonVariants[1];
  const variant3 = findVariantByName('Error') || buttonVariants[4];
  const variant4 = findVariantByName('Square') || buttonVariants[7];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '20px' }}>
      {/* Section: Same variant - should look identical */}
      <div>
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-family-primary)', color: 'var(--color-text-secondary)' }}>
          Same Variant (Primary) - Should look identical
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variantId={variant1?.id}>Button A</Button>
          <Button variantId={variant1?.id}>Button B</Button>
          <Button variantId={variant1?.id}>Button C</Button>
        </div>
      </div>

      {/* Section: Different variants */}
      <div>
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-family-primary)', color: 'var(--color-text-secondary)' }}>
          Different Variants - Each should be unique
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {variant1 && <Button variantId={variant1.id}>{variant1.name}</Button>}
          {variant2 && <Button variantId={variant2.id}>{variant2.name}</Button>}
          {variant3 && <Button variantId={variant3.id}>{variant3.name}</Button>}
          {variant4 && <Button variantId={variant4.id}>{variant4.name}</Button>}
        </div>
      </div>

      {/* Section: All available variants */}
      <div>
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-family-primary)', color: 'var(--color-text-secondary)' }}>
          All Variants
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {buttonVariants.map((variant: ButtonVariantConfig) => (
            <Button key={variant.id} variantId={variant.id}>
              {variant.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Section: Same variant with different content */}
      <div>
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-family-primary)', color: 'var(--color-text-secondary)' }}>
          Same Variant (Error) - Different content, same style
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variantId={variant3?.id}>Delete</Button>
          <Button variantId={variant3?.id}>Remove</Button>
          <Button variantId={variant3?.id}>Cancel</Button>
          <Button variantId={variant3?.id} disabled>Disabled</Button>
        </div>
      </div>
    </div>
  );
};

export const MultiButtonTest: Story = {
  args: {
    children: 'Test',
  },
  render: () => <MultiButtonTestRenderer />,
  parameters: {
    layout: 'fullscreen',
  },
};
