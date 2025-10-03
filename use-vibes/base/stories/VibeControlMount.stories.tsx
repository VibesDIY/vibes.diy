import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useRef, useState } from 'react';
import {
  mountVibeControl,
  mountVibeControlToBody,
  autoMountVibeControl,
} from '../vibe-control-mount.js';
import type { MountVibeControlOptions } from '../vibe-control-mount.js';

// Mock component for demonstrating mount functions
function MountDemo({
  mountType,
  options = {},
}: {
  mountType: 'container' | 'body' | 'auto';
  options?: Partial<MountVibeControlOptions>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [instance, setInstance] = useState<ReturnType<typeof mountVibeControl> | null>(null);

  useEffect(() => {
    if (!mounted) return;

    let control: ReturnType<typeof mountVibeControl> | null = null;

    try {
      switch (mountType) {
        case 'container':
          if (containerRef.current) {
            control = mountVibeControl({
              container: containerRef.current,
              label: 'Mounted Control',
              position: 'bottom-right',
              onOpen: () => console.log('Container-mounted control opened'),
              onClose: () => console.log('Container-mounted control closed'),
              children: React.createElement(
                'div',
                {},
                React.createElement('h3', {}, 'Container Mount Demo'),
                React.createElement(
                  'p',
                  {},
                  'This VibeControl was mounted using mountVibeControl() to a specific container element.'
                ),
                React.createElement(
                  'div',
                  {
                    style: {
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                    },
                  },
                  React.createElement('strong', {}, 'Benefits:'),
                  React.createElement(
                    'ul',
                    { style: { marginTop: '8px' } },
                    React.createElement('li', {}, 'Scoped to specific DOM element'),
                    React.createElement('li', {}, 'No React dependency required'),
                    React.createElement('li', {}, 'Dynamic prop updates supported'),
                    React.createElement('li', {}, 'Clean unmounting')
                  )
                )
              ),
              ...options,
            });
          }
          break;

        case 'body':
          control = mountVibeControlToBody({
            label: 'Body Mount',
            position: 'bottom-left',
            onOpen: () => console.log('Body-mounted control opened'),
            onClose: () => console.log('Body-mounted control closed'),
            children: React.createElement(
              'div',
              {},
              React.createElement('h3', {}, 'Body Mount Demo'),
              React.createElement(
                'p',
                {},
                'This VibeControl was mounted using mountVibeControlToBody().'
              ),
              React.createElement(
                'div',
                {
                  style: {
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f3e5f5',
                    borderRadius: '4px',
                  },
                },
                React.createElement('strong', {}, 'Use Cases:'),
                React.createElement(
                  'ul',
                  { style: { marginTop: '8px' } },
                  React.createElement('li', {}, 'Global application controls'),
                  React.createElement('li', {}, 'Site-wide settings access'),
                  React.createElement('li', {}, 'Help/support overlay'),
                  React.createElement('li', {}, 'User account management')
                )
              )
            ),
            ...options,
          });
          break;

        case 'auto':
          // Set global config for auto-mount demo
          (window as Record<string, unknown>).VIBE_CONTROL_CONFIG = {
            label: 'Auto Mount',
            position: 'top-right',
            children: React.createElement(
              'div',
              {},
              React.createElement('h3', {}, 'Auto Mount Demo'),
              React.createElement(
                'p',
                {},
                'This VibeControl was auto-mounted using global configuration.'
              ),
              React.createElement(
                'div',
                {
                  style: {
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#fff3e0',
                    borderRadius: '4px',
                  },
                },
                React.createElement('strong', {}, 'Perfect for:'),
                React.createElement(
                  'ul',
                  { style: { marginTop: '8px' } },
                  React.createElement('li', {}, 'CDN-based integration'),
                  React.createElement('li', {}, 'No-code implementations'),
                  React.createElement('li', {}, 'Third-party embeds'),
                  React.createElement('li', {}, 'Quick prototyping')
                )
              )
            ),
            ...options,
          };
          control = autoMountVibeControl();
          break;
      }

      setInstance(control);
    } catch (error) {
      console.error(`Failed to mount ${mountType}:`, error);
    }

    // Cleanup
    return () => {
      if (control && typeof control.unmount === 'function') {
        control.unmount();
      }
      if (mountType === 'auto') {
        delete (window as Record<string, unknown>).VIBE_CONTROL_CONFIG;
      }
    };
  }, [mounted, mountType, options]);

  const handleMount = () => setMounted(true);
  const handleUnmount = () => {
    if (instance && typeof instance.unmount === 'function') {
      instance.unmount();
    }
    setMounted(false);
    setInstance(null);
  };

  const handleUpdate = () => {
    if (instance && typeof instance.update === 'function') {
      instance.update({
        label: `Updated ${Date.now()}`,
        position: 'top-left',
      });
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>
        {mountType === 'container' ? 'Container' : mountType === 'body' ? 'Body' : 'Auto'} Mount
        Example
      </h3>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleMount}
          disabled={mounted}
          style={{
            padding: '8px 16px',
            backgroundColor: mounted ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: mounted ? 'not-allowed' : 'pointer',
          }}
        >
          Mount Control
        </button>

        <button
          onClick={handleUpdate}
          disabled={!mounted || !instance}
          style={{
            padding: '8px 16px',
            backgroundColor: !mounted || !instance ? '#ccc' : '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !mounted || !instance ? 'not-allowed' : 'pointer',
          }}
        >
          Update Props
        </button>

        <button
          onClick={handleUnmount}
          disabled={!mounted}
          style={{
            padding: '8px 16px',
            backgroundColor: !mounted ? '#ccc' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !mounted ? 'not-allowed' : 'pointer',
          }}
        >
          Unmount
        </button>
      </div>

      {mountType === 'container' && (
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            height: '200px',
            border: '2px dashed #ccc',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mounted ? '#f0f8ff' : '#fafafa',
          }}
        >
          {mounted ? (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <p>
                <strong>VibeControl mounted!</strong>
              </p>
              <p>Look for the button in the bottom-right of this container.</p>
            </div>
          ) : (
            <p style={{ color: '#999', margin: 0 }}>
              Click "Mount Control" to see the VibeControl in this container
            </p>
          )}
        </div>
      )}

      {mounted && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f0f8ff',
            borderRadius: '4px',
          }}
        >
          <strong>Status:</strong> VibeControl is mounted and active
          {mountType !== 'container' && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9em', color: '#666' }}>
              Look for the floating button positioned on the{' '}
              {mountType === 'body' ? 'page' : 'screen'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const meta: Meta<{
  mountType: 'container' | 'body' | 'auto';
  options?: Partial<MountVibeControlOptions>;
}> = {
  title: 'Components/VibeControl Mount Functions',
  component: MountDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Demonstrates the mount functions for using VibeControl in non-React environments.

### Mount Functions Available
- **\`mountVibeControl(options)\`** - Mount to a specific DOM element
- **\`mountVibeControlToBody(props)\`** - Convenience function for body mounting
- **\`autoMountVibeControl()\`** - Auto-mount from global config (perfect for CDN usage)

### Features
- **Dynamic updates** - Use \`instance.update(props)\` to change properties
- **Clean unmounting** - Use \`instance.unmount()\` for proper cleanup
- **Event callbacks** - Full support for onOpen/onClose handlers
- **No React required** - Works in any JavaScript environment
        `,
      },
    },
  },
  argTypes: {
    mountType: {
      control: { type: 'select' },
      options: ['container', 'body', 'auto'],
      description: 'Type of mount function to demonstrate',
    },
  },
};

export default meta;
type Story = StoryObj<{
  mountType: 'container' | 'body' | 'auto';
  options?: Partial<MountVibeControlOptions>;
}>;

// Container mount example
export const MountToContainer: Story = {
  args: {
    mountType: 'container',
  },
};

// Body mount example
export const MountToBody: Story = {
  args: {
    mountType: 'body',
  },
};

// Auto-mount example
export const AutoMount: Story = {
  args: {
    mountType: 'auto',
  },
};
